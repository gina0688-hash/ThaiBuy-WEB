import { supabase } from "./supabase.js"

export async function loadAuth(){

  const { data } = await supabase.auth.getUser()

  if(!data.user){
    alert("請先登入")
    return null
  }

  return data.user
}