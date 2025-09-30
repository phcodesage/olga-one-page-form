import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';

dotenv.config();

const app = express();
app.use(cors());

// --- Stripe: webhook must use raw body and be registered BEFORE express.json() ---
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-06-20' }) : null;

// Webhook endpoint to receive payment confirmation from Stripe Checkout
// Note: requires STRIPE_WEBHOOK_SECRET in env. Configure webhook in Stripe Dashboard or via Stripe CLI.
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    if (!stripe) return res.status(500).send('Stripe not configured');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers['stripe-signature'] as string;
    if (!webhookSecret || !sig) return res.status(400).send('Missing webhook secret or signature');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed.', err?.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntent = session.payment_intent as string | null;
      const amountTotal = (session.amount_total ?? 0) / 100;
      const customerEmail = (session.customer_details?.email || session.customer_email || '') as string;
      const meta = (session.metadata || {}) as Record<string, string>;

      // Send a simple admin notification using existing email infra
      const from = process.env.FROM_EMAIL || 'no-reply@example.com';
      const subject = `Stripe payment received - ${meta.childName || 'Child'} (${amountTotal.toFixed(2)} USD)`;
      const adminRecipients = [
        'Info@exceedlearningcenterny.com',
        'olganyc21@gmail.com',
        'phcodesage@gmail.com',
      ];
      const lines = [
        'A Stripe Checkout payment was completed.',
        '',
        `Amount: $${amountTotal.toFixed(2)} USD`,
        `Payment reference (payment_intent): ${paymentIntent || 'n/a'}`,
        `Checkout session: ${session.id}`,
        `Email: ${customerEmail || 'n/a'}`,
        `Description: ${meta.description || 'Afterschool Registration'}`,
        '',
        'Metadata:',
        `  Child: ${meta.childName || ''}`,
        `  Parent: ${meta.parentName || ''}`,
        `  Days/Time: ${meta.daysPerWeek || ''} days, ${meta.timeBlock || ''}`,
        `  Frequency: ${meta.frequency || ''}`,
      ];

      // Fire and forget; if email fails, we still ACK webhook
      sendEmail({
        from,
        to: adminRecipients,
        subject,
        text: lines.join('\n'),
        html: `<pre>${lines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('\n')}</pre>`,
      }).catch(err => console.error('admin stripe email error', err));
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('stripe webhook error', err);
    res.status(500).send('internal error');
  }
});

// JSON parser for the rest of the API (must come AFTER webhook raw parser)
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3001;

// Email providers
// EMAIL_PROVIDER=resend|smtp
// Resend: RESEND_API_KEY=re_...
// SMTP (Gmail): SMTP_HOST=smtp.gmail.com, SMTP_PORT=465 or 587, SMTP_USER=you@gmail.com, SMTP_PASS=app_password
// FROM_EMAIL=Afterschool <no-reply@yourdomain.com>
// ADMIN_EMAIL=payments@exceedlearningcenterny.com
const providerEnv = (process.env.EMAIL_PROVIDER || '').toLowerCase();
const resendApiKey = process.env.RESEND_API_KEY;
let resend: Resend | null = null;
if (providerEnv === 'resend') {
  if (!resendApiKey) {
    console.warn('[WARN] EMAIL_PROVIDER is set to "resend" but RESEND_API_KEY is missing. Email sending will fail.');
  } else {
    resend = new Resend(resendApiKey);
  }
}

type EmailArgs = { from: string; to: string[]; subject: string; text: string; html?: string };

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
    return { data: { id: info.messageId } };
  }
  // default to Resend
  if (!resend) {
    throw new Error('Resend not configured. Set EMAIL_PROVIDER=smtp for Gmail SMTP or provide RESEND_API_KEY.');
  }
  const r = await resend.emails.send(args as any);
  return r as any;
}

// Create Stripe Checkout Session
app.post('/api/payments/stripe/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const { amount, description, customer_email, metadata } = req.body || {};
    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'link'],
      ...(customer_email ? { customer_email } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amt * 100),
            product_data: {
              name: description || 'Afterschool Registration',
            },
          },
        },
      ],
      success_url: `${frontendUrl}/stripe-bridge.html?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?canceled=1`,
      metadata: {
        ...(metadata || {}),
        description: description || 'Afterschool Registration',
      },
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: err?.message || 'internal error' });
  }
});

// Quick Stripe status check
app.get('/api/payments/stripe/status', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: 'Stripe not configured (missing STRIPE_SECRET_KEY)' });
    const bal = await stripe.balance.retrieve();
    res.json({ ok: true, livemode: bal.livemode, available: bal.available?.[0]?.amount ?? 0 });
  } catch (err: any) {
    console.error('stripe status error', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
});

