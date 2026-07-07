import { supabase } from "./supabase.js"

let allBatches = []
let products = []
let isSaving = false

const els = {
  openCreateBtn: document.getElementById("openCreateBtn"),
  reloadBtn: document.getElementById("reloadBtn"),

  filterMonth: document.getElementById("filterMonth"),
  filterBank: document.getElementById("filterBank"),
  filterStatus: document.getElementById("filterStatus"),
  filterKeyword: document.getElementById("filterKeyword"),

  summaryCount: document.getElementById("summaryCount"),
  summaryOriginalAmount: document.getElementById("summaryOriginalAmount"),
  summaryCardAmount: document.getElementById("summaryCardAmount"),
  summaryCardFee: document.getElementById("summaryCardFee"),
  bankSummaryList: document.getElementById("bankSummaryList"),

  purchaseTbody: document.getElementById("purchaseTbody"),

  batchModal: document.getElementById("batchModal"),
  modalTitle: document.getElementById("modalTitle"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  cancelModalBtn: document.getElementById("cancelModalBtn"),
  batchForm: document.getElementById("batchForm"),

  batchId: document.getElementById("batchId"),
productId: document.getElementById("productId"),
purchaseSource: document.getElementById("purchaseSource"),

purchaseDate: document.getElementById("purchaseDate"),
bankName: document.getElementById("bankName"),
cardName: document.getElementById("cardName"),
cardHolder: document.getElementById("cardHolder"),
currency: document.getElementById("currency"),

  originalOrderAmount: document.getElementById("originalOrderAmount"),
  cardAmount: document.getElementById("cardAmount"),
  cardFee: document.getElementById("cardFee"),

  officialOrderNo: document.getElementById("officialOrderNo"),
  trackingNo: document.getElementById("trackingNo"),
  expectedShipMonth: document.getElementById("expectedShipMonth"),
  warehouseArrivedAt: document.getElementById("warehouseArrivedAt"),
  returnToTaiwanDate: document.getElementById("returnToTaiwanDate"),
  returnShippingFeePerKg: document.getElementById("returnShippingFeePerKg"),

  isShipped: document.getElementById("isShipped"),
  isWarehouseArrived: document.getElementById("isWarehouseArrived"),
  isCompleted: document.getElementById("isCompleted"),

  officialNote: document.getElementById("officialNote"),
  adminNote: document.getElementById("adminNote"),
}

init()

function init(){
  els.openCreateBtn?.addEventListener("click", openCreateModal)
  els.reloadBtn?.addEventListener("click", loadBatches)
 

  els.closeModalBtn?.addEventListener("click", closeModal)
  els.cancelModalBtn?.addEventListener("click", closeModal)
  els.batchForm?.addEventListener("submit", saveBatch)

  els.filterMonth?.addEventListener("change", render)
  els.filterBank?.addEventListener("change", render)
  els.filterStatus?.addEventListener("change", render)
  els.filterKeyword?.addEventListener("input", render)

  loadInitialData()
}

async function loadInitialData(){
  await loadProducts()
  await loadBatches()
}

async function loadProducts(){
  const { data, error } = await supabase
    .from("products")
    .select("id, name, is_active, sort_order, created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if(error){
    console.error("loadProducts error:", error)
    return
  }

  products = data || []
  renderProductOptions()
}

function renderProductOptions(selectedId = ""){
  els.productId.innerHTML = `<option value="">請選擇商品</option>`

  products.forEach(product => {
    const option = document.createElement("option")
    option.value = product.id
    option.textContent = product.name

    if(String(selectedId) === String(product.id)){
      option.selected = true
    }

    els.productId.appendChild(option)
  })
}

function getProductName(productId){
  const target = products.find(p => String(p.id) === String(productId))
  return target?.name || ""
}


async function loadBatches(){
  els.purchaseTbody.innerHTML = `
    <tr>
      <td colspan="20"  class="empty-cell">資料載入中...</td>
    </tr>
  `

  const { data, error } = await supabase
   .from("purchase_batches")
.select(`
  *,
 products (
  id,
  name
)
`)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })

  if(error){
    console.error("loadBatches error:", error)
    els.purchaseTbody.innerHTML = `
      <tr>
        <td colspan="20" class="empty-cell">載入失敗：${escapeHtml(error.message)}</td>
      </tr>
    `
    return
  }

  allBatches = data || []

  buildFilterOptions()
  render()
}

