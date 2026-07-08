import { supabase } from "./supabase.js"

const urlParams = new URLSearchParams(location.search)
const batchId = urlParams.get("id")

let batchData = null
let itemRows = []
let products = []
let productVariants = []
let isSaving = false

const els = {
  detailTitle: document.getElementById("detailTitle"),
  detailSubtitle: document.getElementById("detailSubtitle"),

  infoProductName: document.getElementById("infoProductName"),
  infoPurchaseSource: document.getElementById("infoPurchaseSource"),
  infoPurchaseDate: document.getElementById("infoPurchaseDate"),
  infoBankCard: document.getElementById("infoBankCard"),
  infoCardHolder: document.getElementById("infoCardHolder"),
  infoCurrency: document.getElementById("infoCurrency"),
  infoOriginalAmount: document.getElementById("infoOriginalAmount"),
  infoCardAmount: document.getElementById("infoCardAmount"),
  infoCardFee: document.getElementById("infoCardFee"),
  infoCardTotal: document.getElementById("infoCardTotal"),
  infoOfficialOrderNo: document.getElementById("infoOfficialOrderNo"),
  infoTrackingNo: document.getElementById("infoTrackingNo"),
  infoExpectedShipMonth: document.getElementById("infoExpectedShipMonth"),
  infoWarehouseArrivedAt: document.getElementById("infoWarehouseArrivedAt"),
  infoReturnToTaiwanDate: document.getElementById("infoReturnToTaiwanDate"),
  infoReturnShippingFeePerKg: document.getElementById("infoReturnShippingFeePerKg"),
  infoStatus: document.getElementById("infoStatus"),
  infoOfficialNote: document.getElementById("infoOfficialNote"),
  infoAdminNote: document.getElementById("infoAdminNote"),

  itemCount: document.getElementById("itemCount"),
  itemQuantityTotal: document.getElementById("itemQuantityTotal"),
  itemSubtotalTotal: document.getElementById("itemSubtotalTotal"),

  itemFormTitle: document.getElementById("itemFormTitle"),
  itemForm: document.getElementById("itemForm"),
  itemId: document.getElementById("itemId"),
  itemProductId: document.getElementById("itemProductId"),
  itemProductName: document.getElementById("itemProductName"),
itemVariantId: document.getElementById("itemVariantId"),
itemVariantName: document.getElementById("itemVariantName"),
itemQuantity: document.getElementById("itemQuantity"),
  itemUnitPrice: document.getElementById("itemUnitPrice"),
  itemSubtotal: document.getElementById("itemSubtotal"),
  itemUnitWeight: document.getElementById("itemUnitWeight"),
  itemNote: document.getElementById("itemNote"),
  cancelItemEditBtn: document.getElementById("cancelItemEditBtn"),
  saveItemBtn: document.getElementById("saveItemBtn"),

  itemTbody: document.getElementById("itemTbody"),
}

init()

function init(){
  if(!batchId){
    alert("缺少刷卡採購紀錄 ID")
    location.href = "./admin-card-purchases.html"
    return
  }

  els.itemForm?.addEventListener("submit", saveItem)
  els.cancelItemEditBtn?.addEventListener("click", resetItemForm)

  els.itemProductId?.addEventListener("change", onProductChange)
  els.itemVariantId?.addEventListener("change", onVariantChange)
  els.itemQuantity?.addEventListener("input", autoCalcSubtotal)
  els.itemUnitPrice?.addEventListener("input", autoCalcSubtotal)

  loadInitialData()
}

async function loadInitialData(){
  await loadProducts()
  await loadBatch()
  await loadItems()
}

async function loadProducts(){
  const { data, error } = await supabase
    .from("products")
.select("id, name, is_active, sort_order, created_at")
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
  els.itemProductId.innerHTML = `<option value="">不連接商品</option>`

  products.forEach(product => {
    const option = document.createElement("option")
    option.value = product.id
    option.textContent = product.is_active
      ? product.name
      : `${product.name}（已下架）`

    if(String(selectedId) === String(product.id)){
      option.selected = true
    }

    els.itemProductId.appendChild(option)
  })
}

