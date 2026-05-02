
import { supabase } from "./supabase.js"
import { loadAuth, bindLogout } from "./auth.js"

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

const user = await loadAuth()
if(!user) throw new Error("未登入")

bindLogout()
let overviewFilter = "all"

// ⭐ 這行你要留就留，不留也可以
showUser(user)

window.loadOrders = async function(){
  console.log("🚀 loadOrders開始")
  console.trace("loadOrders 是誰叫的")
const keyword = document.getElementById("searchInput")?.value.trim() || ""
const statusFilter = document.getElementById("statusFilter")?.value || "all"
const adminStatusFilter = document.getElementById("adminStatusFilter")?.value || "all"

  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })

  // ⭐ 搜尋
if(keyword){
  const upperKeyword = keyword.toUpperCase()

  // ⭐ UUID（系統長ID）就精準搜尋 id
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(keyword)){
    query = query.eq("id", keyword)
  }

  // ⭐ 完整漂亮訂單編號就精準搜尋 order_number
  else if(/^TB\d{8}-\d{4}$/i.test(upperKeyword)){
    query = query.eq("order_number", upperKeyword)
  }

  // ⭐ 其他才模糊搜尋
  else{
    query = query.or(
      `order_number.ilike.%${keyword}%,customer_name.ilike.%${keyword}%,phone.ilike.%${keyword}%,email.ilike.%${keyword}%`
    )
  }
}

  const { data: orders, error } = await query

if(error){
  console.error("orders error:", error)
  return
}
console.log("orders:", orders)
const newBox = document.getElementById("order-new")
const collectingBox = document.getElementById("order-collecting")
const shippingBox = document.getElementById("order-shipping")
const doneBox = document.getElementById("order-done")
const cancelledBox = document.getElementById("order-cancelled")

const countNewEl = document.getElementById("count-new")
const countCollectingEl = document.getElementById("count-collecting")
const countShippingEl = document.getElementById("count-shipping")
const countDoneEl = document.getElementById("count-done")
const countCancelledEl = document.getElementById("count-cancelled")

newBox.innerHTML = ""
collectingBox.innerHTML = ""
shippingBox.innerHTML = ""
doneBox.innerHTML = ""
cancelledBox.innerHTML = ""

