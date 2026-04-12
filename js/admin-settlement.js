import { supabase } from "./supabase.js"

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

let editingBatchId = null
let editingItemId = null
let allBatchRows = []
let batchSearchTimer = null

let currentUser = null
let batchOptions = []
let isBatchLoading = false

window.saveBatch = saveBatch
window.saveBatchItem = saveBatchItem
window.loadVariantsForSettlement = loadVariantsForSettlement
window.editBatch = editBatch
window.deleteBatch = deleteBatch
window.editBatchItem = editBatchItem
window.deleteBatchItem = deleteBatchItem
window.cancelBatchEdit = cancelBatchEdit
window.cancelItemEdit = cancelItemEdit
window.exportSettlementCsv = exportSettlementCsv
window.toggleBatchForm = toggleBatchForm
window.toggleItemForm = toggleItemForm


init()

async function init(){
  const { data: { user } } = await supabase.auth.getUser()
  currentUser = user

  bindAutoCalc()
  ensureActionButtons()
  toggleBatchForm(false)
  toggleItemForm(false)

  document.getElementById("batch_select")?.addEventListener("change", async (e) => {
    await updateBatchWeightInfo(e.target.value)
  })

  document.getElementById("shipping_per_kg")?.addEventListener("input", () => {
    updateEstimatedShippingOnly()
  })

const batchSearchInputMain = document.getElementById("batch_search")
const batchSearchDropdownMain = document.getElementById("batch_search_dropdown")

batchSearchInputMain?.addEventListener("focus", () => {
  renderBatchListSearchDropdown(allBatchRows || [])
  if(batchSearchDropdownMain) batchSearchDropdownMain.style.display = "block"
})

batchSearchInputMain?.addEventListener("input", () => {
  filterBatchList()
  filterBatchListSearchDropdown(batchSearchInputMain.value)

  if(batchSearchDropdownMain){
    batchSearchDropdownMain.style.display = "block"
  }
})

  document.getElementById("stock_status_search")?.addEventListener("change", filterBatchList)
  document.getElementById("packed_status_search")?.addEventListener("change", filterBatchList)
  document.getElementById("batch_date_start")?.addEventListener("change", filterBatchList)
  document.getElementById("batch_date_end")?.addEventListener("change", filterBatchList)
document.getElementById("creator_search")?.addEventListener("change", filterBatchList)

const batchSearchInput = document.getElementById("batch_search_input")
const batchDropdown = document.getElementById("batch_dropdown")

batchSearchInput?.addEventListener("focus", () => {
  renderBatchDropdown(batchOptions)
  if(batchDropdown) batchDropdown.style.display = "block"
})

batchSearchInput?.addEventListener("input", (e) => {
  filterBatchDropdown(e.target.value)
  if(batchDropdown) batchDropdown.style.display = "block"
})

document.addEventListener("click", (e) => {
  if(!e.target.closest(".batch-select-wrap")){
    if(batchDropdown) batchDropdown.style.display = "none"
  }

  if(!e.target.closest(".batch-list-search-wrap")){
    const mainDropdown = document.getElementById("batch_search_dropdown")
    if(mainDropdown) mainDropdown.style.display = "none"
  }
})

await loadBatches()
await loadProducts()
}

function toggleBatchForm(forceOpen = null){
  const wrap = document.getElementById("batchFormWrap")
  const btn = document.getElementById("toggleBatchFormBtn")
  if(!wrap) return

  const shouldOpen = forceOpen === null
    ? wrap.classList.contains("form-collapsed")
    : forceOpen

  wrap.classList.toggle("form-collapsed", !shouldOpen)
  wrap.classList.toggle("form-expanded", shouldOpen)

  if(btn){
    btn.textContent = shouldOpen ? "－收起批次表單" : "＋新增批次"
  }
}

function toggleItemForm(forceOpen = null){
  const wrap = document.getElementById("itemFormWrap")
  const btn = document.getElementById("toggleItemFormBtn")
  if(!wrap) return

  const shouldOpen = forceOpen === null
    ? wrap.classList.contains("form-collapsed")
    : forceOpen

  wrap.classList.toggle("form-collapsed", !shouldOpen)
  wrap.classList.toggle("form-expanded", shouldOpen)

  if(btn){
    btn.textContent = shouldOpen ? "－收起商品表單" : "＋新增批次商品"
  }
}


function ensureActionButtons(){
  if(!document.getElementById("cancelBatchEditBtn")){
    const batchBtnWrap = document.querySelectorAll(".form-actions")[0]
    if(batchBtnWrap){
      const btn = document.createElement("button")
      btn.type = "button"
      btn.id = "cancelBatchEditBtn"
      btn.className = "btn-cancel"
      btn.textContent = "取消編輯"
      btn.style.display = "none"
      btn.onclick = cancelBatchEdit
      batchBtnWrap.appendChild(btn)
    }
  }

  if(!document.getElementById("cancelItemEditBtn")){
    const itemBtnWrap = document.querySelectorAll(".form-actions")[1]
    if(itemBtnWrap){
      const btn = document.createElement("button")
      btn.type = "button"
      btn.id = "cancelItemEditBtn"
      btn.className = "btn-cancel"
      btn.textContent = "取消編輯"
      btn.style.display = "none"
      btn.onclick = cancelItemEdit
      itemBtnWrap.appendChild(btn)
    }
  }

  const batchPrimaryBtn = document.querySelectorAll(".form-actions")[0]?.querySelector(".btn-primary")
  if(batchPrimaryBtn) batchPrimaryBtn.id = "saveBatchBtn"

  const itemPrimaryBtn = document.querySelectorAll(".form-actions")[1]?.querySelector(".btn-primary")
  if(itemPrimaryBtn) itemPrimaryBtn.id = "saveItemBtn"
}

function bindAutoCalc(){
  const amountOriginal = document.getElementById("amount_original")
  const amountTwdFinal = document.getElementById("amount_twd_final")
  const rewardRate = document.getElementById("reward_rate")

  amountOriginal.addEventListener("input", updateExchangeRate)
  amountTwdFinal.addEventListener("input", updateExchangeRate)

  amountTwdFinal.addEventListener("input", updateCardFee)

  rewardRate.addEventListener("input", updateRewardAmount)
  amountTwdFinal.addEventListener("input", updateRewardAmount)
}

