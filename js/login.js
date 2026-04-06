import { supabase } from "./supabase.js"

window.login = async function(){

  const email = document.getElementById("email").value
  const password = document.getElementById("password").value

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if(error){
    alert("登入失敗：" + error.message)
    return
  }

  location.href = "admin-orders.html"
}