let newCount = 0
let collectingCount = 0
let shippingCount = 0
let doneCount = 0
let cancelledCount = 0
let overviewUnsetCount = 0
let overviewCheckingCount = 0
let overviewSecondPaymentCount = 0
let overviewArrivedCount = 0
let overviewCancelledItemCount = 0

  for(const o of orders){

    const { data: items } = await supabase
  .from("order_items")
  .select("*")
  .eq("order_id", o.id)

const money = calcOrderMoney(o, items || [])
const statusText = calcOrderStatus(items || []).text

const hasArrivedItem = (items || []).some(i => i.status === "arrived")
const hasCancelledItem = (items || []).some(i => i.status === "cancelled")

const needSecondPaymentUnpaid =
  o.need_second_payment === true &&
  Number(o.second_payment_amount || 0) > 0 &&
  o.second_payment_status !== "paid"

// ⭐ 待處理總覽統計
if(o.admin_status === null){
  overviewUnsetCount++
}

if(o.admin_status === "checking"){
  overviewCheckingCount++
}

if(needSecondPaymentUnpaid){
  overviewSecondPaymentCount++
}

if(hasArrivedItem){
  overviewArrivedCount++
}

if(hasCancelledItem){
  overviewCancelledItemCount++
}

// ⭐ 點待處理總覽卡片後的篩選
if(overviewFilter === "unset" && o.admin_status !== null){
  continue
}

if(overviewFilter === "checking" && o.admin_status !== "checking"){
  continue
}

if(overviewFilter === "secondPayment" && !needSecondPaymentUnpaid){
  continue
}

if(overviewFilter === "arrived" && !hasArrivedItem){
  continue
}

if(overviewFilter === "cancelledItem" && !hasCancelledItem){
  continue
}


if(statusFilter !== "all"){
  if(statusFilter === "new" && !(statusText.includes("新訂單") || statusText.includes("部分已購買"))){
    continue
  }

  if(statusFilter === "collecting" && !(statusText.includes("已下單") || statusText.includes("等待商品回台"))){
    continue
  }

  if(statusFilter === "shipping" && !(statusText.includes("已回台") || statusText.includes("部分出貨"))){
    continue
  }

  if(statusFilter === "done" && !statusText.includes("已完成")){
    continue
  }

  if(statusFilter === "cancelled" && !statusText.includes("已取消")){
    continue
  }
}

const normalizedAdminStatus = o.admin_status

if(adminStatusFilter === "unset" && normalizedAdminStatus !== null){
  continue
}
if(adminStatusFilter === "checking" && normalizedAdminStatus !== "checking"){
  continue
}
if(adminStatusFilter === "paid" && normalizedAdminStatus !== "paid"){
  continue
}
if(adminStatusFilter === "hold" && normalizedAdminStatus !== "hold"){
  continue
}

    const div = document.createElement("div")
    div.className = "order-card"

    div.innerHTML = `
    <div class="order-summary toggle-btn" data-id="${escapeHtml(o.id)}">

  <div style="
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:10px;
  ">

    <!-- 左 -->
    <div>
     <div style="font-weight:bold;">
  🧾 🧾 ${escapeHtml(o.customer_name)}
  <span style="color:#6b7280;margin-left:6px;">
    $${money.totalAmount}
  </span>
</div>

<div style="font-size:13px;color:#f97316;margin-top:4px;font-weight:700;">
  訂單編號：${escapeHtml(o.order_number || o.id)}
</div>

     <div style="font-size:14px;color:#6b7280;margin-top:4px;font-weight:500;">
${
  o.bank_last5
  ? `<span style="margin-left:8px;">末五碼:${escapeHtml(o.bank_last5)}</span>`
  : ""
}

${
  o.shipping_method
  ? `<span style="margin-left:8px;">🚚 ${escapeHtml(o.shipping_method)}</span>`
  : ""
}

${
  o.shipping_method === "交貨便"
  ? `<span style="margin-left:8px;color:${money.shippingFeeMode === "cap100" ? "#16a34a" : "#ea580c"};font-weight:700;">
       ${money.shippingFeeMode === "cap100" ? "不累加" : "有累加"}
     </span>`
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
  o.need_second_payment && Number(o.second_payment_amount || 0) > 0
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
<b>訂單編號：</b>${escapeHtml(o.order_number || "-")}<br>
<b>系統ID：</b>${escapeHtml(o.id || "-")}<br>
<b>本名：</b>${escapeHtml(o.customer_name || "-")}<br>
<b>電話：</b>${escapeHtml(o.phone || "-")}<br>
<b>Email：</b>${escapeHtml(o.email || "-")}<br>
<b>社群名字：</b>${escapeHtml(o.community_name || "-")}<br>
<b>聯繫方式：</b>${escapeHtml(o.contact_method || "-")}<br>
<b>聯繫帳號：</b>${escapeHtml(o.contact_account || "-")}<br>
<b>預計匯款時間：</b>${escapeHtml(o.expected_remit_time || "-")}<br>
<b>時間：</b>${new Date(o.created_at).toLocaleString()}<br><br>

<b>運送方式：</b>${escapeHtml(o.shipping_method || "-")}<br>
${
  o.shipping_method === "交貨便"
    ? `
    <b>收件本名：</b>${escapeHtml(o.receiver_name || "-")}<br>
<b>收件電話：</b>${escapeHtml(o.receiver_phone || "-")}<br>
<b>7-11 門市：</b>${escapeHtml(o.store_name || "-")}<br>
<b>7-11 店號：</b>${escapeHtml(o.store_code || "-")}<br><br>
    `
    : "<br>"
}

        <b>管理狀態：</b>
<select class="admin-status-select" data-id="${escapeHtml(o.id)}">
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


<div style="margin-top:8px;font-size:14px;line-height:1.8;">
  <div>補款狀態：<b>${formatSecondPaymentStatus(o.second_payment_status)}</b></div>
  <div>補款末五碼：${escapeHtml(o.second_payment_last5 || "-")}</div>
<div>補款時間：${escapeHtml(o.second_payment_time || "-")}</div>
<div>補款備註：${escapeHtml(o.second_payment_note || "-")}</div>
</div>

${
  o.second_payment_status === "submitted"
    ? `
      <button
        onclick="confirmSecondPayment('${o.id}')"
        style="margin-top:10px;background:#16a34a;color:white;border:none;padding:8px 12px;border-radius:8px;"
      >
        ✅ 確認補款完成
      </button>
    `
    : ""
}


<div style="margin-top:4px;">
  補款金額：
  <input type="number"
    value="${Number(o.second_payment_amount || 0)}"
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
                - ${escapeHtml(i.product_name)} / ${escapeHtml(i.variant_name)}
                x ${i.quantity} ($${i.price})
              </div>
        
<button
  data-item-id="${escapeHtml(i.id)}"
  data-status="pending"
  class="status-btn"
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
                  data-item-id="${escapeHtml(i.id)}"
data-status="ordered"
class="status-btn"
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
  data-item-id="${escapeHtml(i.id)}"
  data-status="arrived"
  class="status-btn"
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
  data-item-id="${escapeHtml(i.id)}"
  data-status="shipped"
  class="status-btn"
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

${
  o.shipping_method === "交貨便"
    ? `
      <div style="margin-bottom:4px;">
        運費模式：
        <span style="font-weight:bold;color:${money.shippingFeeMode === "cap100" ? "#16a34a" : "#ea580c"};">
          ${money.shippingFeeMode === "cap100" ? "最高只收100（不累加）" : "超過5000分段累加，分兩單寄送"}
        </span>
      </div>
    `
    : ""
}

<div style="margin-bottom:4px;">
  本次已收：
  <span style="font-weight:bold;color:#2563eb;">
    $${money.totalAmount}
  </span>
</div>

${
  o.need_second_payment && Number(o.second_payment_amount || 0) > 0
    ? `
      <div style="margin-bottom:4px;">
        應補款：
        <span style="font-weight:bold;color:#dc2626;">
          $${Number(o.second_payment_amount || 0)}
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
      ? `<span style="font-weight:bold;color:#2563eb;">${escapeHtml(o.bank_last5)}</span>`
      : `<span style="color:#999;">尚未填寫</span>`
    }
  </div>

  <div style="margin-bottom:4px;">
    預計匯款時間：
    ${
      o.expected_remit_time
      ? `<span style="font-weight:bold;color:#2563eb;">${escapeHtml(o.expected_remit_time)}</span>`
      : `<span style="color:#999;">尚未填寫</span>`
    }
  </div>

  <div>
    備註：
    <input type="text"
      value="${escapeHtml(o.note || "")}"
      style="width:100%"
      onchange="updateNote('${o.id}', this.value)">
  </div>

