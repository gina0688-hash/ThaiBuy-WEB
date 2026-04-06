import { supabase } from "./supabase.js"

export async function loadAuth(){
  const { data } = await supabase.auth.getUser()

  if(!data.user){
    alert("請先登入")
    location.href = "login.html"
    return null
  }

  return data.user
}

export function bindLogout(){
  const btn = document.getElementById("logoutBtn")
  if(!btn) return

  btn.onclick = async function(){
    await supabase.auth.signOut()
    alert("已登出")
    location.href = "login.html"
  }
}