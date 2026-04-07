import { supabase } from "./supabase.js"
import { loadAuth } from "./auth.js"

let currentUser = null
let allRecords = []
let allSeries = []
let isSubmitting = false

const $ = (id) => document.getElementById(id)

init()

async function init() {
  currentUser = await loadAuth()
  if (!currentUser) return

  bindEvents()
  setTodayDefault()
  updatePreview()
  await loadSeriesOptions()
  await loadRecords()
}

function bindEvents() {
  $("openFormBtn").addEventListener("click", openCreateForm)
  $("closeFormBtn").addEventListener("click", closeForm)
  $("cancelBtn").addEventListener("click", closeForm)
  $("searchBtn").addEventListener("click", renderTable)
  $("resetBtn").addEventListener("click", resetFilters)
  $("usageForm").addEventListener("submit", handleSubmit)

  $("costPrice").addEventListener("input", updatePreview)
  $("salePrice").addEventListener("input", updatePreview)
  $("qty").addEventListener("input", updatePreview)

  $("keyword").addEventListener("input", renderTable)
  $("holderFilter").addEventListener("input", renderTable)
  $("startDate").addEventListener("change", renderTable)
  $("endDate").addEventListener("change", renderTable)
}

function setTodayDefault() {
  const today = new Date().toISOString().slice(0, 10)
  $("takenDate").value = today
}

async function loadRecords() {
  const { data, error } = await supabase
    .from("self_usage_records")
    .select("*")
    .order("taken_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error("載入自用紀錄失敗:", error)
    alert("載入自用紀錄失敗：" + error.message)
    return
  }

  allRecords = data || []
  renderTable()
}

async function loadSeriesOptions() {
  const { data, error } = await supabase
    .from("product_series")
    .select("id, name")
    .order("name", { ascending: true })

  if (error) {
    console.error("載入系列失敗:", error)
    $("seriesName").innerHTML = `<option value="">載入失敗</option>`
    return
  }

  allSeries = data || []

  $("seriesName").innerHTML = `
    <option value="">請選擇系列</option>
    ${allSeries.map(series => `
      <option value="${escapeHtml(series.name)}">${escapeHtml(series.name)}</option>
    `).join("")}
  `
}

