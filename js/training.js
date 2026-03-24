function kcal(s) {
  if (sessionCategory(s)==='strength') return 0;
  const w = weight||70;
  if (s.type==='rest') return 0;
  const f = {easy:1.0,moderate:1.1,hard:1.25}[s.type]||1;
  if (s.dist&&parseFloat(s.dist)>0) return Math.round(w*parseFloat(s.dist)*f);
  if (s.dur&&parseInt(s.dur)>0) return Math.round((MET[s.type]||8)*w*parseInt(s.dur)/60);
  return 0;
}

function parseExerciseLines(raw) {
  return raw.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name='',sets='',reps='',weightKg=''] = line.split('|').map(part => part.trim());
      const parsedSets = sets === '' ? undefined : parseInt(sets,10);
      const repsIsNumber = reps !== '' && !Number.isNaN(Number(reps));
      return {
        name,
        ...(Number.isNaN(parsedSets) ? {} : { sets: parsedSets }),
        reps: repsIsNumber ? Number(reps) : reps,
        weightKg: parseFloat(weightKg) || 0,
      };
    })
    .filter(ex => ex.name);
}

function renderTraining(ws,sl,dd,today) {
  const p=document.getElementById('planner'); p.innerHTML='';
  dd.forEach((date,i)=>{
    const isToday=date.getTime()===today.getTime();
    const col=document.createElement('div'); col.className='day-col'+(isToday?' today':'');
    const hdr=document.createElement('div'); hdr.className='day-header';
    hdr.innerHTML=`<div class="day-name">${DAYS_SHORT[i]}</div><div class="day-date">${date.getDate()} ${date.toLocaleString('fr-FR',{month:'short'})}</div>`;
    col.appendChild(hdr);
    const body=document.createElement('div'); body.className='day-body';

    // Sleep block
    const s=sl[i];
    if(s&&s.duration){
      const pct=Math.min(100,(s.duration/10)*100);
      const dots=s.quality?Array.from({length:4},(_,k)=>`<span class="q-dot ${k<s.quality?'on':''}"></span>`).join(''):'';
      const blk=document.createElement('div'); blk.className='sleep-day-block';
      blk.innerHTML=`<div class="sleep-day-header"><span class="sleep-day-label">🌙 Sommeil</span><span class="sleep-day-score" style="color:${QCOLORS[s.quality]||'var(--sleep)'}">${s.duration}h</span></div><div class="sleep-bar-bg"><div class="sleep-bar-fill" style="width:${pct}%"></div></div><div class="sleep-info">${s.bedtime?`<span class="sleep-pill">🛏 ${s.bedtime}</span>`:''} ${s.wakeup?`<span class="sleep-pill">⏰ ${s.wakeup}</span>`:''} ${s.quality?`<span class="sleep-pill">${dots}</span>`:''} ${s.wakeups?`<span class="sleep-pill">↑${s.wakeups}×</span>`:''}</div>`;
      blk.addEventListener('click',()=>openSleepModal(i));
      body.appendChild(blk);
    } else {
      const ab=document.createElement('button'); ab.className='sleep-add-btn'; ab.innerHTML='🌙 Saisir sommeil';
      ab.addEventListener('click',()=>openSleepModal(i)); body.appendChild(ab);
    }

    // Sessions
    (ws[i]||[]).forEach((s,si)=>{
      const card=document.createElement('div'); card.className=`session-card ${s.type}`;
      const cat = sessionCategory(s);
      const m=[];
      if(cat==='run'){
        if(s.dist) m.push(`<span class="meta-pill">📍 ${s.dist} km</span>`);
        if(s.dur) m.push(`<span class="meta-pill">⏱ ${s.dur} min</span>`);
        if(s.pace) m.push(`<span class="meta-pill">🏃 ${s.pace}/km</span>`);
      } else if ((s.exercises||[]).length) {
        m.push(`<span class="meta-pill">🏋️ ${(s.exercises||[]).length} exercice(s)</span>`);
      }
      const c=kcal(s); if(c>0) m.push(`<span class="meta-pill calorie">🔥 ${c} kcal</span>`);
      const tag = cat==='strength' ? CATEGORY_LABELS.strength : TYPE_LABELS[s.type];
      const exerciseText = cat==='strength' && (s.exercises||[]).length
        ? `<div style="font-size:.7rem;color:var(--muted);margin-top:4px">${(s.exercises||[]).map(ex=>`${ex.name}: ${ex.sets?`${ex.sets}×`:''}${ex.reps||'?'} @ ${ex.weightKg||0}kg`).join(' · ')}</div>`
        : '';
      card.innerHTML=`<div class="session-type">${tag}</div><div class="session-title">${s.kind}</div>${m.length?`<div class="session-meta">${m.join('')}</div>`:''}${exerciseText} ${s.notes?`<div style="font-size:.7rem;color:var(--muted);margin-top:5px;font-style:italic">${s.notes}</div>`:''}<button class="session-delete" data-d="${i}" data-si="${si}">✕</button>`;
      card.addEventListener('click',e=>{ if(!e.target.classList.contains('session-delete')) openModal(i,si); });
      body.appendChild(card);
    });

    const ab=document.createElement('button'); ab.className='add-session-btn'; ab.innerHTML='＋ Ajouter séance';
    ab.addEventListener('click',()=>openModal(i,null)); body.appendChild(ab);
    body.addEventListener('click',e=>{ const d=e.target.closest('.session-delete'); if(d){ wSessions()[parseInt(d.dataset.d)].splice(parseInt(d.dataset.si),1); saveSessions(); render(); showToast('Séance supprimée'); }});
    col.appendChild(body); p.appendChild(col);
  });
}