function buildFilterOptions(){
  const oldMonth = els.filterMonth.value
  const oldBank = els.filterBank.value

  const months = [...new Set(
    allBatches
      .map(row => getMonth(row.purchase_date))
      .filter(Boolean)
  )]

  const banks = [...new Set(
    allBatches
      .map(row => row.bank_name)
      .filter(Boolean)
  )]

  els.filterMonth.innerHTML = `<option value="">全部月份</option>`
  months.forEach(month => {
    const option = document.createElement("option")
    option.value = month
    option.textContent = month
    els.filterMonth.appendChild(option)
  })

  els.filterBank.innerHTML = `<option value="">全部銀行</option>`
  banks.forEach(bank => {
    const option = document.createElement("option")
    option.value = bank
    option.textContent = bank
    els.filterBank.appendChild(option)
  })

  els.filterMonth.value = months.includes(oldMonth) ? oldMonth : ""
  els.filterBank.value = banks.includes(oldBank) ? oldBank : ""
}

function render(){
  const rows = getFilteredRows()

  renderSummary(rows)
  renderBankSummary(rows)
  renderTable(rows)
}

function getFilteredRows(){
  const month = els.filterMonth.value
  const bank = els.filterBank.value
  const status = els.filterStatus.value
  const keyword = els.filterKeyword.value.trim().toLowerCase()

  return allBatches.filter(row => {
    if(month && getMonth(row.purchase_date) !== month){
      return false
    }

    if(bank && row.bank_name !== bank){
      return false
    }

    if(status && getStatusValue(row) !== status){
      return false
    }

    if(keyword){
    const text = [
 row.products?.name,
row.purchase_source,
  row.bank_name,
  row.card_name,
  row.card_holder,
  row.official_order_no,
  row.tracking_no,
  row.expected_ship_month,
  row.official_note,
  row.admin_note,
].join(" ").toLowerCase()

      if(!text.includes(keyword)){
        return false
      }
    }

    return true
  })
}

function renderSummary(rows){
  const cardAmountTotal = rows.reduce((total, row) => {
    return total + Number(row.card_amount || 0) + Number(row.card_fee || 0)
  }, 0)

  els.summaryCount.textContent = rows.length
  els.summaryOriginalAmount.textContent = formatMoney(sumRows(rows, "original_order_amount"))
  els.summaryCardAmount.textContent = formatMoney(cardAmountTotal)
  els.summaryCardFee.textContent = formatMoney(sumRows(rows, "card_fee"))
}

function renderBankSummary(rows){
  const summaryMap = new Map()

  rows.forEach(row => {
    const holderName = row.card_holder || "未填刷卡人"
    const bankName = row.bank_name || "未填銀行"
    const key = `${holderName}__${bankName}`

    const current = summaryMap.get(key) || {
      holderName,
      bankName,
      count: 0,
      totalAmount: 0,
    }

    current.count += 1
    current.totalAmount += Number(row.card_amount || 0) + Number(row.card_fee || 0)

    summaryMap.set(key, current)
  })

  const list = [...summaryMap.values()]
    .sort((a, b) => {
      if(a.holderName !== b.holderName){
        return a.holderName.localeCompare(b.holderName, "zh-TW")
      }

      return b.totalAmount - a.totalAmount
    })

  if(list.length === 0){
    els.bankSummaryList.innerHTML = `<div class="empty-text">尚無資料</div>`
    return
  }

  els.bankSummaryList.innerHTML = list.map(item => `
    <div class="bank-summary-item">
      <div class="bank-name">
        ${escapeHtml(item.holderName)} / ${escapeHtml(item.bankName)}
      </div>

      <div>
        <span>筆數</span>
        <b>${item.count}</b>
      </div>

      <div>
        <span>刷卡總額 ( 已含手續費 )</span>
        <b>${formatMoney(item.totalAmount)}</b>
      </div>
    </div>
  `).join("")
}

