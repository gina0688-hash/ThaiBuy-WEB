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
export function addToCart(itemData){

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
  renderCart()
  return true
}

// ⭐ 刪除
export function removeFromCart(index){
  let cart = getCart()
  cart.splice(index, 1)
  saveCart(cart)
  renderCart()
}

// ⭐ 數量變更
export function changeQty(index, delta){
  let cart = getCart()

  cart[index].quantity += delta

  if(cart[index].quantity <= 0){
    cart.splice(index, 1)
  }

  saveCart(cart)
  renderCart()
}

// ⭐ render 購物車
export function renderCart(){

  const cart = getCart()

  const items = document.getElementById("cartItems")
  const totalDiv = document.getElementById("cartTotal")
  const count = document.getElementById("cartCount")

  if(!items) return

  items.innerHTML = ""

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
        <div><b>${item.product_name || ""}</b></div>
        <div>${item.variant}</div>

        <div style="font-size:12px;color:#666;">
          ${item.preorder_type === "limited" ? "限量預購" : "一般預購"}
        </div>

        <div style="margin:6px 0;font-size:13px;">
          商品原價：$${item.original_price}
          ${
            isLimitedDeposit
              ? `<br>本次收款：整單訂金 $${item.deposit_amount}`
              : `<br>本次收款：$${item.checkout_price}`
          }
        </div>

        <button onclick="window.changeQty(${index}, -1)">➖</button>
        ${item.quantity}
        <button onclick="window.changeQty(${index}, 1)">➕</button>

        <br>
        ${
          isLimitedDeposit
            ? `小計：整單只收一次訂金`
            : `小計：$${item.checkout_price * item.quantity}`
        }

        <button onclick="window.removeFromCart(${index})">❌</button>
      </div>
    `
  })

  count.innerText = cart.reduce((sum, i) => sum + i.quantity, 0)
  totalDiv.innerHTML = `<b>本次結帳金額：$${total}</b>`
}

// ⭐ toggle cart
export function toggleCart(){
  const panel = document.getElementById("cartPanel")
  panel.style.display =
    panel.style.display === "block" ? "none" : "block"
}

// ⭐ 對外掛 window（給 HTML onclick 用）
window.changeQty = changeQty
window.removeFromCart = removeFromCart
window.toggleCart = toggleCart

export function goCheckout(){
  window.location.href = "./checkout.html"
}

// ⭐ 給 HTML onclick 用
window.goCheckout = goCheckout