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
      if (sessionCategory(session) === 'strength') {
        totals.sessionCount += 1;
        return;
      }

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

  const weekNumber = isoWeek(getMonday(weekOff));
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
wi.addEventListener('input',()=>{
  const v=parseFloat(wi.value);
  if(v>=30&&v<=200){
    const updateWeight = async () => {
      weight=v;
      localStorage.setItem('rp_weight',v);
      if (hasApiConfig()) {
        await apiFetch('/me', {
          method: 'PATCH',
          body: JSON.stringify({ weightCurrentKg: v }),
        });
      }
      render();
    };
    updateWeight().catch((error) => {
      console.error(error);
      showToast('Erreur API profil');
    });
  }
});

// ── NAV ──
document.getElementById('prevWeek').addEventListener('click', async ()=>{
  weekOff--;
  if (hasApiConfig()) {
    try { await hydrateWeekFromApi(weekOff); } catch (error) { console.error(error); }
  }
  render();
});
document.getElementById('nextWeek').addEventListener('click', async ()=>{
  weekOff++;
  if (hasApiConfig()) {
    try { await hydrateWeekFromApi(weekOff); } catch (error) { console.error(error); }
  }
  render();
});
document.getElementById('clearWeekBtn').addEventListener('click',()=>{
  if(!confirm('Vider les séances de cette semaine ?'))return;
  const clearWeek = async () => {
    if (hasApiConfig()) {
      await apiFetch(`/weeks/${wkey()}/sessions`, { method: 'DELETE' });
    }
    sessions[wkey()]=Array.from({length:7},()=>[]);
    saveSessions();
    render();
    showToast('Semaine vidée');
  };
  clearWeek().catch((error) => {
    console.error(error);
    showToast('Erreur API semaine');
  });
});

// ── EXPORT ──
function toLocalDateInput(dateValue) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function exportFileName(prefix = 'seance-musculation') {
  return `${prefix}-${toLocalDateInput(new Date())}`;
}

function buildExerciseLabel(exercise) {
  const reps = exercise.reps !== undefined && exercise.reps !== '' ? `${exercise.reps} reps` : 'reps ?';
  const sets = exercise.sets ? `${exercise.sets}x` : '';
  const weight = exercise.weightKg || exercise.weightKg === 0 ? ` @ ${exercise.weightKg} kg` : '';
  return `${exercise.name} ${sets} ${reps}${weight}`.replace(/\s+/g, ' ').trim();
}

function buildExportModel() {
  const ws = wSessions();
  const dd = dates();
  const wn = isoWeek(getMonday(weekOff));
  const days = dd.map((date, dayIndex) => ({
    dayLabel: DAYS[dayIndex],
    dateLabel: date.toLocaleDateString('fr-FR'),
    sessions: (ws[dayIndex] || []).map(session => ({
      title: session.kind || 'Séance',
      category: sessionCategory(session),
      typeLabel: sessionCategory(session) === 'strength'
        ? CATEGORY_LABELS.strength
        : TYPE_LABELS[session.type] || 'Course',
      exercises: (session.exercises || []).map(buildExerciseLabel),
      reps: (session.exercises || []).map(ex => ex.reps).filter(Boolean).join(', '),
      weight: (session.exercises || []).map(ex => ex.weightKg).filter(value => value || value === 0).join(', '),
      notes: session.notes || '',
    })),
  }));

  return {
    weekNumber: wn,
    generatedAtLabel: new Date().toLocaleDateString('fr-FR'),
    days,
  };
}

