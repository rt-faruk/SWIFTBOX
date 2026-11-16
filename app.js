import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://yoaxnzqnbaswgbeiqtha.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zvSwZEBBmy6RI0Ur7C902g_8SxqoCZl';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (id) => document.getElementById(id);
let checkedInToday = false, currentUser = null, currentRider = null, lastRows = [], cachedRiders = [];
const qatarDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Qatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const qatarTime = (iso) => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Qatar',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
const toMin = t => { if(!t) return null; const [h,m]=String(t).split(':'); return Number(h)*60+Number(m) };
const hm = t => t ? String(t).slice(0,5) : '';
const qatarMinutes = iso => { const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Qatar',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)); return Number(p.find(x=>x.type==='hour').value)*60+Number(p.find(x=>x.type==='minute').value) };
const LATE_GRACE_MIN = 0; // minutes allowed after shift start before marking Late
function timing(a,shift){
  if(!a) return {label:'—',cls:''};
  const sm=toMin(shift); if(sm==null) return {label:'No shift set',cls:''};
  const diff=qatarMinutes(a.checkin_time)-sm;
  return diff<=LATE_GRACE_MIN?{label:'On time',cls:'ontime'}:{label:'Late ('+diff+' min)',cls:'late'};
}
const timingHtml=(a,shift)=>{const t=timing(a,shift);return t.cls?`<span class="${t.cls}">${t.label}</span>`:t.label};
function connection(ok,msg){$('connection').textContent=msg;$('connection').className='pill '+(ok?'ok':'bad')}
function showLogin(){ $('loginView').hidden=false;$('appView').hidden=true }
function showApp(){ $('loginView').hidden=true;$('appView').hidden=false;$('todayLabel').textContent=`Today · ${qatarDate()} (Qatar)` }
function setRiderMessage(msg,isError=false){$('riderFormMessage').textContent=msg;$('riderFormMessage').className=isError?'error':'hint'}
function resetRiderForm(){ $('riderForm').reset();$('editingRiderId').value='';$('saveRiderBtn').textContent='Add rider';$('cancelEditBtn').hidden=true;setRiderMessage("Create the rider's login in Supabase Authentication first, then paste its User UID here to link it.") }
async function init(){
  const {data:{session},error}=await supabase.auth.getSession();
  if(error){connection(false,'Auth error');showLogin();return}
  connection(true,'Supabase connected');
  if(session){currentUser=session.user;await routeUser()}else showLogin();
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='Signing in…';const {data,error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error){$('loginError').textContent=error.message;return}currentUser=data.user;await routeUser()});
$('logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();currentUser=null;currentRider=null;showLogin()});
async function routeUser(){
  showApp();$('riderView').hidden=true;$('adminView').hidden=true;$('startDutyBtn').hidden=false;$('riderStatus').className='status';$('riderStatus').textContent='';
  const role=currentUser.app_metadata?.role;
  if(role==='admin'){$('roleLabel').textContent='ADMINISTRATOR';$('welcomeName').textContent='Admin Dashboard';$('adminView').hidden=false;await loadAdmin();return}
  const {data,error}=await supabase.from('riders').select('id,rider_id,full_name,is_active,auth_user_id,shift_start').eq('auth_user_id',currentUser.id).maybeSingle();
  if(error){showError('Could not load rider profile: '+error.message);return}
  if(!data){showError('This login is not linked to a rider record. Ask the administrator to link auth_user_id in the riders table.');return}
  if(!data.is_active){showError('This rider account is inactive. Contact administrator.');return}
  currentRider=data;$('roleLabel').textContent='RIDER PORTAL';$('welcomeName').textContent=`Hello, ${data.full_name}`;$('riderView').hidden=false;await loadRiderHistory();await refreshDutyButton();
}
function updateShiftBanner(){
  const el=$('shiftInfo'); if(!el) return;
  if(!currentRider||!currentRider.shift_start){el.textContent='';el.className='muted-text';return}
  const sm=toMin(currentRider.shift_start); const now=qatarMinutes(new Date().toISOString());
  let msg='Your shift starts at '+hm(currentRider.shift_start)+' (Qatar time).'; let cls='muted-text';
  if(!checkedInToday && now>=sm){msg+=' ⏰ Your shift has started — please press START DUTY now.';cls='error'}
  el.textContent=msg;el.className=cls;
}
setInterval(updateShiftBanner,30000);
function showError(message){$('riderView').hidden=false;$('startDutyBtn').hidden=true;$('riderStatus').textContent=message;$('riderStatus').className='error'}
async function refreshDutyButton(){const {data,error}=await supabase.from('attendance').select('id').eq('rider_id',currentRider.id).eq('duty_date',qatarDate()).maybeSingle();if(error){$('riderStatus').textContent=error.message;return}checkedInToday=!!data;updateShiftBanner();if(data){$('startDutyBtn').disabled=true;$('startDutyBtn').textContent='DUTY ALREADY STARTED';$('riderStatus').textContent='Your attendance has already been recorded for today.'}else{$('startDutyBtn').disabled=false;$('startDutyBtn').textContent='START DUTY'}}
$('startDutyBtn').addEventListener('click',async()=>{
  const btn=$('startDutyBtn'),st=$('riderStatus');
  if(!currentRider){st.className='error';st.textContent='This login is not linked to a rider record. Contact the administrator.';return}
  btn.disabled=true;st.className='status';st.textContent='Saving your attendance…';
  try{
    const payload={rider_id:currentRider.id,duty_date:qatarDate(),checkin_time:new Date().toISOString()};
    const {error}=await supabase.from('attendance').insert(payload);
    if(error){
      st.className='error';
      st.textContent=error.code==='23505'?'You have already started duty today.':(error.code==='42501'?'Permission denied (RLS). Ask the administrator to check database policies.':'Error: '+error.message);
      btn.disabled=false;return
    }
    st.textContent='Duty started successfully. Your time has been saved.';
    await loadRiderHistory();await refreshDutyButton();
  }catch(err){
    st.className='error';st.textContent='Unexpected error: '+(err&&err.message?err.message:err);btn.disabled=false
  }
});
async function loadRiderHistory(){const {data,error}=await supabase.from('attendance').select('duty_date,checkin_time,latitude,longitude').eq('rider_id',currentRider.id).order('duty_date',{ascending:false}).limit(10);if(error){$('riderHistory').textContent=error.message;return}const rows=data||[];$('riderHistory').innerHTML='<h3>Recent check-ins</h3>'+ (rows.length?'<div class="table-wrap"><table><thead><tr><th>Date</th><th>Time</th><th>Location</th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${escapeHtml(r.duty_date)}</td><td>${qatarTime(r.checkin_time)}</td><td>${r.latitude!=null&&r.longitude!=null?`<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${r.latitude},${r.longitude}">View map</a>`:'Not available'}</td></tr>`).join('')+'</tbody></table></div>':'<p class="muted-text">No check-ins yet.</p>')}
$('reportDate').value=qatarDate();$('reportDate').addEventListener('change',loadAttendance);$('refreshBtn').addEventListener('click',loadAdmin);$('exportBtn').addEventListener('click',exportCsv);
$('riderForm').addEventListener('submit',saveRider);$('cancelEditBtn').addEventListener('click',resetRiderForm);
async function loadAdmin(){const date=$('reportDate').value||qatarDate();const [{data:riders,error:re},{data:att,error:ae}]=await Promise.all([supabase.from('riders').select('id,rider_id,full_name,is_active,auth_user_id,shift_start').order('full_name'),supabase.from('attendance').select('rider_id,duty_date,checkin_time,latitude,longitude').eq('duty_date',date)]);if(re||ae){$('attendanceRows').innerHTML=`<tr><td colspan="6">${escapeHtml(re?.message||ae?.message||'Unable to load data')}</td></tr>`;return}cachedRiders=riders||[];lastRows=att||[];const active=cachedRiders.filter(r=>r.is_active);$('totalRiders').textContent=active.length;$('presentToday').textContent=lastRows.length;$('absentToday').textContent=Math.max(0,active.length-lastRows.length);renderRiders();await loadAttendance()}
function renderRiders(){ $('riderRows').innerHTML=cachedRiders.map(r=>`<tr><td>${escapeHtml(r.rider_id)}</td><td>${escapeHtml(r.full_name)}</td><td>${r.shift_start?hm(r.shift_start):'—'}</td><td>${r.auth_user_id?'Linked':'Not linked'}</td><td>${r.is_active?'Active':'Inactive'}</td><td class="row-actions"><button class="small-btn" data-action="edit" data-id="${r.id}">Edit</button><button class="small-btn" data-action="toggle" data-id="${r.id}">${r.is_active?'Deactivate':'Activate'}</button><button class="small-btn danger-btn" data-action="delete" data-id="${r.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="6">No riders added yet.</td></tr>'; }
$('riderRows').addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const rider=cachedRiders.find(r=>r.id===b.dataset.id);if(!rider)return;if(b.dataset.action==='edit'){ $('editingRiderId').value=rider.id;$('newRiderCode').value=rider.rider_id;$('newRiderName').value=rider.full_name;$('newRiderAuthId').value=rider.auth_user_id||'';$('newRiderShift').value=hm(rider.shift_start);$('saveRiderBtn').textContent='Save changes';$('cancelEditBtn').hidden=false;setRiderMessage('Editing '+rider.rider_id);$('newRiderCode').focus();return}if(b.dataset.action==='toggle'){const {error}=await supabase.from('riders').update({is_active:!rider.is_active}).eq('id',rider.id);if(error){setRiderMessage(error.message,true);return}await loadAdmin();return}if(b.dataset.action==='delete'){if(!confirm(`Delete rider ${rider.rider_id} (${rider.full_name})? Existing attendance linked to this rider may also be deleted if the database uses ON DELETE CASCADE.`))return;const {error}=await supabase.from('riders').delete().eq('id',rider.id);if(error){setRiderMessage(error.message,true);return}resetRiderForm();await loadAdmin()}});
async function saveRider(e){e.preventDefault();const id=$('editingRiderId').value;const rider_id=$('newRiderCode').value.trim();const full_name=$('newRiderName').value.trim();const authValue=$('newRiderAuthId').value.trim();const auth_user_id=authValue||null;if(auth_user_id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(auth_user_id)){setRiderMessage('Auth User UUID format is invalid.',true);return}const shift_start=$('newRiderShift').value||null;const payload={rider_id,full_name,auth_user_id,shift_start};$('saveRiderBtn').disabled=true;setRiderMessage(id?'Saving changes…':'Adding rider…');const result=id?await supabase.from('riders').update(payload).eq('id',id):await supabase.from('riders').insert(payload);$('saveRiderBtn').disabled=false;if(result.error){setRiderMessage(result.error.message,true);return}resetRiderForm();setRiderMessage(id?'Rider updated successfully.':'Rider added successfully.');await loadAdmin()}
async function loadAttendance(){const date=$('reportDate').value||qatarDate();const [{data:riders,error:re},{data:att,error}]=await Promise.all([supabase.from('riders').select('id,rider_id,full_name,is_active,shift_start'),supabase.from('attendance').select('rider_id,duty_date,checkin_time,latitude,longitude').eq('duty_date',date)]);if(re||error){$('attendanceRows').innerHTML=`<tr><td colspan="7">${escapeHtml(re?.message||error?.message||'Unable to load attendance')}</td></tr>`;return}lastRows=att||[];
  const rmap=new Map((riders||[]).map(r=>[r.id,r]));
  const logins=[...lastRows].sort((x,y)=>new Date(x.checkin_time)-new Date(y.checkin_time));
  $('loginCount').textContent=logins.length;
  $('loginRows').innerHTML=logins.map((a,i)=>{const r=rmap.get(a.rider_id)||{};return `<tr><td>${i+1}</td><td>${escapeHtml(r.rider_id||'—')}</td><td>${escapeHtml(r.full_name||'—')}</td><td>${qatarTime(a.checkin_time)}</td><td>${timingHtml(a,r.shift_start)}</td></tr>`}).join('')||'<tr><td colspan="5">No logins yet for this date.</td></tr>';
  const byId=new Map(lastRows.map(a=>[a.rider_id,a]));$('attendanceRows').innerHTML=(riders||[]).filter(r=>r.is_active).map(r=>{const a=byId.get(r.id);return `<tr><td>${escapeHtml(r.rider_id)}</td><td>${escapeHtml(r.full_name)}</td><td>${r.shift_start?hm(r.shift_start):'—'}</td><td>${a?qatarTime(a.checkin_time):'—'}</td><td>${timingHtml(a,r.shift_start)}</td><td>${a&&a.latitude!=null&&a.longitude!=null?`<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${a.latitude},${a.longitude}">View location</a>`:'—'}</td><td>${a?'<span class="status">Present</span>':'<span class="absent">Absent</span>'}</td></tr>`}).join('')||'<tr><td colspan="7">No riders found.</td></tr>';}
async function exportCsv(){const date=$('reportDate').value||qatarDate();const {data:riders,error}=await supabase.from('riders').select('id,rider_id,full_name,is_active,shift_start').order('full_name');if(error){alert(error.message);return}const byId=new Map(lastRows.map(a=>[a.rider_id,a]));const lines=[['Rider ID','Rider Name','Shift start','Date','Login time Qatar','Late / On time','Latitude','Longitude','Map URL','Status']];(riders||[]).filter(r=>r.is_active).forEach(r=>{const a=byId.get(r.id);lines.push([r.rider_id,r.full_name,hm(r.shift_start),date,a?qatarTime(a.checkin_time):'',timing(a,r.shift_start).label,a?.latitude??'',a?.longitude??'',a&&a.latitude!=null&&a.longitude!=null?`https://www.google.com/maps?q=${a.latitude},${a.longitude}`:'',a?'Present':'Absent'])});const csv=lines.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`snoonu-attendance-${date}.csv`;link.click();URL.revokeObjectURL(url)}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
supabase.auth.onAuthStateChange((_event,session)=>{if(!session){currentUser=null;currentRider=null;showLogin()}});
init();