function updateExchangeRate(){
  const original = Number(document.getElementById("amount_original").value || 0)
  const twd = Number(document.getElementById("amount_twd_final").value || 0)
  const rateInput = document.getElementById("exchange_rate")

  if(original > 0 && twd > 0){
    rateInput.value = (twd / original).toFixed(4)
  }else{
    rateInput.value = 0
  }
}

function updateCardFee(){
  const twd = Number(document.getElementById("amount_twd_final").value || 0)
  const cardFeeInput = document.getElementById("card_fee")
  if(cardFeeInput){
    cardFeeInput.value = (twd * 0.015).toFixed(2)
  }
}

function updateRewardAmount(){
  const twd = Number(document.getElementById("amount_twd_final").value || 0)
  const rewardRate = Number(document.getElementById("reward_rate").value || 0)
  document.getElementById("reward_amount").value = (twd * rewardRate).toFixed(2)
}

/* =========================
   共用計算
========================= */

function calcBatchActualCost(batch, estimatedInternationalShipping = 0){
  const amountTwd = Number(batch.amount_twd_final || 0)
  const cardFee = Number(batch.card_fee || 0)
  const rewardAmount = Number(batch.reward_amount || 0)
  const isRewardUsed = !!batch.is_reward_used

  let total = amountTwd + cardFee + estimatedInternationalShipping

  if(isRewardUsed){
    total -= rewardAmount
  }

  return total
}

function calcItemMetrics(batch, items, item, estimatedInternationalShipping = 0){
  const exchangeRate = Number(batch.exchange_rate || 0)

  const qty = Number(item.qty || 0)
  const unitPriceOriginal = Number(item.unit_price_original || 0)
  const unitWeight = Number(item.unit_weight || 0)

  const variantPrice =
    item.sale_price_override !== null && item.sale_price_override !== undefined
      ? Number(item.sale_price_override || 0)
      : Number(item.product_variants?.price || 0)

  const originalSubtotal = qty * unitPriceOriginal
  const twdSubtotal = originalSubtotal * exchangeRate
  const totalWeight = qty * unitWeight

  // 全批次商品台幣小計總和（用來分攤刷卡費 / 當地運費 / 回饋）
  const totalItemsTwdSubtotal = items.reduce((sum, row) => {
    const rowQty = Number(row.qty || 0)
    const rowUnitPriceOriginal = Number(row.unit_price_original || 0)
    return sum + (rowQty * rowUnitPriceOriginal * exchangeRate)
  }, 0)

  // 全批次總重量（用來分攤國際運費）
  const totalWeightAll = items.reduce((sum, row) => {
    return sum + (Number(row.qty || 0) * Number(row.unit_weight || 0))
  }, 0)

  // 各項批次共用費用
   const cardFee = Number(batch.card_fee || 0)
  const localShippingOriginal = Number(batch.local_shipping || 0)
  const localShipping = localShippingOriginal * exchangeRate
  const rewardAmount = Number(batch.reward_amount || 0)
  const isRewardUsed = !!batch.is_reward_used

  // 金額比例分攤
  let allocatedCardFee = 0
  let allocatedLocalShipping = 0
  let allocatedReward = 0

  if(totalItemsTwdSubtotal > 0){
    const amountRatio = twdSubtotal / totalItemsTwdSubtotal
    allocatedCardFee = cardFee * amountRatio
    allocatedLocalShipping = localShipping * amountRatio
    allocatedReward = isRewardUsed ? rewardAmount * amountRatio : 0
  }

  // 重量比例分攤
  let allocatedInternationalShipping = 0
  if(totalWeightAll > 0){
    allocatedInternationalShipping =
      estimatedInternationalShipping * (totalWeight / totalWeightAll)
  }

  const secondPaymentFee = Number(item.second_payment_fee || 0)
  const secondPaymentTotal = secondPaymentFee * qty

  // 最終商品總成本
  const allocatedCost =
    twdSubtotal +
    allocatedCardFee +
    allocatedLocalShipping +
    allocatedInternationalShipping -
    allocatedReward

  const unitCost = qty > 0 ? allocatedCost / qty : 0
  const netUnitCost = unitCost - secondPaymentFee
  const unitProfit = (variantPrice + secondPaymentFee) - unitCost
  const profitRate =
    (variantPrice + secondPaymentFee) > 0
      ? (unitProfit / (variantPrice + secondPaymentFee)) * 100
      : 0

  return {
    qty,
    unitPriceOriginal,
    unitWeight,
    variantPrice,
    secondPaymentFee,
    secondPaymentTotal,
    originalSubtotal,
    twdSubtotal,
    totalWeight,
    allocatedCardFee,
    allocatedLocalShipping,
    allocatedReward,
    allocatedInternationalShipping,
    allocatedCost,
    unitCost,
    netUnitCost,
    unitProfit,
    profitRate
  }
}

/* =========================
   批次主資料
========================= */