</div>


      <hr>
    `
const toggleEl = div.querySelector(".toggle-btn")
if(toggleEl){
  toggleEl.addEventListener("click", ()=>{
    toggleDetail(o.id)
  })
}

div.querySelectorAll(".status-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    updateItemStatus(
      btn.dataset.itemId,
      btn.dataset.status
    )
  })
})

div.querySelectorAll(".admin-status-select").forEach(sel=>{
  sel.addEventListener("change", ()=>{
    updateAdminStatus(sel.dataset.id, sel.value)
  })
})
    // ⭐ 分類
   const s = statusText

if(s.includes("已取消")){
  cancelledBox.appendChild(div)
  cancelledCount++
}
else if(s.includes("新訂單") || s.includes("部分已購買")){
  newBox.appendChild(div)
  newCount++
}
else if(s.includes("已下單") || s.includes("等待商品回台")){
  collectingBox.appendChild(div)
  collectingCount++
}
else if(s.includes("已回台") || s.includes("部分出貨")){
  shippingBox.appendChild(div)
  shippingCount++
}
else if(s.includes("已完成")){
  doneBox.appendChild(div)
  doneCount++
}
else {
  newBox.appendChild(div)
  newCount++
}

if(countNewEl) countNewEl.textContent = newCount
if(countCollectingEl) countCollectingEl.textContent = collectingCount
if(countShippingEl) countShippingEl.textContent = shippingCount
if(countDoneEl) countDoneEl.textContent = doneCount
if(countCancelledEl) countCancelledEl.textContent = cancelledCount

}

// ⭐ 更新待處理總覽數字
const overviewUnsetEl = document.getElementById("overview-unset")
const overviewCheckingEl = document.getElementById("overview-checking")
const overviewSecondPaymentEl = document.getElementById("overview-second-payment")
const overviewArrivedEl = document.getElementById("overview-arrived")
const overviewCancelledItemEl = document.getElementById("overview-cancelled-item")

if(overviewUnsetEl) overviewUnsetEl.textContent = overviewUnsetCount
if(overviewCheckingEl) overviewCheckingEl.textContent = overviewCheckingCount
if(overviewSecondPaymentEl) overviewSecondPaymentEl.textContent = overviewSecondPaymentCount
if(overviewArrivedEl) overviewArrivedEl.textContent = overviewArrivedCount
if(overviewCancelledItemEl) overviewCancelledItemEl.textContent = overviewCancelledItemCount

}

// ⭐ 展開
window.toggleDetail = function(id){
  const el = document.getElementById(`detail-${id}`)
  el.style.display = el.style.display === "none" ? "block" : "none"
}

// ⭐ 一鍵全部展開
window.expandAllOrders = function(){
  document.querySelectorAll(".order-detail").forEach(el => {
    el.style.display = "block"
  })
}

// ⭐ 一鍵全部收合
window.collapseAllOrders = function(){
  document.querySelectorAll(".order-detail").forEach(el => {
    el.style.display = "none"
  })
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
    alert("二補開關更新失敗")
    return
  }

  await recalcOrder(id)
  alert("二補狀態已更新，畫面未重整，請手動F5查看")
}

// ⭐ 補款金額
window.updateSecondAmount = async function(id, value){

  const { error } = await supabase
    .from("orders")
    .update({ second_payment_amount: Number(value) })
    .eq("id", id)

  if(error){
    console.error(error)
    alert("補款金額更新失敗")
    return
  }

  alert("補款金額已更新，畫面未重整，請手動F5查看")
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
  alert("已取消商品，畫面未重整，請手動F5查看")
}
}

function getC2CBaseFee(amount){
  const total = Number(amount || 0)

  if(total <= 0){
    return 0
  }else if(total <= 1000){
    return 60
  }else if(total < 2000){
    return 70
  }else if(total <= 3000){
    return 80
  }else if(total <= 4000){
    return 90
  }else{
    return 100
  }
}

function calcC2CShippingFee(totalAmount, feeMode = "split"){
  const total = Number(totalAmount || 0)

  if(total <= 0) return 0

  if(feeMode === "cap100"){
    return getC2CBaseFee(Math.min(total, 5000))
  }

  let remaining = total
  let fee = 0

  while(remaining > 0){
    const chunk = Math.min(remaining, 5000)
    fee += getC2CBaseFee(chunk)
    remaining -= chunk
  }

  return fee
}

function getShippingFeeModeText(mode){
  return mode === "cap100" ? "最高100" : "分段累加"
}

function calcOrderMoney(order, items){
  const activeItems = items.filter(i => i.status !== "cancelled")

  const originalItemsTotal = activeItems.reduce((sum, i) => {
    return sum + Number(i.price || 0) * Number(i.quantity || 1)
  }, 0)

  const shippingFeeMode = order.shipping_fee_mode || "split"

const shippingFee = order.shipping_method === "交貨便"
  ? calcC2CShippingFee(originalItemsTotal, shippingFeeMode)
  : 0

  const isDepositOrder = !!order.is_deposit_order
  const needSecondPayment = !!order.need_second_payment

  const finalFullAmount = originalItemsTotal + shippingFee

  let firstCharge = 0
  let secondPaymentAmount = 0
  let refundAmount = 0
  let totalAmount = 0

if(isDepositOrder){
  firstCharge = Number(order.total_amount ?? 500)
  secondPaymentAmount = needSecondPayment
    ? Number(order.second_payment_amount ?? Math.max(finalFullAmount - firstCharge, 0))
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
    shippingFeeMode,
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
    .select(`
      id,
      shipping_method,
      shipping_fee_mode,
      need_second_payment,
      is_deposit_order,
      total_amount,
      second_payment_amount,
      refund_amount
    `)
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

  const activeItems = (items || []).filter(i => i.status !== "cancelled")

  const originalItemsTotal = activeItems.reduce((sum, i) => {
    return sum + Number(i.price || 0) * Number(i.quantity || 1)
  }, 0)

  const shippingFeeMode = order.shipping_fee_mode || "split"

  const shippingFee = order.shipping_method === "交貨便"
    ? calcC2CShippingFee(originalItemsTotal, shippingFeeMode)
    : 0

  const finalFullAmount = originalItemsTotal + shippingFee

  const alreadyPaid = Number(order.total_amount || 0)

  const needPayNow = Math.max(finalFullAmount - alreadyPaid, 0)
  const refundAmount = Math.max(alreadyPaid - finalFullAmount, 0)

  const updateData = {
    second_payment_amount: needPayNow,
    refund_amount: refundAmount,
    need_second_payment: needPayNow > 0,
    second_payment_status: needPayNow > 0 ? "unpaid" : "paid"
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(updateData)
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

  const { error } = await supabase
    .from("order_items")
    .update({ status: newStatus })
    .eq("id", itemId)

  if(error){
    console.error(error)
    alert("更新失敗")
    return
  }

  const { data: userData } = await supabase.auth.getUser()

  await supabase.from("order_item_logs").insert({
    order_id: orderId,
    item_id: itemId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: userData.user?.id
  })

  alert("商品狀態已更新，畫面未重整，請手動F5查看最新結果")
}

window.updateAdminStatus = async function(id, status){
  console.log("更新狀態:", status)

  const { data, error } = await supabase
    .from("orders")
    .update({
      admin_status: status || null
    })
    .eq("id", id)
    .select()

  console.log("update結果:", data)

  if(error){
    console.error(error)
    alert("更新失敗")
    return
  }

  console.log("管理狀態已更新")
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
          （${escapeHtml(name)}）
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
alert("整筆訂單已回復，畫面未重整，請手動F5查看")
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

window.loadOrders()

function formatSecondPaymentStatus(status){
  return {
    unpaid: "尚未補款",
    submitted: "已送出，等待確認",
    paid: "補款完成"
  }[status] || "尚未補款"
}

window.confirmSecondPayment = async function(orderId){

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("total_amount, second_payment_amount")
    .eq("id", orderId)
    .single()

  if(fetchError || !order){
    console.error(fetchError)
    alert("讀取訂單失敗")
    return
  }

  const currentTotal = Number(order.total_amount || 0)
  const secondAmount = Number(order.second_payment_amount || 0)

  const { error } = await supabase
    .from("orders")
    .update({
      total_amount: currentTotal + secondAmount,
      need_second_payment: false,
      second_payment_status: "paid",
      second_payment_confirmed_at: new Date().toISOString()
    })
    .eq("id", orderId)

  if(error){
    console.error(error)
    alert("確認補款失敗")
    return
  }

  alert("已確認補款完成，畫面未重整，請手動F5查看")
}

window.exportShippingList = async function(){

  // 1️⃣ 先抓所有訂單（照送單時間）
  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      customer_name,
      phone,
      email,
      shipping_method,
      receiver_name,
      receiver_phone,
      store_name,
      store_code,
      note,
      created_at
    `)
    .order("created_at", { ascending: true })

  if(orderError){
    console.error(orderError)
    alert("訂單讀取失敗")
    return
  }

  // 2️⃣ 再抓所有待出貨商品
  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .select(`
      id,
      order_id,
      product_name,
      variant_name,
      quantity,
      price,
      status
    `)
    .eq("status", "arrived")

  if(itemError){
    console.error(itemError)
    alert("商品讀取失敗")
    return
  }

  if(!orders || !items || items.length === 0){
    alert("目前沒有待出貨商品")
    return
  }

  // 3️⃣ 建立訂單對照表
  const orderMap = {}
  for(const o of orders){
    orderMap[o.id] = o
  }

  // 4️⃣ 組成匯出資料
