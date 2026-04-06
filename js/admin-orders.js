
import { supabase } from "./supabase.js"
import { loadAuth, bindLogout } from "./auth.js"

const user = await loadAuth()
if(!user) throw new Error("未登入")

bindLogout()

// ⭐ 這行你要留就留，不留也可以
showUser(user)

loadOrders()

async function loadOrders(){
  console.log("🚀 loadOrders開始")
  const keyword = document.getElementById("searchInput")?.value || ""

  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })

  // ⭐ 搜尋
  if(keyword){
    query = query.or(`
      id.ilike.%${keyword}%,
      customer_name.ilike.%${keyword}%,
      phone.ilike.%${keyword}%,
      email.ilike.%${keyword}%
    `)
  }

  const { data: orders, error } = await query

if(error){
  console.error("orders error:", error)
  return
}
console.log("orders:", orders)
  const newBox = document.getElementById("order-new")
  const collectingBox = document.getElementById("order-collecting")   // ⭐新增
  const shippingBox = document.getElementById("order-shipping")
  const doneBox = document.getElementById("order-done")

  newBox.innerHTML = ""
  collectingBox.innerHTML = ""   // ⭐新增
  shippingBox.innerHTML = ""
  doneBox.innerHTML = ""

  for(const o of orders){

    const { data: items } = await supabase
  .from("order_items")
  .select("*")
  .eq("order_id", o.id)

const money = calcOrderMoney(o, items || [])
    

    const div = document.createElement("div")
    div.className = "order-card"

    div.innerHTML = `
     <div class="order-summary" onclick="toggleDetail('${o.id}')">

  <div style="
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:10px;
  ">

    <!-- 左 -->
    <div>
      <div style="font-weight:bold;">
        🧾 ${o.customer_name}
<span style="color:#6b7280;margin-left:6px;">
  $${money.totalAmount}
</span>
      </div>

     <div style="font-size:14px;color:#6b7280;margin-top:4px;font-weight:500;">
${
  o.bank_last5
  ? `<span style="margin-left:8px;">末五碼:${o.bank_last5}</span>`
  : ""
}

${
  o.shipping_method
  ? `<span style="margin-left:8px;">🚚 ${o.shipping_method}</span>`
  : ""
}

${
  o.note
  ? `<span style="margin-left:8px;color:#6b7280;">📝</span>`
  : ""
}
 📦 ${items.length}項商品

${
  items.some(i=>i.status==="cancelled")
  ? `<span style="color:#ef4444;">❌含取消</span>`
  : ""
}

${
  o.need_second_payment && money.secondPaymentAmount > 0
  ? `<span style="color:#f59e0b;">💰需補款</span>`
  : ""
}

${
  money.refundAmount > 0
  ? `<span style="color:#2563eb;">↩️需退款</span>`
  : ""
}
      </div>
    </div>

    <!-- 右 -->
    <div style="text-align:right;">
      <div style="font-size:12px;color:#9ca3af;">
        ${new Date(o.created_at).toLocaleDateString()}
      </div>

      ${(() => {
        const s = calcOrderStatus(items)
        return `
          <div style="text-align:right">
      
            <div style="font-weight:bold;color:${s.color}">
              ${s.text}
            </div>
      
            <div style="font-size:12px;color:#6b7280;margin-top:4px">
  ${
    {
      checking: "等待對帳",
      paid: "對帳完成",
      hold: "暫停處理"
    }[o.admin_status] || "未設定"
  }
</div>
      
          </div>
        `
      })()}
    </div>

  </div>

</div>

      <div id="detail-${o.id}" class="order-detail" style="display:none">
        <button onclick="resetOrder('${o.id}')"
  style="background:#ef4444;color:white;border:none;padding:6px 10px;border-radius:6px;margin-bottom:10px;">
  🔄 回復整筆訂單
</button><br>
        <b>訂單ID：</b>${o.id}<br>
<b>本名：</b>${o.customer_name || "-"}<br>
<b>電話：</b>${o.phone || "-"}<br>
<b>Email：</b>${o.email || "-"}<br>
<b>社群名字：</b>${o.community_name || "-"}<br>
<b>聯繫方式：</b>${o.contact_method || "-"}<br>
<b>聯繫帳號：</b>${o.contact_account || "-"}<br>
<b>預計匯款時間：</b>${o.expected_remit_time || "-"}<br>
<b>時間：</b>${new Date(o.created_at).toLocaleString()}<br><br>

<b>運送方式：</b>${o.shipping_method || "-"}<br>
${
  o.shipping_method === "交貨便"
    ? `
      <b>收件本名：</b>${o.receiver_name || "-"}<br>
      <b>收件電話：</b>${o.receiver_phone || "-"}<br>
      <b>7-11 門市：</b>${o.store_name || "-"}<br>
      <b>7-11 店號：</b>${o.store_code || "-"}<br><br>
    `
    : "<br>"
}

        <b>管理狀態：</b>
<select onchange="updateAdminStatus('${o.id}', this.value)">
  <option value="" ${!o.admin_status ? "selected" : ""}>未設定</option>
  <option value="checking" ${o.admin_status==="checking"?"selected":""}>等待對帳</option>
  <option value="paid" ${o.admin_status==="paid"?"selected":""}>對帳完成</option>
  <option value="hold" ${o.admin_status==="hold"?"selected":""}>暫停處理</option>
</select>
      
       

        <br><br>

<div style="
  margin:8px 0;
  padding:8px 10px;
  border-radius:8px;
  background:#fef3c7;
  border:1px solid #fde68a;
">

  <div style="display:flex;justify-content:space-between;align-items:flex-start">

    <div>
      💰 <b>補款資訊</b>
      ${
        o.need_second_payment
        ? `<span style="color:#dc2626;margin-left:8px;">需補款</span>`
        : `<span style="color:#16a34a;margin-left:8px;">已完成</span>`
      }
    </div>

    <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
      <input type="checkbox"
        ${o.need_second_payment ? "checked" : ""}
        onchange="updateSecondPayment('${o.id}', this.checked)">
      啟用
    </label>

  </div>

<div style="margin-top:4px;">
  補款金額：
  <input type="number"
    value="${money.secondPaymentAmount || 0}"
    style="width:120px;margin:0;"
    onchange="updateSecondAmount('${o.id}', this.value)">
</div>

${
  money.refundAmount > 0
    ? `
      <div style="margin-top:6px;color:#2563eb;font-weight:bold;">
        應退款：$${money.refundAmount}
      </div>
    `
    : ""
}

</div>
        <b>商品：</b><br>
        ${items.map(i=>{

          const status = i.status || "pending"
        
          return `
            <div style="
              opacity:${i.status === "cancelled" ? 0.5 : 1};
              text-decoration:${i.status === "cancelled" ? "line-through" : "none"};
              background:${i.status === "cancelled" ? "#f3f4f6" : "transparent"};
              padding:8px;
              border-radius:6px;
              margin-bottom:8px;
            ">
        
              <div>
                - ${i.product_name} / ${i.variant_name}
                x ${i.quantity} ($${i.price})
              </div>
        
              <button
  onclick="updateItemStatus('${i.id}','pending')"
  style="
    background:${status==="pending"?"#ef4444":"#e5e7eb"};
    color:${status==="pending"?"white":"black"};
    border:none;
    padding:4px 8px;
    border-radius:6px;
  "
>
  🔄 重置
</button>
              
              <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        
                <button
                  onclick="updateItemStatus('${i.id}','ordered')"
                  style="
                    background:${status==="ordered"?"#2563eb":"#e5e7eb"};
                    color:${status==="ordered"?"white":"black"};
                    border:none;
                    padding:4px 8px;
                    border-radius:6px;
                  "
                >
                  🛒 已購
                </button>
        
                <button
                  onclick="updateItemStatus('${i.id}','arrived')"
                  style="
                    background:${status==="arrived"?"#16a34a":"#e5e7eb"};
                    color:${status==="arrived"?"white":"black"};
                    border:none;
                    padding:4px 8px;
                    border-radius:6px;
                  "
                >
                  📦 到台
                </button>
        
                <button
                  onclick="updateItemStatus('${i.id}','shipped')"
                  style="
                    background:${status==="shipped"?"#f59e0b":"#e5e7eb"};
                    color:${status==="shipped"?"white":"black"};
                    border:none;
                    padding:4px 8px;
                    border-radius:6px;
                  "
                >
                  🚚 出貨
                </button>
        
                ${
                  i.status === "cancelled"
                  ? `<span style="color:red;font-weight:bold;">❌ 已取消</span>`
                  : `<button onclick="cancelItem('${i.id}', '${o.id}')">取消</button>`
                }
        
              </div>
        
            </div>
          `
        }).join("")}

      </div>

          <div style="margin-top:10px;font-size:12px;color:#6b7280;">
  <button onclick="loadLogs('${o.id}')"
    style="margin-bottom:6px;">
    📜 查看歷史紀錄
  </button>

  <div id="logs-${o.id}"
  style="background:#f9fafb;padding:8px;border-radius:6px;display:none;">
</div>
</div>

<div style="
  margin-top:12px;
  padding:12px;
  border-radius:8px;
  background:#f8fafc;
  border:1px solid #e5e7eb;
">

  <div style="font-weight:bold;margin-bottom:6px;">
    🧾 付款資訊
  </div>

<div style="margin-bottom:4px;">
  商品原價合計：
  <span style="font-weight:bold;color:#111827;">
    $${money.originalItemsTotal}
  </span>
</div>

<div style="margin-bottom:4px;">
  運費：
  <span style="font-weight:bold;color:#111827;">
    $${money.shippingFee}
  </span>
</div>

<div style="margin-bottom:4px;">
  本次已收：
  <span style="font-weight:bold;color:#2563eb;">
    $${money.totalAmount}
  </span>
</div>

${
  o.need_second_payment && money.secondPaymentAmount > 0
    ? `
      <div style="margin-bottom:4px;">
        應補款：
        <span style="font-weight:bold;color:#dc2626;">
          $${money.secondPaymentAmount}
        </span>
      </div>
    `
    : ""
}

${
  money.refundAmount > 0
    ? `
      <div style="margin-bottom:4px;">
        應退款：
        <span style="font-weight:bold;color:#2563eb;">
          $${money.refundAmount}
        </span>
      </div>
    `
    : ""
}

  <div style="margin-bottom:4px;">
    末五碼：
    ${
      o.bank_last5
      ? `<span style="font-weight:bold;color:#2563eb;">${o.bank_last5}</span>`
      : `<span style="color:#999;">尚未填寫</span>`
    }
  </div>

  <div style="margin-bottom:4px;">
    預計匯款時間：
    ${
      o.expected_remit_time
      ? `<span style="font-weight:bold;color:#2563eb;">${o.expected_remit_time}</span>`
      : `<span style="color:#999;">尚未填寫</span>`
    }
  </div>

  <div>
    備註：
    <input type="text"
      value="${o.note || ""}"
      style="width:100%"
      onchange="updateNote('${o.id}', this.value)">
  </div>

</div>


      <hr>
    `

    // ⭐ 分類
    const s = calcOrderStatus(items).text

    if(s.includes("新訂單") || s.includes("部分已購買")){
      newBox.appendChild(div)
    }
    else if(s.includes("已下單") || s.includes("等待商品回台")){
      collectingBox.appendChild(div)
    }
    else if(s.includes("已回台") || s.includes("部分出貨")){
      shippingBox.appendChild(div)
    }
    else if(s.includes("已完成")){
      doneBox.appendChild(div)
    }

    else {
      // ⭐ 這行很關鍵（補救）
      newBox.appendChild(div)
  }
}}

