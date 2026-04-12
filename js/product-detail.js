import { supabase } from "./supabase.js"
import { addToCart, renderCart } from "./cart.js"

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

function safeAttr(str){
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

// ⭐ 取得 URL id
const params = new URLSearchParams(window.location.search)
const id = params.get("id")
let currentProduct = null

loadProduct()
renderCart()

async function loadProduct(){

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single()

  if(!product){
    const container = document.getElementById("productDetail")
    container.innerHTML = `
      <div style="padding:30px; color:#666;">
        此商品已下架或不存在
      </div>
    `
    return
  }

  currentProduct = product

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", id)

  const { data: images } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", id)
    .order("sort_order")

const safeVariants = (variants || []).filter(v => Number(v.stock || 0) > 0)
const safeImages = (images || []).map((img, index) => ({
  ...img,
  safe_url: safeImageUrl(img.image_url),
  safe_border: index === 0 ? "2px solid #d87a2f" : "1px solid #ddd",
 safe_label: escapeHtml(
  (img.image_label && img.image_label.trim())
    ? img.image_label
    : `圖${index + 1}`
)
}))

const safeProductName = escapeHtml(product.name)
const safePreorderNote = escapeHtml(product.preorder_note)
const safeShippingMethod = escapeHtml(product.shipping_method)
const safePaymentMethod = escapeHtml(product.payment_method)
const safeDescription = escapeHtml(product.description)

const container = document.getElementById("productDetail")

  container.innerHTML = `
    <div style="
      display:flex;
      gap:36px;
      flex-wrap:wrap;
      align-items:flex-start;
    ">

      <!-- 左邊 -->
      <div style="width:320px;flex-shrink:0;">

        <div style="
          background:#f4efe9;
          border-radius:14px;
          padding:12px;
        ">
       <img
  id="mainImg"
  src="${safeImages?.[0]?.safe_url || "https://via.placeholder.com/300"}"
  alt="${safeProductName}"
  style="
    width:100%;
    border-radius:10px;
    display:block;
  "
>

<div
  id="mainImgLabel"
  style="
    margin-top:10px;
    text-align:center;
    font-size:14px;
    color:#6b5b52;
    font-weight:600;
    line-height:1.4;
    display:-webkit-box;
    -webkit-line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden;
    min-height:39px;
  "
  title="${safeImages?.[0]?.safe_label || "圖一"}"
>
  ${safeImages?.[0]?.safe_label || "圖一"}
</div>
        </div>

      ${
  safeImages.length > 0 ? `
    <div
      id="thumbList"
      style="
        margin-top:10px;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      "
    >
   ${safeImages.map((img)=>`
  <div style="
    width:66px;
    text-align:center;
  ">
    <img
      src="${img.safe_url}"
      data-image-url="${safeAttr(img.safe_url)}"
      data-image-label="${safeAttr(img.safe_label)}"
      alt="${safeProductName}"
      style="
        width:58px;
        height:58px;
        object-fit:cover;
        border-radius:8px;
        cursor:pointer;
        border:${img.safe_border};
        background:#fff;
        display:block;
        margin:0 auto;
      "
    >
    <div style="
      margin-top:4px;
      font-size:12px;
      color:#6b5b52;
      line-height:1.3;
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
      min-height:31px;
      word-break:break-word;
    " title="${img.safe_label}">
      ${img.safe_label}
    </div>
  </div>
`).join("")}
    </div>
  ` : ""
}

        <!-- 左邊說明區 -->
        <div style="
          display:flex;
          flex-direction:column;
          gap:12px;
          margin-top:16px;
        ">

      <div style="
  background:linear-gradient(135deg, rgba(255,248,242,0.96) 0%, rgba(255,236,220,0.96) 100%);
  border-radius:14px;
  padding:14px 16px;
  border-left:4px solid #f2a66a;
  box-shadow:0 1px 0 rgba(255,255,255,0.7) inset;
">
            <h4 style="
              margin:0 0 8px 0;
              color:#3a1d14;
              font-size:16px;
            ">預購說明</h4>
            <div style="
              line-height:1.9;
              color:#333;
              white-space:pre-line;
            ">${safePreorderNote}</div>
          </div>

        <div style="
  background:linear-gradient(135deg, rgba(255,246,238,0.96) 0%, rgba(255,230,210,0.96) 100%);
  border-radius:14px;
  padding:14px 16px;
  border-left:4px solid #ee9a58;
  box-shadow:0 1px 0 rgba(255,255,255,0.7) inset;
">
            <h4 style="
              margin:0 0 8px 0;
              color:#3a1d14;
              font-size:16px;
            ">運送方式</h4>
            <div style="
              line-height:1.9;
              color:#333;
              white-space:pre-line;
            ">${safeShippingMethod}</div>
          </div>

         <div style="
  background:linear-gradient(135deg, rgba(255,248,242,0.96) 0%, rgba(255,236,220,0.96) 100%);
  border-radius:14px;
  padding:14px 16px;
  border-left:4px solid #f2a66a;
  box-shadow:0 1px 0 rgba(255,255,255,0.7) inset;
">
            <h4 style="
              margin:0 0 8px 0;
              color:#3a1d14;
              font-size:16px;
            ">付款方式</h4>
            <div style="
              line-height:1.9;
              color:#333;
              white-space:pre-line;
            ">${safePaymentMethod}</div>
          </div>

        </div>
      </div>

      <!-- 右邊資訊 -->
      <div style="flex:1;min-width:300px;">

      <div style="margin-bottom:14px;">
  <h2 style="
    margin:0 0 8px 0;
    font-size:24px;
    line-height:1.4;
    color:#3a1d14;
  ">
    ${safeProductName}
  </h2>

  <div style="
    display:inline-block;
    font-size:13px;
    color:#b55b1f;
    background:linear-gradient(135deg, rgba(255,248,242,0.95) 0%, rgba(255,233,214,0.95) 100%);
    border:1px solid #f0c29a;
    border-radius:999px;
    padding:5px 12px;
    font-weight:600;
  ">
    ${
      product.preorder_type === "limited"
        ? "限量預購"
        : product.preorder_type === "instock"
        ? "現貨"
        : "一般預購"
    }
  </div>
</div>

      

        <!-- 規格區 -->
        <div style="
          background:#f6f1eb;
          border-radius:12px;
          padding:16px;
          margin-bottom:16px;
        ">
          <div style="
            font-size:14px;
            color:#6b5b52;
            margin-bottom:8px;
            font-weight:600;
          ">
            選擇規格
          </div>

          ${
  safeVariants.length > 0
    ? `
      <select
        id="variantSelect"
        style="
          width:100%;
          height:44px;
          border:1px solid #d8d0c8;
          border-radius:10px;
          padding:0 12px;
          font-size:15px;
          background:#fff;
        "
      >
        ${safeVariants.map(v=>`
  <option
    value="${Number(v.price || 0)}"
    data-stock="${Number(v.stock || 0)}"
    data-variant-name="${safeAttr(v.name)}"
    data-variant-id="${safeAttr(v.id)}"
  >
    ${escapeHtml(v.name)} - TWD $${Number(v.price || 0)}（庫存：${Number(v.stock || 0)}）
  </option>
`).join("")}
      </select>
    `
    : `
      <div style="
        padding:12px 14px;
        border-radius:10px;
        background:#fff3f3;
        color:#c62828;
        border:1px solid #f2c7c7;
        font-size:14px;
      ">
        此商品目前已售完
      </div>
    `
}

          <div id="stockInfo" style="
            margin-top:12px;
            font-size:14px;
            color:#666;
          "></div>

          <div id="price" style="
            font-size:20px;
            font-weight:bold;
            margin:12px 0 0 0;
            color:#2f170f;
          "></div>
        </div>

        ${
  safeVariants.length > 0
    ? `
     <button
  id="addDetailBtn"
  class="btn-primary"
  type="button"
  style="
    width:100%;
    margin-bottom:18px;
  "
>
  加入購物車
</button>
    `
    : `
      <button
        class="btn-primary"
        disabled
        style="
          width:100%;
          margin-bottom:18px;
          opacity:0.6;
          cursor:not-allowed;
        "
      >
        已售完
      </button>
    `
}

  <div style="
          line-height:1.9;
          color:#333;
          white-space:pre-line;
          margin-bottom:18px;
        ">
          ${safeDescription}
        </div>

      </div>

    </div>
  `

  const thumbList = document.getElementById("thumbList")
if(thumbList){
  thumbList.querySelectorAll("img").forEach(img=>{
    img.addEventListener("click", ()=>{
changeImage(
  img.dataset.imageUrl || "",
  img.dataset.imageLabel || `圖${Array.from(img.parentElement.parentElement.children).indexOf(img.parentElement) + 1}`,
  img
)
    })
  })
}

const addDetailBtn = document.getElementById("addDetailBtn")
if(addDetailBtn){
  addDetailBtn.addEventListener("click", addDetailToCart)
}

  updatePrice()

  const variantSelect = document.getElementById("variantSelect")
  if(variantSelect){
    variantSelect.addEventListener("change", updatePrice)
  }
}

// ⭐ 切換圖片
window.changeImage = function(url, label, el){
  const mainImg = document.getElementById("mainImg")
  const mainImgLabel = document.getElementById("mainImgLabel")

  if(mainImg){
    mainImg.src = url
  }

  if(mainImgLabel){
    mainImgLabel.textContent = label || ""
  }

  document.querySelectorAll("#thumbList img").forEach(img=>{
    img.style.border = "1px solid #ddd"
  })

  if(el){
    el.style.border = "2px solid #d87a2f"
  }
}

// ⭐ 價格更新
function updatePrice(){
  const select = document.getElementById("variantSelect")
  if(!select) return

  const option = select.options[select.selectedIndex]
  const price = Number(option.value)
  const stock = Number(option.dataset.stock || 0)

  const priceEl = document.getElementById("price")
  const stockEl = document.getElementById("stockInfo")

  if(priceEl){
    priceEl.innerText = `TWD $${price}`
  }

  if(stockEl){
    stockEl.innerText = `目前庫存：${stock}`

    if(stock <= 0){
      stockEl.style.color = "#c62828"
    }else{
      stockEl.style.color = "#666"
    }
  }
}

window.addDetailToCart = function(){

  const select = document.getElementById("variantSelect")
  if(!select){
    alert("請先選擇規格")
    return
  }

  const option = select.options[select.selectedIndex]

  const originalPrice = Number(select.value)
  const variantName = option.dataset.variantName || option.text
  const variantId = option.dataset.variantId
  const stock = Number(option.dataset.stock || 0)

  if(stock <= 0){
    alert("此規格目前無庫存")
    return
  }

  const ok = addToCart({
    product_id: id,
    product_name: currentProduct?.name || "",
variant_id: String(variantId || ""),
variant: String(variantName || ""),
    original_price: originalPrice,
    checkout_price: originalPrice,
    preorder_type: currentProduct?.preorder_type || "normal",
    deposit_required: !!currentProduct?.deposit_required,
    deposit_amount: Number(currentProduct?.deposit_amount || 0),
    stock: stock
  })

  if(ok){
    alert("已加入購物車")
  }
}

window.goBackHome = function(){
  window.location.href = "./index.html"
}