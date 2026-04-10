const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'RESEND_API_KEY 沒抓到'
      });
    }

    const resend = new Resend(apiKey);

    const { orderNumber, customerName, amount } = req.body || {};

    if (!orderNumber) {
      return res.status(400).json({
        ok: false,
        error: '缺少 orderNumber'
      });
    }

    const data = await resend.emails.send({
      from: 'ThaiBuy <onboarding@resend.dev>',
      to: 'gina0688@gmail.com',
      subject: `新訂單通知｜${orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.8;">
          <h2>你有新訂單</h2>
          <p><b>訂單編號：</b>${orderNumber}</p>
          <p><b>客人：</b>${customerName || '未提供'}</p>
          <p><b>金額：</b>${amount ?? '未提供'}</p>
        </div>
      `
    });

    return res.status(200).json({
      ok: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
};