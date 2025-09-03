// Vercel Serverless Function to send a quick test email
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

let smtpTransporter: nodemailer.Transporter | null = null;
function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
  }
  smtpTransporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return smtpTransporter;
}

type EmailArgs = { from: string; to: string[]; subject: string; text: string; html?: string };

async function sendEmail(args: EmailArgs) {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (provider === 'smtp' || process.env.SMTP_HOST) {
    const transporter = getSmtpTransporter();
    const info = await transporter.sendMail({
      from: args.from,
      to: args.to.join(','),
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { data: { id: info.messageId } } as const;
  }
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('Resend not configured. Set EMAIL_PROVIDER=smtp for Gmail SMTP or provide RESEND_API_KEY.');
  }
  const resend = new Resend(resendApiKey);
  const r = await resend.emails.send(args as any);
  return r as any;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: 'Missing "to"' });

    const from = process.env.FROM_EMAIL || 'no-reply@example.com';

    if (!process.env.FROM_EMAIL) {
      return res.status(500).json({ ok: false, error: 'FROM_EMAIL not set in environment' });
    }
    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    if (provider !== 'smtp' && !process.env.SMTP_HOST && !process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: 'Email provider not configured. Set EMAIL_PROVIDER=smtp with SMTP_* vars, or provide RESEND_API_KEY.' });
    }

    const r = await sendEmail({
      from,
      to: [to],
      subject: 'Test email from Afterschool app',
      html: '<p>It works! 🎉</p>',
      text: 'It works!'
    });

    if ((r as any).error) throw new Error(JSON.stringify((r as any).error));
    return res.json({ ok: true, id: (r as any).data?.id });
  } catch (err: any) {
    console.error('api/test-email error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
}
