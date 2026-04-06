import { supabase } from "./supabase.js"
import { renderCart } from "./cart.js"

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
    .order("created_at", { ascending: false })

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

const container = document.getElementById("productGrid")

container.innerHTML = ""

for(const p of filteredProducts){

    // ⭐ 取圖片（第一張）
    const { data: images } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", p.id)
      .order("sort_order")
      .limit(1)
  
    const imgUrl = images?.[0]?.image_url || "https://via.placeholder.com/300"
  
    // ⭐ 取價格（最低）
    const { data: variants } = await supabase
      .from("product_variants")
      .select("price, stock")
      .eq("product_id", p.id)
  
   const minPrice = variants.length
  ? Math.min(...variants.map(v=>v.price))
  : 0

const isSoldOut = !variants || variants.length === 0 || variants.every(v => Number(v.stock || 0) <= 0)

if(currentStockStatus === "available" && isSoldOut){
  continue
}

if(currentStockStatus === "soldout" && !isSoldOut){
  continue
}

const div = document.createElement("div")
    div.className = `product-card ${isSoldOut ? "soldout" : ""}`
  
let preorderLabel = "一般預購"

if(p.preorder_type === "limited"){
  preorderLabel = "限量預購"
}else if(p.preorder_type === "instock"){
  preorderLabel = "現貨"
}

 div.innerHTML = `
  <div class="product-img-wrap">
    <span class="product-badge ${p.preorder_type}">
  ${preorderLabel}
</span>

    ${isSoldOut ? `<span class="soldout-badge">SOLD OUT</span>` : ""}

    <img src="${imgUrl}" class="product-img">

    <button class="add-btn"
      onclick="event.stopPropagation(); goToDetail('${p.id}')">
      查看詳情
    </button>
  </div>

  <div class="product-info">
    <div class="product-name">${p.name}</div>
    <div style="font-size:12px;color:#666;">
      ${p.description || ""}
    </div>
    <div class="product-price">$${minPrice}</div>
  </div>
`
  
    div.onclick = ()=>{
  goToDetail(p.id)
}
  
    container.appendChild(div)
  }

 
  }

async function loadSeries(){

  const { data: series, error } = await supabase
    .from("product_series")
    .select("*")
    .order("created_at", { ascending: false })

  if(error){
    console.error("load series error:", error)
    return
  }

  const container = document.getElementById("seriesSidebar")
  if(!container) return

container.innerHTML = `
  <button class="sidebar-link series-filter ${currentSeriesId === "all" ? "active" : ""}" onclick="filterBySeries('all')">
    全部系列
  </button>
`

for(const s of series || []){
  container.innerHTML += `
    <button class="sidebar-link series-filter ${currentSeriesId === s.id ? "active" : ""}" onclick="filterBySeries('${s.id}')">
      ${s.name}
    </button>
  `
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