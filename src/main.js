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
app.innerHTML=`<header><b>勤怠管理</b><div>${esc(profile?.name)} <button id="lo" class="gray small">ログアウト</button></div></header><main><div class="card"><h1>今日の勤怠</h1><p class="muted">${new Date().toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</p><div class="grid"><div class="stat"><span>出勤</span><strong>${fmt(r?.clock_in)}</strong></div><div class="stat"><span>退勤</span><strong>${fmt(r?.clock_out)}</strong></div><div class="stat"><span>実働</span><strong>${hm(mins(r?.clock_in,r?.clock_out,bm))}</strong></div></div>${!r?.clock_in?`<div class="location-input"><label>勤務場所<input id="workloc" type="text" maxlength="100" placeholder="例：本社、東京営業所、お客様先"></label><small class="muted">出勤する場所を入力してください。</small></div>`:`<div class="location-display"><span>勤務場所</span><strong>${esc(r?.work_location||"未入力")}</strong></div>`}<div class="actions"><button id="cin" class="green" ${r?.clock_in?"disabled":""}>出勤</button><button id="cout" class="red" ${!r?.clock_in||r?.clock_out?"disabled":""}>退勤</button><button id="br" class="gray" ${!r?.clock_in||r?.clock_out?"disabled":""}>${active?"休憩終了":"休憩開始"}</button></div><div class="notice">${active?"休憩中です":r?.clock_out?"本日の勤務が完了しました":r?.clock_in?"勤務中です":"今日はまだ出勤していません"}<br><small>出勤・退勤時に位置情報の許可が必要です。</small></div></div><div class="card"><h2>今月の勤怠</h2><div id="hist">読み込み中...</div></div></main>`;
lo.onclick=()=>sb.auth.signOut();
cin.onclick=async()=>{
  const location=(workloc?.value||"").trim();
  if(!location){alert("勤務場所を入力してください。");workloc?.focus();return}
  cin.disabled=true; cin.textContent="位置情報取得中...";
  try{
    const g=await getLocation();
    let q=await sb.from("attendance_records").insert({
      user_id:user.id,work_date:day(),clock_in:new Date().toISOString(),
      clock_in_latitude:g.latitude,clock_in_longitude:g.longitude,clock_in_accuracy:g.accuracy,
      work_location:location
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
let first=new Date();first.setDate(1);let q=await sb.from("attendance_records").select("*,break_records(*)").eq("user_id",user.id).gte("work_date",first.toISOString().slice(0,10)).order("work_date",{ascending:false});hist.innerHTML='<table><tr><th>日付</th><th>勤務場所</th><th>出勤</th><th>退勤</th><th>実働</th></tr>'+((q.data||[]).map(x=>{let b=(x.break_records||[]).reduce((s,z)=>s+mins(z.started_at,z.ended_at),0);return `<tr><td>${x.work_date}</td><td>${esc(x.work_location||"")}</td><td>${fmt(x.clock_in)}</td><td>${fmt(x.clock_out)}</td><td>${hm(mins(x.clock_in,x.clock_out,b))}</td></tr>`}).join(""))+"</table>"}
async function admin(){
  app.innerHTML=`<header><b>勤怠管理 / 管理者</b><div>${esc(profile?.name)} <button id="lo" class="gray small">ログアウト</button></div></header>
  <main>
    <div class="tabs"><button id="t" class="tab active">勤怠</button><button id="u" class="tab">社員管理</button></div>
    <section id="panel"></section>
  </main>`;
  lo.onclick=()=>sb.auth.signOut();
  t.onclick=()=>{t.classList.add("active");u.classList.remove("active");attendancePanel()};
  u.onclick=()=>{u.classList.add("active");t.classList.remove("active");userPanel()};
  attendancePanel();
}
async function attendancePanel(){
  panel.innerHTML=`<div class="card">
    <h1>勤怠一覧</h1>
    <div class="toolbar">
      <input id="dt" type="date" value="${day()}">
      <input id="kw" type="search" placeholder="社員名で検索">
      <button id="go" class="primary">表示</button>
      <button id="csv" class="gray">CSV出力</button>
    </div>
    <div id="summary" class="grid admin-summary"></div>
  </div>
  <div class="card"><div id="tbl">読み込み中...</div></div>`;
  go.onclick=loadAdmin;
  kw.oninput=loadAdmin;
  csv.onclick=downloadCSV;
  loadAdmin();
}
function mapUrl(lat,lon){
  return lat!=null&&lon!=null
    ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=18/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`
    : null;
}
function gpsCell(lat,lon,acc){
  const text=gpsText(lat,lon,acc);
  const url=mapUrl(lat,lon);
  return url
    ? `<a target="_blank" rel="noopener noreferrer" href="${url}">${text}</a><br><a class="small-link" target="_blank" rel="noopener noreferrer" href="${url}">地図で見る</a>`
    : "位置情報なし";
}
async function loadAdmin(){
  const date=dt.value, keyword=(kw.value||"").trim().toLowerCase();
  let q=await sb.from("attendance_records").select("*,profiles(name),break_records(*)").eq("work_date",date).order("clock_in");
  if(q.error){tbl.textContent=q.error.message;return}
  let rows=(q.data||[]).filter(x=>!keyword||String(x.profiles?.name||"").toLowerCase().includes(keyword));
  const total=rows.length;
  const working=rows.filter(x=>x.clock_in&&!x.clock_out).length;
  const finished=rows.filter(x=>x.clock_out).length;
  const gps=rows.filter(x=>x.clock_in_latitude!=null).length;
  summary.innerHTML=`
    <div class="stat"><span>対象社員</span><strong>${total}人</strong></div>
    <div class="stat"><span>勤務中</span><strong>${working}人</strong></div>
    <div class="stat"><span>退勤済み</span><strong>${finished}人</strong></div>
    <div class="stat"><span>GPS取得済み</span><strong>${gps}人</strong></div>`;
  tbl.innerHTML=`<div class="table-wrap"><table>
    <tr><th>氏名</th><th>勤務場所</th><th>出勤</th><th>退勤</th><th>実働</th><th>出勤位置</th><th>退勤位置</th><th>操作</th></tr>
    ${rows.map(x=>{
      let b=(x.break_records||[]).reduce((s,z)=>s+mins(z.started_at,z.ended_at),0);
      return `<tr>
        <td><b>${esc(x.profiles?.name)}</b></td>
        <td><input class="editloc" data-id="${x.id}" maxlength="100" value="${esc(x.work_location||"")}" aria-label="勤務場所"></td>
        <td><input class="editin" data-id="${x.id}" value="${x.clock_in?new Date(x.clock_in).toISOString().slice(11,16):""}" aria-label="出勤時刻"></td>
        <td><input class="editout" data-id="${x.id}" value="${x.clock_out?new Date(x.clock_out).toISOString().slice(11,16):""}" aria-label="退勤時刻"></td>
        <td>${hm(mins(x.clock_in,x.clock_out,b))}</td>
        <td>${gpsCell(x.clock_in_latitude,x.clock_in_longitude,x.clock_in_accuracy)}</td>
        <td>${gpsCell(x.clock_out_latitude,x.clock_out_longitude,x.clock_out_accuracy)}</td>
        <td><button class="save gray small" data-id="${x.id}">保存</button></td>
      </tr>`;
    }).join("")||`<tr><td colspan="8">該当する勤怠データがありません。</td></tr>`}
  </table></div>`;
  document.querySelectorAll(".save").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.id;
    const lv=document.querySelector(`.editloc[data-id="${id}"]`).value.trim();
    const iv=document.querySelector(`.editin[data-id="${id}"]`).value;
    const ov=document.querySelector(`.editout[data-id="${id}"]`).value;
    const base=dt.value;
    const clock_in=iv?new Date(`${base}T${iv}:00`).toISOString():null;
    const clock_out=ov?new Date(`${base}T${ov}:00`).toISOString():null;
    const r=await sb.from("attendance_records").update({clock_in,clock_out,work_location:lv||null}).eq("id",id);
    if(r.error)alert(r.error.message);else loadAdmin();
  });
}
function downloadCSV(){
  const rows=[...document.querySelectorAll("#tbl tr")].map(r=>[...r.querySelectorAll("th,td")].slice(0,5).map(x=>`"${x.innerText.replaceAll('"','""')}"`).join(","));
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob(["\ufeff"+rows.join("\n")],{type:"text/csv"}));
  a.download=`勤怠_${dt.value}.csv`;
  a.click();
}
async function userPanel(){
  const q=await sb.from("profiles").select("*").order("created_at");
  if(q.error){panel.innerHTML=`<div class="card error">${esc(q.error.message)}</div>`;return}
  panel.innerHTML=`<div class="card">
    <h1>社員管理</h1>
    <p class="muted">社員アカウントは Supabase Dashboard の Authentication から作成してください。作成された社員は自動的に「employee」として一覧に追加されます。</p>
    <p><b>管理者に変更する場合：</b> Supabase の SQL Editor で <code>update public.profiles set role='admin' where id='対象ユーザーUUID';</code> を実行してください。</p>
  </div>
  <div class="card"><div class="table-wrap"><table>
    <tr><th>氏名</th><th>ユーザーID</th><th>権限</th><th>登録日</th></tr>
    ${q.data.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.id)}</td><td><b>${x.role==="admin"?"管理者":"社員"}</b></td><td>${new Date(x.created_at).toLocaleDateString("ja-JP")}</td></tr>`).join("")}
  </table></div></div>`;
}
function render(){if(!user)return login();profile?.role==="admin"?admin():employee()}
sb?.auth.onAuthStateChange(()=>setTimeout(boot,0));boot();
