function setElementDisplay(id, isVisible, visibleDisplay) {
  document.getElementById(id).style.display = isVisible ? visibleDisplay : 'none';
}

function switchTab(nextTab) {
  tab = nextTab;

  document.getElementById('tabTraining').classList.toggle('active', nextTab === 'training');
  document.getElementById('tabSleep').classList.toggle('active', nextTab === 'sleep');
  document.getElementById('tabWeight').classList.toggle('active', nextTab === 'weight');

  setElementDisplay('planner', nextTab === 'training', 'grid');
  setElementDisplay('sleepPanel', nextTab === 'sleep', 'block');
  setElementDisplay('weightPanel', nextTab === 'weight', 'block');
  setElementDisplay('statsTraining', nextTab === 'training', 'flex');
  setElementDisplay('statsSleep', nextTab === 'sleep', 'flex');
  setElementDisplay('statsWeight', nextTab === 'weight', 'flex');

  render();
}

function calculateTrainingStats(weekSessions) {
  const totals = {
    distanceKm: 0,
    durationMinutes: 0,
    sessionCount: 0,
    calories: 0,
    typeCounts: { easy: 0, moderate: 0, hard: 0, rest: 0 },
  };

  weekSessions.forEach(daySessions => {
    daySessions.forEach(session => {
      if (session.type !== 'rest') totals.sessionCount += 1;
      if (session.dist) totals.distanceKm += parseFloat(session.dist);
      if (session.dur) totals.durationMinutes += parseInt(session.dur);
      totals.calories += kcal(session);
      totals.typeCounts[session.type] = (totals.typeCounts[session.type] || 0) + 1;
    });
  });

  totals.dominantType = Object.entries(totals.typeCounts)
    .sort((left, right) => right[1] - left[1])[0];

  return totals;
}

function calculateSleepStats(weekSleep) {
  const filledNights = weekSleep.filter(Boolean);
  const durations = filledNights
    .map(night => (night && night.duration ? night.duration : 0))
    .filter(duration => duration > 0);

  if (!durations.length) {
    return {
      nightsFilled: filledNights.length,
      averageHours: null,
      totalHours: null,
      bestNightHours: null,
      averageQuality: null,
    };
  }

  const totalHours = durations.reduce((acc, value) => acc + value, 0);
  const qualityEntries = filledNights.filter(night => night && night.quality);
  const averageQuality = qualityEntries.length
    ? qualityEntries.reduce((acc, entry) => acc + entry.quality, 0) / qualityEntries.length
    : 0;

  return {
    nightsFilled: filledNights.length,
    averageHours: totalHours / durations.length,
    totalHours,
    bestNightHours: Math.max(...durations),
    averageQuality,
  };
}

function formatMinutesAsDuration(totalMinutes) {
  if (totalMinutes <= 0) return '0 h';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;

  return `${hours}h${minutes}m`;
}

function renderTrainingStats(trainingStats) {
  document.getElementById('statKm').textContent = trainingStats.distanceKm > 0
    ? `${trainingStats.distanceKm.toFixed(1)} km`
    : '0 km';

  document.getElementById('statTime').textContent = formatMinutesAsDuration(trainingStats.durationMinutes);
  document.getElementById('statSessions').textContent = trainingStats.sessionCount;
  document.getElementById('statCalories').textContent = trainingStats.calories > 0
    ? `${trainingStats.calories.toLocaleString('fr-FR')} kcal`
    : '— kcal';

  document.getElementById('statIntensity').textContent =
    trainingStats.dominantType && trainingStats.dominantType[1] > 0
      ? TYPE_LABELS[trainingStats.dominantType[0]]
      : '—';
}

function renderSleepStats(sleepStats) {
  document.getElementById('slNights').textContent = `${sleepStats.nightsFilled}/7`;

  if (sleepStats.averageHours === null) {
    ['slAvg', 'slTotal', 'slBest', 'slQuality']
      .forEach(id => { document.getElementById(id).textContent = '—'; });
    return;
  }

  document.getElementById('slAvg').textContent = `${sleepStats.averageHours.toFixed(1)}h`;
  document.getElementById('slTotal').textContent = `${sleepStats.totalHours.toFixed(1)}h`;
  document.getElementById('slBest').textContent = `${sleepStats.bestNightHours.toFixed(1)}h`;
  document.getElementById('slQuality').textContent = QLABELS[Math.round(sleepStats.averageQuality)] || '—';
}

function render() {
  const weekSessions = wSessions();
  const weekSleep = wSleep();
  const weekDates = dates();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekNumber = isoWeek(getMonday());
  document.getElementById('weekLabel').textContent = `SEMAINE ${weekNumber}`;

  const trainingStats = calculateTrainingStats(weekSessions);
  const sleepStats = calculateSleepStats(weekSleep);

  renderTrainingStats(trainingStats);
  renderSleepStats(sleepStats);

  if (tab === 'training') renderTraining(weekSessions, weekSleep, weekDates, today);
  else if (tab === 'sleep') renderSleepPanel(weekSleep, weekDates, weekNumber);
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
  const ws=wSessions(),sl=wSleep(),dd=dates(),wn=isoWeek(getMonday());
  let txt=`RUNPLAN — Semaine ${wn}\n${'='.repeat(45)}\n\n`;
  dd.forEach((d,i)=>{
    txt+=`${DAYS[i]} ${d.toLocaleDateString('fr-FR')}\n`;
    const s=sl[i];
    if(s&&s.duration)txt+=`  🌙 Sommeil: ${s.duration}h — ${QLABELS[s.quality]||'?'} — ${s.bedtime||'?'}→${s.wakeup||'?'}${s.wakeups?` — ${s.wakeups} réveil(s)`:''}\n`;
    if(!ws[i]||!ws[i].length)txt+='  — Aucune séance\n';
    else ws[i].forEach(s=>{ const c=kcal(s); txt+=`  • [${TYPE_LABELS[s.type]}] ${s.kind}${s.dist?` — ${s.dist} km`:''}${s.dur?` — ${s.dur} min`:''}${s.pace?` @ ${s.pace}/km`:''}${c>0?` — ~${c} kcal`:''}${s.notes?`\n    Note: ${s.notes}`:''}\n`; });
    txt+='\n';
  });
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));
  a.download=`runplan-semaine-${isoWeek(getMonday())}.txt`; a.click(); showToast('Export téléchargé ✓');
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
