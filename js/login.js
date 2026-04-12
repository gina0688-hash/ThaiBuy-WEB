import { supabase } from "./supabase.js"

let isLoggingIn = false

window.login = async function(){

  if(isLoggingIn) return

  const loginBtn = document.getElementById("loginBtn")
  const email = document.getElementById("email").value.trim()
  const password = document.getElementById("password").value.trim()

  if(!email){
    alert("請輸入 Email")
    return
  }

  if(!password){
    alert("請輸入密碼")
    return
  }

  isLoggingIn = true

  if(loginBtn){
    loginBtn.disabled = true
    loginBtn.textContent = "登入中..."
  }

  try{
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if(error){
      alert("登入失敗，請確認帳號密碼是否正確")
      return
    }

    window.location.replace("admin-orders.html")

  }finally{
    isLoggingIn = false

    if(loginBtn){
      loginBtn.disabled = false
      loginBtn.textContent = "登入"
    }
  }
}