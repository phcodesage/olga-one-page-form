// Vercel Serverless Function for sending registration emails
// Mirrors the logic from server/server.ts without starting an Express server

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
  // default to Resend
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
    const { form, pricing, pricingInput, zelle } = req.body || {};

    const from = process.env.FROM_EMAIL || 'no-reply@example.com';
    const adminEmail = process.env.ADMIN_EMAIL || 'payments@exceedlearningcenterny.com';
    const adminRecipients = [
      adminEmail,
      'rechcelttoledo@gmail.com',
      'phcodesage@gmail.com',
    ].filter(Boolean);

    const subject = `New Afterschool Registration - ${form?.childName || 'Child'} (${pricingInput?.frequency || ''})`;

    const lines = [
      `Child: ${form?.childName || ''}`,
      `Parent: ${form?.parentName || ''}`,
      `Email: ${form?.email || ''}`,
      `Phone: ${form?.phoneFull || ''}`,
      `Emergency: ${form?.emergencyContact || ''} - ${form?.emergencyPhoneFull || ''}`,
      `Allergies: ${form?.allergies || 'N/A'}`,
      `Special: ${form?.specialInstructions || 'N/A'}`,
      '',
      `Schedule: ${pricingInput?.daysPerWeek} days, ${pricingInput?.timeBlock}, ${pricingInput?.school}, ${pricingInput?.frequency}`,
      `Base weekly: $${pricing?.baseWeekly?.toFixed?.(2)}`,
      `Add-ons weekly: $${pricing?.addOnWeekly?.toFixed?.(2)}`,
      `School discount: -$${pricing?.schoolDiscountWeekly?.toFixed?.(2)}`,
      `Prepay discount: -$${pricing?.prepayDiscountWeekly?.toFixed?.(2)}`,
      `Final weekly: $${pricing?.finalWeekly?.toFixed?.(2)}`,
      `Weeks in period: ${pricing?.periodWeeks}`,
      `Total for period: $${pricing?.totalForPeriod?.toFixed?.(2)}`,
      '',
      'Payment via Zelle:',
      `Recipient: payments@exceedlearningcenterny.com`,
      `Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
      `Payer: ${zelle?.zellePayerName || ''}`,
      `Confirmation: ${zelle?.zelleConfirmation || ''}`,
      `Notes: ${zelle?.paymentNotes || ''}`,
    ];

    const text = lines.join('\n');
    const html = `<pre style="font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: pre-wrap;">${
      lines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('\n')
    }</pre>`;

    if (!process.env.FROM_EMAIL) {
      return res.status(500).json({ ok: false, error: 'FROM_EMAIL not set in environment' });
    }
    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    if (provider !== 'smtp' && !process.env.SMTP_HOST && !process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: 'Email provider not configured. Set EMAIL_PROVIDER=smtp with SMTP_* vars, or provide RESEND_API_KEY.' });
    }

    // Send to admin
    const adminSend = await sendEmail({ from, to: adminRecipients, subject, text, html });
    if ((adminSend as any).error) throw new Error(JSON.stringify((adminSend as any).error));

    // Confirmation to parent if provided (detailed HTML)
    if (form?.email) {
      const memo = `Afterschool - ${form?.childName || 'Child'} - ${form?.parentName || 'Parent'}`;
      const clientTextLines = [
        'Thank you for registering! We have received your submission.',
        '',
        'Registration summary:',
        `• Child: ${form?.childName || ''}`,
        `• Parent: ${form?.parentName || ''}`,
        `• Email: ${form?.email || ''}`,
        `• Phone: ${form?.phoneFull || ''}`,
        '',
        'Schedule:',
        `• ${pricingInput?.daysPerWeek} days, ${pricingInput?.timeBlock}, ${pricingInput?.school}, ${pricingInput?.frequency}`,
        '',
        'Price breakdown (per week):',
        `• Base: $${pricing?.baseWeekly?.toFixed?.(2)}`,
        `• Add-ons: $${pricing?.addOnWeekly?.toFixed?.(2)}`,
        `• School discount: -$${pricing?.schoolDiscountWeekly?.toFixed?.(2)}`,
        `• Prepay discount: -$${pricing?.prepayDiscountWeekly?.toFixed?.(2)}`,
        `• Final weekly: $${pricing?.finalWeekly?.toFixed?.(2)}`,
        '',
        `Weeks in billing period: ${pricing?.periodWeeks}`,
        `Total due this period: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
        '',
        'Payment via Zelle:',
        '• Recipient: payments@exceedlearningcenterny.com',
        `• Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
        `• Memo: ${memo}`,
        zelle?.zellePayerName ? `• Payer name: ${zelle.zellePayerName}` : '',
        zelle?.zelleConfirmation ? `• Confirmation: ${zelle.zelleConfirmation}` : '',
        zelle?.paymentNotes ? `• Notes: ${zelle.paymentNotes}` : '',
      ].filter(Boolean as any) as string[];

      const clientHtml = `
        <div style="font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111827">
          <h2 style="margin:0 0 8px; font-size:20px; color:#0f766e">Thank you for registering!</h2>
          <p style="margin:0 0 16px">We have received your submission. Below is your registration summary and payment details.</p>

          <div style="background:#fff7ed; border:1px solid #ffedd5; border-radius:10px; padding:12px 14px; margin:0 0 14px">
            <h3 style="margin:0 0 8px; font-size:16px">Registration summary</h3>
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li><strong>Child:</strong> ${form?.childName || ''}</li>
              <li><strong>Parent:</strong> ${form?.parentName || ''}</li>
              <li><strong>Email:</strong> ${form?.email || ''}</li>
              <li><strong>Phone:</strong> ${form?.phoneFull || ''}</li>
            </ul>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin:0 0 14px">
            <h3 style="margin:0 0 8px; font-size:16px">Schedule</h3>
            <p style="margin:0">${pricingInput?.daysPerWeek} days, ${pricingInput?.timeBlock}, ${pricingInput?.school}, ${pricingInput?.frequency}</p>
          </div>

          <div style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin:0 0 14px">
            <h3 style="margin:0 0 8px; font-size:16px">Price breakdown</h3>
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li>Base weekly: <strong>$${pricing?.baseWeekly?.toFixed?.(2)}</strong></li>
              <li>Add-ons weekly: <strong>$${pricing?.addOnWeekly?.toFixed?.(2)}</strong></li>
              <li>School discount: <strong>-$${pricing?.schoolDiscountWeekly?.toFixed?.(2)}</strong></li>
              <li>Prepay discount: <strong>-$${pricing?.prepayDiscountWeekly?.toFixed?.(2)}</strong></li>
              <li>Final weekly: <strong>$${pricing?.finalWeekly?.toFixed?.(2)}</strong></li>
            </ul>
            <p style="margin:8px 0 0">Weeks in period: <strong>${pricing?.periodWeeks}</strong></p>
            <p style="margin:4px 0 0">Total due this period: <strong>$${pricing?.totalForPeriod?.toFixed?.(2)} USD</strong></p>
          </div>

          <div style="background:#ecfeff; border:1px solid #cffafe; border-radius:10px; padding:12px 14px;">
            <h3 style="margin:0 0 8px; font-size:16px">Payment via Zelle</h3>
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li>Recipient: <strong>payments@exceedlearningcenterny.com</strong></li>
              <li>Amount: <strong>$${pricing?.totalForPeriod?.toFixed?.(2)} USD</strong></li>
              <li>Memo: <code>${memo}</code></li>
              ${zelle?.zellePayerName ? `<li>Payer name: ${zelle.zellePayerName}</li>` : ''}
              ${zelle?.zelleConfirmation ? `<li>Confirmation: ${zelle.zelleConfirmation}</li>` : ''}
              ${zelle?.paymentNotes ? `<li>Notes: ${zelle.paymentNotes}</li>` : ''}
            </ul>
          </div>
        </div>
      `;

      const parentSend = await sendEmail({
        from,
        to: [form.email],
        subject: 'We received your registration',
        html: clientHtml,
        text: clientTextLines.join('\n'),
      });
      if ((parentSend as any).error) throw new Error(JSON.stringify((parentSend as any).error));
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('api/send-email error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
}
