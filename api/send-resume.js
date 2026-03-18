import { Resend } from 'resend';
import { getFirestoreDb, verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_COLLECTION = 'apiRateLimitDaily';
const DEFAULT_DAILY_LIMIT_PER_UID = 6;
const DEFAULT_DAILY_LIMIT_PER_IP = 24;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const sanitize = (value) =>
  String(value || '')
    .replace(/[<>"'`]/g, '')
    .trim();

const parseRecipients = (rawValue) =>
  String(rawValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const isValidEmail = (value) => EMAIL_PATTERN.test(String(value || '').trim());

const extractEmailAddress = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('<')) {
    const matched = trimmed.match(/<([^<>]+)>/);
    return String(matched?.[1] || '').trim();
  }
  return trimmed;
};

const buildFromAddress = (mailFrom, mailFromName) => {
  const rawFrom = String(mailFrom || '').trim();
  const rawName = sanitize(mailFromName);
  if (!rawFrom) return { value: '', error: 'MAIL_FROM is missing' };

  const extractedEmail = extractEmailAddress(rawFrom);
  if (!isValidEmail(extractedEmail)) {
    return { value: '', error: 'MAIL_FROM must be a valid sender email (or "Name <email>")' };
  }

  if (rawFrom.includes('<') || !rawName) {
    return { value: rawFrom, error: '' };
  }

  return { value: `${rawName} <${extractedEmail}>`, error: '' };
};

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getTaipeiDateKey = () => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((item) => item.type === 'year')?.value || '0000';
  const month = parts.find((item) => item.type === 'month')?.value || '00';
  const day = parts.find((item) => item.type === 'day')?.value || '00';
  return `${year}-${month}-${day}`;
};

const toDocSafeKey = (value) =>
  String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9:_-]/g, '_')
    .slice(0, 120);

const getClientIp = (req) => {
  const forwarded = String(req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0];
  const realIp = String(req.headers?.['x-real-ip'] || req.headers?.['X-Real-IP'] || '').trim();
  const cfIp = String(req.headers?.['cf-connecting-ip'] || req.headers?.['CF-Connecting-IP'] || '').trim();
  const socketIp = String(req.socket?.remoteAddress || '').trim();
  const candidate = forwarded || realIp || cfIp || socketIp || '';
  if (!candidate) return '';
  return candidate.replace(/[^0-9a-fA-F:.,]/g, '').slice(0, 64);
};

const verifyTurnstileToken = async ({ secretKey, token, remoteIp }) => {
  const payload = new URLSearchParams();
  payload.set('secret', secretKey);
  payload.set('response', token);
  if (remoteIp) payload.set('remoteip', remoteIp);

  const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });

  if (!verifyResponse.ok) {
    throw new Error(`Turnstile verify failed (${verifyResponse.status})`);
  }

  return verifyResponse.json();
};

