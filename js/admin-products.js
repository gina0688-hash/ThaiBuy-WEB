import { supabase } from "./supabase.js"

let variants = []
let editingId = null

function setFormMode(isEdit){
  const title = document.getElementById("formTitle")
  const submitBtn = document.getElementById("submitBtn")
  const cancelBtn = document.getElementById("cancelEditBtn")

  if(title){
    title.textContent = isEdit ? "🛍 編輯商品" : "🛍 新增商品"
  }

  if(submitBtn){
    submitBtn.textContent = isEdit ? "更新商品" : "送出商品"
  }

  if(cancelBtn){
    cancelBtn.style.display = isEdit ? "inline-block" : "none"
  }
}

window.cancelEdit = function(){
  resetForm()
}

window.toggleDepositFields = function(){
  const preorderType = document.getElementById("preorder_type")?.value
  const depositBlock = document.getElementById("depositBlock")

  if(!depositBlock) return

  if(preorderType === "limited"){
    depositBlock.style.display = "block"
  }else{
    depositBlock.style.display = "none"
    document.getElementById("deposit_required").value = "false"
    document.getElementById("deposit_amount").value = 0
    toggleDepositAmount()
  }
}

window.toggleDepositAmount = function(){
  const depositRequired = document.getElementById("deposit_required")?.value === "true"
  const wrap = document.getElementById("depositAmountWrap")

  if(!wrap) return

  wrap.style.display = depositRequired ? "block" : "none"

  if(!depositRequired){
    document.getElementById("deposit_amount").value = 0
  }else if(!document.getElementById("deposit_amount").value){
    document.getElementById("deposit_amount").value = 500
  }
}

async function loadSearchSeriesOptions(){
  const select = document.getElementById("searchSeries")
  if(!select) return

  const { data, error } = await supabase
    .from("product_series")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if(error){
    console.error("loadSearchSeriesOptions error:", error)
    return
  }

  select.innerHTML = `<option value="">全部系列</option>`

  data.forEach(s=>{
    const option = document.createElement("option")
    option.value = s.id
    option.textContent = s.name
    select.appendChild(option)
  })
}

async function loadSeriesOptions(selectedId = ""){
  const select = document.getElementById("series_id")
  if(!select) return

  const { data, error } = await supabase
    .from("product_series")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if(error){
    console.error("loadSeriesOptions error:", error)
    return
  }

  select.innerHTML = `<option value="">請選擇系列</option>`

  data.forEach(s=>{
    const option = document.createElement("option")
    option.value = s.id
    option.textContent = s.name
    if(String(selectedId) === String(s.id)){
      option.selected = true
    }
    select.appendChild(option)
  })
}

window.createSeries = async function(){
  const name = prompt("請輸入系列名稱")
  if(!name || !name.trim()) return

  const { data, error } = await supabase
    .from("product_series")
    .insert({ name: name.trim() })
    .select()
    .single()

  if(error){
    console.error("createSeries error:", error)
    alert("系列建立失敗，可能名稱重複")
    return
  }

 await loadSeriesOptions(data.id)
await loadSearchSeriesOptions()
alert("系列建立完成")
}

// ⭐ 新增規格
window.addVariant = function(){
  const id = crypto.randomUUID()

  variants.push({
    id,              // 前端暫時識別用
    dbId: null,      // 資料庫真正 id，新規格還沒有
    name: "",
    price: 0,
    stock: 0,
    isDeleted: false
  })

  renderVariants()
}

// ⭐ 渲染規格（修正跳掉問題）
function renderVariants(){
  const container = document.getElementById("variants")
  container.innerHTML = ""

  const visibleVariants = variants.filter(v => !v.isDeleted)

  if(visibleVariants.length === 0){
    container.innerHTML = `<div class="helper-text">目前尚未新增規格</div>`
    return
  }

  visibleVariants.forEach(v=>{
    const div = document.createElement("div")
    div.className = "variant"

    div.innerHTML = `
      <input
        placeholder="規格名稱"
        value="${v.name || ""}"
        oninput="updateVariant('${v.id}', 'name', this.value)">

      <input
        placeholder="價格"
        type="number"
        min="0"
        value="${v.price || 0}"
        oninput="updateVariant('${v.id}', 'price', this.value)">

      <input
        placeholder="庫存數量"
        type="number"
        min="0"
        value="${v.stock || 0}"
        oninput="updateVariant('${v.id}', 'stock', this.value)">

      <button type="button" onclick="removeVariant('${v.id}')">刪除</button>
    `

    container.appendChild(div)
  })
}

window.updateVariant = function(id, field, value){
  const v = variants.find(x => String(x.id) === String(id))
  if(!v) return

  v[field] = ["price", "stock"].includes(field)
    ? Number(value)
    : value
}