async function saveBatch(){
if(!currentUser?.id){
  alert("登入狀態失效，請重新登入後再試")
  return
}

  const batch_date = document.getElementById("batch_date").value
const batch_name = document.getElementById("batch_name").value.trim()
const purchase_source = document.getElementById("purchase_source").value.trim()
const official_order_no = document.getElementById("official_order_no").value.trim()
const cargo_no = document.getElementById("cargo_no").value.trim()
  const stock_status = document.getElementById("stock_status").value
  const packed_status = document.getElementById("packed_status").value === "true"
  const payer_name = document.getElementById("payer_name").value
  const bank_name = document.getElementById("bank_name").value
  const card_name = document.getElementById("card_name").value.trim()
  const currency = document.getElementById("currency").value
  const amount_original = Number(document.getElementById("amount_original").value || 0)
  const amount_twd_final = Number(document.getElementById("amount_twd_final").value || 0)
  const card_fee = Number(document.getElementById("card_fee").value || 0)
  const exchange_rate = Number(document.getElementById("exchange_rate").value || 0)
  const local_shipping = Number(document.getElementById("local_shipping").value || 0)
 const shipping_per_kg = Number(document.getElementById("shipping_per_kg").value || 0)
  const reward_rate = Number(document.getElementById("reward_rate").value || 0)
  const reward_amount = Number(document.getElementById("reward_amount").value || 0)
  const is_reward_used = document.getElementById("is_reward_used").value === "true"
  const note = document.getElementById("batch_note").value.trim()

  if(!batch_date || !batch_name){
    alert("請填寫批次日期與批次名稱")
    return
  }

  let stocked_at = null
  let packed_at = null

  if(editingBatchId){
    const { data: oldBatch, error: oldBatchError } = await supabase
      .from("accounting_batches")
      .select("stock_status, stocked_at, packed_status, packed_at")
      .eq("id", editingBatchId)
      .single()

    if(oldBatchError){
      console.error("read old batch error:", oldBatchError)
      alert("讀取原批次資料失敗")
      return
    }

    if(stock_status === "stocked"){
      stocked_at = oldBatch?.stocked_at || new Date().toISOString()
    }else{
      stocked_at = null
    }

    if(packed_status){
      packed_at = oldBatch?.packed_at || new Date().toISOString()
    }else{
      packed_at = null
    }
  }else{
    stocked_at = stock_status === "stocked" ? new Date().toISOString() : null
    packed_at = packed_status ? new Date().toISOString() : null
  }

const basePayload = {
  batch_date,
  batch_name,
  purchase_source,
  official_order_no,
  cargo_no,
  stock_status,
  stocked_at,
  packed_status,
  packed_at,
  payer_name,
  bank_name,
  card_name,
  card_fee,
  currency,
  amount_original,
  amount_twd_final,
  exchange_rate,
  local_shipping,
  shipping_per_kg,
  reward_rate,
  reward_amount,
  is_reward_used,
  note
}

  let error = null

 if(editingBatchId){
  const res = await supabase
    .from("accounting_batches")
    .update(basePayload)
    .eq("id", editingBatchId)

  error = res.error
}else{
  const res = await supabase
    .from("accounting_batches")
    .insert([{
      ...basePayload,
      created_by: currentUser?.id
    }])

  error = res.error
}

  if(error){
    console.error("saveBatch error:", error)
    alert(editingBatchId ? "更新批次失敗" : "建立批次失敗")
    return
  }

  alert(editingBatchId ? "批次更新成功" : "批次建立成功")
  clearBatchForm()
  toggleBatchForm(false)
  await loadBatches()
}

function clearBatchForm(){
  editingBatchId = null

    const title = document.getElementById("batchFormTitle")
  if(title) title.textContent = "新增帳務批次"
  document.getElementById("batch_date").value = ""
  document.getElementById("batch_name").value = ""
document.getElementById("purchase_source").value = ""
document.getElementById("official_order_no").value = ""
document.getElementById("cargo_no").value = ""
document.getElementById("stock_status").value = "pending"
document.getElementById("packed_status").value = "false"
document.getElementById("payer_name").value = ""
  document.getElementById("bank_name").value = ""
  document.getElementById("card_name").value = ""
  document.getElementById("currency").value = "TWD"
  document.getElementById("amount_original").value = 0
  document.getElementById("amount_twd_final").value = 0
  document.getElementById("card_fee").value = 0
  document.getElementById("exchange_rate").value = 0
  document.getElementById("local_shipping").value = 0
 document.getElementById("shipping_per_kg").value = 160
  document.getElementById("reward_rate").value = 0
  document.getElementById("reward_amount").value = 0
  document.getElementById("is_reward_used").value = "false"
  document.getElementById("batch_note").value = ""

  const btn = document.getElementById("saveBatchBtn")
  if(btn) btn.textContent = "建立批次"

  const cancelBtn = document.getElementById("cancelBatchEditBtn")
  if(cancelBtn) cancelBtn.style.display = "none"
}

function cancelBatchEdit(){
  clearBatchForm()
  toggleBatchForm(false)
}

async function editBatch(batchId){
  const { data, error } = await supabase
    .from("accounting_batches")
    .select("*")
    .eq("id", batchId)
    .single()

  if(error || !data){
    console.error("editBatch error:", error)
    alert("讀取批次失敗")
    return
  }

  editingBatchId = data.id
    document.getElementById("batchFormTitle").textContent = "編輯帳務批次"

 document.getElementById("batch_date").value = data.batch_date || ""
document.getElementById("batch_name").value = data.batch_name || ""
document.getElementById("purchase_source").value = data.purchase_source || ""
document.getElementById("official_order_no").value = data.official_order_no || ""
document.getElementById("cargo_no").value = data.cargo_no || ""
document.getElementById("stock_status").value = data.stock_status || "pending"
document.getElementById("packed_status").value = String(!!data.packed_status)
document.getElementById("payer_name").value = data.payer_name || ""
  document.getElementById("bank_name").value = data.bank_name || ""
  document.getElementById("card_name").value = data.card_name || ""
  document.getElementById("currency").value = data.currency || "TWD"
  document.getElementById("amount_original").value = data.amount_original ?? 0
document.getElementById("amount_twd_final").value = data.amount_twd_final ?? 0

if(Number(data.card_fee || 0) > 0){
  document.getElementById("card_fee").value = data.card_fee ?? 0
}else{
  updateCardFee()
}
  
  document.getElementById("exchange_rate").value = data.exchange_rate ?? 0
  document.getElementById("local_shipping").value = data.local_shipping ?? 0
document.getElementById("shipping_per_kg").value = data.shipping_per_kg ?? 160
  document.getElementById("reward_rate").value = data.reward_rate ?? 0
  document.getElementById("reward_amount").value = data.reward_amount ?? 0
  document.getElementById("is_reward_used").value = String(data.is_reward_used)
  document.getElementById("batch_note").value = data.note || ""

  const btn = document.getElementById("saveBatchBtn")
  if(btn) btn.textContent = "更新批次"

  const cancelBtn = document.getElementById("cancelBatchEditBtn")
  if(cancelBtn) cancelBtn.style.display = "inline-block"

  toggleBatchForm(true)
  window.scrollTo({ top: 0, behavior: "smooth" })
}

