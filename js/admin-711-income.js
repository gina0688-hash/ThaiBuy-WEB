import { supabase } from "./supabase.js"
import { loadAuth } from "./auth.js"

let editingIncomeId = null
let allIncomeRows = []
let incomeSearchTimer = null

window.saveIncome = saveIncome
window.editIncome = editIncome
window.deleteIncome = deleteIncome
window.cancelIncomeEdit = cancelIncomeEdit

init()

async function init(){
  const user = await loadAuth()
  if(!user) return

  ensureActionButtons()

  document.getElementById("income_date").value = getTodayDate()

  document.getElementById("income_search")?.addEventListener("input", () => {
    clearTimeout(incomeSearchTimer)
    incomeSearchTimer = setTimeout(() => {
      filterIncomeList()
    }, 300)
  })

  document.getElementById("counted_search")?.addEventListener("change", filterIncomeList)
  document.getElementById("income_date_start")?.addEventListener("change", filterIncomeList)
  document.getElementById("income_date_end")?.addEventListener("change", filterIncomeList)

  await loadIncomeRecords()
}

function ensureActionButtons(){
  if(!document.getElementById("cancelIncomeEditBtn")){
    const btnWrap = document.querySelector(".form-actions")
    if(btnWrap){
      const btn = document.createElement("button")
      btn.type = "button"
      btn.id = "cancelIncomeEditBtn"
      btn.className = "btn-cancel"
      btn.textContent = "取消編輯"
      btn.style.display = "none"
      btn.onclick = cancelIncomeEdit
      btnWrap.appendChild(btn)
    }
  }

  const saveBtn = document.querySelector(".form-actions .btn-primary")
  if(saveBtn) saveBtn.id = "saveIncomeBtn"
}

async function saveIncome(){
  const user = await loadAuth()
  if(!user) return

  const income_date = document.getElementById("income_date").value
  const platform_order_no = document.getElementById("platform_order_no").value.trim()
const customer_name = document.getElementById("customer_name").value.trim()
const received_account = document.getElementById("received_account").value
const amount = Number(document.getElementById("amount").value || 0)
  const is_counted = document.getElementById("is_counted").value === "true"
  const note = document.getElementById("note").value.trim()

  if(!income_date || amount <= 0){
    alert("請填寫入帳日期與正確金額")
    return
  }

 const payload = {
  income_date,
  platform_order_no,
  customer_name,
  received_account,
  amount,
  is_counted,
  counted_at: is_counted ? new Date().toISOString() : null,
  note,
  created_by: user.id
}

  let error = null

  if(editingIncomeId){
    const res = await supabase
      .from("seven_income_records")
      .update(payload)
      .eq("id", editingIncomeId)

    error = res.error
  }else{
    const res = await supabase
      .from("seven_income_records")
      .insert([payload])

    error = res.error
  }

  if(error){
    console.error("saveIncome error:", error)
    alert(editingIncomeId ? "更新紀錄失敗" : "新增紀錄失敗")
    return
  }

  alert(editingIncomeId ? "紀錄更新成功" : "紀錄新增成功")
  clearIncomeForm()
  await loadIncomeRecords()
}

function clearIncomeForm(){
  editingIncomeId = null

  document.getElementById("income_date").value = getTodayDate()
document.getElementById("platform_order_no").value = ""
document.getElementById("customer_name").value = ""
document.getElementById("received_account").value = ""
document.getElementById("amount").value = 0
  document.getElementById("is_counted").value = "false"
  document.getElementById("note").value = ""

  const btn = document.getElementById("saveIncomeBtn")
  if(btn) btn.textContent = "新增紀錄"

  const cancelBtn = document.getElementById("cancelIncomeEditBtn")
  if(cancelBtn) cancelBtn.style.display = "none"
}

function cancelIncomeEdit(){
  clearIncomeForm()
}

async function editIncome(id){
  const { data, error } = await supabase
    .from("seven_income_records")
    .select("*")
    .eq("id", id)
    .single()

  if(error || !data){
    console.error("editIncome error:", error)
    alert("讀取紀錄失敗")
    return
  }

  editingIncomeId = data.id

  document.getElementById("income_date").value = data.income_date || ""
  document.getElementById("platform_order_no").value = data.platform_order_no || ""
document.getElementById("customer_name").value = data.customer_name || ""
document.getElementById("received_account").value = data.received_account || ""
document.getElementById("amount").value = data.amount ?? 0
  document.getElementById("is_counted").value = String(!!data.is_counted)
  document.getElementById("note").value = data.note || ""

  const btn = document.getElementById("saveIncomeBtn")
  if(btn) btn.textContent = "更新紀錄"

  const cancelBtn = document.getElementById("cancelIncomeEditBtn")
  if(cancelBtn) cancelBtn.style.display = "inline-block"

  window.scrollTo({ top: 0, behavior: "smooth" })
}