const rows = items
  .filter(i => orderMap[i.order_id])
  .map(i => {
    const o = orderMap[i.order_id]

    const customerName = (o.customer_name || "").trim()
    const phone = (o.phone || "").trim()
    const email = (o.email || "").trim().toLowerCase()

    // ⭐ 分組key：優先用 電話+Email，其次電話，其次Email，最後才姓名
    const groupKey =
      phone && email ? `${phone}__${email}` :
      phone ? `phone__${phone}` :
      email ? `email__${email}` :
      `name__${customerName}`

    return {
      _groupKey: groupKey,
      _createdAt: o.created_at || "",
      "送單時間": new Date(o.created_at).toLocaleString(),
      "訂單編號": o.order_number || o.id,
      "客人姓名": customerName,
      "電話": phone,
      "Email": email,
      "運送方式": o.shipping_method || "",
      "收件人": o.receiver_name || "",
      "收件電話": o.receiver_phone || "",
      "門市名稱": o.store_name || "",
      "店號": o.store_code || "",
      "商品名稱": i.product_name || "",
      "規格": i.variant_name || "",
      "數量": i.quantity || 0,
      "單價": i.price || 0,
      "訂單備註": o.note || ""
    }
  })

  if(rows.length === 0){
    alert("目前沒有待出貨商品")
    return
  }