// ── TRAINING MODAL ──
let curDay=null;
function openModal(di,si) {
  curDay=di; editState=si!==null?si:null;
  const ws=wSessions(), ex=si!==null?ws[di][si]:null;
  document.getElementById('modalTitle').textContent=ex?'MODIFIER LA SÉANCE':'NOUVELLE SÉANCE';
  const category = ex?sessionCategory(ex):'run';
  selCategory=category;
  document.getElementById('sessionCategory').value=category;
  setType(ex?ex.type:'easy');
  document.getElementById('sessionKind').value=ex?ex.kind:'Footing facile';
  document.getElementById('sessionDist').value=ex?(ex.dist||''):'';
  document.getElementById('sessionDur').value=ex?(ex.dur||''):'';
  document.getElementById('sessionPace').value=ex?(ex.pace||''):'';
  document.getElementById('sessionNotes').value=ex?(ex.notes||''):'';
  document.getElementById('sessionExercises').value=ex&&sessionCategory(ex)==='strength'
    ? (ex.exercises||[]).map(e=>`${e.name}|${e.sets??''}|${e.reps??''}|${e.weightKg??0}`).join('\n')
    : '';
  document.getElementById('strengthHint').style.display=category==='strength'?'block':'none';
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('open'); curDay=null; editState=null; }
function setType(t){ selType=t; document.querySelectorAll('.type-btn').forEach(b=>{ b.className='type-btn'; if(b.dataset.type===t) b.classList.add({easy:'ae',moderate:'am',hard:'ah',rest:'ar'}[t]); }); }
document.querySelectorAll('.type-btn').forEach(b=>b.addEventListener('click',()=>setType(b.dataset.type)));
document.getElementById('sessionCategory').addEventListener('change',e=>{
  selCategory=e.target.value==='strength'?'strength':'run';
  document.getElementById('strengthHint').style.display=selCategory==='strength'?'block':'none';
});
document.getElementById('cancelBtn').addEventListener('click',closeModal);
document.getElementById('modalOverlay').addEventListener('click',e=>{ if(e.target===document.getElementById('modalOverlay'))closeModal(); });
document.getElementById('saveBtn').addEventListener('click',()=>{
  const category = selCategory==='strength'?'strength':'run';
  const s={category,type:selType,kind:document.getElementById('sessionKind').value,dist:document.getElementById('sessionDist').value,dur:document.getElementById('sessionDur').value,pace:document.getElementById('sessionPace').value,notes:document.getElementById('sessionNotes').value};
  if(category==='strength'){
    s.exercises=parseExerciseLines(document.getElementById('sessionExercises').value);
    s.dist='';
    s.dur='';
    s.pace='';
  }
  const ws=wSessions(); if(!ws[curDay])ws[curDay]=[];
  if(editState!==null){ws[curDay][editState]=s;showToast('Séance mise à jour ✓');}
  else{ws[curDay].push(s);showToast('Séance ajoutée ✓');}
  saveSessions();closeModal();render();
});
