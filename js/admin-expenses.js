import { supabase } from "./supabase.js"
import { loadAuth } from "./auth.js"

let editingExpenseId = null
let allExpenseRows = []
let searchTimer = null

window.saveExpense = saveExpense
window.editExpense = editExpense
window.deleteExpense = deleteExpense
window.cancelExpenseEdit = cancelExpenseEdit

init()

async function init(){
  const user = await loadAuth()
  if(!user) return

  ensureActionButtons()

  document.getElementById("search_keyword")?.addEventListener("input", () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      filterExpenseList()
    }, 300)
  })

  document.getElementById("search_type")?.addEventListener("change", filterExpenseList)
  document.getElementById("search_start_date")?.addEventListener("change", filterExpenseList)
  document.getElementById("search_end_date")?.addEventListener("change", filterExpenseList)

  document.getElementById("expense_date").value = getTodayDate()
  await loadExpenses()
}

function ensureActionButtons(){
  if(!document.getElementById("cancelExpenseEditBtn")){
    const btnWrap = document.querySelector(".form-actions")
    if(btnWrap){
      const btn = document.createElement("button")
      btn.type = "button"
      btn.id = "cancelExpenseEditBtn"
      btn.className = "btn-cancel"
      btn.textContent = "取消編輯"
      btn.style.display = "none"
      btn.onclick = cancelExpenseEdit
      btnWrap.appendChild(btn)
    }
  }

  const primaryBtn = document.querySelector(".form-actions .btn-primary")
  if(primaryBtn) primaryBtn.id = "saveExpenseBtn"
}

async function saveExpense(){
  const expense_date = document.getElementById("expense_date").value
  const expense_type = document.getElementById("expense_type").value
  const amount = Number(document.getElementById("amount").value || 0)
  const payment_method = document.getElementById("payment_method").value
  const note = document.getElementById("note").value.trim()

  if(!expense_date || !expense_type || amount <= 0){
    alert("請填寫支出日期、支出類型與正確金額")
    return
  }

  const payload = {
    expense_date,
    expense_type,
    amount,
    payment_method,
    note
  }

  let error = null

  if(editingExpenseId){
    const res = await supabase
      .from("internal_expenses")
      .update(payload)
      .eq("id", editingExpenseId)

    error = res.error
  }else{
    const res = await supabase
      .from("internal_expenses")
      .insert([payload])

    error = res.error
  }

  if(error){
    console.error("saveExpense error:", error)
    alert(editingExpenseId ? "更新支出失敗" : "新增支出失敗")
    return
  }

  alert(editingExpenseId ? "支出更新成功" : "支出新增成功")
  clearExpenseForm()
  await loadExpenses()
}

function clearExpenseForm(){
  editingExpenseId = null

  document.getElementById("expense_date").value = getTodayDate()
  document.getElementById("expense_type").value = ""
  document.getElementById("amount").value = 0
  document.getElementById("payment_method").value = ""
  document.getElementById("note").value = ""

  const btn = document.getElementById("saveExpenseBtn")
  if(btn) btn.textContent = "新增支出"

  const cancelBtn = document.getElementById("cancelExpenseEditBtn")
  if(cancelBtn) cancelBtn.style.display = "none"
}

function cancelExpenseEdit(){
  clearExpenseForm()
}

async function editExpense(expenseId){
  const { data, error } = await supabase
    .from("internal_expenses")
    .select("*")
    .eq("id", expenseId)
    .single()

  if(error || !data){
    console.error("editExpense error:", error)
    alert("讀取支出資料失敗")
    return
  }

  editingExpenseId = data.id

  document.getElementById("expense_date").value = data.expense_date || ""
  document.getElementById("expense_type").value = data.expense_type || ""
  document.getElementById("amount").value = data.amount ?? 0
  document.getElementById("payment_method").value = data.payment_method || ""
  document.getElementById("note").value = data.note || ""

  const btn = document.getElementById("saveExpenseBtn")
  if(btn) btn.textContent = "更新支出"

  const cancelBtn = document.getElementById("cancelExpenseEditBtn")
  if(cancelBtn) cancelBtn.style.display = "inline-block"

  window.scrollTo({ top: 0, behavior: "smooth" })
}

async function deleteExpense(expenseId){
  const ok = confirm("確定要刪除這筆支出嗎？")
  if(!ok) return

  const { error } = await supabase
    .from("internal_expenses")
    .delete()
    .eq("id", expenseId)

  if(error){
    console.error("deleteExpense error:", error)
    alert("刪除支出失敗")
    return
  }

  if(editingExpenseId === expenseId){
    clearExpenseForm()
  }

  alert("支出已刪除")
  await loadExpenses()
}

async function loadExpenses(){
  const { data, error } = await supabase
    .from("internal_expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })

  if(error){
    console.error("loadExpenses error:", error)
    return
  }

  allExpenseRows = data || []
  await renderExpenseList(allExpenseRows)
}

async function renderExpenseList(rows){
  const container = document.getElementById("expense_list")
  const overview = document.getElementById("expense_overview")

  container.innerHTML = ""

  if(!rows || rows.length === 0){
    if(overview) overview.innerHTML = ""
    container.innerHTML = "目前沒有內帳支出資料"
    return
  }

  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)

  const typeTotals = {}
  for(const row of rows){
    const key = row.expense_type || "未分類"
    typeTotals[key] = (typeTotals[key] || 0) + Number(row.amount || 0)
  }

  if(overview){
    overview.innerHTML = `
      <div class="overview-card">
        <div class="overview-item">
          <div class="overview-label">支出總額</div>
          <div class="overview-value">NT$ ${totalAmount.toFixed(2)}</div>
        </div>

        ${Object.entries(typeTotals).map(([type, amount]) => `
          <div class="overview-item">
            <div class="overview-label">${type}</div>
            <div class="overview-value">NT$ ${amount.toFixed(2)}</div>
          </div>
        `).join("")}
      </div>
    `
  }

  container.innerHTML = `
    <table class="expense-table">
      <thead>
        <tr>
          <th>日期</th>
          <th>類型</th>
          <th>金額</th>
          <th>付款方式</th>
          <th>備註</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${row.expense_date || "-"}</td>
            <td>${row.expense_type || "-"}</td>
            <td>${Number(row.amount || 0).toFixed(2)}</td>
            <td>${row.payment_method || "-"}</td>
            <td>${row.note || "-"}</td>
            <td>
              <button type="button" class="btn-secondary btn-sm" onclick="editExpense('${row.id}')">編輯</button>
              <button type="button" class="btn-cancel btn-sm" onclick="deleteExpense('${row.id}')">刪除</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `
}

async function filterExpenseList(){
  const keyword = document.getElementById("search_keyword")?.value.trim().toLowerCase() || ""
  const type = document.getElementById("search_type")?.value || ""
  const startDate = document.getElementById("search_start_date")?.value || ""
  const endDate = document.getElementById("search_end_date")?.value || ""

  const filtered = allExpenseRows.filter(row => {
    const expenseType = String(row.expense_type || "").toLowerCase()
    const note = String(row.note || "").toLowerCase()
    const expenseDate = String(row.expense_date || "")

    const matchKeyword =
      !keyword ||
      expenseType.includes(keyword) ||
      note.includes(keyword)

    const matchType =
      !type ||
      row.expense_type === type

    const matchStartDate =
      !startDate ||
      expenseDate >= startDate

    const matchEndDate =
      !endDate ||
      expenseDate <= endDate

    return (
      matchKeyword &&
      matchType &&
      matchStartDate &&
      matchEndDate
    )
  })

  await renderExpenseList(filtered)
}

function getTodayDate(){
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}