function renderTable(rows){
  if(rows.length === 0){
    els.purchaseTbody.innerHTML = `
      <tr>
        <td colspan="20" class="empty-cell">沒有符合的刷卡紀錄</td>
      </tr>
    `
    return
  }

  els.purchaseTbody.innerHTML = rows.map(row => `
    <tr data-id="${row.id}">
      <td>${escapeHtml(getMonth(row.purchase_date))}</td>
      <td>${escapeHtml(row.products?.name || getProductName(row.product_id) || "")}</td>
      <td>${escapeHtml(formatDate(row.purchase_date))}</td>
      <td>${escapeHtml(formatBankCard(row))}</td>
      <td>${escapeHtml(row.card_holder || "")}</td>

      <td class="money-cell">${formatMoney(row.original_order_amount)}</td>
      <td class="money-cell">${formatMoney(row.card_amount)}</td>
      <td class="money-cell">${formatMoney(row.card_fee)}</td>

      <td>${escapeHtml(row.official_order_no || "")}</td>
      <td>${escapeHtml(row.tracking_no || "")}</td>
      <td>${escapeHtml(row.expected_ship_month || "")}</td>

      <td class="center-cell">
        <input
          type="checkbox"
          class="status-check"
          data-field="is_shipped"
          ${row.is_shipped ? "checked" : ""}
        >
      </td>

      <td class="center-cell">
        <input
          type="checkbox"
          class="status-check"
          data-field="is_warehouse_arrived"
          ${row.is_warehouse_arrived ? "checked" : ""}
        >
      </td>

      <td>${escapeHtml(formatDateTime(row.warehouse_arrived_at))}</td>
   <td class="center-cell">
  <input
    type="checkbox"
    class="status-check"
    data-field="return_to_taiwan"
    ${row.return_to_taiwan_date ? "checked" : ""}
  >
</td>

<td>${escapeHtml(formatDate(row.return_to_taiwan_date) || "-")}</td>
      <td class="money-cell">${formatMoney(row.return_shipping_fee_per_kg)}</td>

      <td class="center-cell">
        <input
          type="checkbox"
          class="status-check"
          data-field="is_completed"
          ${row.is_completed ? "checked" : ""}
        >
      </td>

      <td
        class="note-cell"
        title="${escapeAttr(row.admin_note || row.official_note || "")}"
      >
        ${escapeHtml(row.admin_note || row.official_note || "")}
      </td>

     <td>
  <button type="button" class="small-btn" data-action="detail">查看</button>
  <button type="button" class="small-btn" data-action="edit">編輯</button>
  <button type="button" class="btn-danger" data-action="delete">刪除</button>
</td>
    </tr>
  `).join("")

  els.purchaseTbody.querySelectorAll("button[data-action='detail']").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.closest("tr").dataset.id
      location.href = `./admin-card-purchase-detail.html?id=${id}`
    })
  })

  els.purchaseTbody.querySelectorAll("button[data-action='edit']").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.closest("tr").dataset.id
      const row = allBatches.find(item => String(item.id) === String(id))
      openEditModal(row)
    })
  })


  els.purchaseTbody.querySelectorAll("button[data-action='delete']").forEach(btn => {
  btn.addEventListener("click", e => {
    const id = e.target.closest("tr").dataset.id
    deleteBatch(id)
  })
})
  els.purchaseTbody.querySelectorAll(".status-check").forEach(input => {
    input.addEventListener("change", updateStatus)
  })
}

