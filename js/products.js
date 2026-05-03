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

  const productIds = filteredProducts.map(p => p.id)

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

  const container = document.getElementById("productGrid")
  container.innerHTML = ""

  for(const p of filteredProducts){

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

    container.appendChild(div)
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