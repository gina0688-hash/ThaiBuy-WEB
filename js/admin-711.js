import { supabase } from "./supabase.js"
import { loadAuth } from "./auth.js"

const marketForm = document.getElementById("marketForm")
const editId = document.getElementById("editId")
const marketName = document.getElementById("marketName")
const marketUrl = document.getElementById("marketUrl")
const marketNote = document.getElementById("marketNote")
const sortOrder = document.getElementById("sortOrder")
const isActive = document.getElementById("isActive")
const marketTableWrap = document.getElementById("marketTableWrap")
const formTitle = document.getElementById("formTitle")
const cancelEditBtn = document.getElementById("cancelEditBtn")

init()

async function init(){
  const user = await loadAuth()
  if(!user) return

  await loadMarkets()
}

marketForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  const payload = {
    market_name: marketName.value.trim(),
    market_url: marketUrl.value.trim(),
    note: marketNote.value.trim() || "請勿下單到其他人的單子，僅限下單 THAI BUY 指定賣場。",
    sort_order: Number(sortOrder.value || 0),
    is_active: isActive.checked
  }

  if(!payload.market_name || !payload.market_url){
    alert("請填寫完整賣場名稱與賣場連結")
    return
  }

  let error

  if(editId.value){
    const res = await supabase
      .from("shipping_711_links")
      .update(payload)
      .eq("id", editId.value)

    error = res.error
  }else{
    const { data: authData } = await supabase.auth.getUser()

    const res = await supabase
      .from("shipping_711_links")
      .insert([{
        ...payload,
        created_by: authData.user.id
      }])

    error = res.error
  }

  if(error){
    console.error("save market error:", error)
    alert("儲存失敗")
    return
  }

  resetForm()
  await loadMarkets()
  alert("儲存成功")
})

cancelEditBtn.addEventListener("click", () => {
  resetForm()
})

async function loadMarkets(){
  marketTableWrap.innerHTML = `<div class="loading-box">載入中...</div>`

  const { data, error } = await supabase
    .from("shipping_711_links")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if(error){
    console.error("loadMarkets error:", error)
    marketTableWrap.innerHTML = `<div class="empty-box">載入失敗</div>`
    return
  }

  if(!data || data.length === 0){
    marketTableWrap.innerHTML = `<div class="empty-box">目前還沒有賣場資料</div>`
    return
  }

  marketTableWrap.innerHTML = `
    <table class="market-table">
      <thead>
        <tr>
          <th>名稱</th>
          <th>連結</th>
          <th>排序</th>
          <th>狀態</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(item => `
          <tr>
            <td>
              <b>${escapeHtml(item.market_name)}</b>
              <div style="margin-top:6px;color:#777;font-size:13px;line-height:1.7;">
                ${escapeHtml(item.note || "")}
              </div>
            </td>
            <td>
              <div class="url-text">${escapeHtml(item.market_url)}</div>
            </td>
            <td>${item.sort_order ?? 0}</td>
            <td>
              <span class="status-badge ${item.is_active ? "status-on" : "status-off"}">
                ${item.is_active ? "顯示中" : "已隱藏"}
              </span>
            </td>
            <td>
              <div class="action-group">
                <button class="btn-edit" data-action="edit" data-id="${item.id}">編輯</button>
                <button class="btn-toggle" data-action="toggle" data-id="${item.id}" data-active="${item.is_active}">
                  ${item.is_active ? "下架" : "上架"}
                </button>
                <button class="btn-delete" data-action="delete" data-id="${item.id}">刪除</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `

  bindTableActions(data)
}

function bindTableActions(data){
  marketTableWrap.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action
      const id = btn.dataset.id
      const item = data.find(x => x.id === id)
      if(!item) return

      if(action === "edit"){
        startEdit(item)
      }

      if(action === "toggle"){
        await toggleActive(id, btn.dataset.active === "true")
      }

      if(action === "delete"){
        await deleteMarket(id)
      }
    })
  })
}

function startEdit(item){
  editId.value = item.id
  marketName.value = item.market_name || ""
  marketUrl.value = item.market_url || ""
  marketNote.value = item.note || ""
  sortOrder.value = item.sort_order ?? 0
  isActive.checked = !!item.is_active

  formTitle.textContent = "編輯賣場"
  cancelEditBtn.style.display = "inline-block"

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  })
}

function resetForm(){
  editId.value = ""
  marketForm.reset()
  marketNote.value = "請勿下單到其他人的單子，僅限下單 THAI BUY 指定賣場。"
  sortOrder.value = 0
  isActive.checked = true
  formTitle.textContent = "新增賣場"
  cancelEditBtn.style.display = "none"
}

async function toggleActive(id, currentActive){
  const { error } = await supabase
    .from("shipping_711_links")
    .update({ is_active: !currentActive })
    .eq("id", id)

  if(error){
    console.error("toggleActive error:", error)
    alert("更新狀態失敗")
    return
  }

  await loadMarkets()
}

async function deleteMarket(id){
  const yes = confirm("確定要刪除這筆賣場嗎？")
  if(!yes) return

  const { error } = await supabase
    .from("shipping_711_links")
    .delete()
    .eq("id", id)

  if(error){
    console.error("deleteMarket error:", error)
    alert("刪除失敗")
    return
  }

  await loadMarkets()
}

function escapeHtml(str = ""){
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}