async function onProductChange(){
  const productId = els.itemProductId.value
  const product = products.find(item => String(item.id) === String(productId))

  if(product){
    els.itemProductName.value = product.name || ""
  }else{
    els.itemProductName.value = ""
  }

  els.itemVariantName.value = ""
  await loadProductVariants(productId)
}

async function loadProductVariants(productId, selectedVariantId = ""){
  if(!productId){
    productVariants = []
    renderVariantOptions()
    return
  }

  const { data, error } = await supabase
    .from("product_variants")
.select("id, product_id, name, is_active, created_at")
.eq("product_id", productId)
.order("created_at", { ascending: true })

  if(error){
    console.error("loadProductVariants error:", error)
    productVariants = []
    renderVariantOptions()
    return
  }

  productVariants = data || []
  renderVariantOptions(selectedVariantId)
}

function renderVariantOptions(selectedVariantId = ""){
  if(!els.itemVariantId) return

  if(!els.itemProductId.value){
    els.itemVariantId.innerHTML = `<option value="">請先選擇商品</option>`
    els.itemVariantName.value = ""
    return
  }

  if(productVariants.length === 0){
    els.itemVariantId.innerHTML = `<option value="">此商品沒有品項</option>`
    els.itemVariantName.value = ""
    return
  }

  els.itemVariantId.innerHTML = `<option value="">請選擇品項</option>`

  productVariants.forEach(variant => {
    const option = document.createElement("option")
    option.value = variant.id
    option.textContent = variant.is_active
  ? variant.name
  : `${variant.name}（已下架）`

    if(String(selectedVariantId) === String(variant.id)){
      option.selected = true
    }

    els.itemVariantId.appendChild(option)
  })

  onVariantChange()
}

function onVariantChange(){
  const variantId = els.itemVariantId.value
  const variant = productVariants.find(item => String(item.id) === String(variantId))

  els.itemVariantName.value = variant?.name || ""
}



async function loadBatch(){
  const { data, error } = await supabase
    .from("purchase_batches")
    .select(`
      *,
      products (
        id,
        name
      )
    `)
    .eq("id", batchId)
    .single()

  if(error){
    console.error("loadBatch error:", error)
    alert("讀取刷卡採購主資料失敗：" + error.message)
    return
  }

  batchData = data
  renderBatchInfo()
}

function renderBatchInfo(){
  if(!batchData) return

  const productName = batchData.products?.name || getProductName(batchData.product_id) || "-"
  const cardTotal = Number(batchData.card_amount || 0) + Number(batchData.card_fee || 0)

  els.detailTitle.textContent = `刷卡採購詳細資料｜${productName}`
  els.detailSubtitle.textContent = [
    formatDate(batchData.purchase_date),
    formatBankCard(batchData),
    batchData.official_order_no,
  ].filter(Boolean).join(" / ") || "刷卡採購詳細資料"

  els.infoProductName.textContent = productName
  els.infoPurchaseSource.textContent = batchData.purchase_source || "-"
  els.infoPurchaseDate.textContent = formatDate(batchData.purchase_date) || "-"
  els.infoBankCard.textContent = formatBankCard(batchData) || "-"
  els.infoCardHolder.textContent = batchData.card_holder || "-"
  els.infoCurrency.textContent = formatCurrency(batchData.currency)

  els.infoOriginalAmount.textContent = formatMoney(batchData.original_order_amount)
  els.infoCardAmount.textContent = formatMoney(batchData.card_amount)
  els.infoCardFee.textContent = formatMoney(batchData.card_fee)
  els.infoCardTotal.textContent = formatMoney(cardTotal)

  els.infoOfficialOrderNo.textContent = batchData.official_order_no || "-"
  els.infoTrackingNo.textContent = batchData.tracking_no || "-"
  els.infoExpectedShipMonth.textContent = batchData.expected_ship_month || "-"
  els.infoWarehouseArrivedAt.textContent = formatDateTime(batchData.warehouse_arrived_at) || "-"
  els.infoReturnToTaiwanDate.textContent = formatDate(batchData.return_to_taiwan_date) || "-"
  els.infoReturnShippingFeePerKg.textContent = formatMoney(batchData.return_shipping_fee_per_kg)

  els.infoStatus.innerHTML = getStatusBadge(batchData)

  els.infoOfficialNote.textContent = batchData.official_note || "-"
  els.infoAdminNote.textContent = batchData.admin_note || "-"
}