async function deleteBatch(batchId){
  const ok = confirm("確定要刪除這個批次嗎？刪除後，此批次商品明細也會一起刪除。")
  if(!ok) return

  const { error } = await supabase
    .from("accounting_batches")
    .delete()
    .eq("id", batchId)

  if(error){
    console.error("deleteBatch error:", error)
    alert("刪除批次失敗")
    return
  }

   if(editingBatchId === batchId){
    clearBatchForm()
    toggleBatchForm(false)
  }

  alert("批次已刪除")
  await loadBatches()
}

/* =========================
   商品主檔 / 規格
========================= */

async function loadProducts(){
  const { data, error } = await supabase
    .from("products")
    .select("id, name")
    .order("created_at", { ascending: false })

  if(error){
    console.error("loadProducts error:", error)
    return
  }

  const select = document.getElementById("product_select")
 select.innerHTML = `<option value="">請選擇商品</option>`

for(const p of data || []){
  const option = document.createElement("option")
  option.value = String(p.id || "")
  option.textContent = p.name || ""
  select.appendChild(option)
}
}

async function loadVariantsForSettlement(){
  const productId = document.getElementById("product_select").value
  const variantSelect = document.getElementById("variant_select")

  variantSelect.innerHTML = `<option value="">請選擇規格</option>`

  if(!productId) return

  const { data, error } = await supabase
    .from("product_variants")
    .select("id, name, price, cost, stock")
    .eq("product_id", productId)
    .order("created_at", { ascending: true })

  if(error){
    console.error("loadVariantsForSettlement error:", error)
    return
  }

for(const v of data || []){
  const option = document.createElement("option")
  option.value = String(v.id || "")
  option.textContent = `${v.name || ""}｜售價:${Number(v.price ?? 0)}｜目前cost:${Number(v.cost ?? 0)}`
  variantSelect.appendChild(option)
}
}

/* =========================
   批次商品明細
========================= */

async function saveBatchItem(){
  const batch_id = document.getElementById("batch_select").value
  const product_id = document.getElementById("product_select").value
  const variant_id = document.getElementById("variant_select").value
const qty = Number(document.getElementById("item_qty").value || 0)
const unit_price_original = Number(document.getElementById("unit_price_original").value || 0)
const salePriceRaw = document.getElementById("sale_price_override").value
const sale_price_override = salePriceRaw === "" ? null : Number(salePriceRaw)
const unit_weight = Number(document.getElementById("unit_weight").value || 0)
const second_payment_fee = Number(document.getElementById("second_payment_fee").value || 0)
const note = document.getElementById("item_note").value.trim()

  if(!batch_id || !product_id || !variant_id || qty <= 0){
    alert("請選擇批次 / 商品 / 規格，並填寫正確數量")
    return
  }

const payload = {
  batch_id,
  product_id,
  variant_id,
  qty,
  unit_price_original,
  sale_price_override,
  unit_weight,
  second_payment_fee,
  note
}

  let error = null

  if(editingItemId){
    const res = await supabase
      .from("accounting_batch_items")
      .update(payload)
      .eq("id", editingItemId)

    error = res.error
  }else{
    const res = await supabase
      .from("accounting_batch_items")
      .insert([payload])

    error = res.error
  }

  if(error){
    console.error("saveBatchItem error:", error)
    alert(editingItemId ? "更新商品失敗" : "加入商品失敗")
    return
  }

  alert(editingItemId ? "商品更新成功" : "商品已加入批次")

  await updateBatchWeightInfo(batch_id)
  clearItemForm()
  toggleItemForm(false)
  await loadBatches()
}

function clearItemForm(){
  editingItemId = null
  const title = document.getElementById("itemFormTitle")
  if(title) title.textContent = "加入批次商品"
  document.getElementById("batch_select").value = ""
  document.getElementById("product_select").value = ""
  document.getElementById("batch_search_input").value = ""
  document.getElementById("variant_select").innerHTML = `<option value="">請先選規格</option>`
  document.getElementById("item_qty").value = 1
  document.getElementById("unit_price_original").value = 0
  document.getElementById("sale_price_override").value = ""
document.getElementById("unit_weight").value = 0
document.getElementById("second_payment_fee").value = 0
document.getElementById("batch_total_weight").value = 0
document.getElementById("estimated_international_shipping").value = 0
document.getElementById("item_note").value = ""

  const btn = document.getElementById("saveItemBtn")
  if(btn) btn.textContent = "加入商品"

  const cancelBtn = document.getElementById("cancelItemEditBtn")
  if(cancelBtn) cancelBtn.style.display = "none"
}

function cancelItemEdit(){
  clearItemForm()
  toggleItemForm(false)
}

async function editBatchItem(itemId){
  const { data, error } = await supabase
    .from("accounting_batch_items")
    .select("*")
    .eq("id", itemId)
    .single()

  if(error || !data){
    console.error("editBatchItem error:", error)
    alert("讀取商品明細失敗")
    return
  }

  editingItemId = data.id
    document.getElementById("itemFormTitle").textContent = "編輯批次商品"

  document.getElementById("batch_select").value = data.batch_id
  document.getElementById("product_select").value = data.product_id
const selectedBatch = batchOptions.find(b => b.id === data.batch_id)
document.getElementById("batch_search_input").value = selectedBatch
  ? `${selectedBatch.batch_date}｜${selectedBatch.batch_name}`
  : ""


  await loadVariantsForSettlement()

  document.getElementById("variant_select").value = data.variant_id
document.getElementById("item_qty").value = data.qty ?? 1
document.getElementById("unit_price_original").value = data.unit_price_original ?? 0
document.getElementById("sale_price_override").value = data.sale_price_override ?? ""
document.getElementById("unit_weight").value = data.unit_weight ?? 0
document.getElementById("second_payment_fee").value = data.second_payment_fee ?? 0
document.getElementById("item_note").value = data.note || ""

  const btn = document.getElementById("saveItemBtn")
if(btn) btn.textContent = "更新商品"

const cancelBtn = document.getElementById("cancelItemEditBtn")
if(cancelBtn) cancelBtn.style.display = "inline-block"

await updateBatchWeightInfo(data.batch_id)

toggleItemForm(true)

document.getElementById("itemFormCard")?.scrollIntoView({
  behavior: "smooth",
  block: "center"
})
}

