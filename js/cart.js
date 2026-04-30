import { supabase } from "./supabase.js"

function escapeHtml(str = ""){
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

// ⭐ 取得購物車
export function getCart(){
  const cart = JSON.parse(localStorage.getItem("cart") || "[]")

  return cart.map(item => ({
    ...item,
    product_name: item.product_name || item.name || "",
    variant_id: item.variant_id || null,
    original_price: Number(item.original_price ?? item.price ?? 0),
    checkout_price: Number(item.checkout_price ?? item.price ?? 0),
    preorder_type: item.preorder_type || "normal",
    deposit_required: item.deposit_required ?? false,
    deposit_amount: Number(item.deposit_amount ?? 0),
    quantity: Number(item.quantity || 1)
  }))
}

// ⭐ 存購物車
export function saveCart(cart){
  localStorage.setItem("cart", JSON.stringify(cart))
}

// ⭐ 加入購物車
export async function addToCart(itemData){

  let cart = getCart()

  const cartType = cart.length ? cart[0].preorder_type : null
  const newType = itemData.preorder_type

  if(cartType && cartType !== newType){
    alert("限量預購商品不可與一般預購商品一起結帳，請分開下單")
    return false
  }

 const existing = cart.find(i =>
  i.variant_id === itemData.variant_id &&
  i.preorder_type === itemData.preorder_type
)

  if(existing){
    existing.quantity += 1
  }else{
    cart.push({
      product_id: itemData.product_id,
      product_name: itemData.product_name,
      variant_id: itemData.variant_id,
      name: `${itemData.product_name} / ${itemData.variant}`,
      variant: itemData.variant,
      original_price: Number(itemData.original_price || 0),
      checkout_price: Number(itemData.checkout_price || 0),
      preorder_type: itemData.preorder_type || "normal",
      deposit_required: !!itemData.deposit_required,
      deposit_amount: Number(itemData.deposit_amount || 0),
      quantity: 1
    })
  }

   saveCart(cart)
  await renderCart()
  return true
}

// ⭐ 同步購物車庫存狀態
export async function syncCartWithStock(showAlert = false){
  let cart = getCart()

  if(!cart.length){
    return {
      cart: [],
      removedItems: [],
      changed: false
    }
  }

  const variantIds = [...new Set(
    cart.map(item => item.variant_id).filter(Boolean)
  )]

  if(!variantIds.length){
    return {
      cart,
      removedItems: [],
      changed: false
    }
  }

  const { data, error } = await supabase
    .from("product_variants")
    .select(`
      id,
      stock,
      product_id,
      products (
        id,
        is_active
      )
    `)
    .in("id", variantIds)

  if(error){
    console.error("檢查購物車庫存失敗：", error)
    return {
      cart,
      removedItems: [],
      changed: false
    }
  }

  const variantMap = new Map(
    (data || []).map(row => [row.id, row])
  )

  const removedItems = []
  const adjustedItems = []

  const validCart = cart
    .map(item => {
      const variant = variantMap.get(item.variant_id)

      let productActive = false

      if(Array.isArray(variant?.products)){
        productActive = !!variant.products[0]?.is_active
      }else{
        productActive = !!variant?.products?.is_active
      }

      const stock = Number(variant?.stock || 0)
      const hasStock = stock > 0
      const isValid = !!variant && productActive && hasStock

      if(!isValid){
        removedItems.push(item)
        return null
      }

      if(Number(item.quantity || 0) > stock){
        adjustedItems.push({
          ...item,
          oldQuantity: Number(item.quantity || 0),
          newQuantity: stock
        })

        return {
          ...item,
          quantity: stock
        }
      }

      return item
    })
    .filter(Boolean)

  const changed = removedItems.length > 0 || adjustedItems.length > 0

  if(changed){
    saveCart(validCart)

    if(showAlert){
      let message = ""

      if(removedItems.length){
        const removedNames = removedItems
          .map(item => `${item.product_name} / ${item.variant}`)
          .join("\n")

        message += `以下商品已無庫存或已下架，已自動從購物車移除：\n${removedNames}`
      }

      if(adjustedItems.length){
        const adjustedNames = adjustedItems
          .map(item => `${item.product_name} / ${item.variant}：${item.oldQuantity} → ${item.newQuantity}`)
          .join("\n")

        if(message) message += `\n\n`

        message += `以下商品因庫存不足，已自動調整數量：\n${adjustedNames}`
      }

      alert(message)
    }
  }

  return {
    cart: validCart,
    removedItems,
    adjustedItems,
    changed
  }
}


// ⭐ 刪除
export async function removeFromCart(index){
  let cart = getCart()

  if(index < 0 || index >= cart.length) return

  cart.splice(index, 1)   // ⭐ 你漏掉這行

  saveCart(cart)
  await renderCart()
}

// ⭐ 數量變更
export async function changeQty(index, delta){
  let cart = getCart()

  if(!cart[index]) return

  cart[index].quantity += delta

  if(cart[index].quantity <= 0){
    cart.splice(index, 1)
  }

  saveCart(cart)
  await renderCart()
}



// ⭐ render 購物車
export async function renderCart(){

  const syncResult = await syncCartWithStock(false)
  const cart = syncResult.cart

  const items = document.getElementById("cartItems")
  const totalDiv = document.getElementById("cartTotal")
  const count = document.getElementById("cartCount")

  if(!items) return

    items.innerHTML = ""

  if(!cart.length){
    items.innerHTML = `<div style="color:#666;">購物車目前沒有商品</div>`
    count.innerText = 0
    totalDiv.innerHTML = `<b>本次結帳金額：$0</b>`
    return
  }

  // ⭐ 先算整車總金額
  let total = 0
  let hasLimitedDeposit = false
  let limitedDepositAmount = 0

  for(const cartItem of cart){
    if(cartItem.preorder_type === "limited" && cartItem.deposit_required){
      hasLimitedDeposit = true
      limitedDepositAmount = Number(cartItem.deposit_amount || 0)
    }else{
      total += Number(cartItem.checkout_price || 0) * Number(cartItem.quantity || 0)
    }
  }

  if(hasLimitedDeposit){
    total += limitedDepositAmount
  }

  // ⭐ 再 render 每筆商品
  cart.forEach((item, index)=>{

    const isLimitedDeposit =
      item.preorder_type === "limited" && item.deposit_required

    items.innerHTML += `
      <div class="cart-item">
       <div><b>${escapeHtml(item.product_name || "")}</b></div>
<div>${escapeHtml(item.variant || "")}</div>

        <div style="font-size:12px;color:#666;">
          ${item.preorder_type === "limited" ? "限量預購" : "一般預購"}
        </div>

        <div style="margin:6px 0;font-size:13px;">
        商品原價：$${Number(item.original_price || 0)}
${
  isLimitedDeposit
    ? `<br>本次收款：整單訂金 $${Number(item.deposit_amount || 0)}`
    : `<br>本次收款：$${Number(item.checkout_price || 0)}`
}
        </div>

        <button onclick="window.changeQty(${index}, -1)">➖</button>
        ${item.quantity}
        <button onclick="window.changeQty(${index}, 1)">➕</button>

        <br>
        ${
          isLimitedDeposit
            ? `小計：整單只收一次訂金`
            : `小計：$${Number(item.checkout_price || 0) * Number(item.quantity || 0)}`
        }

        <button onclick="window.removeFromCart(${index})">❌</button>
      </div>
    `
  })

 count.innerText = cart.reduce((sum, i) => sum + Number(i.quantity || 0), 0)
  totalDiv.innerHTML = `<b>本次結帳金額：$${total}</b>`
}

// ⭐ toggle cart
export async function toggleCart(){
  const panel = document.getElementById("cartPanel")

  const willOpen = panel.style.display !== "flex"

  if(willOpen){
    await syncCartWithStock(true)
    await renderCart()

    panel.style.display = "flex"
    return
  }

  panel.style.display = "none"
}

// ⭐ 對外掛 window（給 HTML onclick 用）
window.changeQty = changeQty
window.removeFromCart = removeFromCart
window.toggleCart = toggleCart

export async function goCheckout(){
  const result = await syncCartWithStock(true)

  if(!result.cart.length){
    await renderCart()
    alert("購物車內已沒有可結帳商品")
    return
  }

  await renderCart()
  window.location.href = "./checkout.html"
}

// ⭐ 給 HTML onclick 用
window.goCheckout = goCheckout