import { supabase } from "./supabase.js"
import { getCart, saveCart } from "./cart.js"

let cart = getCart()

function getOriginalItemsTotal(){
  return cart.reduce((sum, item) => {
    return sum + Number(item.original_price || 0) * Number(item.quantity || 1)
  }, 0)
}

function calcC2CShippingFee(totalAmount){
  let remaining = Number(totalAmount || 0)
  let fee = 0

  while(remaining > 0){
    const chunk = Math.min(remaining, 5000)

    if(chunk <= 1000){
      fee += 60
    }else if(chunk < 2000){
      fee += 70
    }else if(chunk <= 3000){
      fee += 80
    }else if(chunk <= 4000){
      fee += 90
    }else{
      fee += 100
    }

    remaining -= chunk
  }

  return fee
}

window.updateShippingNotice = function(){
  const shippingMethod = document.getElementById("shippingMethod")?.value
  const notice = document.getElementById("shippingNotice")

  if(!notice) return

  if(shippingMethod === "交貨便"){
    const fee = calcC2CShippingFee(getOriginalItemsTotal())

    notice.innerHTML = `
      <b>📦 交貨便</b><br>
      • 有保險之配送項目，須先匯款運費，直接加總在訂單總金額上。<br>
      • 本筆訂單依商品原價計算之運費為：<b>TWD $${fee}</b><br>
      • 若超過 5000 元，需分兩單寄送並加總兩筆運費。<br>
      • 選擇此方式者，須在下單時填寫完整運送資訊。
    `
  }else if(shippingMethod === "賣貨便"){
    notice.innerHTML = `
      <b>📦 賣貨便</b><br>
      • 無保險之配送項目，<b>本次訂單總金額不先加運費</b>。<br>
      • 商品抵達超商後，若無二補，將支付最低商品價格 20 + 運費 38 元。<br>
      • 其中 20 元會內退於包裹，<b>請勿自行先扣除</b>。<br>
      • 選擇此方式若貨品遺失，無法賠償。
    `
  }else{
    notice.innerHTML = ""
  }
}

window.toggleC2CFields = function(){
  const shippingMethod = document.getElementById("shippingMethod")?.value
  const block = document.getElementById("c2cFields")

  if(!block) return

  if(shippingMethod === "交貨便"){
    block.style.display = "block"
  }else{
    block.style.display = "none"

    const receiverName = document.getElementById("receiverName")
    const receiverPhone = document.getElementById("receiverPhone")
    const storeName = document.getElementById("storeName")
    const storeCode = document.getElementById("storeCode")

    if(receiverName) receiverName.value = ""
    if(receiverPhone) receiverPhone.value = ""
    if(storeName) storeName.value = ""
    if(storeCode) storeCode.value = ""
  }
}

function render(){
  const summary = document.getElementById("orderSummary")
  summary.innerHTML = ""

  const hasLimitedDeposit = cart.some(item =>
    item.preorder_type === "limited" && item.deposit_required
  )

  const orderDepositAmount = hasLimitedDeposit
    ? Number(
        cart.find(item =>
          item.preorder_type === "limited" && item.deposit_required
        )?.deposit_amount || 500
      )
    : 0

  const shippingMethod = document.getElementById("shippingMethod")?.value || ""
  const originalItemsTotal = getOriginalItemsTotal()

  let productChargeTotal = 0

  cart.forEach(item => {
    if(!hasLimitedDeposit){
      productChargeTotal += Number(item.checkout_price || 0) * Number(item.quantity || 1)
    }

    summary.innerHTML += `
      <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #eee;">
        <div><b>${item.product_name || item.name}</b></div>
        <div>${item.variant}</div>
        <div style="font-size:13px;color:#666;">
          ${item.preorder_type === "limited" ? "限量預購" : "一般預購"}
        </div>
        <div>商品原價：TWD $${Number(item.original_price || 0)}</div>
        <div>x ${Number(item.quantity || 1)}</div>
        ${
          hasLimitedDeposit
            ? `
              <div>商品原價小計：TWD $${Number(item.original_price || 0) * Number(item.quantity || 1)}</div>
            `
            : `
              <div>本次收款：TWD $${Number(item.checkout_price || 0)}</div>
              <div><b>小計：TWD $${Number(item.checkout_price || 0) * Number(item.quantity || 1)}</b></div>
            `
        }
      </div>
    `
  })

  if(hasLimitedDeposit){
    productChargeTotal = orderDepositAmount
  }

  const shippingFee = shippingMethod === "交貨便"
    ? calcC2CShippingFee(originalItemsTotal)
    : 0

  const orderTotal = originalItemsTotal + shippingFee
  const finalTotal = hasLimitedDeposit
    ? productChargeTotal
    : productChargeTotal + shippingFee

  document.getElementById("total").innerHTML = hasLimitedDeposit
    ? `
      <div>商品金額：TWD $${originalItemsTotal}</div>
      <div>運費：TWD $${shippingFee}</div>
      <div>總金額：TWD $${orderTotal}</div>
      <div>訂金金額：TWD $${productChargeTotal}</div>
      <div style="font-size:28px;font-weight:bold;margin-top:8px;">
        此次收款：TWD $${finalTotal}
      </div>
    `
    : `
      <div>商品金額：TWD $${originalItemsTotal}</div>
      <div>運費：TWD $${shippingFee}</div>
      <div>總金額：TWD $${orderTotal}</div>
      <div style="font-size:28px;font-weight:bold;margin-top:8px;">
        此次收款：TWD $${finalTotal}
      </div>
    `

  window.updateShippingNotice()
  window.toggleC2CFields()

  const notice = document.getElementById("checkoutNotice")
  if(notice){
    notice.innerHTML = hasLimitedDeposit
      ? `
        <b>下單前請確認：</b><br>
        1. 此訂單包含限量預購商品。<br>
        2. 本次結帳金額為訂金，非商品全額。<br>
        3. 商品原價已列於上方供確認，但本次整筆訂單僅先收取訂金 TWD $${orderDepositAmount}。<br>
        4. 後續將依實際購得結果通知補款或退款。<br>
        5. 送出訂單即表示你已理解上述付款規則。
      `
      : ""
  }
}