function renderExportPreview(model) {
  const previewCard = document.getElementById('exportPreviewCard');
  const dayBlocks = model.days.map(day => `
    <section class="export-day">
      <div class="export-day-title">${day.dayLabel} — ${day.dateLabel}</div>
      ${(day.sessions.length
        ? day.sessions.map(session => `
          <div class="export-item">
            <div class="export-item-head">
              <span class="export-tag">${session.typeLabel}</span>
              <span class="export-item-title">${session.title}</span>
            </div>
            ${session.category === 'strength' && session.exercises.length
              ? `<ul class="export-ex-list">${session.exercises.map(ex => `<li>${ex}</li>`).join('')}</ul>`
              : '<div class="export-item-meta">Aucun détail exercice</div>'}
          </div>
        `).join('')
        : '<div class="export-empty">Aucune séance</div>')}
    </section>
  `).join('');

  previewCard.innerHTML = `
    <header class="export-head">
      <h2>RunPlan — Semaine ${model.weekNumber}</h2>
      <p>Aperçu export • ${model.generatedAtLabel}</p>
    </header>
    <div class="export-days">${dayBlocks}</div>
  `;
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function drawSessionToCanvas(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  words.forEach(word => {
    const probe = line ? `${line} ${word}` : word;
    const width = ctx.measureText(probe).width;
    if (width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = probe;
    }
  });
  if (line) ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

async function exportWeekAsPng() {
  const model = buildExportModel();
  renderExportPreview(model);

  const canvas = document.createElement('canvas');
  const width = 1300;
  const baseHeight = 240;
  const extraLines = model.days.reduce((acc, day) => {
    if (!day.sessions.length) return acc + 2;
    return acc + day.sessions.reduce((sessionAcc, session) => {
      const lineCount = Math.max(1, session.exercises.length);
      return sessionAcc + 3 + lineCount;
    }, 0);
  }, 0);
  const height = Math.max(900, baseHeight + extraLines * 30);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-context-unavailable');

  ctx.fillStyle = '#f9fafb';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#111827';
  ctx.font = '700 46px "DM Sans", sans-serif';
  ctx.fillText(`RunPlan — Semaine ${model.weekNumber}`, 60, 80);
  ctx.font = '500 26px "DM Sans", sans-serif';
  ctx.fillStyle = '#4b5563';
  ctx.fillText(`Export du ${model.generatedAtLabel}`, 60, 122);

  let y = 170;
  const margin = 60;
  const contentWidth = width - margin * 2;
  model.days.forEach(day => {
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 30px "DM Sans", sans-serif';
    ctx.fillText(`${day.dayLabel} — ${day.dateLabel}`, margin, y);
    y += 40;

    if (!day.sessions.length) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '500 24px "DM Sans", sans-serif';
      ctx.fillText('• Aucune séance', margin + 18, y);
      y += 42;
      return;
    }

    day.sessions.forEach(session => {
      ctx.fillStyle = '#111827';
      ctx.font = '600 24px "DM Sans", sans-serif';
      y = drawSessionToCanvas(
        ctx,
        `• [${session.typeLabel}] ${session.title}`,
        margin + 18,
        y,
        contentWidth - 18,
        32,
      );
      if (session.category === 'strength' && session.exercises.length) {
        ctx.fillStyle = '#374151';
        ctx.font = '500 22px "DM Sans", sans-serif';
        session.exercises.forEach(exerciseLine => {
          y = drawSessionToCanvas(ctx, `- ${exerciseLine}`, margin + 44, y, contentWidth - 44, 28);
        });
      } else {
        ctx.fillStyle = '#6b7280';
        ctx.font = '500 21px "DM Sans", sans-serif';
        y = drawSessionToCanvas(ctx, '- Aucun détail exercice', margin + 44, y, contentWidth - 44, 28);
      }
      y += 10;
    });
    y += 10;
  });

  downloadDataUrl(canvas.toDataURL('image/png'), `${exportFileName()}.png`);
}

function buildWeekTextExport() {
  const ws = wSessions();
  const sl = wSleep();
  const dd = dates();
  const wn = isoWeek(getMonday(weekOff));
  let txt = `RUNPLAN — Semaine ${wn}\n${'='.repeat(45)}\n\n`;
  dd.forEach((d, i) => {
    txt += `${DAYS[i]} ${d.toLocaleDateString('fr-FR')}\n`;
    const s = sl[i];
    if (s && s.duration) txt += `  🌙 Sommeil: ${s.duration}h — ${QLABELS[s.quality] || '?'} — ${s.bedtime || '?'}→${s.wakeup || '?'}${s.wakeups ? ` — ${s.wakeups} réveil(s)` : ''}\n`;
    if (!ws[i] || !ws[i].length) txt += '  — Aucune séance\n';
    else ws[i].forEach(session => {
      if (sessionCategory(session) === 'strength') {
        const exs = (session.exercises || []).map(ex => `${ex.name}${ex.sets ? ` ${ex.sets}x` : ''}${ex.reps ? ` ${ex.reps} reps` : ''}${ex.weightKg !== undefined ? ` @ ${ex.weightKg}kg` : ''}`).join(', ');
        txt += `  • [${CATEGORY_LABELS.strength}] ${session.kind}${exs ? ` — ${exs}` : ''}${session.notes ? `\n    Note: ${session.notes}` : ''}\n`;
        return;
      }
      const c = kcal(session);
      txt += `  • [${TYPE_LABELS[session.type]}] ${session.kind}${session.dist ? ` — ${session.dist} km` : ''}${session.dur ? ` — ${session.dur} min` : ''}${session.pace ? ` @ ${session.pace}/km` : ''}${c > 0 ? ` — ~${c} kcal` : ''}${session.notes ? `\n    Note: ${session.notes}` : ''}\n`;
    });
    txt += '\n';
  });
  return txt;
}

function exportWeekAsText() {
  const text = buildWeekTextExport();
  const blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  downloadDataUrl(blobUrl, `${exportFileName('runplan-semaine')}.txt`);
}

document.getElementById('exportBtn').addEventListener('click', async () => {
  try {
    await exportWeekAsPng();
    showToast('Export PNG téléchargé ✓');
  } catch (error) {
    console.error(error);
    showToast('Échec export image. Export texte téléchargé.', false);
    exportWeekAsText();
  }
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

async function bootstrapData() {
  if (hasApiConfig()) {
    try {
      await hydrateProfileFromApi();
      await hydrateWeekFromApi(weekOff);
      await hydrateWeightFromApi(365);
      const runnerWeightInput = document.getElementById('runnerWeight');
      const wtGoalInputEl = document.getElementById('wtGoalInput');
      const wtHeightInputEl = document.getElementById('wtHeightInput');
      if (runnerWeightInput) runnerWeightInput.value = weight || '';
      if (wtGoalInputEl) wtGoalInputEl.value = weightGoal || '';
      if (wtHeightInputEl) wtHeightInputEl.value = runnerHeight || '';
      return;
    } catch (error) {
      console.error(error);
      showToast('API indisponible, mode local activé');
    }
  }
  initSample();
}

bootstrapData().finally(() => {
  render();
});
