import { supabase } from "./supabase.js"
import { loadAuth, bindLogout } from "./auth.js"

const ALLOW_USER_IDS = [
  "6dfc15fc-dacc-4515-ae56-49a8722fe534",
  "fa754f11-9a7e-4ced-8cbb-da30f01292e0"
]

const user = await loadAuth()
if(!user) throw new Error("未登入")

if(!ALLOW_USER_IDS.includes(user.id)){
  alert("你沒有權限進入此頁")
  window.location.href = "./admin-orders.html"
  throw new Error("無權限")
}

bindLogout()
showUser(user)

const statsTableBody = document.getElementById("statsTableBody")
const purchaseLogList = document.getElementById("purchaseLogList")
const startDateInput = document.getElementById("startDate")
const endDateInput = document.getElementById("endDate")
const keywordInput = document.getElementById("keywordInput")
const sortSelect = document.getElementById("sortSelect")

document.getElementById("searchBtn").addEventListener("click", loadStats)
document.getElementById("resetBtn").addEventListener("click", resetFilters)

setDefaultDates()
await loadStats()

function setDefaultDates(){
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

  startDateInput.value = formatDateInput(firstDay)
  endDateInput.value = formatDateInput(today)
}

function formatDateInput(date){
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function escapeAttr(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function buildKey(productName, variantName){
  return `${productName || ""}|||${variantName || ""}`
}

function parseKey(key){
  const [product_name, variant_name] = key.split("|||")
  return {
    product_name: product_name || "",
    variant_name: variant_name || ""
  }
}

function calcSuccessRate(demandQty, purchasedQty){
  if(!demandQty || demandQty <= 0) return 0
  return Math.min((Number(purchasedQty || 0) / Number(demandQty || 0)) * 100, 100)
}

function resetFilters(){
  setDefaultDates()
  keywordInput.value = ""
  sortSelect.value = "demand_desc"
  loadStats()
}

async function loadStats(){
  const startDate = startDateInput.value
  const endDate = endDateInput.value
  const keyword = keywordInput.value.trim().toLowerCase()
  const sortType = sortSelect.value

  if(!startDate || !endDate){
    alert("請先選擇開始與結束日期")
    return
  }

  if(startDate > endDate){
    alert("開始日期不能大於結束日期")
    return
  }

  statsTableBody.innerHTML = `<tr><td colspan="9" class="empty-cell">讀取中...</td></tr>`
  purchaseLogList.innerHTML = `<div class="empty-log">讀取中...</div>`

  const startDateTime = `${startDate}T00:00:00`
  const endDateTime = `${endDate}T23:59:59`

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, created_at")
    .gte("created_at", startDateTime)
    .lte("created_at", endDateTime)
    .order("created_at", { ascending: false })

  if(ordersError){
    console.error("ordersError:", ordersError)
    statsTableBody.innerHTML = `<tr><td colspan="9" class="empty-cell">訂單讀取失敗</td></tr>`
    return
  }

  const orderIds = (orders || []).map(o => o.id)

  let orderItems = []

  if(orderIds.length > 0){
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("id, order_id, product_name, variant_name, quantity, status")
      .in("order_id", orderIds)

    if(itemsError){
      console.error("itemsError:", itemsError)
      statsTableBody.innerHTML = `<tr><td colspan="9" class="empty-cell">訂單商品讀取失敗</td></tr>`
      return
    }

    orderItems = items || []
  }

  const { data: purchaseRecords, error: purchaseError } = await supabase
    .from("product_purchase_records")
    .select("*")
    .gte("purchase_date", startDate)
    .lte("purchase_date", endDate)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })

  if(purchaseError){
    console.error("purchaseError:", purchaseError)
    statsTableBody.innerHTML = `<tr><td colspan="9" class="empty-cell">購入紀錄讀取失敗</td></tr>`
    return
  }

  const validOrderItems = orderItems.filter(item => item.status !== "cancelled")

  const demandMap = new Map()
  for(const item of validOrderItems){
    const productName = item.product_name || "未命名商品"
    const variantName = item.variant_name || ""
    const key = buildKey(productName, variantName)
    const qty = Number(item.quantity || 0)

    if(!demandMap.has(key)){
      demandMap.set(key, {
        product_name: productName,
        variant_name: variantName,
        demand_qty: 0,
        purchased_qty: 0
      })
    }

    demandMap.get(key).demand_qty += qty
  }

  const purchaseMap = new Map()
  for(const record of (purchaseRecords || [])){
    const productName = record.product_name || "未命名商品"
    const variantName = record.variant_name || ""
    const key = buildKey(productName, variantName)
    const qty = Number(record.purchased_qty || 0)

    if(!purchaseMap.has(key)){
      purchaseMap.set(key, 0)
    }

    purchaseMap.set(key, purchaseMap.get(key) + qty)
  }

  for(const [key, row] of demandMap.entries()){
    row.purchased_qty = Number(purchaseMap.get(key) || 0)
  }

  let rows = Array.from(demandMap.values()).map(row => {
    const remaining_qty = Math.max(Number(row.demand_qty || 0) - Number(row.purchased_qty || 0), 0)
    const success_rate = calcSuccessRate(row.demand_qty, row.purchased_qty)

    return {
      ...row,
      remaining_qty,
      success_rate
    }
  })

  if(keyword){
    rows = rows.filter(row => {
      return (
        row.product_name.toLowerCase().includes(keyword) ||
        row.variant_name.toLowerCase().includes(keyword)
      )
    })
  }

  rows = sortRows(rows, sortType)

  renderSummary(rows)
  renderTable(rows)
  renderPurchaseLogs(purchaseRecords || [], keyword)
}

