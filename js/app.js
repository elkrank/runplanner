function switchTab(t) {
  tab=t;
  document.getElementById('tabTraining').classList.toggle('active',t==='training');
  document.getElementById('tabSleep').classList.toggle('active',t==='sleep');
  document.getElementById('tabWeight').classList.toggle('active',t==='weight');
  document.getElementById('planner').style.display = t==='training'?'grid':'none';
  document.getElementById('sleepPanel').style.display = t==='sleep'?'block':'none';
  document.getElementById('weightPanel').style.display = t==='weight'?'block':'none';
  document.getElementById('statsTraining').style.display = t==='training'?'flex':'none';
  document.getElementById('statsSleep').style.display = t==='sleep'?'flex':'none';
  document.getElementById('statsWeight').style.display = t==='weight'?'flex':'none';
  render();
}

function render() {
  const ws = wSessions(), sl = wSleep(), dd = dates();
  const today = new Date(); today.setHours(0,0,0,0);
  const wn = isoWeek(getMonday());
  document.getElementById('weekLabel').textContent = `SEMAINE ${wn}`;

  // Training stats
  let km=0,min=0,cnt=0,cal=0, tc={easy:0,moderate:0,hard:0,rest:0};
  ws.forEach(day=>day.forEach(s=>{ if(s.type!=='rest')cnt++; if(s.dist)km+=parseFloat(s.dist); if(s.dur)min+=parseInt(s.dur); cal+=kcal(s); tc[s.type]=(tc[s.type]||0)+1; }));
  const dom=Object.entries(tc).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('statKm').textContent=km>0?km.toFixed(1)+' km':'0 km';
  const hh=Math.floor(min/60),mm=min%60;
  document.getElementById('statTime').textContent=min>0?(hh>0?`${hh}h${mm>0?mm+'m':''}`:`${mm}min`):'0 h';
  document.getElementById('statSessions').textContent=cnt;
  document.getElementById('statCalories').textContent=cal>0?cal.toLocaleString('fr-FR')+' kcal':'— kcal';
  document.getElementById('statIntensity').textContent=dom&&dom[1]>0?TYPE_LABELS[dom[0]]:'—';

  // Sleep stats
  const filled=sl.filter(Boolean), hrs=filled.map(s=>s&&s.duration?s.duration:0).filter(h=>h>0);
  document.getElementById('slNights').textContent=`${filled.length}/7`;
  if(hrs.length){
    const avg=hrs.reduce((a,b)=>a+b,0)/hrs.length;
    document.getElementById('slAvg').textContent=avg.toFixed(1)+'h';
    document.getElementById('slTotal').textContent=hrs.reduce((a,b)=>a+b,0).toFixed(1)+'h';
    document.getElementById('slBest').textContent=Math.max(...hrs).toFixed(1)+'h';
    const fq=filled.filter(s=>s&&s.quality), aq=fq.length?fq.reduce((a,s)=>a+s.quality,0)/fq.length:0;
    document.getElementById('slQuality').textContent=QLABELS[Math.round(aq)]||'—';
  } else { ['slAvg','slTotal','slBest','slQuality'].forEach(id=>document.getElementById(id).textContent='—'); }

  if(tab==='training') renderTraining(ws,sl,dd,today);
  else if(tab==='sleep') renderSleepPanel(sl,dd,wn);
  else renderWeightPanel();
}

// ── WEIGHT (header widget) ──
const wi=document.getElementById('runnerWeight');
wi.value=weight;
wi.addEventListener('input',()=>{ const v=parseFloat(wi.value); if(v>=30&&v<=200){weight=v;localStorage.setItem('rp_weight',v);render();} });

// ── NAV ──
document.getElementById('prevWeek').addEventListener('click',()=>{ weekOff--; render(); });
document.getElementById('nextWeek').addEventListener('click',()=>{ weekOff++; render(); });
document.getElementById('clearWeekBtn').addEventListener('click',()=>{
  if(!confirm('Vider les séances de cette semaine ?'))return;
  sessions[wkey()]=Array.from({length:7},()=>[]); saveSessions(); render(); showToast('Semaine vidée');
});