async function updateStatus(e){
  const input = e.target
  const row = input.closest("tr")
  const id = row.dataset.id
  const field = input.dataset.field
  const checked = input.checked

  const payload = {
    [field]: checked,
  }

if(field === "return_to_taiwan"){
  payload.return_to_taiwan_date = checked ? today() : null
  delete payload.return_to_taiwan
}
  
  if(field === "is_warehouse_arrived" && checked){
    payload.is_shipped = true
    payload.warehouse_arrived_at = new Date().toISOString()
  }

  if(field === "is_warehouse_arrived" && !checked){
    payload.warehouse_arrived_at = null
  }

  if(field === "is_completed" && checked){
    payload.is_shipped = true
    payload.is_warehouse_arrived = true

    const target = allBatches.find(item => String(item.id) === String(id))
    if(!target?.warehouse_arrived_at){
      payload.warehouse_arrived_at = new Date().toISOString()
    }
  }

  const { error } = await supabase
    .from("purchase_batches")
    .update(payload)
    .eq("id", id)

  if(error){
    console.error("updateStatus error:", error)
    alert("狀態更新失敗：" + error.message)
    input.checked = !checked
    return
  }

  await loadBatches()
}

async function deleteBatch(id){
  const target = allBatches.find(item => String(item.id) === String(id))

const text = [
  target?.products?.name || getProductName(target?.product_id) || "",
  target?.official_order_no || "",
  target?.purchase_date || "",
].filter(Boolean).join(" / ")

  const ok = confirm(
    `確定要刪除這筆刷卡紀錄嗎？\n\n${text}\n\n刪除後，這筆底下的商品明細也會一起刪除。`
  )

  if(!ok) return

  const { error } = await supabase
    .from("purchase_batches")
    .delete()
    .eq("id", id)

  if(error){
    console.error("deleteBatch error:", error)
    alert("刪除失敗：" + error.message)
    return
  }

  alert("已刪除")
  await loadBatches()
}



function openCreateModal(){
  els.modalTitle.textContent = "新增刷卡紀錄"
  els.batchForm.reset()

renderProductOptions()
els.purchaseSource.value = ""

  els.batchId.value = ""
  els.purchaseDate.value = today()
  els.currency.value = "TWD"

  els.originalOrderAmount.value = 0
  els.cardAmount.value = 0
  els.cardFee.value = 0
  els.returnShippingFeePerKg.value = 0

  els.isShipped.checked = false
  els.isWarehouseArrived.checked = false
  els.isCompleted.checked = false

  els.batchModal.classList.remove("hidden")
}

function openEditModal(row){
  if(!row) return

  els.modalTitle.textContent = "編輯刷卡紀錄"

  els.batchId.value = row.id
renderProductOptions(row.product_id || "")
els.productId.value = row.product_id || ""
els.purchaseSource.value = row.purchase_source || ""
  els.purchaseDate.value = row.purchase_date || ""
  els.bankName.value = row.bank_name || ""
  els.cardName.value = row.card_name || ""
els.cardHolder.value = row.card_holder || ""
els.currency.value = row.currency || "TWD"

  els.originalOrderAmount.value = row.original_order_amount || 0
  els.cardAmount.value = row.card_amount || 0
  els.cardFee.value = row.card_fee || 0

  els.officialOrderNo.value = row.official_order_no || ""
  els.trackingNo.value = row.tracking_no || ""
  els.expectedShipMonth.value = row.expected_ship_month || ""

  els.warehouseArrivedAt.value = toDateTimeLocal(row.warehouse_arrived_at)
  els.returnToTaiwanDate.value = row.return_to_taiwan_date || ""
  els.returnShippingFeePerKg.value = row.return_shipping_fee_per_kg || 0

  els.isShipped.checked = !!row.is_shipped
  els.isWarehouseArrived.checked = !!row.is_warehouse_arrived
  els.isCompleted.checked = !!row.is_completed

  els.officialNote.value = row.official_note || ""
  els.adminNote.value = row.admin_note || ""

  els.batchModal.classList.remove("hidden")
}

