import { supabase } from "./supabase.js"
import { loadAuth } from "./auth.js"

let editingWalletId = null
let editingWalletLogId = null
let allWalletRows = []
let searchTimer = null

window.saveWallet = saveWallet
window.saveWalletLog = saveWalletLog
window.editWallet = editWallet
window.deleteWallet = deleteWallet
window.viewWalletLogs = viewWalletLogs
window.cancelWalletEdit = cancelWalletEdit
window.editWalletLog = editWalletLog
window.deleteWalletLog = deleteWalletLog
window.cancelWalletLogEdit = cancelWalletLogEdit

init()

async function init(){
  const user = await loadAuth()
  if(!user) return

  ensureActionButtons()

  document.getElementById("wallet_search")?.addEventListener("input", () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      filterWalletList()
    }, 300)
  })

  document.getElementById("log_date").value = getTodayDate()

  await loadWallets()
}

function ensureActionButtons(){
  if(!document.getElementById("cancelWalletEditBtn")){
    const btnWrap = document.querySelectorAll(".form-actions")[0]
    if(btnWrap){
      const btn = document.createElement("button")
      btn.type = "button"
      btn.id = "cancelWalletEditBtn"
      btn.className = "btn-cancel"
      btn.textContent = "取消編輯"
      btn.style.display = "none"
      btn.onclick = cancelWalletEdit
      btnWrap.appendChild(btn)
    }
  }

  const saveWalletBtn = document.querySelectorAll(".form-actions")[0]?.querySelector(".btn-primary")
  if(saveWalletBtn) saveWalletBtn.id = "saveWalletBtn"
}

async function saveWallet(){
  const user = await loadAuth()
  if(!user) return

  const customer_name = document.getElementById("customer_name").value.trim()
  const customer_phone = document.getElementById("customer_phone").value.trim()
  const customer_email = document.getElementById("customer_email").value.trim()
  const note = document.getElementById("wallet_note").value.trim()

  if(!customer_name){
    alert("請填寫客戶姓名")
    return
  }

  const payload = {
    customer_name,
    customer_phone,
    customer_email,
    note,
    created_by: user.id
  }

  let error = null

  if(editingWalletId){
    const res = await supabase
      .from("customer_wallets")
      .update(payload)
      .eq("id", editingWalletId)

    error = res.error
  }else{
    const res = await supabase
      .from("customer_wallets")
      .insert([payload])

    error = res.error
  }

  if(error){
    console.error("saveWallet error:", error)
    alert(editingWalletId ? "更新帳戶失敗" : "建立帳戶失敗")
    return
  }

  alert(editingWalletId ? "帳戶更新成功" : "帳戶建立成功")
  clearWalletForm()
  await loadWallets()
}

async function saveWalletLog(){
  const user = await loadAuth()
  if(!user) return

  const wallet_id = document.getElementById("wallet_select").value
  const log_date = document.getElementById("log_date").value
  const change_type = document.getElementById("change_type").value
  const amount = Number(document.getElementById("log_amount").value || 0)
  const note = document.getElementById("log_note").value.trim()

  if(!wallet_id || !log_date || !change_type || amount === 0){
    alert("請選擇帳戶、日期、異動類型，且金額不可為 0")
    return
  }

  let error = null

  if(editingWalletLogId){
    const res = await supabase.rpc("update_customer_wallet_log", {
      p_log_id: editingWalletLogId,
      p_log_date: log_date,
      p_change_type: change_type,
      p_amount: amount,
      p_note: note || null
    })
    error = res.error
  }else{
    const res = await supabase.rpc("adjust_customer_wallet", {
      p_wallet_id: wallet_id,
      p_log_date: log_date,
      p_change_type: change_type,
      p_amount: amount,
      p_note: note || null
    })
    error = res.error
  }

  if(error){
    console.error("saveWalletLog error:", error)
    alert(editingWalletLogId ? "更新異動失敗" : "新增異動失敗")
    return
  }

  alert(editingWalletLogId ? "異動更新成功" : "異動新增成功")
  clearWalletLogForm()
  await loadWallets()
}

