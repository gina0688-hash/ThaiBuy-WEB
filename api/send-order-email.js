const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { orderNumber, notifyToken } = req.body || {};

    if (!orderNumber || !notifyToken) {
      return res.status(400).json({
        ok: false,
        error: '缺少必要參數'
      });
    }

    if (
      !process.env.RESEND_API_KEY ||
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({
        ok: false,
        error: '環境變數未設定完整'
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

  const { data: order, error: orderError } = await supabaseAdmin
  .from('orders')
  .select(`
    id,
    order_number,
    customer_name,
    total_amount,
    email_notified,
    email_notify_token,
    order_items (
      product_name,
      variant_name,
      quantity,
      price
    )
  `)
  .eq('order_number', orderNumber)
  .single();

    if (orderError || !order) {
      return res.status(404).json({
        ok: false,
        error: '查無訂單'
      });
    }

    if (String(order.email_notify_token) !== String(notifyToken)) {
      return res.status(403).json({
        ok: false,
        error: '驗證失敗'
      });
    }

 if (order.email_notified) {
  return res.status(200).json({
    ok: true,
    message: '這筆訂單已通知過，略過寄送'
  });
}

const itemsHtml = (order.order_items || []).map(item => `
  <li style="margin-bottom:8px;">
    <b>${item.product_name || '未命名商品'}</b>
    ${item.variant_name ? `｜${item.variant_name}` : ''}
    × ${item.quantity || 0}
    ${item.price != null ? `（單價 TWD $${item.price}）` : ''}
  </li>
`).join('');

const sendResult = await resend.emails.send({
  from: 'ThaiBuy <onboarding@resend.dev>',
  to: 'gina0688@gmail.com',
  subject: `新訂單通知｜${order.order_number}`,
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.8;">
      <h2>你有新訂單</h2>
      <p><b>訂單編號：</b>${order.order_number}</p>
      <p><b>客人：</b>${order.customer_name || '未提供'}</p>
      <p><b>金額：</b>${order.total_amount ?? '未提供'}</p>
      <p><b>商品內容：</b></p>
      <ul style="padding-left:20px; margin:8px 0 0 0;">
        ${itemsHtml || '<li>無商品資料</li>'}
      </ul>
    </div>
  `
});

    if (sendResult?.error) {
      return res.status(500).json({
        ok: false,
        error: sendResult.error.message || '寄信失敗'
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ email_notified: true })
      .eq('id', order.id);

    if (updateError) {
      return res.status(500).json({
        ok: false,
        error: '寄信成功，但更新通知狀態失敗'
      });
    }

    return res.status(200).json({
      ok: true,
      data: sendResult
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
};