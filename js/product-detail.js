import { supabase } from "./supabase.js"
import { addToCart, renderCart } from "./cart.js"
// ⭐ 取得 URL id
const params = new URLSearchParams(window.location.search)
const id = params.get("id")
let currentProduct = null

loadProduct()

async function loadProduct(){

 const { data: product } = await supabase
  .from("products")
  .select("*")
  .eq("id", id)
  .eq("is_active", true)
  .single()

  if(!product){
    const container = document.getElementById("productDetail")
    container.innerHTML = `<div style="padding:30px; color:#666;">此商品已下架或不存在</div>`
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

  const container = document.getElementById("productDetail")

  container.innerHTML = `
    <div style="display:flex;gap:40px;flex-wrap:wrap">

      <!-- 左邊圖片 -->
      <div>
        <img id="mainImg" src="${images?.[0]?.image_url || ""}" style="width:300px;border-radius:10px">

        <div style="margin-top:10px">
          ${images.map(img=>`
            <img src="${img.image_url}" 
              style="width:60px;margin-right:5px;cursor:pointer"
              onclick="changeImage('${img.image_url}')">
          `).join("")}
        </div>
      </div>

      <!-- 右邊資訊 -->
      <div style="flex:1">

        <h2>${product.name}</h2>

        <p>${product.description || ""}</p>

        <div>
          <select id="variantSelect">
            ${variants.map(v=>`
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
        </div>

        <div id="stockInfo" style="margin-top:8px;color:#666;"></div>

        <div id="price" style="font-size:24px;font-weight:bold;margin:10px 0"></div>

        <button class="btn-primary" onclick="addDetailToCart()">加入購物車</button>

        <hr>

        <div>
          <h4>預購說明</h4>
          ${product.preorder_note || ""}
        </div>

        <div>
          <h4>運送方式</h4>
          ${product.shipping_method || ""}
        </div>

        <div>
          <h4>付款方式</h4>
          ${product.payment_method || ""}
        </div>

      </div>

    </div>
  `

  updatePrice()

  document.getElementById("variantSelect")
    .addEventListener("change", updatePrice)
}

// ⭐ 切換圖片
window.changeImage = function(url){
  document.getElementById("mainImg").src = url
}

// ⭐ 價格更新
function updatePrice(){
  const select = document.getElementById("variantSelect")
  const option = select.options[select.selectedIndex]
  const price = Number(option.value)
  const stock = Number(option.dataset.stock || 0)

  document.getElementById("price").innerText = `TWD $${price}`
  document.getElementById("stockInfo").innerText = `目前庫存：${stock}`
}

window.addDetailToCart = function(){

  const select = document.getElementById("variantSelect")
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

renderCart()

window.goBackHome = function(){
  window.location.href = "./index.html"
}