rows.sort((a, b) => {
  // 1️⃣ 先讓同客人排一起
  const keyCompare = a._groupKey.localeCompare(b._groupKey, "zh-Hant")
  if(keyCompare !== 0) return keyCompare

  // 2️⃣ 同客人內，再照送單時間早到晚
  const timeCompare = String(a._createdAt).localeCompare(String(b._createdAt))
  if(timeCompare !== 0) return timeCompare

  // 3️⃣ 同時間再用訂單編號補排序，避免順序飄
  return String(a["訂單編號"]).localeCompare(String(b["訂單編號"]))
})

  // 5️⃣ 轉 CSV
  const headers = Object.keys(rows[0]).filter(key => !key.startsWith("_"))

  const csv = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(key => {
        const value = String(row[key] ?? "")
          .replaceAll('"', '""')
        return `"${value}"`
      }).join(",")
    )
  ].join("\n")

  // 6️⃣ 下載
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `待出貨清單_${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

window.exportPurchasedAndCancelledList = async function(){

  // 1️⃣ 抓所有訂單
  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      customer_name,
      phone,
      email,
      shipping_method,
      note,
      created_at
    `)
    .order("created_at", { ascending: true })

  if(orderError){
    console.error(orderError)
    alert("訂單讀取失敗")
    return
  }

  // 2️⃣ 抓已購買 + 已取消商品
  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .select(`
      id,
      order_id,
      product_name,
      variant_name,
      quantity,
      price,
      status
    `)
    .in("status", ["ordered", "cancelled"])
    .order("order_id", { ascending: true })

  if(itemError){
    console.error(itemError)
    alert("商品讀取失敗")
    return
  }

  if(!orders || !items || items.length === 0){
    alert("目前沒有已購買或已取消商品")
    return
  }

  // 3️⃣ 建立訂單對照表
  const orderMap = {}
  for(const o of orders){
    orderMap[o.id] = o
  }

  // 4️⃣ 組成匯出資料
  const rows = items
    .filter(i => orderMap[i.order_id])
    .map(i => {
      const o = orderMap[i.order_id]

      const customerName = (o.customer_name || "").trim()
      const phone = (o.phone || "").trim()
      const email = (o.email || "").trim().toLowerCase()

      const groupKey =
        phone && email ? `${phone}__${email}` :
        phone ? `phone__${phone}` :
        email ? `email__${email}` :
        `name__${customerName}`

      return {
        _groupKey: groupKey,
        _createdAt: o.created_at || "",
        _statusSort: i.status === "ordered" ? 0 : 1,

        "送單時間": new Date(o.created_at).toLocaleString(),
        "訂單編號": o.order_number || o.id,
        "客人姓名": customerName,
        "電話": phone,
        "Email": email,
        "運送方式": o.shipping_method || "",
        "商品名稱": i.product_name || "",
        "規格": i.variant_name || "",
        "數量": i.quantity || 0,
        "單價": i.price || 0,
        "商品狀態": i.status === "ordered" ? "已購" : "已取消",
        "訂單備註": o.note || ""
      }
    })

  if(rows.length === 0){
    alert("目前沒有已購買或已取消商品")
    return
  }

  // 5️⃣ 排序
  rows.sort((a, b) => {
    const keyCompare = a._groupKey.localeCompare(b._groupKey, "zh-Hant")
    if(keyCompare !== 0) return keyCompare

    const timeCompare = String(a._createdAt).localeCompare(String(b._createdAt))
    if(timeCompare !== 0) return timeCompare

    const statusCompare = a._statusSort - b._statusSort
    if(statusCompare !== 0) return statusCompare

    return String(a["訂單編號"]).localeCompare(String(b["訂單編號"]))
  })

  // 6️⃣ 轉 CSV
  const headers = Object.keys(rows[0]).filter(key => !key.startsWith("_"))

  const csv = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(key => {
        const value = String(row[key] ?? "").replaceAll('"', '""')
        return `"${value}"`
      }).join(",")
    )
  ].join("\n")

  // 7️⃣ 下載
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `已購已取消清單_${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

window.exportPendingManagementList = async function(){

  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      customer_name,
      phone,
      email,
      community_name,
      contact_method,
      contact_account,
      admin_status,
      need_second_payment,
      second_payment_status,
      second_payment_amount,
      second_payment_last5,
      second_payment_time,
      bank_last5,
      expected_remit_time,
      shipping_method,
      note,
      created_at
    `)
    .order("created_at", { ascending: true })

  if(error){
    console.error(error)
    alert("訂單讀取失敗")
    return
  }

  const rows = (orders || [])
    .filter(o => {
      const isAdminUnset = !o.admin_status
      const isChecking = o.admin_status === "checking"

      const needSecondPaymentUnpaid =
        o.need_second_payment === true &&
        Number(o.second_payment_amount || 0) > 0 &&
        o.second_payment_status !== "paid"

      return isAdminUnset || isChecking || needSecondPaymentUnpaid
    })
    .map(o => {

      const adminStatusText = {
        checking: "等待對帳",
        paid: "對帳完成",
        hold: "暫停處理"
      }[o.admin_status] || "未設定"

      const needSecondPaymentUnpaid =
        o.need_second_payment === true &&
        Number(o.second_payment_amount || 0) > 0 &&
        o.second_payment_status !== "paid"

      const pendingReasons = []

      if(!o.admin_status){
        pendingReasons.push("管理狀態未設定")
      }

      if(o.admin_status === "checking"){
        pendingReasons.push("等待對帳")
      }

      if(needSecondPaymentUnpaid){
        pendingReasons.push("需要補款未完成")
      }

      const secondPaymentStatusText = {
        unpaid: "尚未補款",
        submitted: "已送出，等待確認",
        paid: "補款完成"
      }[o.second_payment_status] || "尚未補款"

      return {
        _createdAt: o.created_at || "",

        "送單時間": new Date(o.created_at).toLocaleString(),
        "訂單編號": o.order_number || o.id,
        "待處理原因": pendingReasons.join(" / "),
        "管理狀態": adminStatusText,

        "客人姓名": o.customer_name || "",
        "電話": o.phone || "",
        "Email": o.email || "",
        "社群名字": o.community_name || "",
        "聯繫方式": o.contact_method || "",
        "聯繫帳號": o.contact_account || "",

        "原匯款末五碼": o.bank_last5 || "",
        "預計匯款時間": o.expected_remit_time || "",

        "是否需補款": o.need_second_payment ? "是" : "否",
        "補款金額": Number(o.second_payment_amount || 0),
        "補款狀態": secondPaymentStatusText,
        "補款末五碼": o.second_payment_last5 || "",
        "補款時間": o.second_payment_time || "",

        "運送方式": o.shipping_method || "",
        "訂單備註": o.note || ""
      }
    })

  if(rows.length === 0){
    alert("目前沒有待處理名單")
    return
  }

  rows.sort((a, b) => {
    return String(a._createdAt).localeCompare(String(b._createdAt))
  })

  const headers = Object.keys(rows[0]).filter(key => !key.startsWith("_"))

  const csv = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(key => {
        const value = String(row[key] ?? "")
          .replaceAll('"', '""')
        return `"${value}"`
      }).join(",")
    )
  ].join("\n")

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")

  a.href = url
  a.download = `待處理名單_${new Date().toISOString().slice(0,10)}.csv`

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

window.filterPendingOverview = function(type){
  overviewFilter = type

  const statusFilter = document.getElementById("statusFilter")
  const adminStatusFilter = document.getElementById("adminStatusFilter")

  if(statusFilter){
    statusFilter.value = "all"
  }

  if(adminStatusFilter){
    adminStatusFilter.value = "all"
  }

  if(type === "unset" && adminStatusFilter){
    adminStatusFilter.value = "unset"
  }

  if(type === "checking" && adminStatusFilter){
    adminStatusFilter.value = "checking"
  }

  loadOrders()
}