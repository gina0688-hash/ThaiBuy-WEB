import { supabase } from "./supabase.js"

loadMarkets()

async function loadMarkets(){
  const marketList = document.getElementById("marketList")

  const { data, error } = await supabase
    .from("shipping_711_links")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if(error){
    console.error("loadMarkets error:", error)
    marketList.innerHTML = `<div class="empty-box">載入失敗，請稍後再試。</div>`
    return
  }

  if(!data || data.length === 0){
    marketList.innerHTML = `
      <div class="empty-box">
        目前暫無可下單的賣貨便賣場。<br>
        若有開放賣場，會更新在此頁面。
      </div>
    `
    return
  }

  marketList.innerHTML = data.map(item => `
    <div class="market-item">
      <div class="market-left">
        <p class="market-name">${escapeHtml(item.market_name)}</p>
        <p class="market-url">賣場連結：${escapeHtml(item.market_url)}</p>
        <div class="market-note">${escapeHtml(item.note || "請勿下單到其他人的單子，僅限下單 THAI BUY 指定賣場。")}</div>
      </div>

      <a
        class="market-link"
        href="${item.market_url}"
        target="_blank"
        rel="noopener noreferrer"
      >
        前往賣場
      </a>
    </div>
  `).join("")
}

function escapeHtml(str = ""){
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}