window.removeVariant = function(id){
  const target = variants.find(v => String(v.id) === String(id))
  if(!target) return

  // 舊規格：不要直接刪掉，先標記刪除
  if(target.dbId){
    target.isDeleted = true
  }else{
    // 新增但還沒存進 DB 的規格，才直接移除
    variants = variants.filter(v => String(v.id) !== String(id))
  }

  renderVariants()
}

function validateProductForm(){
  const name = document.getElementById("name").value.trim()
  const series_id = document.getElementById("series_id").value || ""
  const preorder_type = document.getElementById("preorder_type").value
  const deposit_required = document.getElementById("deposit_required").value === "true"
  const deposit_amount = Number(document.getElementById("deposit_amount").value || 0)

  const activeVariants = variants.filter(v => !v.isDeleted)

  if(!name){
    alert("請輸入商品名稱")
    return false
  }

  if(!series_id){
    alert("請選擇商品系列")
    return false
  }

  if(activeVariants.length === 0){
    alert("請至少新增一個規格")
    return false
  }

  if(preorder_type === "limited" && deposit_required && (isNaN(deposit_amount) || deposit_amount <= 0)){
    alert("限量預購若需訂金，請輸入正確的訂金金額")
    return false
  }

  for(const v of activeVariants){
    if(!v.name || !v.name.trim()){
      alert("規格名稱不可空白")
      return false
    }

    if(isNaN(Number(v.price)) || Number(v.price) < 0){
      alert(`規格「${v.name || "未命名規格"}」的價格不正確`)
      return false
    }

    if(isNaN(Number(v.stock)) || Number(v.stock) < 0){
      alert(`規格「${v.name || "未命名規格"}」的庫存不正確`)
      return false
    }
  }

  return true
}

// ⭐ 儲存商品（含圖片）
window.saveProduct = async function(){

  if(!validateProductForm()) return

    const name = document.getElementById("name").value.trim()
  const series_id = document.getElementById("series_id").value || null
  const is_active = document.getElementById("is_active").value === "true"
  const preorder_type = document.getElementById("preorder_type").value
  const deposit_required = document.getElementById("deposit_required").value === "true"
  const deposit_amount = deposit_required
    ? Number(document.getElementById("deposit_amount").value || 0)
    : 0
  const desc = document.getElementById("desc").value.trim()
  const release_date = document.getElementById("release_date").value
  const preorder_note = document.getElementById("preorder_note").value.trim()
  const payment_method = document.getElementById("payment_method").value.trim()
  const shipping_method = document.getElementById("shipping_method").value.trim()

  let productId = null

  // ✏️ 更新
  if(editingId){

    const { error } = await supabase
      .from("products")
     .update({
  release_date,
  name,
  description: desc,
  preorder_type,
  deposit_required,
  deposit_amount,
  preorder_note,
  payment_method,
  shipping_method,
  series_id,
  is_active
})
      .eq("id", editingId)

    if(error){
      console.error(error)
      alert("更新失敗")
      return
    }

    productId = editingId

 
   

  }else{

    // ➕ 新增
    const { data: product, error } = await supabase
      .from("products")
      .insert({
  release_date,
  name,
  description: desc,
  preorder_type,
  deposit_required,
  deposit_amount,
  preorder_note,
  payment_method,
  shipping_method,
  series_id,
  is_active
})
      .select()
      .single()

    if(error){
      console.error(error)
      alert("新增失敗")
      return
    }

    productId = product.id
  }

  // ⭐ 規格同步：舊的 update、新的 insert、被刪的才 delete
  const activeVariants = variants.filter(v => !v.isDeleted)
  const deletedVariants = variants.filter(v => v.isDeleted && v.dbId)

  // 1. 更新舊規格
  for(const v of activeVariants.filter(v => v.dbId)){
   const { error: updateVariantError } = await supabase
  .from("product_variants")
  .update({
    name: v.name,
    price: Number(v.price || 0),
    stock: Number(v.stock || 0),
    is_active: true
  })
  .eq("id", v.dbId)

    if(updateVariantError){
      console.error("update variant error:", updateVariantError)
      alert(`規格更新失敗：${v.name || "未命名規格"}`)
      return
    }
  }

  // 2. 新增新規格
  const newVariants = activeVariants.filter(v => !v.dbId)

  if(newVariants.length > 0){
  const insertData = newVariants.map(v => ({
  product_id: productId,
  name: v.name,
  price: Number(v.price || 0),
  stock: Number(v.stock || 0),
  is_active: true
}))

    const { error: insertVariantError } = await supabase
      .from("product_variants")
      .insert(insertData)

    if(insertVariantError){
      console.error("insert variant error:", insertVariantError)
      alert("新增規格失敗")
      return
    }
  }

  // 3. 刪除被移除的舊規格
 for(const v of deletedVariants){
  const { error: deactivateVariantError } = await supabase
    .from("product_variants")
    .update({
      is_active: false
    })
    .eq("id", v.dbId)

  if(deactivateVariantError){
    console.error("deactivate variant error:", deactivateVariantError)
    alert(`停用規格失敗：${v.name}`)
    return
  }
}

  // ⭐⭐⭐ 圖片上傳（修正後）

  const files = document.getElementById("images")?.files || []

  // 只有「真的有重新選圖片」時，才刪舊圖再重建
  if(files.length > 0){

    const { error: deleteImageError } = await supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId)

    if(deleteImageError){
      console.error("delete old images error:", deleteImageError)
      alert("刪除舊圖片失敗：" + (deleteImageError.message || "未知錯誤"))
      return
    }

    const imageUrls = await uploadImages(files)

    if(imageUrls.length > 0){

      const imageData = imageUrls.map((url, index)=>({
        product_id: productId,
        image_url: url,
        sort_order: index
      }))

      const { error: imageDbError } = await supabase
        .from("product_images")
        .insert(imageData)

      if(imageDbError){
        console.error("product_images insert error:", imageDbError)
        alert("圖片資料寫入失敗：" + (imageDbError.message || "未知錯誤"))
        return
      }
    }
  }

   alert("完成 🎉")

  resetForm()
  await loadProducts()
}

