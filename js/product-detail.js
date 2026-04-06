import { supabase } from "./supabase.js"
import { addToCart, renderCart } from "./cart.js"

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

  const safeVariants = variants || []
  const safeImages = images || []

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
            src="${safeImages?.[0]?.image_url || ""}"
            style="
              width:100%;
              border-radius:10px;
              display:block;
            "
          >
        </div>

        ${
          safeImages.length > 0 ? `
            <div style="
              margin-top:10px;
              display:flex;
              gap:8px;
              flex-wrap:wrap;
            ">
              ${safeImages.map((img, index)=>`
                <img
                  src="${img.image_url}"
                  style="
                    width:58px;
                    height:58px;
                    object-fit:cover;
                    border-radius:8px;
                    cursor:pointer;
                    border:${index === 0 ? "2px solid #d87a2f" : "1px solid #ddd"};
                    background:#fff;
                  "
                  onclick="changeImage('${img.image_url}', this)"
                >
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
            ">${product.preorder_note || ""}</div>
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
            ">${product.shipping_method || ""}</div>
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
            ">${product.payment_method || ""}</div>
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
    ${product.name || ""}
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
      product.preorder_type === "limit"
        ? "限量預購"
        : product.preorder_type === "instock"
        ? "現貨"
        : "一般預購"
    }
  </div>
</div>

        <div style="
          line-height:1.9;
          color:#333;
          white-space:pre-line;
          margin-bottom:18px;
        ">
          ${product.description || ""}
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
                value="${v.price}"
                data-stock="${v.stock ?? 0}"
                data-variant-name="${v.name}"
                data-variant-id="${v.id}"
              >
                ${v.name} - TWD $${v.price}（庫存：${v.stock ?? 0}）
              </option>
            `).join("")}
          </select>

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

        <button
          class="btn-primary"
          onclick="addDetailToCart()"
          style="
            width:100%;
            margin-bottom:18px;
          "
        >
          加入購物車
        </button>

      </div>

    </div>
  `

  updatePrice()

  const variantSelect = document.getElementById("variantSelect")
  if(variantSelect){
    variantSelect.addEventListener("change", updatePrice)
  }
}

// ⭐ 切換圖片
window.changeImage = function(url, el){
  const mainImg = document.getElementById("mainImg")
  if(mainImg){
    mainImg.src = url
  }

  document.querySelectorAll('#productDetail img[onclick*="changeImage"]').forEach(img=>{
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
    variant_id: variantId,
    variant: variantName,
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