async function deleteBatchItem(itemId){
  const ok = confirm("確定要刪除這筆商品明細嗎？")
  if(!ok) return

  const { data: oldItem, error: readError } = await supabase
    .from("accounting_batch_items")
    .select("batch_id")
    .eq("id", itemId)
    .single()

  if(readError || !oldItem){
    console.error("read old item error:", readError)
    alert("讀取原商品明細失敗")
    return
  }

  const { error } = await supabase
    .from("accounting_batch_items")
    .delete()
    .eq("id", itemId)

  if(error){
    console.error("deleteBatchItem error:", error)
    alert("刪除商品明細失敗")
    return
  }

   if(editingItemId === itemId){
    clearItemForm()
    toggleItemForm(false)
  }

if(document.getElementById("batch_select").value === oldItem.batch_id){
  await updateBatchWeightInfo(oldItem.batch_id)
}

  alert("商品明細已刪除")
  await loadBatches()
}

/* =========================
   載入 / 顯示
========================= */

async function loadBatches(){
   const searchInput = document.getElementById("batch_search")
  if(searchInput){
    searchInput.disabled = true
    searchInput.placeholder = "資料載入中..."
  }
  // 1) 先抓全部批次，給下面列表用
  const { data: allData, error: allError } = await supabase
    .from("accounting_batches")
    .select("*")
    .order("batch_date", { ascending: false })
    .order("created_at", { ascending: false })

if(allError){
  console.error("load all batches error:", allError)

  if(searchInput){
    searchInput.disabled = false
    searchInput.placeholder = "搜尋批次名稱 / 訂單編號 / 貨態編號 / 建立者"
  }

  return
}

  allBatchRows = allData || []

  // 2) 再抓自己的批次，給上方商品加入用的下拉選單
  let myData = []

  if(currentUser?.id){
    const { data: ownData, error: ownError } = await supabase
      .from("accounting_batches")
      .select("*")
      .eq("created_by", currentUser.id)
      .order("batch_date", { ascending: false })
      .order("created_at", { ascending: false })

   if(ownError){
  console.error("load my batches error:", ownError)

  if(searchInput){
    searchInput.disabled = false
    searchInput.placeholder = "搜尋批次名稱 / 訂單編號 / 貨態編號 / 建立者"
  }

  return
}

    myData = ownData || []
  }

  const select = document.getElementById("batch_select")
  const currentValue = select?.value || ""

  if(select){
  select.innerHTML = `<option value="">請選擇批次</option>`

for(const b of myData){
  const option = document.createElement("option")
  option.value = String(b.id || "")
  option.textContent = `${b.batch_date || ""}｜${b.batch_name || ""}`
  select.appendChild(option)
}

    if(currentValue && myData.some(b => b.id === currentValue)){
      select.value = currentValue
    }
  }

batchOptions = myData || []
renderBatchDropdown(batchOptions)

await renderBatchList(allBatchRows)

if(searchInput){
  searchInput.disabled = false
  searchInput.placeholder = "搜尋批次名稱 / 訂單編號 / 貨態編號 / 建立者"
}
}

async function renderBatchList(batchRows){
  const container = document.getElementById("batch_list")
  const overview = document.getElementById("settlement_overview")
  container.innerHTML = ""

  if(!batchRows || batchRows.length === 0){
    if(overview){
      overview.innerHTML = ""
    }
    container.innerHTML = "目前沒有帳務批次"
    return
  }

  let currentDate = ""
  let grandTotalCost = 0
  let grandTotalSale = 0
  let grandTotalProfit = 0

for(const batch of batchRows){
  if(batch.batch_date !== currentDate){
    currentDate = batch.batch_date

    const dateTitle = document.createElement("div")
    dateTitle.className = "batch-date-group"
    const h3 = document.createElement("h3")
h3.textContent = currentDate
dateTitle.innerHTML = ""
dateTitle.appendChild(h3)
    container.appendChild(dateTitle)
  }
    const { data: items, error } = await supabase
      .from("accounting_batch_items")
      .select(`
        *,
        products(name),
        product_variants(name, price)
      `)
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: true })

    if(error){
      console.error("renderBatchList items error:", error)
    }

   const rewardUsedText = batch.is_reward_used ? "已抵用" : "未抵用"
const itemList = items || []

const totalQty = itemList.reduce((sum, item) => sum + Number(item.qty || 0), 0)

const totalWeight = itemList.reduce((sum, item) => {
  return sum + (Number(item.qty || 0) * Number(item.unit_weight || 0))
}, 0)

const shippingPerKg = Number(batch.shipping_per_kg || 0)
const estimatedInternationalShipping = totalWeight * shippingPerKg

const batchReferenceCost = calcBatchActualCost(batch, estimatedInternationalShipping)
let batchActualCost = 0

let totalSaleAmount = 0
let totalProfitAmount = 0
let totalSecondPaymentAmount = 0

for(const item of itemList){
  const m = calcItemMetrics(batch, itemList, item, estimatedInternationalShipping)
  totalSaleAmount += (m.variantPrice * m.qty) + m.secondPaymentTotal
  totalProfitAmount += m.unitProfit * m.qty
  totalSecondPaymentAmount += m.secondPaymentTotal
  batchActualCost += m.allocatedCost
}

const hasNegativeProfit = totalProfitAmount < 0
const batchCostDiff = batchReferenceCost - batchActualCost

grandTotalCost += batchActualCost
grandTotalSale += totalSaleAmount
grandTotalProfit += totalProfitAmount