// ⭐ 載入商品（含圖片）
window.loadProducts = async function(){

  const keyword = document.getElementById("searchKeyword")?.value.trim() || ""
  const searchSeries = document.getElementById("searchSeries")?.value || ""
  const searchStatus = document.getElementById("searchStatus")?.value || ""

  let query = supabase
    .from("products")
    .select(`
      *,
      product_series (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false })


  // 系列篩選
  if(searchSeries){
    query = query.eq("series_id", searchSeries)
  }

  // 狀態篩選
  if(searchStatus !== ""){
    query = query.eq("is_active", searchStatus === "true")
  }

  // 關鍵字先搜尋商品名稱 / 描述
  if(keyword){
    query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
  }

  const { data, error } = await query

  if(error){
    console.error("loadProducts error:", error)
    return
  }

 const container = document.getElementById("productList")
container.innerHTML = ""


for(const p of data){

   const { data: variantRows } = await supabase
  .from("product_variants")
  .select("*")
  .eq("product_id", p.id)
  .eq("is_active", true)

  const { data: images } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", p.id)
    .order("sort_order")

  // ⭐ 前端補充關鍵字過濾：規格名稱也納入搜尋
  if(keyword){
    const textPool = [
      p.name || "",
      p.description || "",
      p.product_series?.name || "",
            ...(variantRows || []).map(v => v.name || "")
    ].join(" ").toLowerCase()

    if(!textPool.includes(keyword.toLowerCase())){
      continue
    }
  }

  const div = document.createElement("div")
  div.className = "product-item"

   div.innerHTML = `
    <b>${p.name}</b>
    <span style="margin-left:8px; color:${p.is_active ? 'green' : 'red'};">
      ${p.is_active ? '上架中' : '已下架'}
    </span>
    <br>

    系列：${p.product_series?.name || "未分類"}<br>
    預購類型：${
  p.preorder_type === "limited"
    ? "限量預購"
    : p.preorder_type === "instock"
    ? "現貨"
    : "一般預購"
}<br>
    訂金：${
      p.deposit_required
        ? `需訂金 NT$${p.deposit_amount || 0}`
        : "不需訂金"
    }<br>
    ${p.description || ""}<br><br>

    上架日期：${p.release_date || "未設定"}<br>
建立時間：${new Date(p.created_at).toLocaleString()}<br><br>

    ${images.map(img => `
      <img src="${img.image_url}" style="width:80px; margin-right:5px;">
    `).join("")}

    <br><br>

       ${(variantRows || []).map(v=>`- ${v.name} / ${v.price} / 庫存：${v.stock || 0}`).join("<br>")}

    <br><br>
    <button onclick="editProduct('${p.id}')">編輯</button>
    <button class="btn-danger" onclick="deleteProduct('${p.id}')">刪除</button>
  `

  container.appendChild(div)
}

if(!container.innerHTML){
  container.innerHTML = `<div style="color:#666;">查無符合商品</div>`
}
}

// ⭐ 編輯
window.editProduct = async function(id){

  editingId = id
  setFormMode(true)

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single()

  if(productError || !product){
    console.error("editProduct product error:", productError)
    alert("讀取商品失敗")
    return
  }

  const { data: vData, error: variantReadError } = await supabase
  .from("product_variants")
  .select("*")
  .eq("product_id", id)
  .eq("is_active", true)

  if(variantReadError){
    console.error("editProduct variants error:", variantReadError)
    alert("讀取商品規格失敗")
    return
  }

  const { data: images, error: imageReadError } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", id)
    .order("sort_order")

  if(imageReadError){
    console.error("editProduct images error:", imageReadError)
    alert("讀取商品圖片失敗")
    return
  }

document.getElementById("release_date").value = product.release_date || ""
document.getElementById("name").value = product.name || ""
document.getElementById("desc").value = product.description || ""
document.getElementById("preorder_type").value = product.preorder_type || "normal"
document.getElementById("deposit_required").value = String(product.deposit_required || false)
document.getElementById("deposit_amount").value = product.deposit_amount || 0
document.getElementById("preorder_note").value = product.preorder_note || ""
document.getElementById("payment_method").value = product.payment_method || ""
document.getElementById("shipping_method").value = product.shipping_method || ""
document.getElementById("is_active").value = String(product.is_active)

toggleDepositFields()
toggleDepositAmount()

await loadSeriesOptions(product.series_id || "")

variants = vData.map(v => ({
  id: crypto.randomUUID(), // 前端畫面用
  dbId: v.id,              // 資料庫真正 id，一定要保留
  name: v.name,
  price: Number(v.price || 0),
  stock: Number(v.stock || 0),
  isDeleted: false
}))

  renderVariants()

// ⭐ 顯示圖片（加在 renderVariants() 下面）
const preview = document.getElementById("preview")

if(preview){
  preview.innerHTML = ""

  images.forEach((img, index)=>{
    const div = document.createElement("div")
    div.style.display = "inline-block"
    div.style.margin = "5px"

    div.innerHTML = `
      <img src="${img.image_url}" style="width:80px;"><br>
      ${index + 1}
    `

    preview.appendChild(div)
  })
}


}

// ⭐ 刪除
window.deleteProduct = async function(id){

  if(!confirm("確定刪除？")) return

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)

  if(error){
    console.error("deleteProduct error:", error)
    alert("刪除失敗")
    return
  }

  loadProducts()
}

// ⭐ 重置
function resetForm(){
  document.getElementById("release_date").value = ""
  document.getElementById("name").value = ""
  document.getElementById("desc").value = ""
  document.getElementById("preorder_type").value = "normal"
  document.getElementById("deposit_required").value = "false"
  document.getElementById("deposit_amount").value = 0
  document.getElementById("preorder_note").value = ""
  document.getElementById("payment_method").value = ""
  document.getElementById("shipping_method").value = ""
  document.getElementById("series_id").value = ""
  document.getElementById("is_active").value = "true"
  document.getElementById("images").value = ""
  document.getElementById("preview").innerHTML = ""

  toggleDepositFields()
  toggleDepositAmount()

  variants = []
  editingId = null
  renderVariants()
  setFormMode(false)
}

// ⭐ 初始化
init()

async function init(){
  await loadSeriesOptions()
  await loadSearchSeriesOptions()
  await loadProducts()

  setFormMode(false)
  toggleDepositFields()
  toggleDepositAmount()

  document.getElementById("searchKeyword")
    ?.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        loadProducts()
      }
    })

  document.getElementById("searchSeries")
    ?.addEventListener("change", loadProducts)

  document.getElementById("searchStatus")
    ?.addEventListener("change", loadProducts)
}

// ⭐ 上傳圖片
async function uploadImages(files){

  const urls = []

  for(const file of files){

    const fileExt = file.name.split(".").pop()
    const fileName = `products/${crypto.randomUUID()}.${fileExt}`

    const { error } = await supabase.storage
      .from("product-images")
      .upload(fileName, file, {
        upsert: false
      })

    if(error){
      console.error("storage upload error:", error)
      alert("圖片上傳失敗：" + (error.message || "未知錯誤"))
      continue
    }

    const { data } = supabase
      .storage
      .from("product-images")
      .getPublicUrl(fileName)

    urls.push(data.publicUrl)
  }

  return urls
}

window.previewImages = function(){

    const files = document.getElementById("images").files
    const preview = document.getElementById("preview")
  
    if(!preview) return
  
    preview.innerHTML = ""
  
    Array.from(files).forEach((file, index)=>{
  
      const reader = new FileReader()
  
      reader.onload = function(e){
  
        const div = document.createElement("div")
        div.style.display = "inline-block"
        div.style.margin = "5px"
  
        div.innerHTML = `
          <img src="${e.target.result}" style="width:80px;"><br>
          ${index + 1}
        `
  
        preview.appendChild(div)
      }
  
      reader.readAsDataURL(file)
    })
  }