const consumeDailyQuota = async ({ db, scope, identityKey, identityValue, dateKey, maxAllowed }) => {
  if (!maxAllowed || maxAllowed <= 0) {
    return { allowed: false, used: 0, remaining: 0 };
  }

  const safeIdentityKey = toDocSafeKey(identityKey);
  if (!safeIdentityKey) {
    return { allowed: false, used: 0, remaining: 0 };
  }

  const docId = `${scope}_${dateKey}_${safeIdentityKey}`.slice(0, 200);
  const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(docId);
  const nowIso = new Date().toISOString();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const currentCount = Number(snapshot.data()?.count || 0);
      if (currentCount >= maxAllowed) {
        throw new Error('DAILY_QUOTA_EXCEEDED');
      }

      const nextCount = currentCount + 1;
      const payload = {
        scope,
        dateKey,
        count: nextCount,
        maxAllowed,
        identityValue: String(identityValue || ''),
        updatedAt: nowIso,
      };

      if (snapshot.exists) {
        transaction.update(docRef, payload);
      } else {
        transaction.set(docRef, { ...payload, createdAt: nowIso });
      }

      return {
        used: nextCount,
        remaining: Math.max(0, maxAllowed - nextCount),
      };
    });

    return { allowed: true, ...result };
  } catch (error) {
    if (String(error?.message || '') === 'DAILY_QUOTA_EXCEEDED') {
      return { allowed: false, used: maxAllowed, remaining: 0 };
    }
    throw error;
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const idToken = getBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ ok: false, message: 'Missing Firebase ID token' });
  }

  let verifiedUser;
  try {
    verifiedUser = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    console.error('Firebase token verify failed:', error);
    const message = String(error?.message || '');
    if (message.includes('Firebase Admin 未設定') || message.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
      return res.status(500).json({ ok: false, message });
    }
    return res.status(401).json({ ok: false, message: 'Invalid Firebase ID token' });
  }

  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const { value: fromEmail, error: fromEmailError } = buildFromAddress(process.env.MAIL_FROM, process.env.MAIL_FROM_NAME);
  const recipientCandidates = parseRecipients(process.env.MAIL_TO);
  const toEmails = recipientCandidates.filter((item) => isValidEmail(item));
  const invalidToEmails = recipientCandidates.filter((item) => !isValidEmail(item));
  const configErrors = [];

  if (!apiKey) configErrors.push('RESEND_API_KEY is missing');
  if (fromEmailError) configErrors.push(fromEmailError);
  if (toEmails.length === 0) configErrors.push('MAIL_TO is missing');
  if (invalidToEmails.length > 0) configErrors.push(`MAIL_TO has invalid email(s): ${invalidToEmails.join(', ')}`);

  if (configErrors.length > 0) {
    return res.status(500).json({
      ok: false,
      message:
        'Server email settings are missing or invalid. Please set RESEND_API_KEY, MAIL_FROM, MAIL_TO (optional MAIL_FROM_NAME).',
      details: configErrors,
    });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (error) {
      return res.status(400).json({ ok: false, message: 'Invalid JSON body' });
    }
  }

  const {
    attachmentBase64,
    attachmentFilename,
    attachmentMimeType,
    applicantName,
    applicantEmail,
    applicantPhone,
    submitterEmail,
    submitterName,
    fillDate,
    isResubmission,
    lastSubmittedAt,
    turnstileToken,
  } = body;

  const requesterIp = getClientIp(req);
  const turnstileSecretKey = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  const safeTurnstileToken = String(turnstileToken || '').trim();

  if (turnstileSecretKey) {
    if (!safeTurnstileToken) {
      return res.status(400).json({ ok: false, message: 'Missing turnstile token' });
    }
    try {
      const verifyResult = await verifyTurnstileToken({
        secretKey: turnstileSecretKey,
        token: safeTurnstileToken,
        remoteIp: requesterIp,
      });
      if (!verifyResult?.success) {
        const errorCodes = Array.isArray(verifyResult?.['error-codes']) ? verifyResult['error-codes'] : [];
        return res.status(403).json({
          ok: false,
          message: '機器人驗證失敗，請重新驗證後再送出。',
          details: errorCodes,
        });
      }
    } catch (error) {
      console.error('Turnstile verify failed:', error);
      return res.status(503).json({
        ok: false,
        message: '機器人驗證服務暫時不可用，請稍後再試。',
      });
    }
  }

  const uidDailyLimit = toPositiveInt(process.env.SEND_RESUME_DAILY_LIMIT_PER_UID, DEFAULT_DAILY_LIMIT_PER_UID);
  const ipDailyLimit = toPositiveInt(process.env.SEND_RESUME_DAILY_LIMIT_PER_IP, DEFAULT_DAILY_LIMIT_PER_IP);
  const dateKey = getTaipeiDateKey();
  const requesterUid = sanitize(verifiedUser?.uid || '');


  try {
    const db = getFirestoreDb();

    if (requesterIp) {
      const ipQuota = await consumeDailyQuota({
        db,
        scope: 'send-resume-ip',
        identityKey: requesterIp,
        identityValue: requesterIp,
        dateKey,
        maxAllowed: ipDailyLimit,
      });

      if (!ipQuota.allowed) {
        return res.status(429).json({
          ok: false,
          message: '已達到此網路今日寄送上限，請於明天（Asia/Taipei）再試。',
          details: [`IP 每日上限：${ipDailyLimit}`, `日期：${dateKey}`],
        });
      }
    }

    const uidQuota = await consumeDailyQuota({
      db,
      scope: 'send-resume-uid',
      identityKey: requesterUid,
      identityValue: requesterUid,
      dateKey,
      maxAllowed: uidDailyLimit,
    });

    if (!uidQuota.allowed) {
      return res.status(429).json({
        ok: false,
        message: '已達到此帳號今日寄送上限，請於明天（Asia/Taipei）再試。',
        details: [`帳號每日上限：${uidDailyLimit}`, `日期：${dateKey}`],
      });
    }
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return res.status(503).json({
      ok: false,
      message: '寄送上限服務暫時無法使用，請稍後再試。',
    });
  }

  if (!attachmentBase64) {
    return res.status(400).json({ ok: false, message: 'Missing attachmentBase64' });
  }

  let attachmentBuffer;
  try {
    attachmentBuffer = Buffer.from(String(attachmentBase64), 'base64');
  } catch (error) {
    return res.status(400).json({ ok: false, message: 'Invalid attachmentBase64' });
  }

  if (!attachmentBuffer || attachmentBuffer.length === 0) {
    return res.status(400).json({ ok: false, message: 'Attachment is empty' });
  }

  if (attachmentBuffer.length > 10 * 1024 * 1024) {
    return res.status(413).json({ ok: false, message: 'Attachment too large (max 10MB)' });
  }

  const safeApplicantName = sanitize(applicantName) || '未填姓名';
  const safeApplicantEmail = sanitize(applicantEmail);
  const safeApplicantPhone = sanitize(applicantPhone);
  const tokenEmail = sanitize(verifiedUser?.email || '').toLowerCase();
  const requestSubmitterEmail = sanitize(submitterEmail).toLowerCase();
  if (requestSubmitterEmail && tokenEmail && requestSubmitterEmail !== tokenEmail) {
    return res.status(403).json({ ok: false, message: 'Submitter email does not match authenticated user' });
  }
  const safeSubmitterEmail = requestSubmitterEmail || tokenEmail;
  const safeSubmitterName = sanitize(submitterName);
  const safeFillDate = sanitize(fillDate);
  const safeLastSubmittedAt = sanitize(lastSubmittedAt);
  const resubmissionFlag = isResubmission === true;

  const nowText = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  const resend = new Resend(apiKey);
  const subject = `[履歷送出] ${safeApplicantName} - ${nowText}`;
  const resubmissionNotice = resubmissionFlag
    ? `<p style="margin: 0 0 12px; color: #92400e; background:#fef3c7; border:1px solid #fde68a; padding:8px 10px; border-radius:6px;">
        此封履歷為編輯後重寄版本${safeLastSubmittedAt ? `（上次送出：${safeLastSubmittedAt}）` : ''}。
      </p>`
    : '';

  const html = `
    <div style="font-family: Arial, 'Microsoft JhengHei', sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px;">新履歷送出通知</h2>
      ${resubmissionNotice}
      <p style="margin: 0 0 16px;">附件已附上履歷 Word 檔案。</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb; width: 140px;">填表姓名</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${safeApplicantName}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;">填表 Email</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${safeApplicantEmail || '-'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;">聯絡電話</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${safeApplicantPhone || '-'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;">填寫日期</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${safeFillDate || '-'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;">送出類型</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${resubmissionFlag ? '編輯後重寄' : '首次送出'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;">登入者</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${safeSubmitterName || '-'} ${safeSubmitterEmail ? `(${safeSubmitterEmail})` : ''}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;">登入 UID</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${sanitize(verifiedUser?.uid || '-')}</td></tr>
      </table>
    </div>
  `;

  const text = [
    '新履歷送出通知',
    `填表姓名: ${safeApplicantName}`,
    `填表 Email: ${safeApplicantEmail || '-'}`,
    `聯絡電話: ${safeApplicantPhone || '-'}`,
    `填寫日期: ${safeFillDate || '-'}`,
    `送出類型: ${resubmissionFlag ? '編輯後重寄' : '首次送出'}`,
    `登入者: ${safeSubmitterName || '-'} ${safeSubmitterEmail ? `(${safeSubmitterEmail})` : ''}`,
    `登入 UID: ${sanitize(verifiedUser?.uid || '-')}`,
  ].join('\n');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmails,
      subject,
      html,
      text,
      replyTo: safeSubmitterEmail || safeApplicantEmail || undefined,
      attachments: [
        {
          filename: sanitize(attachmentFilename) || 'resume.docx',
          content: attachmentBuffer.toString('base64'),
          contentType: sanitize(attachmentMimeType) || 'application/octet-stream',
        },
      ],
    });

    if (error) {
      return res.status(502).json({ ok: false, message: error.message || 'Email provider rejected request' });
    }

    return res.status(200).json({ ok: true, id: data?.id || '' });
  } catch (error) {
    console.error('Failed to send email:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Failed to send email' });
  }
}
