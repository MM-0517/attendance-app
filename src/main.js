import {createClient} from "@supabase/supabase-js";import "./style.css";
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const app=document.querySelector("#app");const sb=url&&key?createClient(url,key):null;let user=null,profile=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const day=()=>new Date().toISOString().slice(0,10),fmt=x=>x?new Date(x).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}):"--:--";
const mins=(a,b,br=0)=>a&&b?Math.max(0,Math.floor((new Date(b)-new Date(a))/60000-br)):0;
const hm=m=>`${Math.floor(m/60)}:${String(m%60).padStart(2,"0")}`;
function getLocation(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation) return reject(new Error("このブラウザは位置情報に対応していません。"));
    navigator.geolocation.getCurrentPosition(
      p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),
      e=>reject(new Error(e.code===1?"位置情報の利用が許可されていません。ブラウザの設定を確認してください。":e.message||"位置情報を取得できませんでした。")),
      {enableHighAccuracy:true,timeout:10000,maximumAge:0}
    );
  });
}
function gpsText(lat,lon,acc){
  if(lat==null||lon==null) return "位置情報なし";
  return `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}${acc?`（精度 約${Math.round(acc)}m）`:""}`;
}

function config(){app.innerHTML='<div class="center"><div class="card narrow"><h1>勤怠管理</h1><p>Supabase設定が必要です。</p><p class="muted">.envにVITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYを設定してください。</p></div></div>'}
async function boot(){if(!sb)return config();let s=await sb.auth.getSession();user=s.data.session?.user||null;if(user){let q=await sb.from("profiles").select("*").eq("id",user.id).single();profile=q.data}render()}
function login(){app.innerHTML='<div class="center"><div class="card narrow"><h1>勤怠管理</h1><p class="muted">ログイン</p><form id="f"><label>メール<input id="e" type="email" required></label><label>パスワード<input id="p" type="password" required></label><button class="primary">ログイン</button><div id="err" class="error"></div></form></div></div>';f.onsubmit=async x=>{x.preventDefault();let r=await sb.auth.signInWithPassword({email:e.value,password:p.value});if(r.error)err.textContent=r.error.message;else boot()}}
async function todayRec(){let r=await sb.from("attendance_records").select("*,break_records(*)").eq("user_id",user.id).eq("work_date",day()).maybeSingle();return r.data}
async function employee(){let r=await todayRec(),bs=r?.break_records||[],active=bs.find(x=>x.started_at&&!x.ended_at),bm=bs.reduce((s,x)=>s+mins(x.started_at,x.ended_at),0);
app.innerHTML=`<header><b>勤怠管理</b><div>${esc(profile?.name)} <button id="lo" class="gray small">ログアウト</button></div></header><main><div class="card"><h1>今日の勤怠</h1><p class="muted">${new Date().toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</p><div class="grid"><div class="stat"><span>出勤</span><strong>${fmt(r?.clock_in)}</strong></div><div class="stat"><span>退勤</span><strong>${fmt(r?.clock_out)}</strong></div><div class="stat"><span>実働</span><strong>${hm(mins(r?.clock_in,r?.clock_out,bm))}</strong></div></div><div class="actions"><button id="cin" class="green" ${r?.clock_in?"disabled":""}>出勤</button><button id="cout" class="red" ${!r?.clock_in||r?.clock_out?"disabled":""}>退勤</button><button id="br" class="gray" ${!r?.clock_in||r?.clock_out?"disabled":""}>${active?"休憩終了":"休憩開始"}</button></div><div class="notice">${active?"休憩中です":r?.clock_out?"本日の勤務が完了しました":r?.clock_in?"勤務中です":"今日はまだ出勤していません"}<br><small>出勤・退勤時に位置情報の許可が必要です。</small></div></div><div class="card"><h2>今月の勤怠</h2><div id="hist">読み込み中...</div></div></main>`;
lo.onclick=()=>sb.auth.signOut();
cin.onclick=async()=>{
  cin.disabled=true; cin.textContent="位置情報取得中...";
  try{
    const g=await getLocation();
    let q=await sb.from("attendance_records").insert({
      user_id:user.id,work_date:day(),clock_in:new Date().toISOString(),
      clock_in_latitude:g.latitude,clock_in_longitude:g.longitude,clock_in_accuracy:g.accuracy
    });
    if(q.error) throw q.error;
    boot();
  }catch(e){alert(e.message);cin.disabled=false;cin.textContent="出勤"}
};
cout.onclick=async()=>{
  cout.disabled=true; cout.textContent="位置情報取得中...";
  try{
    const g=await getLocation();
    let q=await sb.from("attendance_records").update({
      clock_out:new Date().toISOString(),
      clock_out_latitude:g.latitude,clock_out_longitude:g.longitude,clock_out_accuracy:g.accuracy
    }).eq("id",r.id);
    if(q.error) throw q.error;
    boot();
  }catch(e){alert(e.message);cout.disabled=false;cout.textContent="退勤"}
};br.onclick=async()=>{let q=active?await sb.from("break_records").update({ended_at:new Date().toISOString()}).eq("id",active.id):await sb.from("break_records").insert({attendance_id:r.id,started_at:new Date().toISOString()});if(q.error)alert(q.error.message);boot()};
let first=new Date();first.setDate(1);let q=await sb.from("attendance_records").select("*,break_records(*)").eq("user_id",user.id).gte("work_date",first.toISOString().slice(0,10)).order("work_date",{ascending:false});hist.innerHTML='<table><tr><th>日付</th><th>出勤</th><th>退勤</th><th>実働</th></tr>'+((q.data||[]).map(x=>{let b=(x.break_records||[]).reduce((s,z)=>s+mins(z.started_at,z.ended_at),0);return `<tr><td>${x.work_date}</td><td>${fmt(x.clock_in)}</td><td>${fmt(x.clock_out)}</td><td>${hm(mins(x.clock_in,x.clock_out,b))}</td></tr>`}).join(""))+"</table>"}
async function admin(){app.innerHTML=`<header><b>勤怠管理 / 管理者</b><div>${esc(profile?.name)} <button id="lo" class="gray small">ログアウト</button></div></header><main><div class="tabs"><button id="t" class="tab active">勤怠</button><button id="u" class="tab">社員管理</button></div><section id="panel"></section></main>`;lo.onclick=()=>sb.auth.signOut();t.onclick=()=>{t.classList.add("active");u.classList.remove("active");attendancePanel()};u.onclick=()=>{u.classList.add("active");t.classList.remove("active");userPanel()};attendancePanel()}
async function attendancePanel(){panel.innerHTML=`<div class="card"><h1>勤怠一覧</h1><div class="toolbar"><input id="dt" type="date" value="${day()}"><button id="go" class="primary">表示</button><button id="csv" class="gray">CSV出力</button></div></div><div class="card"><div id="tbl">読み込み中...</div></div>`;go.onclick=loadAdmin;csv.onclick=downloadCSV;loadAdmin()}
async function loadAdmin(){let q=await sb.from("attendance_records").select("*,profiles(name),break_records(*)").eq("work_date",dt.value).order("clock_in");if(q.error){tbl.textContent=q.error.message;return}tbl.innerHTML='<table><tr><th>氏名</th><th>出勤</th><th>退勤</th><th>実働</th><th>出勤位置</th><th>退勤位置</th><th>操作</th></tr>'+((q.data||[]).map(x=>{let b=(x.break_records||[]).reduce((s,z)=>s+mins(z.started_at,z.ended_at),0);return `<tr><td>${esc(x.profiles?.name)}</td><td><input class="editin" data-id="${x.id}" value="${x.clock_in?new Date(x.clock_in).toISOString().slice(11,16):""}"></td><td><input class="editout" data-id="${x.id}" value="${x.clock_out?new Date(x.clock_out).toISOString().slice(11,16):""}"></td><td>${hm(mins(x.clock_in,x.clock_out,b))}</td><td><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${x.clock_in_latitude||""},${x.clock_in_longitude||""}">${gpsText(x.clock_in_latitude,x.clock_in_longitude,x.clock_in_accuracy)}</a></td><td><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${x.clock_out_latitude||""},${x.clock_out_longitude||""}">${gpsText(x.clock_out_latitude,x.clock_out_longitude,x.clock_out_accuracy)}</a></td><td><button class="save gray small" data-id="${x.id}">保存</button></td></tr>`}).join(""))+"</table>";document.querySelectorAll(".save").forEach(b=>b.onclick=async()=>{let id=b.dataset.id,iv=document.querySelector(`.editin[data-id="${id}"]`).value,ov=document.querySelector(`.editout[data-id="${id}"]`).value;let base=dt.value;let clock_in=iv?new Date(`${base}T${iv}:00`).toISOString():null,clock_out=ov?new Date(`${base}T${ov}:00`).toISOString():null;let r=await sb.from("attendance_records").update({clock_in,clock_out}).eq("id",id);if(r.error)alert(r.error.message);loadAdmin()})}
function downloadCSV(){let rows=[...document.querySelectorAll("#tbl tr")].map(r=>[...r.querySelectorAll("th,td")].slice(0,4).map(x=>`"${x.innerText.replaceAll('"','""')}"`).join(","));let a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+rows.join("\n")],{type:"text/csv"}));a.download=`勤怠_${dt.value}.csv`;a.click()}
async function userPanel(){let q=await sb.from("profiles").select("*").order("created_at");panel.innerHTML=`<div class="card"><h1>社員管理</h1><p class="muted">新しい社員アカウントはSupabase DashboardのAuthenticationから作成してください。作成後ここに表示されます。</p></div><div class="card"><table><tr><th>氏名</th><th>権限</th><th>登録日</th></tr>${(q.data||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${x.role}</td><td>${new Date(x.created_at).toLocaleDateString("ja-JP")}</td></tr>`).join("")}</table></div>`}
function render(){if(!user)return login();profile?.role==="admin"?admin():employee()}
sb?.auth.onAuthStateChange(()=>setTimeout(boot,0));boot();