// ⭐ 展開
window.toggleDetail = function(id){
  const el = document.getElementById(`detail-${id}`)
  el.style.display = el.style.display === "none" ? "block" : "none"
}

// ⭐ 更新狀態
window.updateStatus = async function(id, status){

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)

  if(error){
    console.error(error)
    alert("更新失敗")
    return
  }

  document.getElementById(`status-${id}`).innerText = status
}

// ⭐ 補款開關
window.updateSecondPayment = async function(id, value){

  const { error } = await supabase
    .from("orders")
    .update({ need_second_payment: value })
    .eq("id", id)

  if(error){
    console.error(error)
    return
  }

  await recalcOrder(id)
  await loadOrders()
}

// ⭐ 補款金額
window.updateSecondAmount = async function(id, value){

  const { error } = await supabase
    .from("orders")
    .update({ second_payment_amount: Number(value) })
    .eq("id", id)

  if(error){
    console.error(error)
  }
}



// ⭐ 商品取消（⭐獨立出來）
window.cancelItem = async function(itemId, orderId){

  console.log("取消 itemId:", itemId)

  if(!confirm("確定取消這個商品？")) return

  const { data, error } = await supabase
    .from("order_items")
    .update({ status: "cancelled" })
    .eq("id", itemId)
    .select()   // ⭐ 加這行（關鍵）

  console.log("update結果:", data)

  if(error){
    console.error(error)
    alert("取消失敗")
    return
  }

  if(!data || data.length === 0){
    alert("❌ 沒有更新成功（RLS或ID問題）")
    return
  }

  alert("已取消")

  const ok = await recalcOrder(orderId)

  if(ok){
    loadOrders()
  }
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

  const hasDeposit = !!order.need_second_payment

  // ⭐ 限量預購目前固定整單先收 500
  let firstCharge = 0

  if(activeItems.length === 0){
    firstCharge = hasDeposit ? 500 : 0
  }else if(hasDeposit){
    firstCharge = 500
  }else{
    firstCharge = originalItemsTotal
  }

  const finalFullAmount = originalItemsTotal + shippingFee

  const secondPaymentAmount = hasDeposit
    ? Math.max(finalFullAmount - firstCharge, 0)
    : 0

  const refundAmount = hasDeposit
    ? Math.max(firstCharge - finalFullAmount, 0)
    : 0

  const totalAmount = hasDeposit
    ? firstCharge
    : finalFullAmount

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

async function recalcOrder(orderId){

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, shipping_method, need_second_payment")
    .eq("id", orderId)
    .single()

  if(orderError || !order){
    console.error("recalc order fetch error:", orderError)
    return false
  }

  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .select("price, quantity, status")
    .eq("order_id", orderId)

  if(itemError){
    console.error("recalc item fetch error:", itemError)
    return false
  }

  const money = calcOrderMoney(order, items || [])

  const { error: updateError } = await supabase
    .from("orders")
    .update({
  total_amount: money.totalAmount,
  second_payment_amount: money.secondPaymentAmount,
  refund_amount: money.refundAmount
})
    .eq("id", orderId)

  if(updateError){
    console.error("update total error:", updateError)
    return false
  }

  return true
}


function calcOrderStatus(items){

  const active = items.filter(i => i.status !== "cancelled")

  if(active.length === 0){
    return { text: "已取消", color:"#9ca3af" }
  }

  const total = active.length
  const ordered = active.filter(i=>i.status==="ordered").length
  const arrived = active.filter(i=>i.status==="arrived").length
  const shipped = active.filter(i=>i.status==="shipped").length

  if(shipped === total){
    return { text:"已完成寄送", color:"#22c55e" }
  }

  if(shipped > 0){
    return { text:"部分出貨", color:"#f59e0b" }
  }

  if(arrived === total){
    return { text:"已回台，等待出貨", color:"#3b82f6" }
  }

  if(arrived > 0){
    return { text:"等待商品回台", color:"#6366f1" }
  }

  if(ordered === total){
    return { text:"已下單（等待回台）", color:"#0ea5e9" }
  }

  if(ordered > 0){
    return { text:"部分已購買", color:"#06b6d4" }
  }

  return { text:"新訂單（未處理）", color:"#ef4444" }
}


// ⭐ 更新末五碼
window.updateLast5 = async function(id, value){

  const { error } = await supabase
    .from("orders")
    .update({ bank_last5: value })
    .eq("id", id)

  if(error){
    console.error(error)
  }
}

// ⭐ 更新備註
window.updateNote = async function(id, value){

  const { error } = await supabase
    .from("orders")
    .update({ note: value })
    .eq("id", id)

  if(error){
    console.error(error)
  }
}

window.updateItemStatus = async function(itemId, newStatus){

  // 1️⃣ 先拿舊資料
  const { data: oldData, error: fetchError } = await supabase
    .from("order_items")
    .select("status, order_id")
    .eq("id", itemId)
    .single()

  if(fetchError){
    console.error(fetchError)
    return
  }

  const oldStatus = oldData.status || "pending"
  const orderId = oldData.order_id

  // 2️⃣ 更新狀態
  const { error } = await supabase
    .from("order_items")
    .update({ status: newStatus })
    .eq("id", itemId)

  if(error){
    console.error(error)
    alert("更新失敗")
    return
  }

  // 3️⃣ 寫入 log
  const { data: userData } = await supabase.auth.getUser()

  await supabase.from("order_item_logs").insert({
    order_id: orderId,
    item_id: itemId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: userData.user?.id   // ⭐新增
  })

  loadOrders()
}

window.updateAdminStatus = async function(id, status){
  console.log("更新狀態:", status)
  const { data, error } = await supabase
  .from("orders")
  .update({ admin_status: status })
  .eq("id", id)
  .select()   // ⭐ 加這行（超關鍵）
  console.log("update結果:", data)
  if(error){
    console.error(error)
    alert("更新失敗")
    return
  }

  await new Promise(r => setTimeout(r, 200))
await loadOrders()
}

window.loadLogs = async function(orderId){

  const box = document.getElementById(`logs-${orderId}`)

  // ⭐ 1️⃣ 先判斷是否已開
  if(box.style.display === "block"){
    box.style.display = "none"
    return
  }

  // ⭐ 2️⃣ 再去抓資料
  const { data, error } = await supabase
    .from("order_item_logs")
    .select(`
      *,
      profiles:changed_by(name)
    `)
    .eq("order_id", orderId)
    .order("changed_at", { ascending: false })

  if(error){
    console.error(error)
    return
  }

  // ⭐ 3️⃣ 顯示
  box.style.display = "block"

  box.innerHTML = data.map(log=>{

    const name = log.profiles?.name || "未知"
    const color = getUserColor(name)

    return `
      <div style="margin-bottom:4px;">
        ${new Date(log.changed_at).toLocaleString()}：
        ${formatStatus(log.old_status)} → ${formatStatus(log.new_status)}
        <span style="color:${color};font-weight:bold;">
          （${name}）
        </span>
      </div>
    `
  }).join("")
}

window.resetOrder = async function(orderId){

  if(!confirm("確定要回復整筆訂單嗎？")) return

  const { error } = await supabase
    .from("order_items")
    .update({ status: "pending" })
    .eq("order_id", orderId)

  if(error){
    console.error(error)
    alert("回復失敗")
    return
  }

  await recalcOrder(orderId)
  loadOrders()
}

function formatStatus(s){
  return {
    pending: "未處理",
    ordered: "已購",
    arrived: "到台",
    shipped: "出貨",
    cancelled: "取消"
  }[s] || s
}

function getUserColor(name){
  return {
    "青": "#2563eb",   // 藍
    "媛媛": "#16a34a"    // 綠
  }[name] || "#6b7280"   // 預設灰
}

async function showUser(user){
  if(!user) return

  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single()

  const name = data?.name || user.email
  const color = getUserColor(name)

  const el = document.getElementById("currentUser")
  if(el){
    el.textContent = `👤 ${name}`
    el.style.color = color
    el.style.fontWeight = "bold"
  }
}