import { supabase } from "./supabase.js"

let returnedBatches = []
let allItems = []
let mergedItems = []

const els = {
  filterReturnMonth: document.getElementById("filterReturnMonth"),
  reloadBtn: document.getElementById("reloadBtn"),
  printBtn: document.getElementById("printBtn"),

  printTitle: document.getElementById("printTitle"),
  printSubtitle: document.getElementById("printSubtitle"),

  batchCount: document.getElementById("batchCount"),
  productTypeCount: document.getElementById("productTypeCount"),
  quantityTotal: document.getElementById("quantityTotal"),

  pickingTbody: document.getElementById("pickingTbody"),
  batchTbody: document.getElementById("batchTbody"),
}

init()

function init(){
  els.filterReturnMonth.value = getCurrentMonth()

  els.reloadBtn?.addEventListener("click", loadReturnedData)
  els.filterReturnMonth?.addEventListener("change", loadReturnedData)
  els.printBtn?.addEventListener("click", () => window.print())

  loadReturnedData()
}

async function loadReturnedData(){
  const month = els.filterReturnMonth.value || getCurrentMonth()
  const { startDate, endDate } = getMonthRange(month)

  els.pickingTbody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-cell">資料載入中...</td>
    </tr>
  `

  els.batchTbody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-cell">資料載入中...</td>
    </tr>
  `

  const { data, error } = await supabase
    .from("purchase_batches")
    .select(`
      *,
      products (
        id,
        name
      ),
      purchase_batch_items (
        id,
        product_id,
        variant_id,
        product_name,
        variant_name,
        quantity,
        item_note,
        products (
          id,
          name
        )
      )
    `)
    .gte("return_to_taiwan_date", startDate)
    .lt("return_to_taiwan_date", endDate)
    .order("return_to_taiwan_date", { ascending: true })
    .order("created_at", { ascending: true })

  if(error){
    console.error("loadReturnedData error:", error)

    els.pickingTbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">載入失敗：${escapeHtml(error.message)}</td>
      </tr>
    `

    return
  }

  returnedBatches = data || []
  allItems = flattenItems(returnedBatches)
  mergedItems = mergeItems(allItems)

  renderSummary()
  renderPickingTable()
  renderBatchTable()
  renderPrintTitle()
}

function flattenItems(batches){
  const result = []

  batches.forEach(batch => {
    const items = batch.purchase_batch_items || []

    items.forEach(item => {
      result.push({
        batch_id: batch.id,
        return_to_taiwan_date: batch.return_to_taiwan_date,
        official_order_no: batch.official_order_no || "",
        tracking_no: batch.tracking_no || "",
        batch_product_name: batch.products?.name || "",
        card_holder: batch.card_holder || "",
        bank_name: batch.bank_name || "",
        card_name: batch.card_name || "",

        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name || item.products?.name || "",
        variant_name: item.variant_name || "",
        quantity: Number(item.quantity || 0),
        item_note: item.item_note || "",
      })
    })
  })

  return result
}

function mergeItems(items){
  const map = new Map()

  items.forEach(item => {
    const key = [
      item.product_id || item.product_name,
      item.variant_id || item.variant_name,
    ].join("__")

    const current = map.get(key) || {
      product_name: item.product_name,
      variant_name: item.variant_name,
      quantity: 0,
      notes: new Set(),
      sources: [],
      returnDates: new Set(),
    }

    current.quantity += Number(item.quantity || 0)

    if(item.item_note){
      current.notes.add(item.item_note)
    }

    if(item.return_to_taiwan_date){
      current.returnDates.add(formatDate(item.return_to_taiwan_date))
    }

    current.sources.push({
      official_order_no: item.official_order_no,
      tracking_no: item.tracking_no,
      return_to_taiwan_date: item.return_to_taiwan_date,
    })

    map.set(key, current)
  })

  return [...map.values()]
    .sort((a, b) => {
      const nameCompare = a.product_name.localeCompare(b.product_name, "zh-TW")
      if(nameCompare !== 0) return nameCompare
      return a.variant_name.localeCompare(b.variant_name, "zh-TW")
    })
}

function renderSummary(){
  const quantityTotal = mergedItems.reduce((total, item) => {
    return total + Number(item.quantity || 0)
  }, 0)

  els.batchCount.textContent = returnedBatches.length
  els.productTypeCount.textContent = mergedItems.length
  els.quantityTotal.textContent = quantityTotal
}

function renderPickingTable(){
  if(mergedItems.length === 0){
    els.pickingTbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">這個月份沒有回台商品明細</td>
      </tr>
    `
    return
  }

  els.pickingTbody.innerHTML = mergedItems.map(item => `
    <tr>
      <td>
        <input type="checkbox" class="picking-checkbox">
      </td>

      <td>${escapeHtml(item.product_name || "-")}</td>
      <td>${escapeHtml(item.variant_name || "-")}</td>
      <td>${formatMoney(item.quantity)}</td>

      <td>
        <div class="source-list">
          ${item.sources.map(source => {
            return [
              source.official_order_no ? `訂單：${escapeHtml(source.official_order_no)}` : "",
              source.tracking_no ? `貨態：${escapeHtml(source.tracking_no)}` : "",
            ].filter(Boolean).join(" / ")
          }).filter(Boolean).join("<br>")}
        </div>
      </td>

      <td>${escapeHtml([...item.returnDates].join("、") || "-")}</td>
      <td>${escapeHtml([...item.notes].join("、") || "")}</td>
    </tr>
  `).join("")
}

function renderBatchTable(){
  if(returnedBatches.length === 0){
    els.batchTbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">這個月份沒有回台刷卡單</td>
      </tr>
    `
    return
  }

  els.batchTbody.innerHTML = returnedBatches.map(batch => `
    <tr>
      <td>${escapeHtml(formatDate(batch.return_to_taiwan_date))}</td>
      <td>${escapeHtml(batch.products?.name || "-")}</td>
      <td>${escapeHtml(batch.official_order_no || "")}</td>
      <td>${escapeHtml(batch.tracking_no || "")}</td>
      <td>${escapeHtml(batch.card_holder || "")}</td>
      <td>${escapeHtml(formatBankCard(batch))}</td>
      <td>
        <a href="./admin-card-purchase-detail.html?id=${batch.id}" class="small-btn">
          查看
        </a>
      </td>
    </tr>
  `).join("")
}

function renderPrintTitle(){
  const month = els.filterReturnMonth.value || getCurrentMonth()
  const label = month.replace("-", "/")

  els.printTitle.textContent = `${label} 回台點貨單`
  els.printSubtitle.textContent = `回台單數：${returnedBatches.length}｜商品種類：${mergedItems.length}｜總件數：${els.quantityTotal.textContent}`
}

function getMonthRange(monthText){
  const [year, month] = monthText.split("-").map(Number)
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`

  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  return { startDate, endDate }
}

function getCurrentMonth(){
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function formatDate(dateText){
  if(!dateText) return ""
  return String(dateText).replaceAll("-", "/")
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

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}