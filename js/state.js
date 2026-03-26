const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAYS_SHORT = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
const TYPE_LABELS = { easy:'Facile', moderate:'Modéré', hard:'Intense', rest:'Repos' };
const MET = { easy:7.0, moderate:9.5, hard:12.5, rest:1.3 };
const CATEGORY_LABELS = { run:'Course', strength:'Musculation' };
const QLABELS = { 1:'Mauvaise', 2:'Correct', 3:'Bonne', 4:'Excellente' };
const QCOLORS = { 1:'var(--hard)', 2:'var(--moderate)', 3:'var(--easy)', 4:'var(--sleep)' };
const API_BASE_URL = localStorage.getItem('rp_api_base_url') || 'https://api.runplan.app/v1';
const API_TOKEN = localStorage.getItem('rp_api_token') || window.RUNPLAN_API_TOKEN || '';

let tab = 'training';
let weekOff = 0;
let sessions = JSON.parse(localStorage.getItem('rp_sessions') || '{}');
let sleepData = JSON.parse(localStorage.getItem('rp_sleep') || '{}');
let weightLog = JSON.parse(localStorage.getItem('rp_weightlog') || '[]'); // [{date:'2024-01-01', val:72.5}]
let weightGoal = parseFloat(localStorage.getItem('rp_wtgoal') || '0');
let runnerHeight = parseFloat(localStorage.getItem('rp_height') || '0');
let weight = parseFloat(localStorage.getItem('rp_weight') || '70');
let wtRange = 30;
let editState = null, sleepDay = null;
let selType = 'easy', selQ = 3, selCategory = 'run';

function sessionCategory(session) {
  return session && session.category === 'strength' ? 'strength' : 'run';
}

function getMonday(off = 0) {
  const n = new Date(), day = n.getDay();
  const m = new Date(n);
  m.setDate(n.getDate() + (day===0?-6:1-day) + off*7);
  m.setHours(0,0,0,0);
  return m;
}
function isoWeek(d) {
  const dt = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  dt.setUTCDate(dt.getUTCDate()+4-(dt.getUTCDay()||7));
  return Math.ceil((((dt-new Date(Date.UTC(dt.getUTCFullYear(),0,1)))/86400000)+1)/7);
}
function wkey(off=weekOff) { const d=getMonday(off); return `${d.getFullYear()}-W${String(isoWeek(d)).padStart(2,'0')}`; }
function dates(off=weekOff) { const m=getMonday(off); return Array.from({length:7},(_,i)=>{ const d=new Date(m); d.setDate(m.getDate()+i); return d; }); }
function saveSessions() { localStorage.setItem('rp_sessions',JSON.stringify(sessions)); }
function saveSleep() { localStorage.setItem('rp_sleep',JSON.stringify(sleepData)); }
function wSessions(off=weekOff) { const k=wkey(off); if(!sessions[k]) sessions[k]=Array.from({length:7},()=>[]); return sessions[k]; }
function wSleep(off=weekOff) { const k=wkey(off); if(!sleepData[k]) sleepData[k]=Array(7).fill(null); return sleepData[k]; }
function dateKey(dateValue) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function isoWeekKey(off = weekOff) { return wkey(off); }
function hasApiConfig() { return Boolean(API_TOKEN); }
async function apiFetch(path, options = {}) {
  if (!hasApiConfig()) return null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API ${response.status} ${path} — ${errorBody || response.statusText}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function toLocalSession(apiSession = {}) {
  return {
    id: apiSession.id,
    date: apiSession.date,
    createdAt: apiSession.createdAt,
    updatedAt: apiSession.updatedAt,
    category: apiSession.category || 'run',
    type: apiSession.type || 'easy',
    kind: apiSession.kind || 'Séance',
    dist: apiSession.distKm ?? '',
    dur: apiSession.durMin ?? '',
    pace: apiSession.pace || '',
    notes: apiSession.notes || '',
    exercises: Array.isArray(apiSession.exercises) ? apiSession.exercises : [],
  };
}

function toApiSessionInput(localSession = {}, dayDate) {
  return {
    date: dayDate,
    category: sessionCategory(localSession),
    type: localSession.type || 'easy',
    kind: localSession.kind || 'Séance',
    distKm: localSession.dist === '' || localSession.dist === undefined ? null : parseFloat(localSession.dist),
    durMin: localSession.dur === '' || localSession.dur === undefined ? null : parseInt(localSession.dur, 10),
    pace: localSession.pace || null,
    notes: localSession.notes || null,
    exercises: Array.isArray(localSession.exercises) ? localSession.exercises : [],
  };
}

function toLocalSleep(apiSleep = null) {
  if (!apiSleep) return null;
  return {
    bedtime: apiSleep.bedtime,
    wakeup: apiSleep.wakeup,
    duration: apiSleep.durationH,
    quality: apiSleep.quality,
    wakeups: apiSleep.wakeups,
    notes: apiSleep.notes || '',
    date: apiSleep.date,
  };
}

function toApiSleepInput(localSleep = {}) {
  return {
    bedtime: localSleep.bedtime,
    wakeup: localSleep.wakeup,
    durationH: localSleep.duration,
    quality: localSleep.quality,
    wakeups: localSleep.wakeups || 0,
    notes: localSleep.notes || null,
  };
}

async function hydrateProfileFromApi() {
  if (!hasApiConfig()) return;
  const profile = await apiFetch('/me');
  if (!profile) return;
  if (profile.weightCurrentKg) {
    weight = profile.weightCurrentKg;
    localStorage.setItem('rp_weight', weight);
  }
  weightGoal = profile.weightGoalKg || 0;
  runnerHeight = profile.heightCm || 0;
  localStorage.setItem('rp_wtgoal', weightGoal);
  localStorage.setItem('rp_height', runnerHeight);
}

async function hydrateWeekFromApi(off = weekOff) {
  if (!hasApiConfig()) return false;
  const weekId = isoWeekKey(off);
  const bundle = await apiFetch(`/weeks/${weekId}`);
  if (!bundle) return false;
  sessions[weekId] = (bundle.sessionsByDay || []).map(daySessions => daySessions.map(toLocalSession));
  sleepData[weekId] = (bundle.sleepByDay || []).map(toLocalSleep);
  saveSessions();
  saveSleep();
  return true;
}

async function hydrateWeightFromApi(daysBack = 365) {
  if (!hasApiConfig()) return false;
  const to = dateKey(new Date());
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const from = dateKey(fromDate);
  const payload = await apiFetch(`/weight?from=${from}&to=${to}`);
  weightLog = (payload?.items || []).map(entry => ({ date: entry.date, val: entry.weightKg }));
  localStorage.setItem('rp_weightlog', JSON.stringify(weightLog));
  return true;
}