// Tiny test Checkout Session ($0.50)
app.post('/api/payments/stripe/test-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'link'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: 50,
            product_data: { name: 'Test Payment (manual E2E check)' },
          },
        },
      ],
      success_url: `${frontendUrl}/stripe-bridge.html?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?canceled=1`,
      metadata: { description: 'Test Payment (manual E2E check)' },
    });
    res.json({ url: session.url });
  } catch (err: any) {
    console.error('stripe test-session error', err);
    res.status(500).json({ error: err?.message || 'internal error' });
  }
});

app.post('/api/send-email', async (req, res) => {
  try {
    const {
      form,
      pricing,
      pricingInput,
      payment,
    } = req.body || {};

    const from = process.env.FROM_EMAIL || 'no-reply@example.com';
    const adminRecipients = [
      'Info@exceedlearningcenterny.com',
      'olganyc21@gmail.com',
      'phcodesage@gmail.com',
    ];

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
      ...(form?.paymentMethod === 'zelle' ? [
        'Zelle Details:',
        `  Recipient: payments@exceedlearningcenterny.com`,
        `  Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
        `  Payer: ${payment?.zellePayerName || 'Not provided'}`,
        `  Confirmation: ${payment?.zelleConfirmation || 'Not provided'}`,
      ] : []),
      ...(form?.paymentMethod === 'stripe' ? [
        'Stripe Payment:',
        `  Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
        `  Reference: ${payment?.paymentReference || 'Not available'}`,
      ] : []),
      ...(form?.paymentMethod === 'credit-card' ? [
        'Credit Card Details:',
        `  Card Number: ${payment?.cardNumber || 'Not provided'}`,
        `  Expiration: ${payment?.cardExpiration || 'Not provided'}`,
        `  Security Code: ${payment?.cardSecurityCode || 'Not provided'}`,
        `  ZIP Code: ${payment?.cardZipCode || 'Not provided'}`,
      ] : []),
      ...(form?.paymentMethod === 'cash' ? [
        `Cash Payment: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
      ] : []),
      ...(form?.paymentMethod === 'check' ? [
        `Check Payment: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
        `  Make payable to: Exceed Learning Center`,
      ] : []),
      `Payment Notes: ${form?.paymentNotes || 'None'}`,
    ];

    const text = lines.join('\n');
    const html = `<pre style="font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: pre-wrap;">${
      lines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('\n')
    }</pre>`;

    if (!process.env.FROM_EMAIL) {
      return res.status(500).json({ ok: false, error: 'FROM_EMAIL not set in environment' });
    }
    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    if (provider !== 'smtp' && !process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: 'RESEND_API_KEY not set in environment' });
    }

    // Send to admin
    const adminSend = await sendEmail({
      from,
      to: adminRecipients,
      subject,
      text,
      html,
    });
    if ((adminSend as any).error) throw new Error(JSON.stringify((adminSend as any).error));

    // Optional: confirmation to parent if provided
    if (form?.email) {
      const memo = `Afterschool - ${form?.childName || 'Child'} - ${form?.parentName || 'Parent'}`;
      const clientTextLines = [
        'Thank you for registering! We have received your submission.',
        '',
        'Registration summary:',
        `• Child: ${form?.childName || ''}`,
        `• Child DOB: ${form?.childDateOfBirth || ''}`,
        `• Child Grade: ${form?.childGrade || ''}`,
        `• Parent: ${form?.parentName || ''}`,
        `• Parent Address: ${form?.parentAddress || ''}`,
        `• Email: ${form?.email || ''}`,
        `• Phone: ${form?.phoneFull || ''}`,
        '',
        'Schedule:',
        `• ${pricingInput?.daysPerWeek} days, ${pricingInput?.timeBlock}, ${pricingInput?.school}, ${pricingInput?.frequency}`,
        `• Extension hours: ${pricingInput?.extensionsEnabled ? `Enabled (${pricingInput?.timeBlock})` : 'Disabled'}`,
        `• Abacus: ${pricingInput?.abacusEnabled ? 'Enabled' : 'Disabled'}`,
        `• Chess: ${pricingInput?.chessEnabled ? 'Enabled' : 'Disabled'}`,
        `• Carrington waiver: ${pricingInput?.isCarrington ? 'Yes' : 'No'}`,
        '',
        'Price breakdown (per week):',
        `• Base weekly: $${pricing?.baseWeekly?.toFixed?.(2)}`,
        `• Add-ons weekly: $${pricing?.addOnWeekly?.toFixed?.(2)}`,
        `• Abacus weekly: $${pricing?.abacusWeekly?.toFixed?.(2)}`,
        `• Chess weekly: $${pricing?.chessWeekly?.toFixed?.(2)}`,
        `• School discount: -$${pricing?.schoolDiscountWeekly?.toFixed?.(2)}`,
        `• Prepay discount: -$${pricing?.prepayDiscountWeekly?.toFixed?.(2)}`,
        `• Final weekly: $${pricing?.finalWeekly?.toFixed?.(2)}`,
        '',
        `Weeks in billing period: ${pricing?.periodWeeks}`,
        `One-time registration fee: $${pricing?.registrationFee?.toFixed?.(2)}`,
        `Total due this period: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
        '',
        `Payment method: ${form?.paymentMethod === 'stripe' ? 'Stripe (Paid)' : (form?.paymentMethod || 'Not specified')}`,
        ...(form?.paymentMethod === 'zelle' ? [
          'Zelle Payment:',
          '• Recipient: payments@exceedlearningcenterny.com',
          `• Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
          `• Memo: ${memo}`,
          payment?.zellePayerName ? `• Payer name: ${payment.zellePayerName}` : '',
          payment?.zelleConfirmation ? `• Confirmation: ${payment.zelleConfirmation}` : '',
        ] : []),
        ...(form?.paymentMethod === 'stripe' ? [
          'Stripe Payment:',
          `• Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
          `• Reference: ${payment?.paymentReference || 'Not available'}`,
        ] : []),
        ...(form?.paymentMethod === 'credit-card' ? [
          'Credit Card Payment:',
          `• Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
          `• Card Number: ${payment?.cardNumber || 'Not provided'}`,
          `• Expiration: ${payment?.cardExpiration || 'Not provided'}`,
          `• Security Code: ${payment?.cardSecurityCode || 'Not provided'}`,
          `• ZIP Code: ${payment?.cardZipCode || 'Not provided'}`,
        ] : []),
        ...(form?.paymentMethod === 'cash' ? [
          'Cash Payment:',
          `• Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
          '• Please bring payment to the center',
        ] : []),
        ...(form?.paymentMethod === 'check' ? [
          'Check Payment:',
          `• Amount: $${pricing?.totalForPeriod?.toFixed?.(2)} USD`,
          '• Make payable to: Exceed Learning Center',
          `• Memo: ${memo}`,
        ] : []),
        form?.paymentNotes ? `• Payment notes: ${form.paymentNotes}` : '',
      ].filter(Boolean as any) as string[];

      const clientHtml = `
        <div style="font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111827">
          <h2 style="margin:0 0 8px; font-size:20px; color:#0f766e">Thank you for registering!</h2>
          <p style="margin:0 0 16px">We have received your submission. Below is your registration summary and payment details.</p>

          <div style="background:#fff7ed; border:1px solid #ffedd5; border-radius:10px; padding:12px 14px; margin:0 0 14px">
            <h3 style="margin:0 0 8px; font-size:16px">Registration summary</h3>
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li><strong>Child:</strong> ${form?.childName || ''}</li>
              <li><strong>Child DOB:</strong> ${form?.childDateOfBirth || ''}</li>
              <li><strong>Child Grade:</strong> ${form?.childGrade || ''}</li>
              <li><strong>Parent:</strong> ${form?.parentName || ''}</li>
              <li><strong>Parent Address:</strong> ${form?.parentAddress || ''}</li>
              <li><strong>Email:</strong> ${form?.email || ''}</li>
              <li><strong>Phone:</strong> ${form?.phoneFull || ''}</li>
            </ul>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin:0 0 14px">
            <h3 style="margin:0 0 8px; font-size:16px">Schedule</h3>
            <p style="margin:0">${pricingInput?.daysPerWeek} days, ${pricingInput?.timeBlock}, ${pricingInput?.school}, ${pricingInput?.frequency}</p>
            <ul style="margin:6px 0 0; padding-left:18px; line-height:1.6">
              <li>Extension hours: <strong>${pricingInput?.extensionsEnabled ? `Enabled (${pricingInput?.timeBlock})` : 'Disabled'}</strong></li>
              <li>Abacus: <strong>${pricingInput?.abacusEnabled ? 'Enabled' : 'Disabled'}</strong></li>
              <li>Chess: <strong>${pricingInput?.chessEnabled ? 'Enabled' : 'Disabled'}</strong></li>
              <li>Carrington waiver: <strong>${pricingInput?.isCarrington ? 'Yes' : 'No'}</strong></li>
            </ul>
          </div>

          <div style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin:0 0 14px">
            <h3 style="margin:0 0 8px; font-size:16px">Price breakdown</h3>
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li>Base weekly: <strong>$${pricing?.baseWeekly?.toFixed?.(2)}</strong></li>
              <li>Add-ons weekly: <strong>$${pricing?.addOnWeekly?.toFixed?.(2)}</strong></li>
              <li>Abacus weekly: <strong>$${pricing?.abacusWeekly?.toFixed?.(2)}</strong></li>
              <li>Chess weekly: <strong>$${pricing?.chessWeekly?.toFixed?.(2)}</strong></li>
              <li>School discount: <strong>-$${pricing?.schoolDiscountWeekly?.toFixed?.(2)}</strong></li>
              <li>Prepay discount: <strong>-$${pricing?.prepayDiscountWeekly?.toFixed?.(2)}</strong></li>
              <li>Final weekly: <strong>$${pricing?.finalWeekly?.toFixed?.(2)}</strong></li>
            </ul>
            <p style="margin:8px 0 0">Weeks in period: <strong>${pricing?.periodWeeks}</strong></p>
            <p style="margin:4px 0 0">One-time registration fee: <strong>$${pricing?.registrationFee?.toFixed?.(2)}</strong></p>
            <p style="margin:4px 0 0">Total due this period: <strong>$${pricing?.totalForPeriod?.toFixed?.(2)} USD</strong></p>
          </div>

          <div style="background:#ecfeff; border:1px solid #cffafe; border-radius:10px; padding:12px 14px;">
            <h3 style="margin:0 0 8px; font-size:16px">Payment Information</h3>
            <p style="margin:0 0 8px"><strong>Method:</strong> ${form?.paymentMethod === 'stripe' ? 'Stripe (Paid)' : (form?.paymentMethod || 'Not specified')}</p>
            ${form?.paymentMethod === 'zelle' ? `
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li>Recipient: <strong>payments@exceedlearningcenterny.com</strong></li>
              <li>Amount: <strong>$${pricing?.totalForPeriod?.toFixed?.(2)} USD</strong></li>
              <li>Memo: <code>${memo}</code></li>
              ${payment?.zellePayerName ? `<li>Payer name: ${payment.zellePayerName}</li>` : ''}
              ${payment?.zelleConfirmation ? `<li>Confirmation: ${payment.zelleConfirmation}</li>` : ''}
            </ul>` : ''}
            ${form?.paymentMethod === 'stripe' ? `
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li>Amount: <strong>$${pricing?.totalForPeriod?.toFixed?.(2)} USD</strong></li>
              <li>Reference: <code>${payment?.paymentReference || 'Not available'}</code></li>
            </ul>` : ''}
            ${form?.paymentMethod === 'credit-card' ? `
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li>Amount: <strong>$${pricing?.totalForPeriod?.toFixed?.(2)} USD</strong></li>
              <li>Card Number: <strong>${payment?.cardNumber || 'Not provided'}</strong></li>
              <li>Expiration: <strong>${payment?.cardExpiration || 'Not provided'}</strong></li>
              <li>Security Code: <strong>${payment?.cardSecurityCode || 'Not provided'}</strong></li>
              <li>ZIP Code: <strong>${payment?.cardZipCode || 'Not provided'}</strong></li>
            </ul>` : ''}
            ${form?.paymentMethod === 'cash' ? `
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li>Amount: <strong>$${pricing?.totalForPeriod?.toFixed?.(2)} USD</strong></li>
              <li>Please bring payment to the center</li>
            </ul>` : ''}
            ${form?.paymentMethod === 'check' ? `
            <ul style="margin:0; padding-left:18px; line-height:1.6">
              <li>Amount: <strong>$${pricing?.totalForPeriod?.toFixed?.(2)} USD</strong></li>
              <li>Make payable to: <strong>Exceed Learning Center</strong></li>
              <li>Memo: <code>${memo}</code></li>
            </ul>` : ''}
            ${form?.paymentNotes ? `<p style="margin:8px 0 0"><strong>Notes:</strong> ${form.paymentNotes}</p>` : ''}
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

    res.json({ ok: true });
  } catch (err: any) {
    console.error('email error', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
});

// Lightweight test endpoint to verify email sending quickly
app.post('/api/test-email', async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: 'Missing "to"' });
    const from = process.env.FROM_EMAIL || 'no-reply@example.com';
    const provider2 = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    if (!process.env.FROM_EMAIL) {
      return res.status(500).json({ ok: false, error: 'FROM_EMAIL not set in environment' });
    }
    if (provider2 !== 'smtp' && !process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: 'RESEND_API_KEY not set in environment' });
    }
    const r = await sendEmail({
      from,
      to: [to],
      subject: 'Test email from Afterschool app',
      html: '<p>It works! 🎉</p>',
      text: 'It works!'
    });
    if ((r as any).error) throw new Error(JSON.stringify((r as any).error));
    res.json({ ok: true, id: r.data?.id });
  } catch (err: any) {
    console.error('test email error', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
});

app.listen(PORT, () => {
  console.log(`Email server listening on http://localhost:${PORT}`);
});