let itemsHtml = ""

    if(itemList.length > 0){
      itemsHtml = `
        <table class="settlement-table">
          <thead>
            <tr>
              <th>商品</th>
              <th>規格</th>
              <th>數量</th>
              <th>原幣單價</th>
              <th>原幣小計</th>
              <th>台幣小計</th>
              <th>單件重量</th>
              <th>總重量</th>
              <th>國際運費</th>
              <th>刷卡費分攤</th>
<th>當地運費分攤</th>
<th>回饋分攤</th>
              <th>單件二補</th>
              <th>分攤後總成本</th>
              <th>單件成本</th>
              <th>扣二補後成本</th>
              <th>售價</th>
              <th>單件利潤</th>
              <th>利潤率</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${itemList.map(item => {
              const m = calcItemMetrics(batch, itemList, item, estimatedInternationalShipping)
              const profitClass = m.unitProfit < 0 ? "text-danger" : "text-profit"

              return `
              <tr>
  <td>${escapeHtml(item.products?.name || "-")}</td>
  <td>${escapeHtml(item.product_variants?.name || "-")}</td>
  <td>${m.qty}</td>
  <td>${m.unitPriceOriginal.toFixed(2)}</td>
  <td>${m.originalSubtotal.toFixed(2)}</td>
  <td>${m.twdSubtotal.toFixed(2)}</td>
  <td>${m.unitWeight.toFixed(3)}</td>
  <td>${m.totalWeight.toFixed(3)}</td>
<td>${m.allocatedInternationalShipping.toFixed(2)}</td>
<td>${m.allocatedCardFee.toFixed(2)}</td>
<td>${m.allocatedLocalShipping.toFixed(2)}</td>
<td>${m.allocatedReward.toFixed(2)}</td>
<td>${m.secondPaymentFee.toFixed(2)}</td>
<td>${m.allocatedCost.toFixed(2)}</td>
<td>${m.unitCost.toFixed(2)}</td>
<td>${m.netUnitCost.toFixed(2)}</td>
<td>
  ${m.variantPrice.toFixed(2)}
  ${item.sale_price_override !== null && item.sale_price_override !== undefined
    ? `<div class="small-muted">手動售價</div>`
    : ``}
</td>
  <td class="${profitClass}">${m.unitProfit.toFixed(2)}</td>
  <td class="${profitClass}">${m.profitRate.toFixed(1)}%</td>
  <td>${escapeHtml(item.note || "-")}</td>
  <td>
  <button type="button" class="btn-secondary btn-sm edit-item-btn" data-id="${escapeHtml(item.id)}">編輯</button>
<button type="button" class="btn-cancel btn-sm delete-item-btn" data-id="${escapeHtml(item.id)}">刪除</button>
  </td>
</tr>
              `
            }).join("")}
          </tbody>
        </table>
      `
    }else{
      itemsHtml = `<div style="color:#888;">此批次尚未加入商品</div>`
    }

    const batchCard = document.createElement("div")
    batchCard.className = hasNegativeProfit ? "batch-card batch-card-danger" : "batch-card"



    batchCard.innerHTML = `
      <div class="batch-header">
        <div class="batch-header-top">
          <h3>
            ${escapeHtml(batch.batch_date || "-")}｜${escapeHtml(batch.batch_name || "-")}
            ${hasNegativeProfit ? `<span class="danger-badge">負利潤</span>` : ``}
          </h3>

          <div class="batch-actions">
<button type="button" class="btn-secondary btn-sm edit-batch-btn" data-id="${escapeHtml(batch.id)}">編輯批次</button>
<button type="button" class="btn-cancel btn-sm delete-batch-btn" data-id="${escapeHtml(batch.id)}">刪除批次</button>
          </div>
        </div>

      <div class="batch-quick-info">
  <div><b>建立者：</b>${
    batch.created_by === "fa754f11-9a7e-4ced-8cbb-da30f01292e0"
      ? "青"
      : batch.created_by === "6dfc15fc-dacc-4515-ae56-49a8722fe534"
      ? "媛媛"
      : "-"
  }</div>
  <div><b>購買來源：</b>${escapeHtml(batch.purchase_source || "-")}</div>
  <div><b>官方訂單編號：</b>${escapeHtml(batch.official_order_no || "-")}</div>
  <div><b>貨態編號：</b>${escapeHtml(batch.cargo_no || "-")}</div>
</div>

        <div class="batch-tags">
          <span class="status-tag stock-${batch.stock_status || "pending"}">
            ${formatStockStatus(batch.stock_status)}
          </span>
          <span class="status-tag ${batch.packed_status ? "packed-yes" : "packed-no"}">
            ${batch.packed_status ? "已打包回台" : "未打包回台"}
          </span>
        </div>
       <div class="batch-summary">
  <span>購買商品件數：${totalQty}</span>
  <span>批次總重量：${totalWeight.toFixed(3)}</span>
  <span>二補總額：${totalSecondPaymentAmount.toFixed(2)}</span>
  <span>批次參考總額：${batchReferenceCost.toFixed(2)}</span>
  <span>商品試算總成本：${batchActualCost.toFixed(2)}</span>
  <span class="${Math.abs(batchCostDiff) > 1 ? "text-danger" : ""}">
    差額：${batchCostDiff.toFixed(2)}
  </span>
  <span>售價總額：${totalSaleAmount.toFixed(2)}</span>
  <span class="${totalProfitAmount < 0 ? "text-danger" : "text-profit"}">
    總利潤：${totalProfitAmount.toFixed(2)}
  </span>
</div>

    

        <div class="batch-detail-block expanded">
          <div>入庫時間：${formatDateTime(batch.stocked_at)}</div>
          <div>打包回台時間：${formatDateTime(batch.packed_at)}</div>
          <div>刷卡人：${escapeHtml(batch.payer_name || "-")}</div>
          <div>銀行：${escapeHtml(batch.bank_name || "-")} / ${escapeHtml(batch.card_name || "-")}</div>
          <div>原幣：${batch.currency} ${Number(batch.amount_original || 0).toFixed(2)}</div>
          <div>台幣：${Number(batch.amount_twd_final || 0).toFixed(2)}</div>
          <div>刷卡手續費：${Number(batch.card_fee || 0).toFixed(2)}</div>
          <div>匯率：${Number(batch.exchange_rate || 0).toFixed(4)}</div>
         <div>
  當地運費：${Number(batch.local_shipping || 0).toFixed(2)}
  ／折台幣：${(Number(batch.local_shipping || 0) * Number(batch.exchange_rate || 0)).toFixed(2)}
</div>
          <div>每公斤國際運費：${Number(batch.shipping_per_kg || 0).toFixed(2)}</div>
          <div>回饋：${Number(batch.reward_amount || 0).toFixed(2)}（${rewardUsedText}）</div>
          <div>備註：${escapeHtml(batch.note || "-")}</div>
        </div>
      </div>

     <div class="batch-items-block expanded">
        ${itemsHtml}
      </div>
    `

