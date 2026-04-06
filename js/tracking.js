import { supabase } from "./supabase.js"

loadTrackingStatus()

async function loadTrackingStatus() {
  const { data, error } = await supabase
    .from("tracking_status")
    .select("*")
    .eq("is_active", true)
    .order("stage", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("載入貨態失敗:", error)
    return
  }

  const stageMap = {
    official_pending: document.getElementById("stage-official_pending"),
    warehouse: document.getElementById("stage-warehouse"),
    packing: document.getElementById("stage-packing"),
    customs: document.getElementById("stage-customs"),
    checking: document.getElementById("stage-checking"),
    ready_to_order: document.getElementById("stage-ready_to_order")
  }

  // 清空
  Object.values(stageMap).forEach(el => {
    if (el) el.innerHTML = ""
  })

  // 分組
  for (const row of data || []) {
    const container = stageMap[row.stage]
    if (!container) continue

    const div = document.createElement("div")
    div.className = "tracking-item"
    div.textContent = `📦 ${row.batch_label} - ${row.series_name}${row.status_note ? `（${row.status_note}）` : ""}`
    container.appendChild(div)
  }

  // 沒資料顯示預設文字
  Object.entries(stageMap).forEach(([stage, el]) => {
    if (!el) return
    if (el.children.length === 0) {
      el.innerHTML = `<div class="tracking-empty">📦 目前沒有公告項目</div>`
    }
  })

  // 更新時間取最新一筆
  if (data && data.length > 0) {
    const latest = [...data].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]
    const dt = new Date(latest.updated_at)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, "0")
    const d = String(dt.getDate()).padStart(2, "0")
    const hh = String(dt.getHours()).padStart(2, "0")
    const mm = String(dt.getMinutes()).padStart(2, "0")

    const lastUpdatedEl = document.getElementById("lastUpdated")
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = `🕒 最後更新：${y}/${m}/${d} ${hh}:${mm}`
    }
  }
}