function sortRows(rows, sortType){
  const list = [...rows]

  switch(sortType){
    case "remaining_desc":
      return list.sort((a, b) => b.remaining_qty - a.remaining_qty)

    case "success_asc":
      return list.sort((a, b) => a.success_rate - b.success_rate)

    case "success_desc":
      return list.sort((a, b) => b.success_rate - a.success_rate)

    case "name_asc":
      return list.sort((a, b) => {
        const aText = `${a.product_name} ${a.variant_name}`.trim()
        const bText = `${b.product_name} ${b.variant_name}`.trim()
        return aText.localeCompare(bText, "zh-Hant")
      })

    case "demand_desc":
    default:
      return list.sort((a, b) => b.demand_qty - a.demand_qty)
  }
}

function renderSummary(rows){
  const totalDemand = rows.reduce((sum, row) => sum + Number(row.demand_qty || 0), 0)
  const totalPurchased = rows.reduce((sum, row) => sum + Number(row.purchased_qty || 0), 0)
  const totalRemaining = rows.reduce((sum, row) => sum + Number(row.remaining_qty || 0), 0)
  const overallRate = totalDemand > 0 ? Math.min((totalPurchased / totalDemand) * 100, 100) : 0

  document.getElementById("totalDemand").textContent = totalDemand
  document.getElementById("totalPurchased").textContent = totalPurchased
  document.getElementById("totalRemaining").textContent = totalRemaining
  document.getElementById("overallSuccessRate").textContent = `${overallRate.toFixed(1)}%`
}

function renderTable(rows){
  if(!rows.length){
    statsTableBody.innerHTML = `<tr><td colspan="9" class="empty-cell">這段時間沒有可統計的商品</td></tr>`
    return
  }

  statsTableBody.innerHTML = rows.map((row, index) => {
    const key = buildKey(row.product_name, row.variant_name)

    let badgeClass = "rate-badge danger"
    if(row.success_rate >= 100){
      badgeClass = "rate-badge success"
    }else if(row.success_rate >= 50){
      badgeClass = "rate-badge warning"
    }

    return `
      <tr>
        <td>${escapeHtml(row.product_name)}</td>
        <td>${escapeHtml(row.variant_name || "-")}</td>
        <td>${row.demand_qty}</td>
        <td>${row.purchased_qty}</td>
        <td class="${row.remaining_qty > 0 ? "text-danger" : "text-success"}">${row.remaining_qty}</td>
        <td><span class="${badgeClass}">${row.success_rate.toFixed(1)}%</span></td>
        <td>
          <input
            type="number"
            min="1"
            class="inline-input"
            id="purchaseQty-${index}"
            placeholder="數量"
          >
        </td>
        <td>
          <input
            type="text"
            class="inline-input"
            id="purchaseNote-${index}"
            placeholder="備註（可不填）"
          >
        </td>
        <td>
          <button class="btn-small" onclick="savePurchaseRecord('${encodeURIComponent(key)}', ${index})">
            記錄購入
          </button>
        </td>
      </tr>
    `
  }).join("")
}

