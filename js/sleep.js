function slDur(bed,wake) {
  if (!bed||!wake) return null;
  const [bh,bm]=bed.split(':').map(Number), [wh,wm]=wake.split(':').map(Number);
  let m=(wh*60+wm)-(bh*60+bm); if(m<=0) m+=1440;
  return Math.round(m/60*4)/4;
}
function slColor(h) { if(!h)return'empty-bar'; if(h<5.5)return'low'; if(h<7)return'ok'; if(h<8.5)return'good'; return'great'; }
function slHex(h) { return {low:'var(--hard)',ok:'var(--moderate)',good:'var(--easy)',great:'var(--sleep)','empty-bar':'var(--border)'}[slColor(h)]; }

function renderSleepPanel(sl,dd,wn) {
  document.getElementById('slWeekNum').textContent=wn;
  const grid=document.getElementById('sleepGrid'); grid.innerHTML='';
  dd.forEach((date,i)=>{
    const s=sl[i];
    const card=document.createElement('div'); card.className='sleep-week-card'+(s?' filled':'');
    const dots=s&&s.quality?Array.from({length:4},(_,k)=>`<span class="q-dot ${k<s.quality?'on':''}"></span>`).join(''):'';
    card.innerHTML=`<div class="swc-day">${DAYS_SHORT[i]}</div><div class="swc-date">${date.getDate()} ${date.toLocaleString('fr-FR',{month:'short'})}</div>${s&&s.duration?`<div class="swc-hours" style="color:${QCOLORS[s.quality]||'var(--sleep)'}">${s.duration}h</div><div class="swc-qdots">${dots}</div>${s.bedtime?`<div class="swc-sub">${s.bedtime} → ${s.wakeup}</div>`:''} ${s.wakeups?`<div class="swc-sub">${s.wakeups} réveil(s)</div>`:''}` : `<div class="swc-hours empty">—</div><div class="swc-sub">Non saisi</div>`}`;
    card.addEventListener('click',()=>openSleepModal(i)); grid.appendChild(card);
  });

  // Chart
  const chart=document.getElementById('sleepChart'); chart.innerHTML='';
  const maxH=Math.max(9,...sl.filter(Boolean).map(s=>s&&s.duration?s.duration:0));
  dd.forEach((date,i)=>{
    const s=sl[i], h=s&&s.duration?s.duration:0;
    const pct=h>0?(h/maxH)*100:5;
    const cc=slColor(h);
    const w=document.createElement('div'); w.className='sleep-bar-wrap';
    w.innerHTML=`<div style="height:${pct}%;width:100%"><div class="sleep-bar-col ${cc}" style="height:100%" title="${h?h+'h':'—'}"></div></div><div class="sleep-bar-lbl">${DAYS_SHORT[i]}</div><div class="sleep-bar-val">${h?h+'h':'—'}</div>`;
    chart.appendChild(w);
  });

  // Tips
  const tips=document.getElementById('sleepTips'); tips.innerHTML='';
  const filled=sl.filter(Boolean), hrs=filled.map(s=>s&&s.duration?s.duration:0).filter(h=>h>0);
  if(!hrs.length){ tips.innerHTML=`<div style="color:var(--muted);font-size:.82rem;padding:8px 0">Aucune nuit saisie cette semaine. Clique sur un jour pour commencer.</div>`; return; }
  const avg=hrs.reduce((a,b)=>a+b,0)/hrs.length;
  const deficit=Math.max(0,8-avg);
  const spread=Math.max(...hrs)-Math.min(...hrs);
  const fq=filled.filter(s=>s&&s.quality), aq=fq.length?fq.reduce((a,s)=>a+s.quality,0)/fq.length:0;
  const medBed=(()=>{ const bt=filled.filter(s=>s&&s.bedtime).map(s=>{ const[h,m]=s.bedtime.split(':').map(Number); return h<12?h*60+m+1440:h*60+m; }); if(!bt.length)return'—'; const md=bt.sort((a,b)=>a-b)[Math.floor(bt.length/2)]; return `${String(Math.floor(md/60)%24).padStart(2,'0')}:${String(md%60).padStart(2,'0')}`; })();
  const rows=[
    {icon:'⏱',label:'Moyenne / nuit',val:avg.toFixed(1)+'h',color:avg>=7?'var(--easy)':avg>=6?'var(--moderate)':'var(--hard)'},
    {icon:'📉',label:'Déficit semaine',val:deficit>0?'−'+(deficit*filled.length).toFixed(1)+'h':'✓ Suffisant',color:deficit>0?'var(--hard)':'var(--easy)'},
    {icon:'📊',label:'Régularité',val:spread<=1.5?'Bonne':spread<=2.5?'Irrégulier':'Très irrégulier',color:spread<=1.5?'var(--easy)':spread<=2.5?'var(--moderate)':'var(--hard)'},
    {icon:'⭐',label:'Qualité moy.',val:QLABELS[Math.round(aq)]||'—',color:aq>=3?'var(--easy)':aq>=2?'var(--moderate)':'var(--hard)'},
    {icon:'🌙',label:'Coucher médian',val:medBed,color:'var(--sleep)'},
    {icon:'💡',label:'Conseil',val:avg<6?'Priorité au sommeil!':deficit>0?'Rattrapez le déficit':spread>2?'Régularisez les horaires':'Bonne routine 👍',color:'var(--muted)'},
  ];
  rows.forEach(r=>{ const d=document.createElement('div'); d.className='tip-row'; d.innerHTML=`<div class="tip-left"><span class="tip-icon">${r.icon}</span><span class="tip-label">${r.label}</span></div><span class="tip-val" style="color:${r.color}">${r.val}</span>`; tips.appendChild(d); });
}