function closeModal(){
  els.batchModal.classList.add("hidden")
}

async function saveBatch(e){
  e.preventDefault()

  if(isSaving) return
  isSaving = true

  const payload = {
 product_id: els.productId.value || null,
purchase_source: els.purchaseSource.value.trim() || null,
purchase_date: els.purchaseDate.value,

   bank_name: els.bankName.value || null,
card_name: els.cardName.value.trim() || null,
card_holder: els.cardHolder.value.trim() || null,
currency: els.currency.value || "TWD",

    original_order_amount: Number(els.originalOrderAmount.value || 0),
    card_amount: Number(els.cardAmount.value || 0),
    card_fee: Number(els.cardFee.value || 0),

    official_order_no: els.officialOrderNo.value.trim() || null,
    tracking_no: els.trackingNo.value.trim() || null,
    expected_ship_month: els.expectedShipMonth.value.trim() || null,

    warehouse_arrived_at: els.warehouseArrivedAt.value
      ? new Date(els.warehouseArrivedAt.value).toISOString()
      : null,

    return_to_taiwan_date: els.returnToTaiwanDate.value || null,
    return_shipping_fee_per_kg: Number(els.returnShippingFeePerKg.value || 0),

    is_shipped: els.isShipped.checked,
    is_warehouse_arrived: els.isWarehouseArrived.checked,
    is_completed: els.isCompleted.checked,

    official_note: els.officialNote.value.trim() || null,
    admin_note: els.adminNote.value.trim() || null,
  }

  if(payload.is_warehouse_arrived || payload.is_completed){
    payload.is_shipped = true
  }

  if(payload.is_completed){
    payload.is_warehouse_arrived = true

    if(!payload.warehouse_arrived_at){
      payload.warehouse_arrived_at = new Date().toISOString()
    }
  }

  if(payload.is_warehouse_arrived && !payload.warehouse_arrived_at){
    payload.warehouse_arrived_at = new Date().toISOString()
  }

  let error

  if(els.batchId.value){
    const res = await supabase
      .from("purchase_batches")
      .update(payload)
      .eq("id", els.batchId.value)

    error = res.error
  }else{
    const res = await supabase
      .from("purchase_batches")
      .insert(payload)

    error = res.error
  }

  isSaving = false

  if(error){
    console.error("saveBatch error:", error)
    alert("儲存失敗：" + error.message)
    return
  }

  closeModal()
  await loadBatches()
}

function getStatusValue(row){
  if(row.is_completed) return "completed"
  if(row.is_warehouse_arrived) return "warehouse"
  if(row.is_shipped) return "shipped"
  return "pending"
}

function getMonth(dateText){
  if(!dateText) return ""
  return String(dateText).slice(0, 7).replace("-", "/")
}

function formatDate(dateText){
  if(!dateText) return ""
  return String(dateText).replaceAll("-", "/")
}

function formatDateTime(value){
  if(!value) return ""

  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ""

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")

  return `${y}/${m}/${d} ${hh}:${mm}`
}

function toDateTimeLocal(value){
  if(!value) return ""

  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ""

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")

  return `${y}-${m}-${d}T${hh}:${mm}`
}

function formatBankCard(row){
  return [row.bank_name, row.card_name]
    .filter(Boolean)
    .join(" / ")
}

function formatMoney(value){
  return Number(value || 0).toLocaleString("zh-TW", {
    maximumFractionDigits: 0,
  })
}

function sumRows(rows, key){
  return rows.reduce((total, row) => {
    return total + Number(row[key] || 0)
  }, 0)
}

function today(){
  return new Date().toISOString().slice(0, 10)
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
  return escapeHtml(value)
}