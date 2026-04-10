import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderNumber, customerName, amount } = req.body;

    const data = await resend.emails.send({
      from: 'ThaiBuy <onboarding@resend.dev>',
      to: 'gina0688@gmail.com',
      subject: `新訂單通知｜${orderNumber}`,
      html: `
        <h2>你有新訂單</h2>
        <p>訂單編號：${orderNumber}</p>
        <p>客人：${customerName}</p>
        <p>金額：${amount}</p>
      `
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}