function clearWalletLogForm(){
  editingWalletLogId = null

  document.getElementById("wallet_select").value = ""
  document.getElementById("log_date").value = getTodayDate()
  document.getElementById("change_type").value = ""
  document.getElementById("log_amount").value = 0
  document.getElementById("log_note").value = ""

  const btn = document.getElementById("saveWalletLogBtn")
  if(btn) btn.textContent = "新增異動"

  const cancelBtn = document.getElementById("cancelWalletLogEditBtn")
  if(cancelBtn) cancelBtn.style.display = "none"
}

function cancelWalletLogEdit(){
  clearWalletLogForm()
}

async function editWallet(walletId){
  const { data, error } = await supabase
    .from("customer_wallets")
    .select("*")
    .eq("id", walletId)
    .single()

  if(error || !data){
    console.error("editWallet error:", error)
    alert("讀取帳戶失敗")
    return
  }

  editingWalletId = data.id

  document.getElementById("customer_name").value = data.customer_name || ""
  document.getElementById("customer_phone").value = data.customer_phone || ""
  document.getElementById("customer_email").value = data.customer_email || ""
  document.getElementById("wallet_note").value = data.note || ""

  const btn = document.getElementById("saveWalletBtn")
  if(btn) btn.textContent = "更新帳戶"

  const cancelBtn = document.getElementById("cancelWalletEditBtn")
  if(cancelBtn) cancelBtn.style.display = "inline-block"

  window.scrollTo({ top: 0, behavior: "smooth" })
}

async function deleteWallet(walletId){
  const ok = confirm("確定要刪除這個儲值帳戶嗎？刪除後異動紀錄也會一起刪除。")
  if(!ok) return

  const { error } = await supabase
    .from("customer_wallets")
    .delete()
    .eq("id", walletId)

  if(error){
    console.error("deleteWallet error:", error)
    alert("刪除帳戶失敗")
    return
  }

  if(editingWalletId === walletId){
    clearWalletForm()
  }

  alert("儲值帳戶已刪除")
  await loadWallets()
}

async function loadWallets(){
  const { data, error } = await supabase
    .from("customer_wallets")
    .select("*")
    .order("updated_at", { ascending: false })

  if(error){
    console.error("loadWallets error:", error)
    return
  }

  allWalletRows = data || []

  const select = document.getElementById("wallet_select")
  const currentValue = select.value
  select.innerHTML = `<option value="">請選擇客戶帳戶</option>`

  for(const row of allWalletRows){
    select.innerHTML += `
      <option value="${row.id}">
        ${row.customer_name}｜餘額 ${Number(row.balance || 0).toFixed(2)}
      </option>
    `
  }

  if(currentValue){
    select.value = currentValue
  }

  await renderWalletList(allWalletRows)
}

async function renderWalletList(rows){
  const container = document.getElementById("wallet_list")
  const overview = document.getElementById("wallet_overview")

  container.innerHTML = ""

  if(!rows || rows.length === 0){
    if(overview) overview.innerHTML = ""
    container.innerHTML = "目前沒有儲值帳戶資料"
    return
  }

  const totalBalance = rows.reduce((sum, row) => sum + Number(row.balance || 0), 0)

  if(overview){
    overview.innerHTML = `
      <div class="overview-card">
        <div class="overview-item">
          <div class="overview-label">目前儲值總額</div>
          <div class="overview-value">NT$ ${totalBalance.toFixed(2)}</div>
        </div>
        <div class="overview-item">
          <div class="overview-label">帳戶數</div>
          <div class="overview-value">${rows.length}</div>
        </div>
      </div>
    `
  }

  for(const row of rows){
    const { data: logs, error } = await supabase
      .from("customer_wallet_logs")
      .select("*")
      .eq("wallet_id", row.id)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })

    if(error){
      console.error("wallet logs error:", error)
    }

    const logList = logs || []

    const card = document.createElement("div")
    card.className = "wallet-card"

    card.innerHTML = `
      <div class="wallet-header">
        <div class="wallet-title-wrap">
          <h3>${row.customer_name}</h3>
          <div class="wallet-subinfo">電話：${row.customer_phone || "-"} / Email：${row.customer_email || "-"}</div>
        </div>
        <div class="wallet-balance">餘額：NT$ ${Number(row.balance || 0).toFixed(2)}</div>
      </div>

      <div class="wallet-meta">
        <div>備註：${row.note || "-"}</div>
      </div>

      <div class="wallet-actions">
        <button type="button" class="btn-secondary btn-sm" onclick="editWallet('${row.id}')">編輯帳戶</button>
        <button type="button" class="btn-cancel btn-sm" onclick="deleteWallet('${row.id}')">刪除帳戶</button>
      </div>

      <div class="wallet-log-title">異動紀錄</div>

      ${
        logList.length > 0
          ? `
            <table class="wallet-table">
             <thead>
  <tr>
    <th>日期</th>
    <th>類型</th>
    <th>金額</th>
    <th>備註</th>
    <th>操作</th>
  </tr>