batchCard.querySelectorAll(".edit-item-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    editBatchItem(btn.dataset.id || "")
  })
})

batchCard.querySelectorAll(".delete-item-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    deleteBatchItem(btn.dataset.id || "")
  })
})

batchCard.querySelectorAll(".edit-batch-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    editBatch(btn.dataset.id || "")
  })
})

batchCard.querySelectorAll(".delete-batch-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    deleteBatch(btn.dataset.id || "")
  })
})

      container.appendChild(batchCard)
  }

  if(overview){
    overview.innerHTML = `
      <div class="overview-card">
        <div class="overview-item">
          <div class="overview-label">目前帳列成本</div>
          <div class="overview-value">NT$ ${grandTotalCost.toFixed(2)}</div>
        </div>

        <div class="overview-item">
          <div class="overview-label">預計銷售金額</div>
          <div class="overview-value">NT$ ${grandTotalSale.toFixed(2)}</div>
        </div>

        <div class="overview-item">
          <div class="overview-label">總利潤（未扣包材）</div>
          <div class="overview-value ${grandTotalProfit < 0 ? "text-danger" : "text-profit"}">
            NT$ ${grandTotalProfit.toFixed(2)}
          </div>
        </div>
      </div>
    `
  }
}

async function updateBatchWeightInfo(batchId){
  const weightInput = document.getElementById("batch_total_weight")
  const shippingInput = document.getElementById("estimated_international_shipping")

  if(!weightInput || !shippingInput){
    return
  }

  if(!batchId){
    weightInput.value = 0
    shippingInput.value = 0
    return
  }

  const { data: batchData, error: batchError } = await supabase
    .from("accounting_batches")
    .select("shipping_per_kg")
    .eq("id", batchId)
    .single()

  if(batchError){
    console.error("read batch shipping_per_kg error:", batchError)
    weightInput.value = 0
    shippingInput.value = 0
    return
  }

  const { data, error } = await supabase
    .from("accounting_batch_items")
    .select("qty, unit_weight")
    .eq("batch_id", batchId)

  if(error){
    console.error("updateBatchWeightInfo error:", error)
    weightInput.value = 0
    shippingInput.value = 0
    return
  }

  const totalWeight = (data || []).reduce((sum, row) => {
    return sum + (Number(row.qty || 0) * Number(row.unit_weight || 0))
  }, 0)

  const shippingPerKg = Number(batchData?.shipping_per_kg || 0)
  const estimatedInternationalShipping = totalWeight * shippingPerKg

  weightInput.value = totalWeight.toFixed(3)
  shippingInput.value = estimatedInternationalShipping.toFixed(2)
}

function updateEstimatedShippingOnly(){
  const totalWeight = Number(document.getElementById("batch_total_weight")?.value || 0)
  const shippingPerKg = Number(document.getElementById("shipping_per_kg")?.value || 0)
  const shippingInput = document.getElementById("estimated_international_shipping")

  if(!shippingInput) return

  shippingInput.value = (totalWeight * shippingPerKg).toFixed(2)
}

async function filterBatchList(){
  if(isBatchLoading){
  return
}
  const keyword = document.getElementById("batch_search")?.value.trim().toLowerCase() || ""
  const stockStatus = document.getElementById("stock_status_search")?.value || ""
  const packedStatus = document.getElementById("packed_status_search")?.value || ""
  const startDate = document.getElementById("batch_date_start")?.value || ""
  const endDate = document.getElementById("batch_date_end")?.value || ""
  const creatorId = document.getElementById("creator_search")?.value || ""

  const filtered = allBatchRows.filter(batch => {
    const batchName = String(batch.batch_name || "").toLowerCase()
    const officialOrderNo = String(batch.official_order_no || "").toLowerCase()
    const cargoNo = String(batch.cargo_no || "").toLowerCase()
    const creatorName =
  batch.created_by === "fa754f11-9a7e-4ced-8cbb-da30f01292e0"
    ? "青"
    : batch.created_by === "6dfc15fc-dacc-4515-ae56-49a8722fe534"
    ? "媛媛"
    : ""
    const batchDate = String(batch.batch_date || "")

  const matchKeyword =
  !keyword ||
  batchName.includes(keyword) ||
  officialOrderNo.includes(keyword) ||
  cargoNo.includes(keyword) ||
  creatorName.includes(keyword)   // ⭐ 加這行

    const matchStockStatus =
      !stockStatus ||
      String(batch.stock_status || "") === stockStatus

    const matchPackedStatus =
      !packedStatus ||
      String(!!batch.packed_status) === packedStatus

    const matchStartDate =
      !startDate ||
      batchDate >= startDate

    const matchEndDate =
      !endDate ||
      batchDate <= endDate

    const matchCreator =
      !creatorId ||
      String(batch.created_by || "") === creatorId

    return (
      matchKeyword &&
      matchStockStatus &&
      matchPackedStatus &&
      matchStartDate &&
      matchEndDate &&
      matchCreator
    )
  })

  await renderBatchList(filtered)
}


function formatStockStatus(status){
  switch(status){
    case "pending":
      return "未入庫"
    case "in_transit":
      return "運送中"
    case "arrived":
      return "已到貨未入庫"
    case "stocked":
      return "已入庫"
    default:
      return "-"
  }
}

function formatDateTime(value){
  if(!value) return "-"
  const d = new Date(value)
  if(isNaN(d.getTime())) return "-"
  return d.toLocaleString("zh-TW", { hour12: false })
}

