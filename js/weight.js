function wtBMI(w) {
  if(!runnerHeight||runnerHeight<100) return null;
  const h=runnerHeight/100;
  return (w/(h*h)).toFixed(1);
}
function wtBMILabel(bmi) {
  if(!bmi) return '—';
  const b=parseFloat(bmi);
  if(b<18.5) return 'Insuffisant';
  if(b<25) return 'Normal';
  if(b<30) return 'Surpoids';
  return 'Obésité';
}
function wtBMIColor(bmi) {
  if(!bmi) return 'var(--muted)';
  const b=parseFloat(bmi);
  if(b<18.5) return 'var(--moderate)';
  if(b<25) return 'var(--easy)';
  if(b<30) return 'var(--moderate)';
  return 'var(--hard)';
}

function setWtRange(r) {
  wtRange=r;
  document.querySelectorAll('.wp-range-btn').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.range)===r));
  renderWeightPanel();
}

function renderWeightPanel() {
  const sorted = [...weightLog].sort((a,b)=>a.date.localeCompare(b.date));
  const cur = sorted.length ? sorted[sorted.length-1].val : null;
  const first = sorted.length ? sorted[0].val : null;
  const delta = (cur&&first) ? (cur-first) : null;
  const goalDiff = (cur&&weightGoal) ? (cur-weightGoal) : null;
  const bmi = cur ? wtBMI(cur) : null;

  // Header stats bar
  document.getElementById('wtCurrent').textContent = cur ? cur.toFixed(1)+' kg' : '—';
  document.getElementById('wtStart').textContent = first ? first.toFixed(1)+' kg' : '—';
  document.getElementById('wtDelta').textContent = delta!==null ? (delta>0?'+':'')+delta.toFixed(1)+' kg' : '—';
  document.getElementById('wtDelta').style.color = delta===null?'var(--wt)':delta>0?'var(--hard)':delta<0?'var(--easy)':'var(--wt)';
  document.getElementById('wtGoalDiff').textContent = goalDiff!==null ? (goalDiff>0?'+':'')+goalDiff.toFixed(1)+' kg' : '—';
  document.getElementById('wtGoalDiff').style.color = goalDiff===null?'var(--wt)':Math.abs(goalDiff)<0.5?'var(--easy)':goalDiff>0?'var(--hard)':'var(--easy)';
  document.getElementById('wtBMI').textContent = bmi ? bmi : '—';
  document.getElementById('wtBMI').style.color = bmi ? wtBMIColor(bmi) : 'var(--wt)';

  // Panel stats
  document.getElementById('wpCur').textContent = cur ? cur.toFixed(1)+' kg' : '—';
  document.getElementById('wpDelta').textContent = delta!==null ? (delta>0?'+':'')+delta.toFixed(1)+' kg' : '—';
  document.getElementById('wpDelta').style.color = delta===null?'var(--wt)':delta>0?'var(--hard)':delta<0?'var(--easy)':'var(--wt)';
  document.getElementById('wpGoalDiff').textContent = goalDiff!==null ? (goalDiff>0?'+':'')+goalDiff.toFixed(1)+' kg' : '—';
  document.getElementById('wpGoalDiff').style.color = goalDiff===null?'var(--wt)':Math.abs(goalDiff)<0.5?'var(--easy)':goalDiff>0?'var(--hard)':'var(--easy)';
  const bmiLabel = bmi ? `${bmi} (${wtBMILabel(bmi)})` : '—';
  document.getElementById('wpBMI').textContent = bmiLabel;
  document.getElementById('wpBMI').style.color = bmi ? wtBMIColor(bmi) : 'var(--wt)';
  document.getElementById('wpEntries').textContent = sorted.length;

  // Filter by range
  let display = sorted;
  if(wtRange>0) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-wtRange);
    const cutStr = cutoff.toISOString().split('T')[0];
    display = sorted.filter(e=>e.date>=cutStr);
  }

  // SVG Chart
  renderWtChart(display, weightGoal);

  // Log list
  const list = document.getElementById('wtLogList');
  list.innerHTML = '';
  if(!sorted.length) { list.innerHTML='<div class="wp-empty">Aucune mesure. Ajoutez votre premier poids !</div>'; return; }
  const rev = [...sorted].reverse();
  rev.forEach((e,i)=>{
    const prev = rev[i+1];
    const diff = prev ? e.val-prev.val : null;
    const deltaClass = diff===null?'same':diff>0?'up':'down';
    const deltaStr = diff===null?'—':(diff>0?'+':'')+diff.toFixed(1)+' kg';
    const row = document.createElement('div'); row.className='wp-log-entry';
    row.innerHTML=`<span class="wp-log-date">${new Date(e.date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</span><span class="wp-log-val">${e.val.toFixed(1)} kg</span><span class="wp-log-delta ${deltaClass}">${deltaStr}</span><button class="wp-log-del" data-date="${e.date}">✕</button>`;
    list.appendChild(row);
  });
  list.addEventListener('click',e=>{
    const btn=e.target.closest('.wp-log-del');
    if(btn){
      const deleteEntry = async () => {
        if (hasApiConfig()) {
          await apiFetch(`/weight/${btn.dataset.date}`, { method: 'DELETE' });
        }
        weightLog=weightLog.filter(x=>x.date!==btn.dataset.date);
        localStorage.setItem('rp_weightlog',JSON.stringify(weightLog));
        renderWeightPanel();
        showToast('Mesure supprimée',false,'wt');
      };
      deleteEntry().catch((error) => {
        console.error(error);
        showToast('Erreur suppression poids', false, 'wt');
      });
    }
  });
}

