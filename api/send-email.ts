import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Allowed CORS origins
const ALLOW_ORIGINS = new Set([
  'https://olga-one-page-form.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]);

function setCors(res: VercelResponse, origin: string | undefined) {
  const allow = origin && ALLOW_ORIGINS.has(origin) ? origin : '*';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  if (!host || !user || !pass) throw new Error('SMTP not configured');
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req.headers.origin as string | undefined);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { form, pricing, pricingInput, payment } = (req.body || {}) as any;

    const from = process.env.FROM_EMAIL || 'no-reply@example.com';
    const adminRecipients = [
      'Info@exceedlearningcenterny.com',
      'olganyc21@gmail.com',
      'phcodesage@gmail.com',
    ];

    if (!from) return res.status(500).json({ ok: false, error: 'FROM_EMAIL not set' });

    const subject = `New Afterschool Registration - ${form?.childName || 'Child'} (${pricingInput?.frequency || ''})`;

    const lines = [
      `Child: ${form?.childName || ''}`,
      `Child DOB: ${form?.childDateOfBirth || ''}`,
      `Child Grade: ${form?.childGrade || ''}`,
      `Parent: ${form?.parentName || ''}`,
      `Parent Address: ${form?.parentAddress || ''}`,
      `Email: ${form?.email || ''}`,
      `Phone: ${form?.phoneFull || ''}`,
      `Emergency: ${form?.emergencyContact || ''} - ${form?.emergencyPhoneFull || ''}`,
      `Allergies: ${form?.allergies || 'N/A'}`,
      `Special: ${form?.specialInstructions || 'N/A'}`,
      '',
      `Schedule: ${pricingInput?.daysPerWeek} days, ${pricingInput?.timeBlock}, ${pricingInput?.school}, ${pricingInput?.frequency}`,
      `Extension hours: ${pricingInput?.extensionsEnabled ? `Enabled (${pricingInput?.timeBlock})` : 'Disabled'}`,
      `Abacus: ${pricingInput?.abacusEnabled ? 'Enabled' : 'Disabled'}`,
      `Chess: ${pricingInput?.chessEnabled ? 'Enabled' : 'Disabled'}`,
      `Carrington waiver: ${pricingInput?.isCarrington ? 'Yes' : 'No'}`,
      `Base weekly: $${pricing?.baseWeekly?.toFixed?.(2)}`,
      `Add-ons weekly: $${pricing?.addOnWeekly?.toFixed?.(2)}`,
      `Abacus weekly: $${pricing?.abacusWeekly?.toFixed?.(2)}`,
      `Chess weekly: $${pricing?.chessWeekly?.toFixed?.(2)}`,
      `Registration fee (one-time): $${pricing?.registrationFee?.toFixed?.(2)}`,
      `School discount: -$${pricing?.schoolDiscountWeekly?.toFixed?.(2)}`,
      `Prepay discount: -$${pricing?.prepayDiscountWeekly?.toFixed?.(2)}`,
      `Final weekly: $${pricing?.finalWeekly?.toFixed?.(2)}`,
      `Weeks in period: ${pricing?.periodWeeks}`,
      `Total for period: $${pricing?.totalForPeriod?.toFixed?.(2)}`,
      '',
      `Payment method: ${form?.paymentMethod === 'stripe' ? 'Stripe (Paid)' : (form?.paymentMethod || 'Not specified')}`,
      ...(form?.paymentMethod === 'zelle'
        ? [
            'Zelle Details:',
            `  Recipient: payments@exceedlearningcenterny.com`,
            `  Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
            `  Payer: ${payment?.zellePayerName || 'Not provided'}`,
            `  Confirmation: ${payment?.zelleConfirmation || 'Not provided'}`,
          ]
        : []),
      ...(form?.paymentMethod === 'stripe'
        ? [
            'Stripe Payment:',
            `  Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
            `  Reference: ${payment?.paymentReference || 'Not available'}`,
          ]
        : []),
      ...(form?.paymentMethod === 'credit-card'
        ? [
            'Credit Card Details:',
            `  Card Number: ${payment?.cardNumber || 'Not provided'}`,
            `  Expiration: ${payment?.cardExpiration || 'Not provided'}`,
            `  Security Code: ${payment?.cardSecurityCode || 'Not provided'}`,
            `  ZIP Code: ${payment?.cardZipCode || 'Not provided'}`,
          ]
        : []),
      ...(form?.paymentMethod === 'cash' ? [`Cash Payment: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`] : []),
      ...(form?.paymentMethod === 'check'
        ? [
            `Check Payment: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
            `  Make payable to: Exceed Learning Center`,
          ]
        : []),
      `Payment Notes: ${form?.paymentNotes || 'None'}`,
    ];

    const text = lines.join('\n');
    const html = `<pre style="font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: pre-wrap;">${
      lines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('\n')
    }</pre>`;

    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

    async function sendViaSmtp() {
      const tx = getSmtpTransporter();
      const info = await tx.sendMail({ from, to: adminRecipients.join(','), subject, text, html });
      // optional: confirmation to parent
      if (form?.email) {
        await tx.sendMail({ from, to: form.email, subject: 'We received your registration', text, html });
      }
      return info.messageId;
    }

    async function sendViaResend() {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new Error('RESEND_API_KEY missing');
      const resend = new Resend(apiKey);
      const admin = await resend.emails.send({ from, to: adminRecipients, subject, text, html } as any);
      if (form?.email) {
        await resend.emails.send({ from, to: [form.email], subject: 'We received your registration', text, html } as any);
      }
      return (admin as any)?.data?.id || 'sent';
    }

    const id = provider === 'smtp' ? await sendViaSmtp() : await sendViaResend();

    return res.status(200).json({ ok: true, id });
  } catch (err: any) {
    console.error('vercel send-email error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
}