async function exportSettlementCsv(){
  const keyword = document.getElementById("batch_search")?.value.trim().toLowerCase() || ""
  const stockStatus = document.getElementById("stock_status_search")?.value || ""
  const packedStatus = document.getElementById("packed_status_search")?.value || ""
  const startDate = document.getElementById("batch_date_start")?.value || ""
  const endDate = document.getElementById("batch_date_end")?.value || ""
  const creatorId = document.getElementById("creator_search")?.value || ""

  const filtered = allBatchRows.filter(batch => {
    const batchName = String(batch.batch_name || "").toLowerCase()
    const officialOrderNo = String(batch.official_order_no || "").toLowerCase()
    const cargoNo = String(batch.cargo_no || "").toLowerCase()
    const batchDate = String(batch.batch_date || "")

    const matchKeyword =
      !keyword ||
      batchName.includes(keyword) ||
      officialOrderNo.includes(keyword) ||
      cargoNo.includes(keyword)

    const matchStockStatus =
      !stockStatus ||
      String(batch.stock_status || "") === stockStatus

    const matchPackedStatus =
      !packedStatus ||
      String(!!batch.packed_status) === packedStatus

    const matchStartDate =
      !startDate ||
      batchDate >= startDate

    const matchEndDate =
      !endDate ||
      batchDate <= endDate

    const matchCreator =
      !creatorId ||
      String(batch.created_by || "") === creatorId

    return (
      matchKeyword &&
      matchStockStatus &&
      matchPackedStatus &&
      matchStartDate &&
      matchEndDate &&
      matchCreator
    )
  })

  const rows = [[
  "批次日期",
  "批次名稱",
  "購買來源",
  "官方訂單編號",
  "貨態編號",
    "入庫狀態",
    "入庫時間",
    "是否已打包回台",
    "打包回台時間",
    "商品名稱",
    "規格",
    "數量",
    "原幣單價",
    "售價",
    "商品備註"
  ]]

  for(const batch of filtered){
    const { data: items, error } = await supabase
      .from("accounting_batch_items")
      .select(`
        *,
        products(name),
        product_variants(name, price)
      `)
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: true })

    if(error){
      console.error("exportSettlementCsv items error:", error)
      continue
    }

    const itemList = items || []

    if(itemList.length === 0){
     rows.push([
  batch.batch_date || "",
  batch.batch_name || "",
  batch.purchase_source || "",
  batch.official_order_no || "",
  batch.cargo_no || "",
  formatStockStatus(batch.stock_status),
        formatDateTime(batch.stocked_at),
        batch.packed_status ? "是" : "否",
        formatDateTime(batch.packed_at),
        "",
        "",
        "",
        "",
        "",
        ""
      ])
      continue
    }

    for(const item of itemList){
      const salePrice =
        item.sale_price_override !== null && item.sale_price_override !== undefined
          ? Number(item.sale_price_override || 0)
          : Number(item.product_variants?.price || 0)

      rows.push([
  batch.batch_date || "",
  batch.batch_name || "",
  batch.purchase_source || "",
  batch.official_order_no || "",
  batch.cargo_no || "",
  formatStockStatus(batch.stock_status),
        formatDateTime(batch.stocked_at),
        batch.packed_status ? "是" : "否",
        formatDateTime(batch.packed_at),
        item.products?.name || "",
        item.product_variants?.name || "",
        Number(item.qty || 0),
        Number(item.unit_price_original || 0).toFixed(2),
        salePrice.toFixed(2),
        item.note || ""
      ])
    }
  }

  const csvContent = "\uFEFF" + rows.map(row =>
    row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")
  ).join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "settlement_export.csv"
  link.click()
  URL.revokeObjectURL(url)
}

function renderBatchDropdown(list){
  const dropdown = document.getElementById("batch_dropdown")
  dropdown.innerHTML = ""

  list.forEach(b => {
    const div = document.createElement("div")
    div.className = "batch-option"
    div.textContent = `${b.batch_date}｜${b.batch_name}`

    div.onclick = () => {
      document.getElementById("batch_select").value = b.id
      document.getElementById("batch_search_input").value = `${b.batch_date}｜${b.batch_name}`
      dropdown.style.display = "none"

      updateBatchWeightInfo(b.id)
    }

    dropdown.appendChild(div)
  })
}

function filterBatchDropdown(keyword){
  const text = String(keyword || "").trim().toLowerCase()

  const filtered = batchOptions.filter(b => {
    const batchDate = String(b.batch_date || "").toLowerCase()
    const batchName = String(b.batch_name || "").toLowerCase()
    const purchaseSource = String(b.purchase_source || "").toLowerCase()
    const officialOrderNo = String(b.official_order_no || "").toLowerCase()
    const cargoNo = String(b.cargo_no || "").toLowerCase()

    return (
      batchDate.includes(text) ||
      batchName.includes(text) ||
      purchaseSource.includes(text) ||
      officialOrderNo.includes(text) ||
      cargoNo.includes(text)
    )
  })

  renderBatchDropdown(filtered)
}

function renderBatchListSearchDropdown(list){
  const dropdown = document.getElementById("batch_search_dropdown")
  if(!dropdown) return

  dropdown.innerHTML = ""

  list.forEach(batch => {
    const div = document.createElement("div")
    div.className = "batch-search-option"
    div.textContent = `${batch.batch_date || "-"}｜${batch.batch_name || "-"}｜${batch.official_order_no || "-"}｜${batch.cargo_no || "-"}`

  div.onclick = () => {
  const input = document.getElementById("batch_search")
  if(input){
    input.value = `${batch.batch_name || ""}`.trim()
  }
  dropdown.style.display = "none"
  filterBatchList()
}

    dropdown.appendChild(div)
  })
}

function filterBatchListSearchDropdown(keyword){
  const text = String(keyword || "").trim().toLowerCase()

  const filtered = allBatchRows.filter(batch => {
    const batchName = String(batch.batch_name || "").toLowerCase()
    const officialOrderNo = String(batch.official_order_no || "").toLowerCase()
    const cargoNo = String(batch.cargo_no || "").toLowerCase()
    const purchaseSource = String(batch.purchase_source || "").toLowerCase()
    const batchDate = String(batch.batch_date || "").toLowerCase()

    return (
      batchName.includes(text) ||
      officialOrderNo.includes(text) ||
      cargoNo.includes(text) ||
      purchaseSource.includes(text) ||
      batchDate.includes(text)
    )
  })

  renderBatchListSearchDropdown(filtered)
}