function renderWtChart(data, goal) {
  const wrap = document.getElementById('wtChartWrap');
  const W=wrap.clientWidth||600, H=220;
  const PAD={top:20,right:20,bottom:36,left:44};
  const cw=W-PAD.left-PAD.right, ch=H-PAD.top-PAD.bottom;

  if(!data.length){
    wrap.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%"><text x="${W/2}" y="${H/2}" text-anchor="middle" fill="var(--muted)" font-family="DM Sans" font-size="13">Aucune donnée à afficher</text></svg>`;
    return;
  }

  const vals = data.map(d=>d.val);
  let minV = Math.min(...vals), maxV = Math.max(...vals);
  if(goal) { minV=Math.min(minV,goal); maxV=Math.max(maxV,goal); }
  const pad = Math.max(0.5,(maxV-minV)*0.15)||1;
  minV-=pad; maxV+=pad;

  const xScale = i => PAD.left + (data.length>1 ? i/(data.length-1)*cw : cw/2);
  const yScale = v => PAD.top + ch - ((v-minV)/(maxV-minV))*ch;

  // Y grid lines
  const yTicks=5;
  let gridLines='', yLabels='';
  for(let i=0;i<=yTicks;i++){
    const v=minV+(maxV-minV)*i/yTicks;
    const y=yScale(v);
    gridLines+=`<line x1="${PAD.left}" y1="${y}" x2="${PAD.left+cw}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
    yLabels+=`<text x="${PAD.left-6}" y="${y+4}" text-anchor="end" fill="var(--muted)" font-family="DM Sans" font-size="10">${v.toFixed(1)}</text>`;
  }

  // X labels (show ~6 max)
  let xLabels='';
  const step=Math.max(1,Math.floor(data.length/6));
  data.forEach((d,i)=>{
    if(i%step===0||i===data.length-1){
      const x=xScale(i), y=PAD.top+ch+22;
      const dt=new Date(d.date+'T12:00:00');
      const lbl=dt.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
      xLabels+=`<text x="${x}" y="${y}" text-anchor="middle" fill="var(--muted)" font-family="DM Sans" font-size="10">${lbl}</text>`;
    }
  });

  // Area fill
  let areaPath=`M ${xScale(0)} ${PAD.top+ch}`;
  data.forEach((d,i)=>{ areaPath+=` L ${xScale(i)} ${yScale(d.val)}`; });
  areaPath+=` L ${xScale(data.length-1)} ${PAD.top+ch} Z`;

  // Line path
  let linePath='';
  data.forEach((d,i)=>{ linePath+=(i===0?'M':'L')+` ${xScale(i)} ${yScale(d.val)}`; });

  // Goal line
  let goalLine='';
  if(goal&&goal>=minV&&goal<=maxV){
    const gy=yScale(goal);
    goalLine=`<line x1="${PAD.left}" y1="${gy}" x2="${PAD.left+cw}" y2="${gy}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>
    <text x="${PAD.left+cw-2}" y="${gy-5}" text-anchor="end" fill="var(--accent)" font-family="DM Sans" font-size="10">Objectif ${goal} kg</text>`;
  }

  // Dots
  let dots='';
  const showDots = data.length<=60;
  if(showDots) data.forEach((d,i)=>{
    dots+=`<circle cx="${xScale(i)}" cy="${yScale(d.val)}" r="3.5" fill="var(--wt)" stroke="var(--bg)" stroke-width="1.5">
      <title>${new Date(d.date+'T12:00:00').toLocaleDateString('fr-FR')} — ${d.val} kg</title>
    </circle>`;
  });

  // Trend line (linear regression)
  let trendLine='';
  if(data.length>=3){
    const n=data.length, xs=data.map((_,i)=>i), ys=data.map(d=>d.val);
    const mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
    const num=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0);
    const den=xs.reduce((a,x)=>a+(x-mx)**2,0);
    const slope=den?num/den:0, intercept=my-slope*mx;
    const ty0=intercept, ty1=slope*(n-1)+intercept;
    trendLine=`<line x1="${xScale(0)}" y1="${yScale(ty0)}" x2="${xScale(n-1)}" y2="${yScale(ty1)}" stroke="rgba(52,211,153,0.35)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }

  wrap.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">
    <defs>
      <linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--wt)" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="var(--wt)" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    ${gridLines}${yLabels}${xLabels}
    <path d="${areaPath}" fill="url(#wtGrad)"/>
    ${trendLine}
    ${goalLine}
    <path d="${linePath}" fill="none" stroke="var(--wt)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg>`;
}

