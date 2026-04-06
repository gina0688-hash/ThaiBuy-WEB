import { supabase } from "./supabase.js"

const queryOrderNumber = document.getElementById("queryOrderNumber")
const queryEmail = document.getElementById("queryEmail")
const queryPhone = document.getElementById("queryPhone")
const queryBtn = document.getElementById("queryBtn")
const queryResult = document.getElementById("queryResult")

queryBtn.addEventListener("click", handleQuery)

queryEmail.addEventListener("keydown", (e) => {
  if(e.key === "Enter") handleQuery()
})

queryPhone.addEventListener("keydown", (e) => {
  if(e.key === "Enter") handleQuery()
})

async function handleQuery(){
const orderNumber = queryOrderNumber.value.trim().toUpperCase()
const email = queryEmail.value.trim().toLowerCase()
const phone = normalizePhone(queryPhone.value)

if(!orderNumber && (!email || !phone)){
  renderEmpty(
    "請輸入查詢資訊",
    "可輸入訂單編號，或同時輸入下單時填寫的 Email 與電話才能查詢。"
  )
  return
}

  queryBtn.disabled = true
  queryBtn.textContent = "查詢中..."

  try{
   const { data, error } = await supabase.rpc("query_orders_for_customer", {
  p_order_number: orderNumber || null,
  p_email: email || null,
  p_phone: phone || null
})

    if(error){
      console.error("rpc query error:", error)
      renderError("訂單查詢失敗，請稍後再試")
      return
    }

    const orders = data || []

   if(orders.length === 0){
  alert("查無訂單資料。\n如果確認已有下單但找不到資料，請聯繫客服人員。")
  renderEmpty("查無訂單資料", "如果確認已有下單但找不到資料，請聯繫客服人員。")
  return
}

    renderOrders(orders)

  }catch(err){
    console.error(err)
    renderError("查詢失敗，請稍後再試")
  }finally{
    queryBtn.disabled = false
    queryBtn.textContent = "查詢訂單"
  }
}

