const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAYS_SHORT = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
const TYPE_LABELS = { easy:'Facile', moderate:'Modéré', hard:'Intense', rest:'Repos' };
const MET = { easy:7.0, moderate:9.5, hard:12.5, rest:1.3 };
const QLABELS = { 1:'Mauvaise', 2:'Correct', 3:'Bonne', 4:'Excellente' };
const QCOLORS = { 1:'var(--hard)', 2:'var(--moderate)', 3:'var(--easy)', 4:'var(--sleep)' };

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
let selType = 'easy', selQ = 3;

function getMonday(off = 0) {
  const n = new Date(), day = n.getDay();
  const m = new Date(n);
  m.setDate(n.getDate() + (day===0?-6:1-day) + off*7);
  m.setHours(0,0,0,0);
  return m;
}
function isoWeekRef(d) {
  const dt = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  dt.setUTCDate(dt.getUTCDate()+4-(dt.getUTCDay()||7));
  return dt;
}
function isoWeek(d) {
  const dt = isoWeekRef(d);
  return Math.ceil((((dt-new Date(Date.UTC(dt.getUTCFullYear(),0,1)))/86400000)+1)/7);
}
function isoWeekYear(d) { return isoWeekRef(d).getUTCFullYear(); }
function wkey(off=weekOff) { const d=getMonday(off); return `${isoWeekYear(d)}-W${String(isoWeek(d)).padStart(2,'0')}`; }
function dates(off=weekOff) { const m=getMonday(off); return Array.from({length:7},(_,i)=>{ const d=new Date(m); d.setDate(m.getDate()+i); return d; }); }
function saveSessions() { localStorage.setItem('rp_sessions',JSON.stringify(sessions)); }
function saveSleep() { localStorage.setItem('rp_sleep',JSON.stringify(sleepData)); }
function wSessions(off=weekOff) { const k=wkey(off); if(!sessions[k]) sessions[k]=Array.from({length:7},()=>[]); return sessions[k]; }
function wSleep(off=weekOff) { const k=wkey(off); if(!sleepData[k]) sleepData[k]=Array(7).fill(null); return sleepData[k]; }