// ── WEIGHT PANEL INIT ──
const wtGoalInput = document.getElementById('wtGoalInput');
const wtHeightInput = document.getElementById('wtHeightInput');
wtGoalInput.value = weightGoal || '';
wtHeightInput.value = runnerHeight || '';
wtGoalInput.addEventListener('change',()=>{
  const updateGoal = async () => {
    weightGoal=parseFloat(wtGoalInput.value)||0;
    localStorage.setItem('rp_wtgoal',weightGoal);
    if (hasApiConfig()) {
      await apiFetch('/me', {
        method: 'PATCH',
        body: JSON.stringify({ weightGoalKg: weightGoal || null }),
      });
    }
    renderWeightPanel();
  };
  updateGoal().catch((error) => {
    console.error(error);
    showToast('Erreur API profil', false, 'wt');
  });
});
wtHeightInput.addEventListener('change',()=>{
  const updateHeight = async () => {
    runnerHeight=parseFloat(wtHeightInput.value)||0;
    localStorage.setItem('rp_height',runnerHeight);
    if (hasApiConfig()) {
      await apiFetch('/me', {
        method: 'PATCH',
        body: JSON.stringify({ heightCm: runnerHeight || null }),
      });
    }
    renderWeightPanel();
  };
  updateHeight().catch((error) => {
    console.error(error);
    showToast('Erreur API profil', false, 'wt');
  });
});

// Set default date to today
document.getElementById('wtDate').value = new Date().toISOString().split('T')[0];

document.getElementById('wtAddBtn').addEventListener('click',()=>{
  const date=document.getElementById('wtDate').value;
  const val=parseFloat(document.getElementById('wtVal').value);
  if(!date||isNaN(val)||val<30||val>250){ showToast('Valeur invalide','','wt'); return; }
  const saveWeight = async () => {
    if (hasApiConfig()) {
      await apiFetch(`/weight/${date}`, {
        method: 'PUT',
        body: JSON.stringify({ weightKg: val }),
      });
      await apiFetch('/me', {
        method: 'PATCH',
        body: JSON.stringify({ weightCurrentKg: val }),
      });
    }
    // Replace existing entry for same date
    weightLog=weightLog.filter(e=>e.date!==date);
    weightLog.push({date,val});
    localStorage.setItem('rp_weightlog',JSON.stringify(weightLog));
    // Update running weight for calorie calc
    weight=val; localStorage.setItem('rp_weight',val);
    document.getElementById('runnerWeight').value=val;
    document.getElementById('wtVal').value='';
    renderWeightPanel(); showToast('Poids enregistré ✓',false,'wt');
  };
  saveWeight().catch((error) => {
    console.error(error);
    showToast('Erreur API poids', false, 'wt');
  });
});