async function loadItems(){
  els.itemTbody.innerHTML = `
    <tr>
      <td colspan="8" class="empty-cell">商品明細載入中...</td>
    </tr>
  `

  const { data, error } = await supabase
    .from("purchase_batch_items")
    .select(`
      *,
      products (
        id,
        name
      )
    `)
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true })

  if(error){
    console.error("loadItems error:", error)
    els.itemTbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">商品明細載入失敗：${escapeHtml(error.message)}</td>
      </tr>
    `
    return
  }

  itemRows = data || []

  renderItemSummary()
  renderItemTable()
}

function renderItemSummary(){
  const quantityTotal = itemRows.reduce((total, item) => {
    return total + Number(item.quantity || 0)
  }, 0)

  const subtotalTotal = itemRows.reduce((total, item) => {
    return total + Number(item.subtotal || 0)
  }, 0)

  els.itemCount.textContent = itemRows.length
  els.itemQuantityTotal.textContent = quantityTotal
  els.itemSubtotalTotal.textContent = formatMoney(subtotalTotal)
}

function renderItemTable(){
  if(itemRows.length === 0){
    els.itemTbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">尚未新增商品明細</td>
      </tr>
    `
    return
  }

  els.itemTbody.innerHTML = itemRows.map(item => `
    <tr data-id="${item.id}">
      <td>${escapeHtml(item.product_name || item.products?.name || "")}</td>
      <td>${escapeHtml(item.variant_name || "")}</td>
      <td class="money-cell">${formatMoney(item.quantity)}</td>
      <td class="money-cell">${formatMoney(item.unit_price)}</td>
      <td class="money-cell">${formatMoney(item.subtotal)}</td>
      <td class="money-cell">${formatWeight(item.unit_weight)}</td>
      <td>${escapeHtml(item.item_note || "")}</td>
      <td>
        <div class="action-cell">
          <button type="button" class="small-btn" data-action="edit">編輯</button>
          <button type="button" class="btn-danger" data-action="delete">刪除</button>
        </div>
      </td>
    </tr>
  `).join("")

  els.itemTbody.querySelectorAll("button[data-action='edit']").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.closest("tr").dataset.id
      const item = itemRows.find(row => String(row.id) === String(id))
      editItem(item)
    })
  })

  els.itemTbody.querySelectorAll("button[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.closest("tr").dataset.id
      deleteItem(id)
    })
  })
}

async function editItem(item){
  if(!item) return

  els.itemFormTitle.textContent = "編輯商品明細"
  els.saveItemBtn.textContent = "儲存修改"
  els.cancelItemEditBtn.classList.remove("hidden")

  els.itemId.value = item.id
 renderProductOptions(item.product_id || "")
els.itemProductId.value = item.product_id || ""

await loadProductVariants(item.product_id || "", item.variant_id || "")

els.itemProductName.value = item.product_name || ""
els.itemVariantName.value = item.variant_name || ""
  els.itemQuantity.value = item.quantity || 1
  els.itemUnitPrice.value = item.unit_price || 0
  els.itemSubtotal.value = item.subtotal || 0
  els.itemUnitWeight.value = item.unit_weight || 0
  els.itemNote.value = item.item_note || ""

  window.scrollTo({
    top: document.querySelector(".item-form-card").offsetTop - 20,
    behavior: "smooth",
  })
}