window.submitOrder = async function(){
  const name = document.getElementById("name").value.trim()
  const phone = document.getElementById("phone").value.trim()
  const communityName = document.getElementById("communityName").value.trim()
  const email = document.getElementById("email").value.trim()
  const bankLast5 = document.getElementById("bankLast5").value.trim()
  const expectedRemitTime = document.getElementById("expectedRemitTime").value.trim()
  const contactMethod = document.getElementById("contactMethod").value
  const contactAccount = document.getElementById("contactAccount").value.trim()
  const shippingMethod = document.getElementById("shippingMethod").value
  const receiverName = document.getElementById("receiverName")?.value.trim() || ""
  const receiverPhone = document.getElementById("receiverPhone")?.value.trim() || ""
  const storeName = document.getElementById("storeName")?.value.trim() || ""
  const storeCode = document.getElementById("storeCode")?.value.trim() || ""
  const agreeNotice = document.getElementById("agreeNotice")?.checked

  if(!name){
    alert("請填本名")
    return
  }

  if(!phone){
    alert("請填電話")
    return
  }

  if(!email){
    alert("請填Email")
    return
  }

  if(!bankLast5){
    alert("請填匯款帳號末五碼")
    return
  }

  if(!expectedRemitTime){
    alert("請填預計匯款時間")
    return
  }

  if(!contactMethod){
    alert("請選擇聯繫方式")
    return
  }

  if(!contactAccount){
    alert("請填聯繫帳號")
    return
  }

  if(!shippingMethod){
    alert("請選擇運送方式")
    return
  }

  if(!agreeNotice){
    alert("請先勾選同意 ThaiBuy 代購下單規則")
    return
  }

  if(shippingMethod === "交貨便"){
    if(!receiverName){
      alert("請填寫交貨便收件本名")
      return
    }
    if(!receiverPhone){
      alert("請填寫交貨便收件電話")
      return
    }
    if(!storeName){
      alert("請填寫7-11門市")
      return
    }
    if(!storeCode){
      alert("請填寫7-11店號")
      return
    }
  }

  if(cart.length === 0){
    alert("購物車是空的")
    return
  }

  const hasLimitedDeposit = cart.some(i =>
    i.preorder_type === "limited" && i.deposit_required
  )

  const productChargeTotal = hasLimitedDeposit
    ? Number(
        cart.find(i =>
          i.preorder_type === "limited" && i.deposit_required
        )?.deposit_amount || 500
      )
    : cart.reduce((sum, i) =>
        sum + Number(i.checkout_price || 0) * Number(i.quantity || 1), 0)

  const originalItemsTotal = cart.reduce((sum, i) => {
    return sum + Number(i.original_price || 0) * Number(i.quantity || 1)
  }, 0)

  const shippingFee = shippingMethod === "交貨便"
    ? calcC2CShippingFee(originalItemsTotal)
    : 0

  const total = hasLimitedDeposit
    ? productChargeTotal
    : productChargeTotal + shippingFee

  const rpcItems = cart.map(i => ({
    product_id: i.product_id || null,
    variant_id: i.variant_id || null,
    product_name: i.product_name || i.name,
    variant_name: i.variant,
    price: Number(i.original_price || 0),
    quantity: Number(i.quantity || 1)
  }))

  const { data, error } = await supabase.rpc("create_order_with_items_and_stock", {
    p_customer_name: name,
    p_phone: phone,
    p_community_name: communityName || null,
    p_email: email,
    p_bank_last5: bankLast5,
    p_expected_remit_time: expectedRemitTime,
    p_contact_method: contactMethod,
    p_contact_account: contactAccount,
    p_total_amount: total,
    p_need_second_payment: hasLimitedDeposit,
    p_is_deposit_order: hasLimitedDeposit,
    p_second_payment_status: hasLimitedDeposit ? "unpaid" : null,
    p_shipping_method: shippingMethod,
    p_receiver_name: shippingMethod === "交貨便" ? receiverName : null,
    p_receiver_phone: shippingMethod === "交貨便" ? receiverPhone : null,
    p_store_name: shippingMethod === "交貨便" ? storeName : null,
    p_store_code: shippingMethod === "交貨便" ? storeCode : null,
    p_items: rpcItems
  })

  if(error){
    console.error("create_order_with_items_and_stock error:", error)
    alert(`訂單建立失敗：${error.message || "未知錯誤"}`)
    return
  }

  if(!data?.success){
    alert(`訂單建立失敗：${data?.message || "未知錯誤"}`)
    return
  }

const orderNumber = data.order_number || data.order_id

try{
  await fetch('/api/send-order-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNumber,
      customerName: name,
      amount: total
    })
  })
}catch(err){
  console.error("send-order-email error:", err)
}

saveCart([])
window.location.href = `./order-success.html?orderNumber=${encodeURIComponent(orderNumber)}&amount=${encodeURIComponent(total)}`
}

window.refreshCheckout = function(){
  render()
}

render()