import { supabase } from "./supabase.js"
import { renderCart } from "./cart.js"

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function safeImageUrl(url){
  const str = String(url || "").trim()

  if(!str) return "https://via.placeholder.com/300"

  if(
    str.startsWith("http://") ||
    str.startsWith("https://") ||
    str.startsWith("/")
  ){
    return str
  }

  return "https://via.placeholder.com/300"
}

let productsData = []
let currentSeriesId = "all"
let currentPreorderType = "all"
let currentStockStatus = "all"

renderCart()
loadSeries()
loadProducts()

window.goToDetail = function(productId){
  window.location.href = `product-detail.html?id=${productId}`
}

// ⭐ 載入商品
async function loadProducts(){

let query = supabase
  .from("products")
  .select("*")
  .eq("is_active", true)
  .order("sort_order", { ascending: true })
  .order("created_at", { ascending: true })

  if(currentSeriesId !== "all"){
    query = query.eq("series_id", currentSeriesId)
  }

  const { data, error } = await query

  if(error){
    console.error("load products error:", error)
    return
  }

  productsData = data

  let filteredProducts = data || []

  if(currentPreorderType !== "all"){
    filteredProducts = filteredProducts.filter(p => p.preorder_type === currentPreorderType)
  }

  const productIds = filteredProducts.map(p => p.id)

  if(productIds.length === 0){
  const container = document.getElementById("productGrid")

  if(container){
    container.innerHTML = `
      <div style="color:#666; padding:20px;">
        查無符合商品
      </div>
    `
  }

  return
}

  // ⭐ 一次抓全部商品的圖片，不要每個商品查一次
  const { data: allImages, error: imageError } = await supabase
    .from("product_images")
    .select("product_id, image_url, sort_order")
    .in("product_id", productIds)
    .order("sort_order", { ascending: true })

  if(imageError){
    console.error("load images error:", imageError)
  }

  // ⭐ 一次抓全部商品的規格，不要每個商品查一次
  const { data: allVariants, error: variantError } = await supabase
    .from("product_variants")
    .select("product_id, price, stock")
    .in("product_id", productIds)

  if(variantError){
    console.error("load variants error:", variantError)
  }

  // ⭐ 整理圖片：每個商品只取第一張
  const imageMap = {}

  for(const img of allImages || []){
    if(!imageMap[img.product_id]){
      imageMap[img.product_id] = img
    }
  }

  // ⭐ 整理規格：依商品分組
  const variantMap = {}

  for(const v of allVariants || []){
    if(!variantMap[v.product_id]){
      variantMap[v.product_id] = []
    }

    variantMap[v.product_id].push(v)
  }

function sortByReleaseDate(list){
  return [...list].sort((a, b) => {
    const dateA = a.release_date ? new Date(a.release_date) : new Date(0)
    const dateB = b.release_date ? new Date(b.release_date) : new Date(0)

    return dateB - dateA
  })
}

const currentProducts = sortByReleaseDate(
  filteredProducts.filter(p => p.display_status === "current")
)

const ongoingProducts = sortByReleaseDate(
  filteredProducts.filter(p => p.display_status === "ongoing")
)

const instockProducts = sortByReleaseDate(
  filteredProducts.filter(p => p.display_status === "instock")
)

const container = document.getElementById("productGrid")
container.innerHTML = ""

function renderProductCard(p, targetContainer){

  const imgUrl = safeImageUrl(imageMap[p.id]?.image_url)
  const variants = variantMap[p.id] || []

  const minPrice = variants.length
    ? Math.min(...variants.map(v => Number(v.price || 0)))
    : 0

  const maxPrice = variants.length
    ? Math.max(...variants.map(v => Number(v.price || 0)))
    : 0

  const priceText = minPrice === maxPrice
    ? `$${minPrice}`
    : `$${minPrice} ~ $${maxPrice}`

  const isSoldOut =
    !variants ||
    variants.length === 0 ||
    variants.every(v => Number(v.stock || 0) <= 0)

  if(currentStockStatus === "available" && isSoldOut){
    return
  }

  if(currentStockStatus === "soldout" && !isSoldOut){
    return
  }

  const div = document.createElement("div")
  div.className = `product-card ${isSoldOut ? "soldout" : ""}`

  let preorderLabel = "一般預購"

  if(p.preorder_type === "limited"){
    preorderLabel = "限量預購"
  }else if(p.preorder_type === "instock"){
    preorderLabel = "現貨"
  }

  const safeProductId = String(p.id || "")
  const safeProductName = escapeHtml(p.name)

  const safeBadgeClass = ["limited", "instock", "normal"].includes(p.preorder_type)
    ? p.preorder_type
    : "normal"

  div.innerHTML = `
    <div class="product-img-wrap">
      <span class="product-badge ${safeBadgeClass}">
        ${preorderLabel}
      </span>

      ${isSoldOut ? `<span class="soldout-badge">SOLD OUT</span>` : ""}

      <img 
        src="${imgUrl}" 
        class="product-img" 
        alt="${safeProductName}"
        loading="lazy"
        decoding="async"
      >

      <button class="add-btn" type="button">
        查看詳情
      </button>
    </div>

    <div class="product-info">
      <div class="product-name">${safeProductName}</div>
      <div class="product-price">${priceText}</div>
    </div>
  `

  const detailBtn = div.querySelector(".add-btn")

  if(detailBtn){
    detailBtn.addEventListener("click", (event)=>{
      event.stopPropagation()
      goToDetail(safeProductId)
    })
  }

  div.addEventListener("click", ()=>{
    goToDetail(safeProductId)
  })

  targetContainer.appendChild(div)
}

function renderSection(title, products){

  if(!products || products.length === 0){
    return
  }

  const section = document.createElement("section")
  section.className = "product-section"

  const titleEl = document.createElement("h2")
  titleEl.className = "product-section-title"
  titleEl.textContent = title

  const grid = document.createElement("div")
  grid.className = "product-section-grid"

  products.forEach(p =>{
    renderProductCard(p, grid)
  })

  // 如果經過庫存篩選後，這區一個商品都沒有，就不要顯示標題
  if(grid.children.length === 0){
    return
  }

  section.appendChild(titleEl)
  section.appendChild(grid)

  container.appendChild(section)
}

renderSection("⏰ 目前限時填單", currentProducts)
renderSection("🛍️ 持續預購", ongoingProducts)
renderSection("📦 現貨商品", instockProducts)

if(container.children.length === 0){
  container.innerHTML = `
    <div style="color:#666; padding:20px;">
      查無符合商品
    </div>
  `
}
}

