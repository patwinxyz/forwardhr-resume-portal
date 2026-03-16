import { Resend } from 'resend';

const sanitize = (value) =>
  String(value || '')
    .replace(/[<>"'`]/g, '')
    .trim();

const parseRecipients = (rawValue) =>
  String(rawValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
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
  } = req.body || {};

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
  const safeSubmitterEmail = sanitize(submitterEmail);
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
  ].join('\n');

  try {
    await resend.emails.send({
      from: fromEmail,
      to: toEmails,
      subject,
      html,
      text,
      replyTo: safeSubmitterEmail || safeApplicantEmail || undefined,
      attachments: [
        {
          filename: sanitize(attachmentFilename) || 'resume.docx',
          content: attachmentBuffer,
          contentType: sanitize(attachmentMimeType) || 'application/octet-stream',
        },
      ],
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Failed to send email:', error);
    return res.status(500).json({ ok: false, message: 'Failed to send email' });
  }
}