function getFilteredRecords() {
  const keyword = $("keyword").value.trim().toLowerCase()
  const holder = $("holderFilter").value.trim().toLowerCase()
  const startDate = $("startDate").value
  const endDate = $("endDate").value

  return allRecords.filter(row => {
    const rowKeyword = [
      row.series_name,
      row.item_name,
      row.variant_name,
      row.note,
      row.holder_name
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    const matchKeyword = !keyword || rowKeyword.includes(keyword)
    const matchHolder = !holder || (row.holder_name || "").toLowerCase().includes(holder)
    const matchStart = !startDate || row.taken_date >= startDate
    const matchEnd = !endDate || row.taken_date <= endDate

    return matchKeyword && matchHolder && matchStart && matchEnd
  })
}

function renderTable() {
  const tbody = $("usageTableBody")
  const rows = getFilteredRecords()

  renderStats(rows)
  renderHolderSummary(rows)

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-row">目前沒有符合條件的資料</td>
      </tr>
    `
    return
  }

  tbody.innerHTML = rows.map(row => {
    const qty = Number(row.qty || 0)
    const costPrice = Number(row.cost_price || 0)
    const salePrice = Number(row.sale_price || 0)
    const unitProfitGap = salePrice - costPrice
    const totalProfitGap = unitProfitGap * qty

    return `
      <tr>
        <td>${escapeHtml(row.taken_date || "")}</td>
        <td>${escapeHtml(row.holder_name || "")}</td>
        <td>${escapeHtml(row.series_name || "")}</td>
        <td>${escapeHtml(row.item_name || "")}</td>
        <td>${escapeHtml(row.variant_name || "-")}</td>
        <td>${qty}</td>
        <td>${formatMoney(costPrice)}</td>
        <td>${formatMoney(salePrice)}</td>
        <td class="${unitProfitGap < 0 ? "negative" : "positive"}">
          ${formatMoney(unitProfitGap)}
        </td>
        <td class="${totalProfitGap < 0 ? "negative" : "positive"}">
          ${formatMoney(totalProfitGap)}
        </td>
        <td class="note-cell">${escapeHtml(row.note || "-")}</td>
        <td>
          <div class="action-group">
            <button class="table-btn edit" data-id="${row.id}">編輯</button>
            <button class="table-btn delete" data-id="${row.id}">刪除</button>
          </div>
        </td>
      </tr>
    `
  }).join("")

  tbody.querySelectorAll(".edit").forEach(btn => {
    btn.addEventListener("click", () => openEditForm(btn.dataset.id))
  })

  tbody.querySelectorAll(".delete").forEach(btn => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.id))
  })
}

function renderStats(rows) {
  const totalCount = rows.length

  const totalCost = rows.reduce((sum, row) => {
    return sum + (Number(row.cost_price || 0) * Number(row.qty || 0))
  }, 0)

  const totalSale = rows.reduce((sum, row) => {
    return sum + (Number(row.sale_price || 0) * Number(row.qty || 0))
  }, 0)

  const totalProfit = rows.reduce((sum, row) => {
    const qty = Number(row.qty || 0)
    const cost = Number(row.cost_price || 0)
    const sale = Number(row.sale_price || 0)
    return sum + ((sale - cost) * qty)
  }, 0)

  $("statCount").textContent = totalCount
  $("statTotalCost").textContent = formatMoney(totalCost)
  $("statTotalSale").textContent = formatMoney(totalSale)
  $("statTotalProfit").textContent = formatMoney(totalProfit)
}

function renderHolderSummary(rows) {
  const container = $("holderSummaryList")
  if (!container) return

  if (!rows.length) {
    container.innerHTML = `<div class="empty-holder-row">目前沒有資料</div>`
    return
  }

  const holderMap = {}

  rows.forEach(row => {
    const holderName = (row.holder_name || "未填寫").trim() || "未填寫"
    const qty = Number(row.qty || 0)
    const costPrice = Number(row.cost_price || 0)
    const salePrice = Number(row.sale_price || 0)

    if (!holderMap[holderName]) {
      holderMap[holderName] = {
        holderName,
        totalQty: 0,
        totalCost: 0,
        totalSale: 0,
        totalProfit: 0
      }
    }

    holderMap[holderName].totalQty += qty
    holderMap[holderName].totalCost += costPrice * qty
    holderMap[holderName].totalSale += salePrice * qty
    holderMap[holderName].totalProfit += (salePrice - costPrice) * qty
  })

  const list = Object.values(holderMap).sort((a, b) => b.totalCost - a.totalCost)

  container.innerHTML = list.map(item => `
    <div class="holder-card">
      <div class="holder-name">${escapeHtml(item.holderName)}</div>

      <div class="holder-stat">
        <span>拿走件數</span>
        <strong>${item.totalQty}</strong>
      </div>

      <div class="holder-stat">
        <span>花費成本</span>
        <strong>${formatMoney(item.totalCost)}</strong>
      </div>

      <div class="holder-stat">
        <span>原售價總額</span>
        <strong>${formatMoney(item.totalSale)}</strong>
      </div>

      <div class="holder-stat">
        <span>重疊利潤</span>
        <strong class="${item.totalProfit < 0 ? "holder-profit-negative" : "holder-profit-positive"}">
          ${formatMoney(item.totalProfit)}
        </strong>
      </div>
    </div>
  `).join("")
}







function updatePreview() {
  const qty = Number($("qty").value || 0)
  const cost = Number($("costPrice").value || 0)
  const sale = Number($("salePrice").value || 0)

  const unitProfit = sale - cost
  const totalCost = cost * qty
  const totalSale = sale * qty
  const totalProfit = unitProfit * qty

  $("previewUnitProfit").textContent = formatMoney(unitProfit)
  $("previewTotalCost").textContent = formatMoney(totalCost)
  $("previewTotalSale").textContent = formatMoney(totalSale)
  $("previewTotalProfit").textContent = formatMoney(totalProfit)
}

function openCreateForm() {
  $("formTitle").textContent = "新增自用紀錄"
  $("usageForm").reset()
  $("recordId").value = ""
  setTodayDefault()
  $("qty").value = 1
  updatePreview()
  $("formCard").classList.remove("hidden")
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function openEditForm(id) {
  const row = allRecords.find(item => item.id === id)
  if (!row) return

  $("formTitle").textContent = "編輯自用紀錄"
  $("recordId").value = row.id
  $("takenDate").value = row.taken_date || ""
  $("holderName").value = row.holder_name || ""
  $("seriesName").value = row.series_name || ""
  $("itemName").value = row.item_name || ""
  $("variantName").value = row.variant_name || ""
  $("qty").value = row.qty || 1
  $("costPrice").value = row.cost_price || 0
  $("salePrice").value = row.sale_price || 0
  $("note").value = row.note || ""

  updatePreview()
  $("formCard").classList.remove("hidden")
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function closeForm() {
  $("formCard").classList.add("hidden")
}

function resetFilters() {
  $("keyword").value = ""
  $("holderFilter").value = ""
  $("startDate").value = ""
  $("endDate").value = ""
  renderTable()
}

async function handleSubmit(e) {
  e.preventDefault()
  if (isSubmitting) return

  const recordId = $("recordId").value
  const payload = {
    taken_date: $("takenDate").value,
    holder_name: $("holderName").value.trim(),
    series_name: $("seriesName").value.trim(),
    item_name: $("itemName").value.trim(),
    variant_name: $("variantName").value.trim() || null,
    qty: Number($("qty").value || 1),
    cost_price: Number($("costPrice").value || 0),
    sale_price: Number($("salePrice").value || 0),
    note: $("note").value.trim() || null
  }

  if (!payload.taken_date || !payload.holder_name || !payload.series_name || !payload.item_name) {
    alert("請把必填欄位填完整")
    return
  }

  if (payload.qty <= 0) {
    alert("數量必須大於 0")
    return
  }

  isSubmitting = true
  $("saveBtn").disabled = true
  $("saveBtn").textContent = "儲存中..."

  try {
    let error = null

    if (recordId) {
      const res = await supabase
        .from("self_usage_records")
        .update(payload)
        .eq("id", recordId)

      error = res.error
    } else {
      const res = await supabase
        .from("self_usage_records")
        .insert([
          {
            ...payload,
            created_by: currentUser.id
          }
        ])

      error = res.error
    }

    if (error) throw error

    alert(recordId ? "更新成功" : "新增成功")
    closeForm()
    await loadRecords()
  } catch (err) {
    console.error("儲存失敗:", err)
    alert("儲存失敗：" + err.message)
  } finally {
    isSubmitting = false
    $("saveBtn").disabled = false
    $("saveBtn").textContent = "儲存紀錄"
  }
}

async function handleDelete(id) {
  const row = allRecords.find(item => item.id === id)
  if (!row) return

  const ok = confirm(`確定要刪除這筆紀錄嗎？\n\n${row.series_name} / ${row.item_name}`)
  if (!ok) return

  const { error } = await supabase
    .from("self_usage_records")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("刪除失敗:", error)
    alert("刪除失敗：" + error.message)
    return
  }

  alert("刪除成功")
  await loadRecords()
}

function formatMoney(value) {
  const num = Number(value || 0)
  return `$${num.toLocaleString("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}