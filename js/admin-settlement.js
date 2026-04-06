import { supabase } from "./supabase.js"

let editingBatchId = null
let editingItemId = null
let allBatchRows = []
let batchSearchTimer = null

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

init()

async function init(){
  bindAutoCalc()
  ensureActionButtons()

  document.getElementById("batch_select")?.addEventListener("change", async (e) => {
    await updateBatchWeightInfo(e.target.value)
  })

  document.getElementById("shipping_per_kg")?.addEventListener("input", () => {
    updateEstimatedShippingOnly()
  })

document.getElementById("batch_search")?.addEventListener("input", () => {
  clearTimeout(batchSearchTimer)
  batchSearchTimer = setTimeout(() => {
    filterBatchList()
  }, 300)
})

document.getElementById("stock_status_search")?.addEventListener("change", filterBatchList)
document.getElementById("packed_status_search")?.addEventListener("change", filterBatchList)
document.getElementById("batch_date_start")?.addEventListener("change", filterBatchList)
document.getElementById("batch_date_end")?.addEventListener("change", filterBatchList)

await loadBatches()
await loadProducts()
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

function updateRewardAmount(){
  const twd = Number(document.getElementById("amount_twd_final").value || 0)
  const rewardRate = Number(document.getElementById("reward_rate").value || 0)
  document.getElementById("reward_amount").value = (twd * rewardRate).toFixed(2)
}

/* =========================
   共用計算
========================= */

function calcBatchActualCost(batch){
  const amountTwd = Number(batch.amount_twd_final || 0)
  const cardFee = Number(batch.card_fee || 0)
  const rewardAmount = Number(batch.reward_amount || 0)
  const isRewardUsed = !!batch.is_reward_used

  let total = amountTwd + cardFee

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

  const totalItemsTwdSubtotal = items.reduce((sum, row) => {
    return sum + (Number(row.qty || 0) * Number(row.unit_price_original || 0) * exchangeRate)
  }, 0)

  let allocatedInternationalShipping = 0

  if(totalItemsTwdSubtotal > 0){
    allocatedInternationalShipping =
      estimatedInternationalShipping * (twdSubtotal / totalItemsTwdSubtotal)
  }

  const batchBaseCost = calcBatchActualCost(batch)
  let allocatedBaseCost = 0

  if(totalItemsTwdSubtotal > 0){
    allocatedBaseCost = batchBaseCost * (twdSubtotal / totalItemsTwdSubtotal)
  }

  const allocatedCost = allocatedBaseCost + allocatedInternationalShipping

  const unitCost = qty > 0 ? allocatedCost / qty : 0
  const unitProfit = variantPrice - unitCost
  const profitRate = variantPrice > 0 ? (unitProfit / variantPrice) * 100 : 0

  return {
    qty,
    unitPriceOriginal,
    unitWeight,
    variantPrice,
    originalSubtotal,
    twdSubtotal,
    totalWeight,
    allocatedInternationalShipping,
    allocatedBaseCost,
    allocatedCost,
    unitCost,
    unitProfit,
    profitRate
  }
}

/* =========================
   批次主資料
========================= */

async function saveBatch(){
  const batch_date = document.getElementById("batch_date").value
  const batch_name = document.getElementById("batch_name").value.trim()
  const purchase_source = document.getElementById("purchase_source").value.trim()
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

const payload = {
  batch_date,
  batch_name,
  purchase_source,
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
  reward_rate,
  reward_amount,
  is_reward_used,
  note
}

  let error = null

  if(editingBatchId){
    const res = await supabase
      .from("accounting_batches")
      .update(payload)
      .eq("id", editingBatchId)

    error = res.error
  }else{
    const res = await supabase
      .from("accounting_batches")
      .insert([payload])

    error = res.error
  }

  if(error){
    console.error("saveBatch error:", error)
    alert(editingBatchId ? "更新批次失敗" : "建立批次失敗")
    return
  }

  alert(editingBatchId ? "批次更新成功" : "批次建立成功")
  clearBatchForm()
  await loadBatches()
}

function clearBatchForm(){
  editingBatchId = null

  document.getElementById("batch_date").value = ""
  document.getElementById("batch_name").value = ""
 document.getElementById("purchase_source").value = ""
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

 document.getElementById("batch_date").value = data.batch_date || ""
document.getElementById("batch_name").value = data.batch_name || ""
document.getElementById("purchase_source").value = data.purchase_source || ""
document.getElementById("cargo_no").value = data.cargo_no || ""
document.getElementById("stock_status").value = data.stock_status || "pending"
document.getElementById("packed_status").value = String(!!data.packed_status)
document.getElementById("payer_name").value = data.payer_name || ""
  document.getElementById("bank_name").value = data.bank_name || ""
  document.getElementById("card_name").value = data.card_name || ""
  document.getElementById("currency").value = data.currency || "TWD"
  document.getElementById("amount_original").value = data.amount_original ?? 0
  document.getElementById("amount_twd_final").value = data.amount_twd_final ?? 0
  document.getElementById("card_fee").value = data.card_fee ?? 0
  document.getElementById("exchange_rate").value = data.exchange_rate ?? 0
  document.getElementById("local_shipping").value = data.local_shipping ?? 0
 
  document.getElementById("reward_rate").value = data.reward_rate ?? 0
  document.getElementById("reward_amount").value = data.reward_amount ?? 0
  document.getElementById("is_reward_used").value = String(data.is_reward_used)
  document.getElementById("batch_note").value = data.note || ""

  const btn = document.getElementById("saveBatchBtn")
  if(btn) btn.textContent = "更新批次"

  const cancelBtn = document.getElementById("cancelBatchEditBtn")
  if(cancelBtn) cancelBtn.style.display = "inline-block"

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
    select.innerHTML += `<option value="${p.id}">${p.name}</option>`
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
    variantSelect.innerHTML += `
      <option value="${v.id}">
        ${v.name}｜售價:${v.price ?? 0}｜目前cost:${v.cost ?? 0}
      </option>
    `
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
  await loadBatches()
}

function clearItemForm(){
  editingItemId = null

  document.getElementById("batch_select").value = ""
  document.getElementById("product_select").value = ""
  document.getElementById("variant_select").innerHTML = `<option value="">請先選規格</option>`
  document.getElementById("item_qty").value = 1
  document.getElementById("unit_price_original").value = 0
  document.getElementById("sale_price_override").value = ""
  document.getElementById("unit_weight").value = 0
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

  document.getElementById("batch_select").value = data.batch_id
  document.getElementById("product_select").value = data.product_id

  await loadVariantsForSettlement()

  document.getElementById("variant_select").value = data.variant_id
  document.getElementById("item_qty").value = data.qty ?? 1
document.getElementById("unit_price_original").value = data.unit_price_original ?? 0
document.getElementById("sale_price_override").value = data.sale_price_override ?? ""
document.getElementById("unit_weight").value = data.unit_weight ?? 0
document.getElementById("item_note").value = data.note || ""

  const btn = document.getElementById("saveItemBtn")
if(btn) btn.textContent = "更新商品"

const cancelBtn = document.getElementById("cancelItemEditBtn")
if(cancelBtn) cancelBtn.style.display = "inline-block"

await updateBatchWeightInfo(data.batch_id)

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
  const { data, error } = await supabase
    .from("accounting_batches")
    .select("*")
    .order("batch_date", { ascending: false })
    .order("created_at", { ascending: false })


    allBatchRows = data || []
  if(error){
    console.error("loadBatches error:", error)
    return
  }

  const select = document.getElementById("batch_select")
  const currentValue = select.value

  select.innerHTML = `<option value="">請選擇批次</option>`

  for(const b of data || []){
    select.innerHTML += `<option value="${b.id}">${b.batch_date}｜${b.batch_name}</option>`
  }

  if(currentValue){
    select.value = currentValue
  }

  await renderBatchList(allBatchRows)
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
    dateTitle.innerHTML = `<h3>${currentDate}</h3>`
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

const shippingPerKg = Number(document.getElementById("shipping_per_kg")?.value || 0)
const estimatedInternationalShipping = totalWeight * shippingPerKg

const batchBaseCost = calcBatchActualCost(batch)
const batchActualCost = batchBaseCost + estimatedInternationalShipping

let totalSaleAmount = 0
let totalProfitAmount = 0

for(const item of itemList){
  const m = calcItemMetrics(batch, itemList, item, estimatedInternationalShipping)
  totalSaleAmount += m.variantPrice * m.qty
  totalProfitAmount += m.unitProfit * m.qty
}

const hasNegativeProfit = totalProfitAmount < 0

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
              <th>分攤後總成本</th>
              <th>單件成本</th>
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
  <td>${item.products?.name || "-"}</td>
  <td>${item.product_variants?.name || "-"}</td>
  <td>${m.qty}</td>
  <td>${m.unitPriceOriginal.toFixed(2)}</td>
  <td>${m.originalSubtotal.toFixed(2)}</td>
  <td>${m.twdSubtotal.toFixed(2)}</td>
  <td>${m.unitWeight.toFixed(3)}</td>
  <td>${m.totalWeight.toFixed(3)}</td>
  <td>${m.allocatedInternationalShipping.toFixed(2)}</td>
  <td>${m.allocatedCost.toFixed(2)}</td>
  <td>${m.unitCost.toFixed(2)}</td>
  <td>
  ${m.variantPrice.toFixed(2)}
  ${item.sale_price_override !== null && item.sale_price_override !== undefined
    ? `<div class="small-muted">手動售價</div>`
    : ``}
</td>
  <td class="${profitClass}">${m.unitProfit.toFixed(2)}</td>
  <td class="${profitClass}">${m.profitRate.toFixed(1)}%</td>
  <td>${item.note || "-"}</td>
  <td>
    <button type="button" class="btn-secondary btn-sm" onclick="editBatchItem('${item.id}')">編輯</button>
    <button type="button" class="btn-cancel btn-sm" onclick="deleteBatchItem('${item.id}')">刪除</button>
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
  ${batch.batch_date}｜${batch.batch_name}
  ${hasNegativeProfit ? `<span class="danger-badge">負利潤</span>` : ``}
</h3>
          <div class="batch-actions">
            <button type="button" class="btn-secondary btn-sm" onclick="editBatch('${batch.id}')">編輯批次</button>
            <button type="button" class="btn-cancel btn-sm" onclick="deleteBatch('${batch.id}')">刪除批次</button>
          </div>
        </div>
        <div>購買來源：${batch.purchase_source || "-"}</div>
<div>貨態編號：${batch.cargo_no || "-"}</div>
<div>入庫狀態：${formatStockStatus(batch.stock_status)}</div>
<div>入庫時間：${formatDateTime(batch.stocked_at)}</div>
<div>是否已打包回台：${batch.packed_status ? "是" : "否"}</div>
<div>打包回台時間：${formatDateTime(batch.packed_at)}</div>
<div>刷卡人：${batch.payer_name || "-"}</div>
        <div>銀行：${batch.bank_name || "-"} / ${batch.card_name || "-"}</div>
        <div>原幣：${batch.currency} ${Number(batch.amount_original || 0).toFixed(2)}</div>
        <div>台幣：${Number(batch.amount_twd_final || 0).toFixed(2)}</div>
        <div>刷卡手續費：${Number(batch.card_fee || 0).toFixed(2)}</div>
        <div>匯率：${Number(batch.exchange_rate || 0).toFixed(4)}</div>
        <div>當地運費（已含刷卡）：${Number(batch.local_shipping || 0).toFixed(2)}</div>
        <div>回饋：${Number(batch.reward_amount || 0).toFixed(2)}（${rewardUsedText}）</div>
    <div class="batch-summary">
  <span>購買商品件數：${totalQty}</span>
  <span>批次總重量：${totalWeight.toFixed(3)}</span>
  <span>總成本：${batchActualCost.toFixed(2)}</span>
  <span>售價總額：${totalSaleAmount.toFixed(2)}</span>
  <span class="${totalProfitAmount < 0 ? "text-danger" : "text-profit"}">
    總利潤：${totalProfitAmount.toFixed(2)}
  </span>
</div>
        <div>備註：${batch.note || "-"}</div>
      </div>

      <div class="batch-items">
        ${itemsHtml}
      </div>
    `

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

  const shippingPerKg = Number(document.getElementById("shipping_per_kg")?.value || 0)
  const estimatedShipping = totalWeight * shippingPerKg

  weightInput.value = totalWeight.toFixed(3)
  shippingInput.value = estimatedShipping.toFixed(2)
}

function updateEstimatedShippingOnly(){
  const totalWeight = Number(document.getElementById("batch_total_weight")?.value || 0)
  const shippingPerKg = Number(document.getElementById("shipping_per_kg")?.value || 0)
  const shippingInput = document.getElementById("estimated_international_shipping")

  if(!shippingInput) return

  shippingInput.value = (totalWeight * shippingPerKg).toFixed(2)
}

async function filterBatchList(){
  const keyword = document.getElementById("batch_search")?.value.trim().toLowerCase() || ""
  const stockStatus = document.getElementById("stock_status_search")?.value || ""
  const packedStatus = document.getElementById("packed_status_search")?.value || ""
  const startDate = document.getElementById("batch_date_start")?.value || ""
  const endDate = document.getElementById("batch_date_end")?.value || ""

  const filtered = allBatchRows.filter(batch => {
    const batchName = String(batch.batch_name || "").toLowerCase()
    const cargoNo = String(batch.cargo_no || "").toLowerCase()
    const batchDate = String(batch.batch_date || "")

    const matchKeyword =
      !keyword ||
      batchName.includes(keyword) ||
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

    return (
      matchKeyword &&
      matchStockStatus &&
      matchPackedStatus &&
      matchStartDate &&
      matchEndDate
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

  const filtered = allBatchRows.filter(batch => {
    const batchName = String(batch.batch_name || "").toLowerCase()
    const cargoNo = String(batch.cargo_no || "").toLowerCase()
    const batchDate = String(batch.batch_date || "")

    const matchKeyword =
      !keyword ||
      batchName.includes(keyword) ||
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

    return (
      matchKeyword &&
      matchStockStatus &&
      matchPackedStatus &&
      matchStartDate &&
      matchEndDate
    )
  })

  const rows = [[
    "批次日期",
    "批次名稱",
    "購買來源",
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