async function deleteIncome(id){
  const ok = confirm("確定要刪除這筆 7-11 入帳紀錄嗎？")
  if(!ok) return

  const { error } = await supabase
    .from("seven_income_records")
    .delete()
    .eq("id", id)

  if(error){
    console.error("deleteIncome error:", error)
    alert("刪除紀錄失敗")
    return
  }

  if(editingIncomeId === id){
    clearIncomeForm()
  }

  alert("紀錄已刪除")
  await loadIncomeRecords()
}

async function loadIncomeRecords(){
  const { data, error } = await supabase
    .from("seven_income_records")
    .select("*")
    .order("income_date", { ascending: false })
    .order("created_at", { ascending: false })

  if(error){
    console.error("loadIncomeRecords error:", error)
    return
  }

  allIncomeRows = data || []
  await renderIncomeList(allIncomeRows)
}

async function renderIncomeList(rows){
  const container = document.getElementById("income_list")
  const overview = document.getElementById("income_overview")

  container.innerHTML = ""

  if(!rows || rows.length === 0){
    if(overview) overview.innerHTML = ""
    container.innerHTML = "目前沒有 7-11 入帳紀錄"
    return
  }

  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)

const countedAmount = rows
  .filter(row => row.is_counted)
  .reduce((sum, row) => sum + Number(row.amount || 0), 0)

const pendingAmount = totalAmount - countedAmount

const qingAmount = rows
  .filter(row => row.received_account === "青")
  .reduce((sum, row) => sum + Number(row.amount || 0), 0)

const yuanAmount = rows
  .filter(row => row.received_account === "媛媛")
  .reduce((sum, row) => sum + Number(row.amount || 0), 0)

  if(overview){
  overview.innerHTML = `
  <div class="overview-card">
    <div class="overview-item">
      <div class="overview-label">總入帳金額</div>
      <div class="overview-value">NT$ ${totalAmount.toFixed(2)}</div>
    </div>

    <div class="overview-item">
      <div class="overview-label">已加回帳務</div>
      <div class="overview-value text-profit">NT$ ${countedAmount.toFixed(2)}</div>
    </div>

    <div class="overview-item">
      <div class="overview-label">未加回帳務</div>
      <div class="overview-value text-danger">NT$ ${pendingAmount.toFixed(2)}</div>
    </div>

    <div class="overview-item">
      <div class="overview-label">青戶頭總入帳</div>
      <div class="overview-value">NT$ ${qingAmount.toFixed(2)}</div>
    </div>

    <div class="overview-item">
      <div class="overview-label">媛媛戶頭總入帳</div>
      <div class="overview-value">NT$ ${yuanAmount.toFixed(2)}</div>
    </div>
  </div>
`
  }

  container.innerHTML = `
    <table class="income-table">
      <thead>
        <tr>
          <th>日期</th>
         <th>訂單編號</th>
<th>客戶姓名</th>
<th>入帳戶頭</th>
<th>入帳金額</th>
          <th>是否已加回</th>
          <th>加回時間</th>
          <th>備註</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${row.income_date || "-"}</td>
           <td>${row.platform_order_no || "-"}</td>
<td>${row.customer_name || "-"}</td>
<td>${row.received_account || "-"}</td>
<td>${Number(row.amount || 0).toFixed(2)}</td>
            <td class="${row.is_counted ? "text-profit" : "text-danger"}">
              ${row.is_counted ? "已加回" : "未加回"}
            </td>
            <td>${formatDateTime(row.counted_at)}</td>
            <td>${row.note || "-"}</td>
            <td>
              <button type="button" class="btn-secondary btn-sm" onclick="editIncome('${row.id}')">編輯</button>
              <button type="button" class="btn-cancel btn-sm" onclick="deleteIncome('${row.id}')">刪除</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `
}

async function filterIncomeList(){
  const keyword = document.getElementById("income_search")?.value.trim().toLowerCase() || ""
  const countedStatus = document.getElementById("counted_search")?.value || ""
  const startDate = document.getElementById("income_date_start")?.value || ""
  const endDate = document.getElementById("income_date_end")?.value || ""

  const filtered = allIncomeRows.filter(row => {
    const orderNo = String(row.platform_order_no || "").toLowerCase()
const customerName = String(row.customer_name || "").toLowerCase()
const receivedAccount = String(row.received_account || "").toLowerCase()
const note = String(row.note || "").toLowerCase()
    const incomeDate = String(row.income_date || "")

  const matchKeyword =
  !keyword ||
  orderNo.includes(keyword) ||
  customerName.includes(keyword) ||
  receivedAccount.includes(keyword) ||
  note.includes(keyword)

    const matchCounted =
      !countedStatus ||
      String(!!row.is_counted) === countedStatus

    const matchStartDate =
      !startDate ||
      incomeDate >= startDate

    const matchEndDate =
      !endDate ||
      incomeDate <= endDate

    return (
      matchKeyword &&
      matchCounted &&
      matchStartDate &&
      matchEndDate
    )
  })

  await renderIncomeList(filtered)
}

function formatDateTime(value){
  if(!value) return "-"
  const d = new Date(value)
  if(isNaN(d.getTime())) return "-"
  return d.toLocaleString("zh-TW", { hour12: false })
}

function getTodayDate(){
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}