// ── SLEEP MODAL ──
function openSleepModal(di){
  sleepDay=di;
  const sl=wSleep(), ex=sl[di];
  document.getElementById('sleepModalTitle').textContent=`SOMMEIL — ${DAYS[di].toUpperCase()}`;
  document.getElementById('slBedtime').value=ex?(ex.bedtime||'22:30'):'22:30';
  document.getElementById('slWakeup').value=ex?(ex.wakeup||'06:30'):'06:30';
  document.getElementById('slDuration').value=ex?(ex.duration||''):'';
  document.getElementById('slWakeups').value=ex?(ex.wakeups||0):0;
  document.getElementById('slNotes').value=ex?(ex.notes||''):'';
  setQ(ex?(ex.quality||3):3);
  document.getElementById('sleepModal').classList.add('open');
}
function closeSleepModal(){ document.getElementById('sleepModal').classList.remove('open'); sleepDay=null; }
function setQ(q){ selQ=q; document.querySelectorAll('.q-btn').forEach(b=>{ b.classList.toggle('aq',parseInt(b.dataset.q)===q); }); }
document.querySelectorAll('.q-btn').forEach(b=>b.addEventListener('click',()=>setQ(parseInt(b.dataset.q))));
['slBedtime','slWakeup'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{
  const d=slDur(document.getElementById('slBedtime').value,document.getElementById('slWakeup').value);
  if(d!==null)document.getElementById('slDuration').value=d;
}));
document.getElementById('slCancelBtn').addEventListener('click',closeSleepModal);
document.getElementById('sleepModal').addEventListener('click',e=>{ if(e.target===document.getElementById('sleepModal'))closeSleepModal(); });
document.getElementById('slSaveBtn').addEventListener('click',()=>{
  const bt=document.getElementById('slBedtime').value, wk=document.getElementById('slWakeup').value;
  let dur=parseFloat(document.getElementById('slDuration').value);
  if(!dur||isNaN(dur))dur=slDur(bt,wk);
  const entry={bedtime:bt,wakeup:wk,duration:dur,quality:selQ,wakeups:parseInt(document.getElementById('slWakeups').value)||0,notes:document.getElementById('slNotes').value};
  const saveSleepEntry = async () => {
    if (hasApiConfig()) {
      const dayDate = dateKey(dates()[sleepDay]);
      const payload = await apiFetch(`/sleep/${dayDate}`, {
        method: 'PUT',
        body: JSON.stringify(toApiSleepInput(entry)),
      });
      wSleep()[sleepDay] = toLocalSleep(payload);
    } else {
      wSleep()[sleepDay]=entry;
    }
    saveSleep(); closeSleepModal(); render(); showToast('Sommeil enregistré 🌙',true);
  };
  saveSleepEntry().catch((error) => {
    console.error(error);
    showToast('Erreur API sommeil', true);
  });
});