async function saveItem(e){
  e.preventDefault()

  if(isSaving) return
  isSaving = true

  const quantity = Number(els.itemQuantity.value || 0)
  const unitPrice = Number(els.itemUnitPrice.value || 0)
  const subtotal = Number(els.itemSubtotal.value || 0)

 const payload = {
  batch_id: batchId,
  product_id: els.itemProductId.value || null,
  variant_id: els.itemVariantId.value || null,
  product_name: els.itemProductName.value.trim(),
  variant_name: els.itemVariantName.value.trim() || null,
    quantity,
    unit_price: unitPrice,
    subtotal,
    unit_weight: Number(els.itemUnitWeight.value || 0),
    item_note: els.itemNote.value.trim() || null,
  }

  let error

  if(els.itemId.value){
    const res = await supabase
      .from("purchase_batch_items")
      .update(payload)
      .eq("id", els.itemId.value)

    error = res.error
  }else{
    const res = await supabase
      .from("purchase_batch_items")
      .insert(payload)

    error = res.error
  }

  isSaving = false

  if(error){
    console.error("saveItem error:", error)
    alert("商品明細儲存失敗：" + error.message)
    return
  }

  resetItemForm()
  await loadItems()
}

async function deleteItem(id){
  const item = itemRows.find(row => String(row.id) === String(id))

  const ok = confirm(
    `確定要刪除這筆商品明細嗎？\n\n${item?.product_name || ""} ${item?.variant_name || ""}`
  )

  if(!ok) return

  const { error } = await supabase
    .from("purchase_batch_items")
    .delete()
    .eq("id", id)

  if(error){
    console.error("deleteItem error:", error)
    alert("商品明細刪除失敗：" + error.message)
    return
  }

  alert("已刪除")
  await loadItems()
}

function resetItemForm(){
  els.itemFormTitle.textContent = "新增商品明細"
  els.saveItemBtn.textContent = "新增明細"
  els.cancelItemEditBtn.classList.add("hidden")

  els.itemForm.reset()
  els.itemId.value = ""

  renderProductOptions()


  productVariants = []
renderVariantOptions()


  els.itemQuantity.value = 1
  els.itemUnitPrice.value = 0
  els.itemSubtotal.value = 0
  els.itemUnitWeight.value = 0
}

function autoCalcSubtotal(){
  const quantity = Number(els.itemQuantity.value || 0)
  const unitPrice = Number(els.itemUnitPrice.value || 0)

  els.itemSubtotal.value = quantity * unitPrice
}

function getProductName(productId){
  const target = products.find(product => String(product.id) === String(productId))
  return target?.name || ""
}

function getStatusBadge(row){
  const status = getStatusValue(row)

  const labelMap = {
    pending: "未出貨",
    shipped: "已出貨未入倉",
    warehouse: "已入倉",
    completed: "已完成",
  }

  return `<span class="status-badge ${status}">${labelMap[status]}</span>`
}

function getStatusValue(row){
  if(row.is_completed) return "completed"
  if(row.is_warehouse_arrived) return "warehouse"
  if(row.is_shipped) return "shipped"
  return "pending"
}

function formatBankCard(row){
  return [row.bank_name, row.card_name]
    .filter(Boolean)
    .join(" / ")
}

function formatCurrency(value){
  const map = {
    TWD: "台幣 TWD",
    THB: "泰銖 THB",
    USD: "美金 USD",
  }

  return map[value] || value || "-"
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

function formatMoney(value){
  return Number(value || 0).toLocaleString("zh-TW", {
    maximumFractionDigits: 0,
  })
}

function formatWeight(value){
  return Number(value || 0).toLocaleString("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}