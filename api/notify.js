import { verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

const TELEGRAM_CHAT_ID = 'REDACTED';
const TELEGRAM_API = 'https://api.telegram.org';

const sanitize = (value) =>
  String(value || '')
    .replace(/[<>"'`]/g, '')
    .trim();

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

const sendTelegramDocument = async (token, text, fileBuffer, filename, mimeType) => {
  const formData = new FormData();
  formData.append('chat_id', TELEGRAM_CHAT_ID);
  formData.append('caption', text);
  formData.append('parse_mode', 'HTML');
  formData.append('document', new Blob([fileBuffer], { type: mimeType }), filename);

  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendDocument`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Telegram API error ${response.status}: ${body.slice(0, 200)}`);
  }
};

const sendTelegramMessage = async (token, text) => {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Telegram API error ${response.status}: ${body.slice(0, 200)}`);
  }
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const token = String(process.env.TELEGRAM_TOKEN || '').trim();
  if (!token) {
    return res.status(500).json({ ok: false, message: 'TELEGRAM_TOKEN 未設定' });
  }

  const idToken = getBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ ok: false, message: 'Missing Firebase ID token' });
  }

  try {
    await verifyFirebaseIdToken(idToken);
  } catch {
    return res.status(401).json({ ok: false, message: 'Invalid Firebase ID token' });
  }

  let body;
  try {
    body = parseBody(req);
  } catch {
    return res.status(400).json({ ok: false, message: 'Invalid request body' });
  }

  const applicantName = sanitize(body?.applicantName);
  const applicantEmail = sanitize(body?.applicantEmail);
  const applicantPhone = sanitize(body?.applicantPhone);
  const fillDate = sanitize(body?.fillDate);
  const isResubmission = Boolean(body?.isResubmission);
  const attachmentBase64 = String(body?.attachmentBase64 || '').trim();
  const attachmentFilename = sanitize(body?.attachmentFilename) || 'resume.docx';
  const attachmentMimeType = sanitize(body?.attachmentMimeType) ||
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const label = isResubmission ? '【重新送出】' : '【新履歷】';
  const caption = [
    `${label} 收到求職者履歷`,
    `姓名：${applicantName || '（未填）'}`,
    `電話：${applicantPhone || '（未填）'}`,
    `Email：${applicantEmail || '（未填）'}`,
    `填寫日期：${fillDate || '（未填）'}`,
  ].join('\n');

  try {
    if (attachmentBase64) {
      const fileBuffer = Buffer.from(attachmentBase64, 'base64');
      await sendTelegramDocument(token, caption, fileBuffer, attachmentFilename, attachmentMimeType);
    } else {
      await sendTelegramMessage(token, caption);
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Telegram notify failed:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Telegram 通知失敗' });
  }
}