function renderOrders(orders){
  queryResult.innerHTML = orders.map(order => {
    const items = order.items || []
    const status = calcOrderStatus(items)
    const money = calcOrderMoney(order, items)

    return `
      <div style="
        background:linear-gradient(180deg,#fffdfb 0%, #fff8f3 100%);
        border:1px solid #f1dac8;
        border-radius:22px;
        padding:20px;
        margin-bottom:16px;
        box-shadow:0 8px 18px rgba(0,0,0,0.04);
      ">
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:14px;
          flex-wrap:wrap;
          margin-bottom:14px;
        ">
          <div>
            <div style="font-size:20px;font-weight:800;color:#3f352f;">
              訂單編號：${escapeHtml(order.order_number || order.id)}
            </div>
            <div style="margin-top:6px;font-size:14px;color:#7a6558;line-height:1.8;">
              下單時間：${formatDateTime(order.created_at)}<br>
              聯絡人：${escapeHtml(order.customer_name || "-")}<br>
              Email：${maskEmail(order.email || "-")}<br>
              電話：${maskPhone(order.phone || "-")}<br>
            匯款末五碼：${order.bank_last5 || "-"}
            </div>
          </div>

          <div style="text-align:right;">
            <div style="
              display:inline-block;
              padding:8px 14px;
              border-radius:999px;
              font-weight:800;
              font-size:14px;
              color:#fff;
              background:${status.color};
            ">
              ${status.text}
            </div>

            <div style="margin-top:8px;font-size:13px;color:#7a6558;">
              ${formatAdminStatus(order.admin_status)}
            </div>
          </div>
        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
          gap:10px;
          margin-bottom:16px;
        ">
          <div style="background:#fff;border:1px solid #f3e5da;border-radius:16px;padding:14px;">
            <div style="font-size:13px;color:#8b776a;">商品原價合計</div>
            <div style="margin-top:6px;font-size:20px;font-weight:800;color:#3f352f;">
              $${money.originalItemsTotal}
            </div>
          </div>

          <div style="background:#fff;border:1px solid #f3e5da;border-radius:16px;padding:14px;">
            <div style="font-size:13px;color:#8b776a;">運費</div>
            <div style="margin-top:6px;font-size:20px;font-weight:800;color:#3f352f;">
              $${money.shippingFee}
            </div>
          </div>

          <div style="background:#fff;border:1px solid #f3e5da;border-radius:16px;padding:14px;">
            <div style="font-size:13px;color:#8b776a;">目前已收</div>
            <div style="margin-top:6px;font-size:20px;font-weight:800;color:#2563eb;">
              $${money.totalAmount}
            </div>
          </div>

          <div style="background:#fff;border:1px solid #f3e5da;border-radius:16px;padding:14px;">
            <div style="font-size:13px;color:#8b776a;">商品件數</div>
            <div style="margin-top:6px;font-size:20px;font-weight:800;color:#3f352f;">
              ${items.length} 項
            </div>
          </div>
        </div>

       ${
  order.need_second_payment && Number(order.second_payment_amount || money.secondPaymentAmount || 0) > 0
  ? `
    <div style="
      margin-bottom:14px;
      background:#fff7ed;
      border:1px solid #fed7aa;
      border-radius:16px;
      padding:14px;
      color:#9a3412;
      line-height:1.8;
    ">
      <b>補款提醒：</b> 尚有補款金額
      <b>$${Number(order.second_payment_amount || money.secondPaymentAmount || 0)}</b><br>
      補款狀態：<b>${formatSecondPaymentStatus(order.second_payment_status)}</b>
    </div>

    ${
      order.second_payment_status === "paid"
        ? `
          <div style="
            margin-bottom:14px;
            background:#ecfdf5;
            border:1px solid #bbf7d0;
            border-radius:16px;
            padding:14px;
            color:#166534;
            line-height:1.8;
          ">
            <b>補款完成</b><br>
            我們已確認收到你的補款，謝謝你。
          </div>
        `
        : order.second_payment_status === "submitted"
        ? `
          <div style="
            margin-bottom:14px;
            background:#eff6ff;
            border:1px solid #bfdbfe;
            border-radius:16px;
            padding:14px;
            color:#1d4ed8;
            line-height:1.8;
          ">
            <b>已送出補款資訊</b><br>
            目前正在等待我們確認入帳，請留意後續通知。
          </div>
        `
        : `
          <div style="
            margin-bottom:14px;
            background:#fff;
            border:1px solid #f3e5da;
            border-radius:18px;
            padding:16px;
          ">
            <div style="font-weight:800;color:#4f433c;margin-bottom:10px;">
              補款資料填寫
            </div>

            <div style="display:grid;gap:10px;">
              <input
                id="secondLast5-${order.id}"
                type="text"
                placeholder="請輸入補款帳號末五碼"
                style="width:100%;box-sizing:border-box;border:1px solid #f0d9c7;background:#fffaf6;border-radius:14px;padding:12px 14px;font-size:14px;"
              >

              <input
  id="secondTime-${order.id}"
  type="datetime-local"
  style="width:100%;box-sizing:border-box;border:1px solid #f0d9c7;background:#fffaf6;border-radius:14px;padding:12px 14px;font-size:14px;"
>

              <textarea
                id="secondNote-${order.id}"
                placeholder="備註（選填）"
                style="width:100%;box-sizing:border-box;border:1px solid #f0d9c7;background:#fffaf6;border-radius:14px;padding:12px 14px;font-size:14px;min-height:90px;"
              ></textarea>

              <button
                type="button"
                onclick="submitSecondPayment('${order.id}')"
                style="border:none;border-radius:999px;padding:12px 18px;background:linear-gradient(135deg,#ffb36b,#ff8b3d);color:#fff;font-size:14px;font-weight:800;cursor:pointer;"
              >
                我已完成補款
              </button>
            </div>
          </div>
        `
    }
  `
  : ""
}

        ${
          money.refundAmount > 0
          ? `
            <div style="
              margin-bottom:14px;
              background:#eff6ff;
              border:1px solid #bfdbfe;
              border-radius:16px;
              padding:14px;
              color:#1d4ed8;
              line-height:1.8;
            ">
              <b>退款提醒：</b> 應退款金額 <b>$${money.refundAmount}</b>
            </div>
          `
          : ""
        }

        <div style="
          background:#fff;
          border:1px solid #f3e5da;
          border-radius:18px;
          padding:16px;
        ">
          <div style="font-weight:800;color:#4f433c;margin-bottom:10px;">
            商品明細
          </div>

          ${
            items.length === 0
            ? `<div style="color:#8b776a;">尚無商品資料</div>`
            : items.map(item => {
                const isCancelled = item.status === "cancelled"
                return `
                  <div style="
                    padding:10px 0;
                    border-bottom:1px dashed #eee1d6;
                    opacity:${isCancelled ? 0.55 : 1};
                    text-decoration:${isCancelled ? "line-through" : "none"};
                  ">
                    <div style="font-weight:700;color:#4f433c;">
                      ${escapeHtml(item.product_name || "-")}
                    </div>

                    <div style="margin-top:4px;font-size:14px;color:#7a6558;line-height:1.7;">
                      規格：${escapeHtml(item.variant_name || "-")}<br>
                      數量：${item.quantity || 1}<br>
                      單價：$${item.price || 0}<br>
                      狀態：${formatItemStatus(item.status)}
                    </div>
                  </div>
                `
              }).join("")
          }
        </div>

        <div style="margin-top:14px;font-size:14px;color:#7a6558;line-height:1.8;">
          運送方式：${escapeHtml(order.shipping_method || "-")}<br>
          ${
            order.shipping_method === "交貨便"
            ? `門市：${escapeHtml(order.store_name || "-")} / 店號：${escapeHtml(order.store_code || "-")}`
            : ""
          }
        </div>
      </div>
    `
  }).join("")
}

