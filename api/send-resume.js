import { Resend } from 'resend';
import { verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

const sanitize = (value) =>
  String(value || '')
    .replace(/[<>"'`]/g, '')
    .trim();

const parseRecipients = (rawValue) =>
  String(rawValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
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

  const apiKey = process.env.RESEND_API_KEY || '';
  const fromEmail = process.env.MAIL_FROM || '';
  const toEmails = parseRecipients(process.env.MAIL_TO);

  if (!apiKey || !fromEmail || toEmails.length === 0) {
    return res.status(500).json({
      ok: false,
      message: 'Server email settings are missing. Please set RESEND_API_KEY, MAIL_FROM, MAIL_TO.',
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
  } = body;

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

  const nowText = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  const resend = new Resend(apiKey);
  const subject = `[履歷送出] ${safeApplicantName} - ${nowText}`;

  const html = `
    <div style="font-family: Arial, 'Microsoft JhengHei', sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px;">新履歷送出通知</h2>
      <p style="margin: 0 0 16px;">附件已附上履歷 Word 檔案。</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb; width: 140px;">填表姓名</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${safeApplicantName}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;">填表 Email</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${safeApplicantEmail || '-'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;">聯絡電話</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${safeApplicantPhone || '-'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;">填寫日期</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${safeFillDate || '-'}</td></tr>
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
