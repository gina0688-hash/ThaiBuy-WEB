import { supabase } from "./supabase.js"

let editingId = null

loadTrackingList()

window.addTracking = async function () {
  const batch_label = document.getElementById("batchLabel").value.trim()
  const series_name = document.getElementById("seriesName").value.trim()
  const stage = document.getElementById("stage").value
  const status_note = document.getElementById("statusNote").value.trim()
  const sort_order = Number(document.getElementById("sortOrder").value || 0)

  if (!batch_label || !series_name) {
    alert("請填寫批次月份與系列名稱")
    return
  }

  // ⭐ 編輯模式：更新
  if (editingId) {
    const { error } = await supabase
      .from("tracking_status")
      .update({
        batch_label,
        series_name,
        stage,
        status_note,
        sort_order
      })
      .eq("id", editingId)

    if (error) {
      console.error(error)
      alert("更新失敗")
      return
    }

    alert("更新成功")
    resetForm()
    loadTrackingList()
    return
  }

  // ⭐ 新增模式：insert
  const { error } = await supabase
    .from("tracking_status")
    .insert([{
      batch_label,
      series_name,
      stage,
      status_note,
      sort_order
    }])

  if (error) {
    console.error(error)
    alert("新增失敗")
    return
  }

  alert("新增成功")
  resetForm()
  loadTrackingList()
}

async function loadTrackingList() {
  const { data, error } = await supabase
    .from("tracking_status")
    .select("*")
    .order("stage", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })

  if (error) {
    console.error(error)
    return
  }

  const container = document.getElementById("trackingList")
  container.innerHTML = ""

  if (!data || data.length === 0) {
    container.innerHTML = "<p>目前沒有貨態資料</p>"
    return
  }

  for (const row of data) {
    const div = document.createElement("div")
div.className = "tracking-row"

    div.innerHTML = `
      <p><b>批次：</b>${row.batch_label}</p>
      <p><b>系列：</b>${row.series_name}</p>
      <p><b>階段：</b>${translateStage(row.stage)}</p>
      <p><b>備註：</b>${row.status_note || "-"}</p>
      <p><b>排序：</b>${row.sort_order}</p>
      <div class="row-actions">
  <button class="btn-primary" onclick="editTracking('${row.id}')">編輯</button>
  <button class="btn-danger" onclick="deleteTracking('${row.id}')">刪除</button>
</div>
    `

    container.appendChild(div)
  }
}

window.editTracking = async function (id) {
  const { data, error } = await supabase
    .from("tracking_status")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    console.error(error)
    alert("讀取資料失敗")
    return
  }

  editingId = id

  document.getElementById("batchLabel").value = data.batch_label || ""
  document.getElementById("seriesName").value = data.series_name || ""
  document.getElementById("stage").value = data.stage || "official_pending"
  document.getElementById("statusNote").value = data.status_note || ""
  document.getElementById("sortOrder").value = data.sort_order ?? 0

  const submitBtn = document.getElementById("trackingSubmitBtn")
  if (submitBtn) submitBtn.textContent = "更新貨態"

  const cancelBtn = document.getElementById("trackingCancelBtn")
  if (cancelBtn) cancelBtn.style.display = "inline-block"

  window.scrollTo({ top: 0, behavior: "smooth" })
}

window.deleteTracking = async function (id) {
  if (!confirm("確定要刪除這筆貨態嗎？")) return

  const { error } = await supabase
    .from("tracking_status")
    .delete()
    .eq("id", id)

  if (error) {
    console.error(error)
    alert("刪除失敗")
    return
  }

  // 如果剛好刪的是正在編輯那筆，就重置表單
  if (editingId === id) {
    resetForm()
  }

  loadTrackingList()
}

window.cancelEditTracking = function () {
  resetForm()
}

function resetForm() {
  editingId = null

  document.getElementById("batchLabel").value = ""
  document.getElementById("seriesName").value = ""
  document.getElementById("stage").value = "official_pending"
  document.getElementById("statusNote").value = ""
  document.getElementById("sortOrder").value = "0"

  const submitBtn = document.getElementById("trackingSubmitBtn")
  if (submitBtn) submitBtn.textContent = "新增貨態"

  const cancelBtn = document.getElementById("trackingCancelBtn")
  if (cancelBtn) cancelBtn.style.display = "none"
}

function translateStage(stage) {
  const map = {
    official_pending: "官方未出貨",
    warehouse: "已到集運倉",
    packing: "準備打包回台",
    customs: "已抵台，等待清關",
    checking: "我方點貨中",
    ready_to_order: "已打包完成，等待客人下單中"
  }

  return map[stage] || stage
}