function renderEmpty(title, text){
  queryResult.innerHTML = `
    <div class="result-empty">
      <div class="result-icon">📦</div>
      <h3>${title}</h3>
      <p>${text}</p>
    </div>
  `
}

function renderError(text){
  queryResult.innerHTML = `
    <div class="result-empty">
      <div class="result-icon">⚠️</div>
      <h3>發生錯誤</h3>
      <p>${text}</p>
    </div>
  `
}

function normalizePhone(str){
  return String(str || "").replace(/\D/g, "")
}

function calcC2CShippingFee(totalAmount){
  let remaining = Number(totalAmount || 0)
  let fee = 0

  while(remaining > 0){
    const chunk = Math.min(remaining, 5000)

    if(chunk <= 1000){
      fee += 60
    }else if(chunk < 2000){
      fee += 70
    }else if(chunk <= 3000){
      fee += 80
    }else if(chunk <= 4000){
      fee += 90
    }else{
      fee += 100
    }

    remaining -= chunk
  }

  return fee
}

function calcOrderMoney(order, items){
  const activeItems = items.filter(i => i.status !== "cancelled")

  const originalItemsTotal = activeItems.reduce((sum, i) => {
    return sum + Number(i.price || 0) * Number(i.quantity || 1)
  }, 0)

  const shippingFee = order.shipping_method === "交貨便"
    ? calcC2CShippingFee(originalItemsTotal)
    : 0

  const isDepositOrder = !!order.is_deposit_order
  const needSecondPayment = !!order.need_second_payment

  const finalFullAmount = originalItemsTotal + shippingFee

  let firstCharge = 0
  let secondPaymentAmount = 0
  let refundAmount = 0
  let totalAmount = 0

  if(isDepositOrder){
    firstCharge = Number(order.total_amount || 500)
    secondPaymentAmount = needSecondPayment
      ? Number(order.second_payment_amount || Math.max(finalFullAmount - firstCharge, 0))
      : 0
    refundAmount = Math.max(firstCharge - finalFullAmount, 0)
    totalAmount = firstCharge
  }else{
    firstCharge = Number(order.total_amount || finalFullAmount)
    secondPaymentAmount = needSecondPayment
      ? Number(order.second_payment_amount || 0)
      : 0
    refundAmount = Number(order.refund_amount || 0)
    totalAmount = firstCharge
  }

  return {
    activeItems,
    originalItemsTotal,
    shippingFee,
    firstCharge,
    totalAmount,
    finalFullAmount,
    secondPaymentAmount,
    refundAmount
  }
}

