import { Resend } from 'resend';
import { getFirestoreDb, verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

/**
 * 招募需求送出通知 — 廠商在 /employer 送出招募需求後呼叫。
 * 同時發出 Telegram（notify.js 慣例）與 Resend Email（send-resume.js 慣例）給灃禾。
 *
 * 前端流程：先 POST /api/requisitions（submit:true）存檔，取得 record.id，
 * 再 POST /api/notify-requisition { requisitionId }。通知失敗不影響已存檔的需求。
 *
 * 為避免信任前端傳入的內容，這裡用 requisitionId 從 Firestore 讀回實際資料，
 * 並確認呼叫者是該需求的 owner 或管理員。
 *
 * 需要的環境變數（都已存在於本專案）：
 *   TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
 *   RESEND_API_KEY, MAIL_FROM, MAIL_TO（可多筆逗號分隔）, 選用 MAIL_FROM_NAME
 */

const COLLECTION_NAME = 'requisitions';
const TELEGRAM_API = 'https://api.telegram.org';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
);

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Invalid JSON body');
    }
  }
  return req.body;
};

const sanitize = (value) =>
  String(value || '')
    .replace(/[<>"'`]/g, '')
    .trim();

// Telegram/HTML 用：只轉義 HTML 特殊字元，保留原文（含中文）
const escHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const parseRecipients = (rawValue) =>
  String(rawValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const isValidEmail = (value) => EMAIL_PATTERN.test(String(value || '').trim());

const extractEmailAddress = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('<')) return String(trimmed.match(/<([^<>]+)>/)?.[1] || '').trim();
  return trimmed;
};

const buildFromAddress = (mailFrom, mailFromName) => {
  const rawFrom = String(mailFrom || '').trim();
  const rawName = sanitize(mailFromName);
  if (!rawFrom) return { value: '', error: 'MAIL_FROM is missing' };
  const extracted = extractEmailAddress(rawFrom);
  if (!isValidEmail(extracted)) return { value: '', error: 'MAIL_FROM must be a valid sender email' };
  if (rawFrom.includes('<') || !rawName) return { value: rawFrom, error: '' };
  return { value: `${rawName} <${extracted}>`, error: '' };
};

const canAccess = ({ authUser, isAdmin, record }) => {
  if (isAdmin) return true;
  const uid = sanitize(authUser?.uid);
  const email = normalizeEmail(authUser?.email);
  return (
    (Boolean(uid) && uid === sanitize(record?.ownerUid)) ||
    (Boolean(email) && email === normalizeEmail(record?.ownerEmail))
  );
};

const sendTelegramMessage = async (token, chatId, text) => {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Telegram API error ${response.status}: ${body.slice(0, 200)}`);
  }
};

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
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

  let authUser;
  try {
    authUser = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('Firebase Admin 未設定') || message.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
      return res.status(500).json({ ok: false, message });
    }
    return res.status(401).json({ ok: false, message: 'Invalid Firebase ID token' });
  }

  let body;
  try {
    body = parseBody(req);
  } catch {
    return res.status(400).json({ ok: false, message: 'Invalid request body' });
  }

  const requisitionId = sanitize(body?.requisitionId);
  if (!requisitionId) {
    return res.status(400).json({ ok: false, message: 'Missing requisitionId' });
  }

  // 讀回需求（權威資料 + 擁有權檢查）
  const db = getFirestoreDb();
  const snapshot = await db.collection(COLLECTION_NAME).doc(requisitionId).get();
  const record = snapshot.exists ? (snapshot.data() || {}) : null;
  if (!record) {
    return res.status(404).json({ ok: false, message: 'Requisition not found' });
  }
  const isAdmin = Boolean(normalizeEmail(authUser?.email)) && ADMIN_EMAILS.has(normalizeEmail(authUser?.email));
  if (!canAccess({ authUser, isAdmin, record })) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const fd = record.formData || {};
  const company = record.companyName || fd.unitName || '（未填單位）';
  const jobTitle = record.jobTitle || fd.jobTitle || '（未填職缺）';
  const location = record.location || fd.location || '';
  const headcount = record.headcount || fd.headcount || '';
  const employment = fd.employment || '';
  const contact = fd.contact || record.ownerName || '';
  const phone = fd.phone || '';
  const submittedAt = record.submittedAt || new Date().toISOString();
  const baseUrl = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  // 統一後台在 /admin（招募需求為其中一個分頁）
  const adminLink = baseUrl ? `${baseUrl}/admin` : '';

  const results = { telegram: null, email: null };

  // ---- Telegram ----
  const tgToken = String(process.env.TELEGRAM_TOKEN || '').trim();
  const tgChatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  if (tgToken && tgChatId) {
    const lines = [
      '📋 <b>新招募需求</b>',
      `單位名稱：${escHtml(company)}`,
      `職缺：${escHtml(jobTitle)}`,
      location ? `工作地點：${escHtml(location)}` : '',
      headcount ? `需求人數：${escHtml(headcount)} 人` : '',
      employment ? `雇用性質：${escHtml(employment)}` : '',
      contact || phone ? `連絡人：${escHtml(contact)}${phone ? `　${escHtml(phone)}` : ''}` : '',
      `送出時間：${escHtml(submittedAt)}`,
      adminLink ? `後台：${escHtml(adminLink)}` : '',
    ].filter(Boolean);
    try {
      await sendTelegramMessage(tgToken, tgChatId, lines.join('\n'));
      results.telegram = { ok: true };
    } catch (error) {
      console.error('Requisition Telegram notify failed:', error);
      results.telegram = { ok: false, message: error?.message || 'Telegram 通知失敗' };
    }
  } else {
    results.telegram = { ok: false, message: 'TELEGRAM_TOKEN / TELEGRAM_CHAT_ID 未設定' };
  }

  // ---- Email (Resend) ----
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const { value: fromEmail, error: fromError } = buildFromAddress(process.env.MAIL_FROM, process.env.MAIL_FROM_NAME);
  const toEmails = parseRecipients(process.env.MAIL_TO).filter(isValidEmail);
  if (apiKey && !fromError && toEmails.length > 0) {
    const row = (k, v) =>
      `<tr><td style="padding:8px;border:1px solid #e5e7eb;width:140px;background:#eff6ff;color:#6b7280;font-weight:700;">${escHtml(k)}</td><td style="padding:8px;border:1px solid #e5e7eb;">${escHtml(v || '-')}</td></tr>`;
    const html = `
      <div style="font-family:'Noto Sans TC',Arial,'Microsoft JhengHei',sans-serif;line-height:1.6;color:#111827;">
        <h2 style="margin:0 0 12px;color:#1d4ed8;">新招募需求</h2>
        <p style="margin:0 0 16px;color:#6b7280;">有廠商透過廠商入口送出一筆招募需求，請至後台檢視。</p>
        <table style="border-collapse:collapse;width:100%;max-width:640px;">
          ${row('單位名稱', company)}
          ${row('職缺', jobTitle)}
          ${row('工作地點', location)}
          ${row('需求人數', headcount ? `${headcount} 人` : '')}
          ${row('雇用性質', employment)}
          ${row('連絡人', [contact, phone].filter(Boolean).join('　'))}
          ${row('送出時間', submittedAt)}
        </table>
        ${adminLink ? `<p style="margin:16px 0 0;"><a href="${escHtml(adminLink)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px;">到後台檢視需求</a></p>` : ''}
      </div>`;
    const text = [
      '新招募需求',
      `單位名稱: ${company}`,
      `職缺: ${jobTitle}`,
      `工作地點: ${location || '-'}`,
      `需求人數: ${headcount ? `${headcount} 人` : '-'}`,
      `雇用性質: ${employment || '-'}`,
      `連絡人: ${[contact, phone].filter(Boolean).join(' ') || '-'}`,
      `送出時間: ${submittedAt}`,
      adminLink ? `後台: ${adminLink}` : '',
    ].filter(Boolean).join('\n');

    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: toEmails,
        subject: `新招募需求：${company}－${jobTitle}`,
        html,
        text,
      });
      if (error) {
        results.email = { ok: false, message: error.message || 'Email provider rejected request' };
      } else {
        results.email = { ok: true, id: data?.id || '' };
      }
    } catch (error) {
      console.error('Requisition email notify failed:', error);
      results.email = { ok: false, message: error?.message || 'Failed to send email' };
    }
  } else {
    results.email = { ok: false, message: 'RESEND_API_KEY / MAIL_FROM / MAIL_TO 未設定或無效' };
  }

  const anyOk = Boolean(results.telegram?.ok || results.email?.ok);
  return res.status(anyOk ? 200 : 502).json({ ok: anyOk, results });
}