</thead>
              <tbody>
                ${logList.map(log => `
                 <tr>
  <td>${log.log_date || "-"}</td>
  <td>${log.change_type || "-"}</td>
  <td class="${Number(log.amount || 0) < 0 ? "text-danger" : "text-profit"}">
    ${Number(log.amount || 0).toFixed(2)}
  </td>
  <td>${log.note || "-"}</td>
  <td>
    <button type="button" class="btn-secondary btn-sm" onclick="editWalletLog('${log.id}')">編輯</button>
    <button type="button" class="btn-cancel btn-sm" onclick="deleteWalletLog('${log.id}')">刪除</button>
  </td>
</tr>
                `).join("")}
              </tbody>
            </table>
          `
          : `<div class="empty-logs">目前沒有異動紀錄</div>`
      }
    `

    container.appendChild(card)
  }
}

async function filterWalletList(){
  const keyword = document.getElementById("wallet_search")?.value.trim().toLowerCase() || ""

  const filtered = allWalletRows.filter(row => {
    const name = String(row.customer_name || "").toLowerCase()
    const phone = String(row.customer_phone || "").toLowerCase()
    const email = String(row.customer_email || "").toLowerCase()

    return (
      !keyword ||
      name.includes(keyword) ||
      phone.includes(keyword) ||
      email.includes(keyword)
    )
  })

  await renderWalletList(filtered)
}

function viewWalletLogs(walletId){
  console.log("viewWalletLogs", walletId)
}

function getTodayDate(){
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

async function editWalletLog(logId){
  const { data, error } = await supabase
    .from("customer_wallet_logs")
    .select("*")
    .eq("id", logId)
    .single()

  if(error || !data){
    console.error("editWalletLog error:", error)
    alert("讀取異動資料失敗")
    return
  }

  editingWalletLogId = data.id

  document.getElementById("wallet_select").value = data.wallet_id || ""
  document.getElementById("log_date").value = data.log_date || getTodayDate()
  document.getElementById("change_type").value = data.change_type || ""
  document.getElementById("log_amount").value = data.amount ?? 0
  document.getElementById("log_note").value = data.note || ""

  const btn = document.getElementById("saveWalletLogBtn")
  if(btn) btn.textContent = "更新異動"

  const cancelBtn = document.getElementById("cancelWalletLogEditBtn")
  if(cancelBtn) cancelBtn.style.display = "inline-block"

  window.scrollTo({ top: 0, behavior: "smooth" })
}

async function deleteWalletLog(logId){
  const ok = confirm("確定要刪除這筆異動嗎？刪除後餘額會同步回算。")
  if(!ok) return

  const { error } = await supabase.rpc("delete_customer_wallet_log", {
    p_log_id: logId
  })

  if(error){
    console.error("deleteWalletLog error:", error)
    alert("刪除異動失敗")
    return
  }

  if(editingWalletLogId === logId){
    clearWalletLogForm()
  }

  alert("異動已刪除")
  await loadWallets()
}

function clearWalletForm(){
  editingWalletId = null

  document.getElementById("customer_name").value = ""
  document.getElementById("customer_phone").value = ""
  document.getElementById("customer_email").value = ""
  document.getElementById("wallet_note").value = ""

  const btn = document.getElementById("saveWalletBtn")
  if(btn) btn.textContent = "建立帳戶"

  const cancelBtn = document.getElementById("cancelWalletEditBtn")
  if(cancelBtn) cancelBtn.style.display = "none"
}

function cancelWalletEdit(){
  clearWalletForm()
}