function calcOrderStatus(items){
  const active = items.filter(i => i.status !== "cancelled")

  if(active.length === 0){
    return { text: "已取消", color: "#9ca3af" }
  }

  const total = active.length
  const ordered = active.filter(i => i.status === "ordered").length
  const arrived = active.filter(i => i.status === "arrived").length
  const shipped = active.filter(i => i.status === "shipped").length

  if(shipped === total){
    return { text: "已完成寄送", color: "#22c55e" }
  }

  if(shipped > 0){
    return { text: "部分出貨", color: "#f59e0b" }
  }

  if(arrived === total){
    return { text: "已回台，等待出貨", color: "#3b82f6" }
  }

  if(arrived > 0){
    return { text: "等待商品回台", color: "#6366f1" }
  }

  if(ordered === total){
    return { text: "已下單（等待回台）", color: "#0ea5e9" }
  }

  if(ordered > 0){
    return { text: "部分已購買", color: "#06b6d4" }
  }

  return { text: "新訂單（未處理）", color: "#ef4444" }
}

function formatItemStatus(status){
  return {
    pending: "未處理",
    ordered: "已購買",
    arrived: "已回台",
    shipped: "已出貨",
    cancelled: "已取消"
  }[status] || "未處理"
}

function formatAdminStatus(status){
  return {
    checking: "付款狀態：等待對帳",
    paid: "付款狀態：對帳完成",
    hold: "付款狀態：暫停處理"
  }[status] || "付款狀態：未設定"
}

function formatDateTime(dateStr){
  if(!dateStr) return "-"
  return new Date(dateStr).toLocaleString("zh-TW")
}

function maskPhone(phone){
  const digits = normalizePhone(phone)
  if(digits.length < 4) return phone
  return digits.slice(0, 4) + "****" + digits.slice(-2)
}

function maskEmail(email){
  const str = String(email || "")
  if(!str.includes("@")) return str

  const [name, domain] = str.split("@")
  if(name.length <= 2){
    return `${name[0] || ""}***@${domain}`
  }

  return `${name.slice(0, 2)}***@${domain}`
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatSecondPaymentStatus(status){
  return {
    unpaid: "尚未補款",
    submitted: "已送出，等待確認",
    paid: "補款完成"
  }[status] || "尚未補款"
}

window.submitSecondPayment = async function(orderId){
  const last5 = document.getElementById(`secondLast5-${orderId}`)?.value.trim() || ""
  const remitRaw = document.getElementById(`secondTime-${orderId}`)?.value || ""
const remitTime = remitRaw ? remitRaw.replace("T", " ") : ""
  const note = document.getElementById(`secondNote-${orderId}`)?.value.trim() || ""

  if(!last5){
    alert("請填寫補款帳號末五碼")
    return
  }

 if(!remitTime){
  alert("請選擇補款日期時間")
  return
}

  const { error } = await supabase
    .from("orders")
    .update({
      second_payment_last5: last5,
      second_payment_time: remitTime,
      second_payment_note: note,
      second_payment_status: "submitted"
    })
    .eq("id", orderId)

  if(error){
    console.error(error)
    alert("補款資料送出失敗，請稍後再試")
    return
  }

  alert("已送出補款資訊，請等待對帳確認")

  handleQuery()
}