async function loadSeries(){

 const { data: series, error } = await supabase
  .from("product_series")
  .select("*")
  .eq("show_in_filter", true)
  .order("created_at", { ascending: false })

  if(error){
    console.error("load series error:", error)
    return
  }

  const container = document.getElementById("seriesSidebar")
  if(!container) return

container.innerHTML = ""

const allBtn = document.createElement("button")
allBtn.className = `sidebar-link series-filter ${currentSeriesId === "all" ? "active" : ""}`
allBtn.textContent = "全部系列"
allBtn.type = "button"
allBtn.addEventListener("click", ()=>{
  filterBySeries("all")
})
container.appendChild(allBtn)

for(const s of series || []){
  const btn = document.createElement("button")
  const safeSeriesId = String(s.id || "")
btn.className = `sidebar-link series-filter ${currentSeriesId === safeSeriesId ? "active" : ""}`
  btn.textContent = s.name || ""
  btn.type = "button"
  btn.addEventListener("click", ()=>{
    filterBySeries(safeSeriesId)
  })
  container.appendChild(btn)
}
}

window.filterBySeries = async function(seriesId){
  currentSeriesId = seriesId
  await loadSeries()
  await loadProducts()
}

window.filterByPreorderType = async function(type){
  currentPreorderType = type

  document.querySelectorAll(".preorder-filter").forEach(btn=>{
    btn.classList.remove("active")
  })

  const target = document.querySelector(`[data-preorder="${type}"]`)
  if(target) target.classList.add("active")

  await loadProducts()
}

window.filterByStockStatus = async function(status){
  currentStockStatus = status

  document.querySelectorAll(".stock-filter").forEach(btn=>{
    btn.classList.remove("active")
  })

  const target = document.querySelector(`[data-stock-filter="${status}"]`)
  if(target) target.classList.add("active")

  await loadProducts()
}

window.resetAllFilters = async function(){
  currentSeriesId = "all"
  currentPreorderType = "all"
  currentStockStatus = "all"

  await loadSeries()

  document.querySelectorAll(".preorder-filter").forEach(btn=>{
    btn.classList.remove("active")
  })
  document.querySelectorAll(".stock-filter").forEach(btn=>{
    btn.classList.remove("active")
  })

  const preorderAll = document.querySelector('[data-preorder="all"]')
  if(preorderAll) preorderAll.classList.add("active")

  const stockAll = document.querySelector('[data-stock-filter="all"]')
  if(stockAll) stockAll.classList.add("active")

  await loadProducts()
}