// ── EXPORT ──
document.getElementById('exportBtn').addEventListener('click',()=>{
  const monday=getMonday(), ws=wSessions(),sl=wSleep(),dd=dates(),wn=isoWeek(monday),wy=isoWeekYear(monday);
  let txt=`RUNPLAN — Semaine ${wy}-W${String(wn).padStart(2,'0')}\n${'='.repeat(45)}\n\n`;
  dd.forEach((d,i)=>{
    txt+=`${DAYS[i]} ${d.toLocaleDateString('fr-FR')}\n`;
    const s=sl[i];
    if(s&&s.duration)txt+=`  🌙 Sommeil: ${s.duration}h — ${QLABELS[s.quality]||'?'} — ${s.bedtime||'?'}→${s.wakeup||'?'}${s.wakeups?` — ${s.wakeups} réveil(s)`:''}\n`;
    if(!ws[i]||!ws[i].length)txt+='  — Aucune séance\n';
    else ws[i].forEach(s=>{ const c=kcal(s); txt+=`  • [${TYPE_LABELS[s.type]}] ${s.kind}${s.dist?` — ${s.dist} km`:''}${s.dur?` — ${s.dur} min`:''}${s.pace?` @ ${s.pace}/km`:''}${c>0?` — ~${c} kcal`:''}${s.notes?`\n    Note: ${s.notes}`:''}\n`; });
    txt+='\n';
  });
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));
  a.download=`runplan-semaine-${wy}-W${String(wn).padStart(2,'0')}.txt`; a.click(); showToast('Export téléchargé ✓');
});

function showToast(msg,isSleep=false,type=''){
  const t=document.getElementById('toast'); t.textContent=msg;
  t.className='toast show'+(isSleep?' slp':'')+(type==='wt'?' wt':'');
  setTimeout(()=>t.classList.remove('show'),2500);
}

// ── SAMPLE DATA ──
// Init latest weight in header from log
(function(){
  if(weightLog.length){
    const sorted=[...weightLog].sort((a,b)=>a.date.localeCompare(b.date));
    const latest=sorted[sorted.length-1].val;
    weight=latest; localStorage.setItem('rp_weight',latest);
    document.getElementById('runnerWeight').value=latest;
  }
})();

function initSample(){
  const k=wkey(0);
  if(!sessions[k]){
    sessions[k]=[
      [{type:'easy',kind:'Footing facile',dist:'8',dur:'48',pace:'6:00',notes:'Allure conversation'}],[],
      [{type:'hard',kind:'Fractionné court',dist:'10',dur:'55',pace:'4:15',notes:'10×400m avec 90s récup'}],
      [{type:'easy',kind:'Récupération active',dist:'5',dur:'35',pace:'7:00',notes:''}],[],
      [{type:'moderate',kind:'Sortie longue',dist:'18',dur:'105',pace:'5:50',notes:'Progressif, allure marathon en fin'}],
      [{type:'rest',kind:'Repos complet',dist:'',dur:'',pace:'',notes:'Étirements, foam roller'}],
    ]; saveSessions();
  }
  if(!sleepData[k]||sleepData[k].every(s=>!s)){
    sleepData[k]=[
      {bedtime:'22:45',wakeup:'06:30',duration:7.75,quality:3,wakeups:1,notes:''},
      {bedtime:'23:30',wakeup:'07:00',duration:7.5,quality:2,wakeups:2,notes:'Stress avant fractionné'},
      {bedtime:'22:00',wakeup:'06:00',duration:8,quality:4,wakeups:0,notes:''},
      {bedtime:'23:00',wakeup:'06:30',duration:7.5,quality:3,wakeups:1,notes:''},
      {bedtime:'00:30',wakeup:'07:30',duration:7,quality:2,wakeups:2,notes:'Couché tard'},
      {bedtime:'22:30',wakeup:'07:30',duration:9,quality:4,wakeups:0,notes:'Bonne récup sortie longue'},
      null,
    ]; saveSleep();
  }
  if(!weightLog.length){
    const today=new Date(); const base=74.2;
    for(let i=34;i>=0;i-=2){
      const d=new Date(today); d.setDate(today.getDate()-i);
      const v=parseFloat((base - i*0.04 + (Math.random()-0.5)*0.4).toFixed(1));
      const ds=d.toISOString().split('T')[0];
      if(!weightLog.find(e=>e.date===ds)) weightLog.push({date:ds,val:v});
    }
    localStorage.setItem('rp_weightlog',JSON.stringify(weightLog));
    weightGoal=72; localStorage.setItem('rp_wtgoal',weightGoal); document.getElementById('wtGoalInput').value=72;
    runnerHeight=178; localStorage.setItem('rp_height',runnerHeight); document.getElementById('wtHeightInput').value=178;
    // Seed header widget with latest
    const sorted=[...weightLog].sort((a,b)=>a.date.localeCompare(b.date));
    weight=sorted[sorted.length-1].val; localStorage.setItem('rp_weight',weight);
    document.getElementById('runnerWeight').value=weight;
  }
}

initSample();
render();