function renderPurchaseLogs(records, keyword = ""){
  let rows = [...records]

  if(keyword){
    rows = rows.filter(record => {
      const productName = String(record.product_name || "").toLowerCase()
      const variantName = String(record.variant_name || "").toLowerCase()
      return productName.includes(keyword) || variantName.includes(keyword)
    })
  }

  if(!rows.length){
    purchaseLogList.innerHTML = `<div class="empty-log">尚無購入紀錄</div>`
    return
  }

purchaseLogList.innerHTML = rows.map(record => `
  <div class="purchase-log-card">
    <div class="purchase-log-main">
      <div class="purchase-title">
        ${escapeHtml(record.product_name)}
        <span class="purchase-variant">${escapeHtml(record.variant_name || "-")}</span>
      </div>
      <div class="purchase-meta">
        <span>購入數量：<b>${record.purchased_qty}</b></span>
        <span>日期：<b>${record.purchase_date}</b></span>
        <span>備註：<b>${escapeHtml(record.note || "-")}</b></span>
      </div>
    </div>

    <div class="purchase-actions">
      <button
        class="btn-small"
        onclick="openEditPurchaseRecord(
          '${record.id}',
          '${escapeAttr(record.product_name)}',
          '${escapeAttr(record.variant_name || "")}',
          ${record.purchased_qty},
          '${record.purchase_date}',
          '${escapeAttr(record.note || "")}'
        )"
      >
        編輯
      </button>

      <button class="btn-danger-small" onclick="deletePurchaseRecord('${record.id}')">刪除</button>
    </div>
  </div>
`).join("")
}

window.savePurchaseRecord = async function(encodedKey, index){
  const key = decodeURIComponent(encodedKey)
  const { product_name, variant_name } = parseKey(key)

  const qtyInput = document.getElementById(`purchaseQty-${index}`)
  const noteInput = document.getElementById(`purchaseNote-${index}`)

  const qty = Number(qtyInput.value || 0)
  const note = noteInput.value.trim()

  if(!qty || qty <= 0){
    alert("請輸入正確的購入數量")
    return
  }

  const { error } = await supabase
    .from("product_purchase_records")
    .insert({
      product_name,
      variant_name,
      purchased_qty: qty,
      purchase_date: formatDateInput(new Date()),
      note,
      created_by: user.id,
      updated_by: user.id
    })

  if(error){
    console.error(error)
    alert("購入紀錄新增失敗")
    return
  }

  qtyInput.value = ""
  noteInput.value = ""
  await loadStats()
}

window.deletePurchaseRecord = async function(id){
  if(!confirm("確定要刪除這筆購入紀錄嗎？")) return

  const { error } = await supabase
    .from("product_purchase_records")
    .delete()
    .eq("id", id)

  if(error){
    console.error(error)
    alert("刪除失敗")
    return
  }

  await loadStats()
}

window.openEditPurchaseRecord = function(id, productName, variantName, qty, purchaseDate, note){
  const newQty = prompt(
    `編輯購入數量\n商品：${productName} ${variantName ? "/ " + variantName : ""}`,
    qty
  )

  if(newQty === null) return

  const qtyNumber = Number(newQty)
  if(!qtyNumber || qtyNumber <= 0){
    alert("購入數量必須大於 0")
    return
  }

  const newDate = prompt("編輯購入日期（格式：YYYY-MM-DD）", purchaseDate)
  if(newDate === null) return

  if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate)){
    alert("日期格式錯誤，請輸入 YYYY-MM-DD")
    return
  }

  const newNote = prompt("編輯備註", note || "")
  if(newNote === null) return

  updatePurchaseRecord(id, qtyNumber, newDate, newNote)
}

async function updatePurchaseRecord(id, qty, purchaseDate, note){
  const { error } = await supabase
    .from("product_purchase_records")
    .update({
      purchased_qty: qty,
      purchase_date: purchaseDate,
      note: note,
      updated_by: user.id
    })
    .eq("id", id)

  if(error){
    console.error(error)
    alert("編輯失敗")
    return
  }

  alert("已更新購入紀錄")
  await loadStats()
}


function getUserColor(name){
  return {
    "青": "#2563eb",
    "媛媛": "#16a34a"
  }[name] || "#6b7280"
}

async function showUser(user){
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