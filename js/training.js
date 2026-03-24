function kcal(s) {
  if (sessionCategory(s)==='strength') return 0;
  const w = weight||70;
  if (s.type==='rest') return 0;
  const f = {easy:1.0,moderate:1.1,hard:1.25}[s.type]||1;
  if (s.dist&&parseFloat(s.dist)>0) return Math.round(w*parseFloat(s.dist)*f);
  if (s.dur&&parseInt(s.dur)>0) return Math.round((MET[s.type]||8)*w*parseInt(s.dur)/60);
  return 0;
}

function exerciseLineToText(ex) {
  const reps = ex.reps || '?';
  const sets = ex.sets ? `${ex.sets}x` : '';
  const kg = ex.weightKg ?? 0;
  return `${ex.name} — ${sets}${reps} — ${kg} kg`;
}

function normalizeExercise(ex = {}) {
  const parsedSets = ex.sets === '' || ex.sets === undefined ? undefined : parseInt(ex.sets, 10);
  const parsedWeight = ex.weightKg === '' || ex.weightKg === undefined ? 0 : parseFloat(ex.weightKg);
  return {
    name: (ex.name || '').trim(),
    ...(Number.isNaN(parsedSets) ? {} : (parsedSets ? { sets: parsedSets } : {})),
    reps: ex.reps === undefined ? '' : String(ex.reps).trim(),
    weightKg: Number.isNaN(parsedWeight) ? 0 : parsedWeight,
  };
}

function readExerciseRows() {
  return Array.from(document.querySelectorAll('.exercise-row')).map(row => normalizeExercise({
    name: row.querySelector('.exercise-name')?.value,
    reps: row.querySelector('.exercise-reps')?.value,
    sets: row.querySelector('.exercise-sets')?.value,
    weightKg: row.querySelector('.exercise-weight')?.value,
  }));
}

function addExerciseRow(exercise = {}) {
  const list = document.getElementById('exerciseList');
  const ex = normalizeExercise(exercise);
  const row = document.createElement('div');
  row.className = 'exercise-row';
  row.innerHTML = `
    <input class="form-input exercise-name" type="text" placeholder="Nom (ex: Développé couché)" value="${ex.name}">
    <input class="form-input exercise-sets" type="number" min="1" step="1" placeholder="Séries" value="${ex.sets ?? ''}">
    <input class="form-input exercise-reps" type="text" placeholder="Répétitions (ex: 8 ou 8-10)" value="${ex.reps}">
    <input class="form-input exercise-weight" type="number" min="0" step="0.5" placeholder="Poids (kg)" value="${ex.weightKg || 0}">
    <button class="exercise-remove" type="button" aria-label="Supprimer l'exercice">✕</button>
  `;
  row.querySelector('.exercise-remove').addEventListener('click', () => {
    row.remove();
    const hasExercises = document.querySelectorAll('.exercise-row').length > 0;
    if (!hasExercises && selCategory === 'strength') document.getElementById('strengthHint').style.display = 'block';
  });
  list.appendChild(row);
}

function resetExerciseRows() {
  document.getElementById('exerciseList').innerHTML = '';
}

function setSessionCategory(category) {
  selCategory = category === 'strength' ? 'strength' : 'run';
  const isStrength = selCategory === 'strength';
  document.getElementById('runFields').style.display = isStrength ? 'none' : 'block';
  document.getElementById('strengthBlock').style.display = isStrength ? 'block' : 'none';
  document.getElementById('strengthHint').style.display = isStrength ? 'block' : 'none';
  document.getElementById('sessionCategory').value = selCategory;
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
      if (cat === 'strength') card.classList.add('strength');
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
        ? `<div class="strength-exercises">${(s.exercises||[]).map(ex=>`<div class="strength-exercise-item">${exerciseLineToText(ex)}</div>`).join('')}</div>`
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
  setSessionCategory(category);
  setType(ex?ex.type:'easy');
  document.getElementById('sessionKind').value=ex?ex.kind:'Footing facile';
  document.getElementById('sessionDist').value=ex?(ex.dist||''):'';
  document.getElementById('sessionDur').value=ex?(ex.dur||''):'';
  document.getElementById('sessionPace').value=ex?(ex.pace||''):'';
  document.getElementById('sessionNotes').value=ex?(ex.notes||''):'';

  resetExerciseRows();
  if (category === 'strength' && ex && (ex.exercises||[]).length) {
    (ex.exercises||[]).forEach(addExerciseRow);
  } else if (category === 'strength') {
    addExerciseRow();
  }

  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('open'); curDay=null; editState=null; }
function setType(t){ selType=t; document.querySelectorAll('.type-btn').forEach(b=>{ b.className='type-btn'; if(b.dataset.type===t) b.classList.add({easy:'ae',moderate:'am',hard:'ah',rest:'ar'}[t]); }); }
document.querySelectorAll('.type-btn').forEach(b=>b.addEventListener('click',()=>setType(b.dataset.type)));
document.getElementById('sessionCategory').addEventListener('change',e=>{
  setSessionCategory(e.target.value);
  if (selCategory === 'strength' && document.querySelectorAll('.exercise-row').length === 0) addExerciseRow();
});
document.getElementById('addExerciseBtn').addEventListener('click',()=>{
  addExerciseRow();
  document.getElementById('strengthHint').style.display='none';
});
document.getElementById('cancelBtn').addEventListener('click',closeModal);
document.getElementById('modalOverlay').addEventListener('click',e=>{ if(e.target===document.getElementById('modalOverlay'))closeModal(); });
document.getElementById('saveBtn').addEventListener('click',()=>{
  const category = selCategory==='strength'?'strength':'run';
  const s={category,type:selType,kind:document.getElementById('sessionKind').value,dist:document.getElementById('sessionDist').value,dur:document.getElementById('sessionDur').value,pace:document.getElementById('sessionPace').value,notes:document.getElementById('sessionNotes').value};
  if(category==='strength'){
    s.kind='Musculation';
    s.exercises=readExerciseRows().filter(ex => ex.name);
    if (!s.exercises.length) {
      document.getElementById('strengthHint').style.display='block';
      showToast('Ajoutez au moins un exercice de musculation');
      return;
    }
    s.dist='';
    s.dur='';
    s.pace='';
  }
  const ws=wSessions(); if(!ws[curDay])ws[curDay]=[];
  if(editState!==null){ws[curDay][editState]=s;showToast('Séance mise à jour ✓');}
  else{ws[curDay].push(s);showToast('Séance ajoutée ✓');}
  saveSessions();closeModal();render();
});
