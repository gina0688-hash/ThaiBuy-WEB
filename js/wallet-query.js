import { supabase } from "./supabase.js"

const queryBtn = document.getElementById("queryBtn")
const queryEmail = document.getElementById("queryEmail")
const queryPhone = document.getElementById("queryPhone")
const queryResult = document.getElementById("queryResult")

queryBtn?.addEventListener("click", queryWallet)

function escapeHtml(str = ""){
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function formatMoney(num){
  return Number(num || 0).toLocaleString("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

async function queryWallet(){
  const email = queryEmail.value.trim()
  const phone = queryPhone.value.trim()

  if(!email || !phone){
    alert("請輸入 Email 與電話")
    return
  }

  queryResult.innerHTML = `
    <div class="result-empty">
      <div class="result-icon">🔎</div>
      <h3>查詢中</h3>
      <p>正在確認儲值金資料，請稍候。</p>
    </div>
  `

  const { data, error } = await supabase.rpc("query_customer_wallet_for_customer", {
    p_email: email,
    p_phone: phone
  })

  if(error){
    console.error("query wallet error:", error)
    queryResult.innerHTML = `
      <div class="result-empty">
        <div class="result-icon">⚠️</div>
        <h3>查詢失敗</h3>
        <p>系統暫時無法查詢，請稍後再試，或聯繫客服協助確認。</p>
      </div>
    `
    return
  }

  if(!data?.success){
    queryResult.innerHTML = `
      <div class="result-empty">
        <div class="result-icon">🙇‍♀️</div>
        <h3>查無儲值金資料</h3>
        <p>${escapeHtml(data?.message || "請確認 Email 與電話是否正確。")}</p>
      </div>
    `
    return
  }

  const wallet = data.wallet || {}
  const logs = wallet.logs || []

  queryResult.innerHTML = `
    <div class="wallet-balance-box">
      <div class="wallet-balance-label">目前可使用儲值金餘額</div>
      <div class="wallet-balance-value">NT$ ${formatMoney(wallet.balance)}</div>
    </div>

    <div class="wallet-info">
      <div class="wallet-info-item">
        <div class="wallet-info-label">姓名</div>
        <div class="wallet-info-value">${escapeHtml(wallet.customer_name || "-")}</div>
      </div>

      <div class="wallet-info-item">
        <div class="wallet-info-label">Email</div>
        <div class="wallet-info-value">${escapeHtml(wallet.customer_email || "-")}</div>
      </div>

      <div class="wallet-info-item">
        <div class="wallet-info-label">電話</div>
        <div class="wallet-info-value">${escapeHtml(wallet.customer_phone || "-")}</div>
      </div>
    </div>

    <div class="section-title">儲值金異動紀錄</div>

    ${
      logs.length > 0
        ? `
          <div class="wallet-table-wrap">
            <table class="wallet-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>使用狀態</th>
                  <th>金額</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(log => {
                  const amount = Number(log.amount || 0)
                  return `
                    <tr>
                      <td>${escapeHtml(log.log_date || "-")}</td>
                      <td>${escapeHtml(log.change_type || "-")}</td>
                      <td class="${amount < 0 ? "text-danger" : "text-profit"}">
                        ${amount > 0 ? "+" : ""}${formatMoney(amount)}
                      </td>
                      <td>${escapeHtml(log.note || "-")}</td>
                    </tr>
                  `
                }).join("")}
              </tbody>
            </table>
          </div>
        `
        : `
          <div class="result-empty">
            <div class="result-icon">🧾</div>
            <h3>目前沒有異動紀錄</h3>
            <p>此儲值帳戶目前尚未有加值或扣抵紀錄。</p>
          </div>
        `
    }
  `
}