// =============================================================
// OS State — shared addon library for Row pages.
// Drop on any page with: <script src="os-state.js" defer></script>
// Then place container divs like:
//   <div data-os-section="moms-house"></div>
//   <div data-os-section="fitness-goals"></div>
// Or call OSAddons.render('section-name', containerOrId) from page JS.
//
// State lives in localStorage key 'os-state-v1' and syncs via the
// existing sync.js (app_key 'os-state'). All Row pages that include
// this script share the same data.
// =============================================================
(function () {
  'use strict';

  const KEY = 'os-state-v1';
  const APP_KEY = 'os-state';

  // -------- DEFAULT STATE --------
  const defaultState = {
    // Daily (keyed by 'YYYY-MM-DD')
    bigDomino: {}, priorities: {}, dailyChecks: {}, nonZero: {},
    meals: {}, resetBlock: {}, nightShutdown: {}, journal: {}, quran: {}, burnout: {},

    // Strategic
    warRoom: { priorities: [], fires: [], opportunities: [], bottleneck: '' },
    levels: {
      current: 1,
      defs: [
        { id: 1, name: 'Stabilization', criteria: [
          '4 gym sessions/week for 3 consecutive weeks',
          'Fajr on time 20/28 days (one month)',
          'Sleep avg 8.0+ hr for 4 weeks',
          'Dashboard used 20/28 days',
          'War Room kept ≤3 priorities the whole month'
        ] },
        { id: 2, name: 'Scaling', criteria: [
          '$30k/month revenue for 2 consecutive months',
          'Appointwise bottleneck resolved (logged in Decision Log)',
          'New VA + 30 days of zero costly mistakes',
          'Onboarding SOP documented and used 5+ times',
          '0 lost-revenue cancellations not replaced in 30 days'
        ] },
        { id: 3, name: 'Operator → Owner', criteria: [
          '$100k/month revenue for 2 consecutive months',
          'CEO Hours 2×/wk for 8 consecutive weeks',
          'Delegation matrix: every recurring task has an owner ≠ you',
          'SOPs documented for every role',
          '1 fully unplugged week without revenue dropping >10%'
        ] },
        { id: 4, name: 'Wealth Expansion', criteria: [
          'Second business launched + first $5k revenue',
          'First investment executed (stocks, property, biz, anything)',
          'Dubai property search active (3+ viewings)',
          'Both businesses profitable for 60 days',
          "Mom's house fully paid"
        ] }
      ],
      checks: { 1:[false,false,false,false,false], 2:[false,false,false,false,false], 3:[false,false,false,false,false], 4:[false,false,false,false,false] }
    },
    weeklyScore: {}, weeklyMetrics: {},
    monthlyTargets: { '2026-05': { revenue: 60000, clients: 12, onboarded: 12, gym: 16, sleep: 8.5, weight: 70 } },
    recoveryDays: [], systems: [], decisions: [], delegation: [],

    // Goals & trackers (cross-page integration)
    momsHouse: { target: 0, paid: 0, contributions: [] },
    fitnessGoals: { weightTarget: 70, gymWeeklyTarget: 4 },
    faithGoals: { fajrWeeklyTarget: 7 },
    yearlyGoals: [
      { id: 'g1', text: 'Scale to $100k/month revenue',            cat: 'biz', deadline: 'Jun 30', done: false },
      { id: 'g2', text: 'Hire VA account manager',                 cat: 'biz', deadline: 'May 31', done: false },
      { id: 'g3', text: 'Resolve Appointwise bottleneck',          cat: 'biz', deadline: 'May 31', done: false },
      { id: 'g4', text: 'Start second business (≥90% automated)',  cat: 'biz', deadline: 'Sep 15', done: false },
      { id: 'g5', text: "Pay off mom's house",                     cat: 'family', deadline: 'Dec 31', done: false },
      { id: 'g6', text: 'Begin Dubai house search',                cat: 'life', deadline: 'Dec 31', done: false },
      { id: 'g7', text: 'Weigh 70kg',                              cat: 'health', deadline: 'Dec 31', done: false },
      { id: 'g8', text: 'Get RTA driving license',                 cat: 'life', deadline: 'May 14', done: false },
      { id: 'g9', text: 'Fajr on time — daily discipline',         cat: 'faith', deadline: 'Daily', done: false },
      { id: 'g10', text: '5 daily prayers on time',                cat: 'faith', deadline: 'Daily', done: false }
    ],

    // Cross-cutting
    capture: [], loops: [], clients: [],
    ui: { collapsed: {} }
  };

  // -------- STORAGE --------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(defaultState);
      const stored = JSON.parse(raw);
      const merged = Object.assign(structuredClone(defaultState), stored);
      // Always pull latest level defs but keep user's progress
      if (stored.levels) {
        merged.levels = { current: stored.levels.current || 1, checks: {}, defs: defaultState.levels.defs };
        defaultState.levels.defs.forEach(d => {
          const old = (stored.levels.checks && stored.levels.checks[d.id]) || [];
          merged.levels.checks[d.id] = d.criteria.map((_, i) => !!old[i]);
        });
      }
      if (!stored.yearlyGoals || !stored.yearlyGoals.length) merged.yearlyGoals = defaultState.yearlyGoals;
      return merged;
    } catch { return structuredClone(defaultState); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  let state = load();

  // -------- HELPERS --------
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isoWeekOf(d) {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (dt.getUTCDay() + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
    const ft = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
    const diff = (dt - ft) / 86400000;
    const week = 1 + Math.round((diff - 3 + ((ft.getUTCDay() + 6) % 7)) / 7);
    return dt.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
  }
  function todayKey() { return dateKey(); }
  function tomorrowKey() { const d = new Date(); d.setDate(d.getDate() + 1); return dateKey(d); }
  function monthKey() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function isoWeek() { return isoWeekOf(new Date()); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtMoney(n) { return '$' + (n || 0).toLocaleString(); }
  function getStreak(checkKey) {
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const k = dateKey(d);
      if (state.dailyChecks[k] && state.dailyChecks[k][checkKey]) { count++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return count;
  }
  // Read gym sessions this week from Row's existing po-coach data (best-effort)
  function gymThisWeek() {
    try {
      const w = isoWeek();
      let count = 0;
      const checks = state.dailyChecks;
      Object.entries(checks).forEach(([dk, vals]) => {
        if (vals && vals.gym) {
          try { if (isoWeekOf(new Date(dk + 'T12:00:00')) === w) count++; } catch (e) {}
        }
      });
      // Also try to read Row's po-coach workout-done count
      try {
        const done = JSON.parse(localStorage.getItem('po_coach_workout_done') || '{}');
        // Best effort — if it's a date map of booleans, count this week's
        if (done && typeof done === 'object') {
          let extra = 0;
          Object.entries(done).forEach(([dk, v]) => {
            if (!v) return;
            try { if (isoWeekOf(new Date(dk + 'T12:00:00')) === w) extra++; } catch (e) {}
          });
          // Prefer the larger of the two signals
          count = Math.max(count, extra);
        }
      } catch (e) {}
      return count;
    } catch (e) { return 0; }
  }
  // Read latest weight from Row's existing gym tracker if available
  function latestWeight() {
    try {
      const weights = JSON.parse(localStorage.getItem('po_coach_weights') || '[]');
      if (Array.isArray(weights) && weights.length) {
        // Sort by date desc and take latest
        const sorted = weights.slice().sort((a, b) => {
          const ad = (a && a.dateKey) || (a && a.date) || '';
          const bd = (b && b.dateKey) || (b && b.date) || '';
          return bd.localeCompare(ad);
        });
        const v = sorted[0];
        return (v && (v.weight || v.kg || v.value)) || 0;
      }
    } catch (e) {}
    // Fallback: weekly metric weight
    const wk = state.weeklyMetrics[isoWeek()];
    if (wk && typeof wk.weight === 'number') return wk.weight;
    return 0;
  }

  // -------- CSS (injected once) --------
  const css = `
.os-card {
  background: linear-gradient(180deg, rgba(13,13,16,0.92) 0%, rgba(13,13,16,0.7) 100%);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 16px;
  margin: 12px 0;
  color: #B8B6B0;
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.os-card-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; margin-bottom: 12px; }
.os-card-head h2 { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #76746E; cursor: pointer; user-select: none; position: relative; padding-right: 18px; }
.os-card-head h2:hover { color: #d4af37; }
.os-card-head h2::after { content: ''; position: absolute; right: 0; top: 50%; width: 6px; height: 6px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: translateY(-65%) rotate(45deg); opacity: 0.5; transition: transform 0.2s; }
.os-card.collapsed > *:not(.os-card-head) { display: none !important; }
.os-card.collapsed .os-card-head h2::after { transform: translateY(-30%) rotate(-45deg); }
.os-card-sub { font-size: 11px; color: #76746E; letter-spacing: 0.04em; }
.os-input { width: 100%; background: #14141a; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; color: #FAFAFA; padding: 9px 12px; font-size: 14px; font-family: inherit; outline: none; }
.os-input:focus { border-color: #d4af37; }
.os-btn { background: #14141a; border: 1px solid rgba(255,255,255,0.10); color: #B8B6B0; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit; transition: all 0.15s; }
.os-btn:hover { background: rgba(212,175,55,0.10); border-color: #d4af37; color: #e6c068; }
.os-btn-icon { background: transparent; border: none; color: #76746E; cursor: pointer; padding: 4px 8px; font-size: 16px; }
.os-btn-icon:hover { color: #FF6B6B; }
.os-empty { color: #76746E; padding: 18px; text-align: center; font-style: italic; font-size: 12px; }

/* ===== MOM'S HOUSE ===== */
.os-mh {
  background:
    linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.03) 100%),
    linear-gradient(180deg, rgba(13,13,16,0.95), rgba(13,13,16,0.85));
  border: 1px solid rgba(212,175,55,0.28);
  border-radius: 16px; padding: 20px; margin: 12px 0; position: relative; overflow: hidden;
}
.os-mh::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, #d4af37, transparent); opacity: 0.6; }
.os-mh-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; color: #d4af37; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; }
.os-mh-eyebrow::before { content: ''; width: 22px; height: 1px; background: #d4af37; }
.os-mh-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #FAFAFA; margin-bottom: 4px; }
.os-mh-deadline { font-size: 11px; color: #76746E; letter-spacing: 0.04em; margin-bottom: 16px; }
.os-mh-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(20,20,26,0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; margin-bottom: 10px; }
.os-mh-row label { font-size: 11px; color: #76746E; text-transform: uppercase; letter-spacing: 0.1em; }
.os-mh-row input { width: 140px; background: transparent; border: none; color: #FAFAFA; text-align: right; font-size: 18px; font-weight: 700; outline: none; font-family: inherit; font-variant-numeric: tabular-nums; }
.os-mh-bar { height: 12px; background: rgba(20,20,26,0.8); border-radius: 6px; overflow: hidden; margin: 14px 0 12px; border: 1px solid rgba(255,255,255,0.06); }
.os-mh-fill { height: 100%; background: linear-gradient(90deg, #b8941f, #e6c068); border-radius: 6px; box-shadow: 0 0 16px rgba(212,175,55,0.5); transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
.os-mh-stats { display: flex; justify-content: space-between; font-size: 13px; font-variant-numeric: tabular-nums; flex-wrap: wrap; gap: 8px; }
.os-mh-stat-label { font-size: 9px; color: #76746E; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 2px; }
.os-mh-stat-value { color: #FAFAFA; font-weight: 600; }
.os-mh-stat-value.pct { color: #e6c068; font-weight: 800; font-size: 18px; }
.os-mh-add { display: flex; gap: 8px; margin-top: 14px; }
.os-mh-add input { flex: 1; background: rgba(20,20,26,0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; color: #FAFAFA; padding: 8px 12px; font-size: 14px; outline: none; font-family: inherit; }
.os-mh-add input:focus { border-color: #d4af37; }
.os-mh-log { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); max-height: 130px; overflow-y: auto; }
.os-mh-log-item { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; color: #76746E; border-bottom: 1px dashed rgba(255,255,255,0.04); }
.os-mh-log-item:last-child { border-bottom: none; }
.os-mh-log-item .amt { color: #6BE3A4; font-weight: 700; font-variant-numeric: tabular-nums; }
.os-mh-zero-note { font-size: 12px; color: #76746E; font-style: italic; margin-top: 10px; padding: 10px; background: rgba(20,20,26,0.5); border-radius: 8px; }

/* ===== FITNESS GOALS ===== */
.os-fg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.os-fg-stat { background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; }
.os-fg-stat-label { font-size: 10px; color: #76746E; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; font-weight: 600; }
.os-fg-stat-val { font-size: 22px; font-weight: 700; color: #FAFAFA; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.os-fg-stat-target { font-size: 11px; color: #76746E; margin-top: 4px; }
.os-fg-stat-bar { height: 5px; background: rgba(20,20,26,0.8); border-radius: 3px; overflow: hidden; margin-top: 10px; }
.os-fg-stat-fill { height: 100%; background: linear-gradient(90deg, #b8941f, #e6c068); border-radius: 3px; transition: width 0.6s; box-shadow: 0 0 8px rgba(212,175,55,0.3); }
.os-fg-stat-fill.green { background: linear-gradient(90deg, #059669, #6BE3A4); box-shadow: 0 0 8px rgba(107,227,164,0.3); }
.os-fg-goals { margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
.os-fg-goals-title { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #76746E; margin-bottom: 8px; }
.os-fg-goal { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(20,20,26,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 4px; font-size: 13px; color: #B8B6B0; }
.os-fg-goal.done { color: #6BE3A4; background: rgba(107,227,164,0.06); border-color: rgba(107,227,164,0.25); }
.os-fg-goal.done .os-fg-goal-text { text-decoration: line-through; opacity: 0.7; }
.os-fg-goal-text { flex: 1; }
.os-fg-goal-deadline { font-size: 9px; color: #76746E; letter-spacing: 0.1em; text-transform: uppercase; }
.os-fg-targets { display: flex; gap: 6px; margin-top: 10px; }
.os-fg-target-input { background: rgba(20,20,26,0.7); border: 1px solid rgba(255,255,255,0.06); color: #FAFAFA; padding: 6px 10px; border-radius: 6px; font-size: 13px; font-family: inherit; outline: none; width: 80px; font-variant-numeric: tabular-nums; }
.os-fg-target-input:focus { border-color: #d4af37; }
.os-fg-target-label { font-size: 10px; color: #76746E; align-self: center; text-transform: uppercase; letter-spacing: 0.1em; }

/* ===== MEALS / RITUAL ===== */
.os-ritual-list { list-style: none; padding: 0; margin: 0; }
.os-ritual-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; cursor: pointer; user-select: none; transition: all 0.15s; font-size: 13px; }
.os-ritual-item:hover { background: rgba(20,20,26,0.5); }
.os-ritual-item.on { color: #6BE3A4; }
.os-ritual-item.on .os-ri-text { text-decoration: line-through; opacity: 0.7; }
.os-ri-time { color: #76746E; font-size: 11px; width: 44px; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.os-ri-count-pill { font-size: 11px; color: #76746E; font-variant-numeric: tabular-nums; }
.os-card.meals .os-card-head h2 { color: #d4a574; }
.os-card.meals { border-color: rgba(212,165,116,0.15); }
.os-card.meals .os-ritual-item input { accent-color: #d4a574; }

/* ===== QURAN ===== */
.os-qr-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; margin-bottom: 10px; }
.os-qr-row label { font-size: 11px; color: #76746E; text-transform: uppercase; letter-spacing: 0.1em; }
.os-qr-row input { width: 80px; background: transparent; border: none; color: #FAFAFA; text-align: right; font-size: 20px; font-weight: 700; outline: none; font-family: inherit; font-variant-numeric: tabular-nums; }
.os-qr-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.os-qr-stat { background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; text-align: center; }
.os-qr-stat-label { font-size: 9px; color: #76746E; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
.os-qr-stat-value { font-size: 20px; font-weight: 700; color: #e6c068; font-variant-numeric: tabular-nums; }
.os-card.quran .os-card-head h2 { color: #e6c068; }
.os-card.quran { border-color: rgba(230,192,104,0.15); }

/* ===== FAITH GOALS ===== */
.os-faith-list { list-style: none; padding: 0; margin: 0; }
.os-faith-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid #e6c068; border-radius: 8px; margin-bottom: 6px; }
.os-faith-text { flex: 1; font-size: 13px; color: #B8B6B0; }
.os-faith-progress { font-size: 12px; color: #e6c068; font-weight: 700; font-variant-numeric: tabular-nums; }
.os-card.faith .os-card-head h2 { color: #e6c068; }
.os-card.faith { border-color: rgba(230,192,104,0.15); }

/* ===== BURNOUT ===== */
.os-bw-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
.os-bw-metric { background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.os-bw-metric-top { display: flex; justify-content: space-between; align-items: center; }
.os-bw-metric label { font-size: 10px; color: #76746E; text-transform: uppercase; letter-spacing: 0.08em; }
.os-bw-metric input { width: 60px; background: transparent; border: none; color: #FAFAFA; text-align: right; font-size: 15px; font-weight: 600; outline: none; font-family: inherit; font-variant-numeric: tabular-nums; }
.os-bw-spark { height: 22px; color: #d4af37; opacity: 0.7; }
.os-bw-spark svg { display: block; width: 100%; height: 100%; }
.os-bw-since { font-size: 12px; color: #76746E; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); }
.os-bw-since strong { color: #d4af37; font-variant-numeric: tabular-nums; font-size: 15px; font-weight: 700; }

/* ===== BIG DOMINO ===== */
.os-bd {
  position: relative; overflow: hidden;
  background: linear-gradient(135deg, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0.02) 100%), rgba(13,13,16,0.85);
  border: 1px solid rgba(212,175,55,0.28); border-radius: 14px;
  padding: 18px 20px; margin: 12px 0;
}
.os-bd::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, #d4af37, transparent); opacity: 0.6; }
.os-bd-label { font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #d4af37; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
.os-bd-label::before { content: ''; width: 20px; height: 1px; background: #d4af37; }
.os-bd-input { width: 100%; background: transparent; border: none; color: #FAFAFA; font-size: 20px; font-weight: 500; line-height: 1.3; letter-spacing: -0.02em; outline: none; font-family: inherit; padding: 4px 0; }
.os-bd-input::placeholder { color: #5a5a5a; font-weight: 400; }
.os-bd-meta { margin-top: 8px; font-size: 11px; color: #76746E; font-style: italic; }

/* ===== DAILY CHECKS ===== */
.os-dc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.os-dc-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; cursor: pointer; user-select: none; transition: all 0.15s; font-size: 13px; }
.os-dc-row:hover { background: rgba(26,26,34,0.7); }
.os-dc-row.on { background: rgba(107,227,164,0.06); border-color: rgba(107,227,164,0.35); color: #6BE3A4; }
.os-dc-row span:first-of-type { flex: 1; }
.os-streak { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #d4af37; padding: 2px 6px; border-radius: 3px; background: rgba(212,175,55,0.10); border: 1px solid rgba(212,175,55,0.25); font-variant-numeric: tabular-nums; }
.os-streak.zero { opacity: 0; pointer-events: none; }

/* ===== NON-ZERO ===== */
.os-nz { background: rgba(20,20,26,0.5); border: 1px dashed rgba(242,192,99,0.3); border-radius: 10px; padding: 12px; margin-top: 12px; }
.os-nz-head { display: flex; justify-content: space-between; margin-bottom: 10px; }
.os-nz-title { font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #F2C063; }
.os-nz-count { font-size: 11px; color: #76746E; font-variant-numeric: tabular-nums; }
.os-nz-count strong { color: #6BE3A4; font-weight: 700; }
.os-nz-checks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.os-nz-checks .os-dc-row { font-size: 12px; padding: 8px 10px; }
.os-nz-foot { margin-top: 8px; font-size: 10px; color: #76746E; font-style: italic; }

.os-check { width: 18px; height: 18px; cursor: pointer; accent-color: #d4af37; }

@media (max-width: 600px) {
  .os-fg-grid, .os-bw-grid, .os-dc-grid, .os-nz-checks { grid-template-columns: 1fr; }
}
`;

  // -------- INJECT CSS ONCE --------
  function injectCss() {
    if (document.getElementById('os-state-css')) return;
    const style = document.createElement('style');
    style.id = 'os-state-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // -------- SECTION RENDERERS --------
  const sections = {};

  // ===== MOM'S HOUSE =====
  sections['moms-house'] = function (root) {
    const mh = state.momsHouse;
    const pct = mh.target > 0 ? Math.min(100, Math.round((mh.paid / mh.target) * 100)) : 0;
    const remaining = Math.max(0, (mh.target || 0) - (mh.paid || 0));
    root.className = 'os-mh os-card-host';
    root.innerHTML = `
      <div class="os-mh-eyebrow">Most important · most emotional</div>
      <div class="os-mh-title">Mom's House</div>
      <div class="os-mh-deadline">Pay off by Dec 31, 2026</div>

      <div class="os-mh-row"><label>Total target ($)</label><input type="number" data-mh="target" placeholder="0" /></div>
      <div class="os-mh-bar"><div class="os-mh-fill" style="width:${pct}%"></div></div>
      <div class="os-mh-stats">
        <div><span class="os-mh-stat-label">Paid</span><span class="os-mh-stat-value">${fmtMoney(mh.paid)}</span></div>
        <div><span class="os-mh-stat-label">Remaining</span><span class="os-mh-stat-value">${fmtMoney(remaining)}</span></div>
        <div><span class="os-mh-stat-label">Progress</span><span class="os-mh-stat-value pct">${pct}%</span></div>
      </div>
      <div class="os-mh-add">
        <input type="number" data-mh="amount" placeholder="Add contribution ($)" />
        <button class="os-btn" data-mh="add">+ Pay</button>
      </div>
      <div class="os-mh-log" id="osMhLog"></div>
      ${mh.target === 0 ? '<div class="os-mh-zero-note">Set your total payoff target above. The progress bar lights up once you have one.</div>' : ''}
    `;
    root.querySelector('[data-mh="target"]').value = mh.target || '';
    root.querySelector('[data-mh="target"]').addEventListener('input', e => {
      state.momsHouse.target = Number(e.target.value) || 0; save(); renderAll();
    });
    root.querySelector('[data-mh="add"]').addEventListener('click', () => {
      const amtEl = root.querySelector('[data-mh="amount"]');
      const amt = Number(amtEl.value);
      if (!amt || amt <= 0) return;
      state.momsHouse.paid = (state.momsHouse.paid || 0) + amt;
      state.momsHouse.contributions.push({ id: Date.now() + '', date: todayKey(), amount: amt });
      amtEl.value = '';
      save(); renderAll();
    });
    const log = root.querySelector('#osMhLog');
    (mh.contributions || []).slice().reverse().slice(0, 10).forEach(c => {
      const div = document.createElement('div');
      div.className = 'os-mh-log-item';
      div.innerHTML = `<span>${c.date}</span><span class="amt">+${fmtMoney(c.amount)}</span>`;
      log.appendChild(div);
    });
  };

  // ===== FITNESS GOALS =====
  sections['fitness-goals'] = function (root) {
    const fg = state.fitnessGoals;
    const weightNow = latestWeight();
    const weightTarget = fg.weightTarget || 70;
    const gymThis = gymThisWeek();
    const gymTarget = fg.gymWeeklyTarget || 4;
    const gymPct = Math.min(100, Math.round((gymThis / gymTarget) * 100));
    // Filter fitness/health-tagged yearly goals
    const fitnessYearly = (state.yearlyGoals || []).filter(g => g.cat === 'health' || /weigh|kg|gym|workout|fitness/i.test(g.text));
    // Weight progress: if weightNow < target, show progress from a baseline of ~60kg (assume start). Otherwise 100%.
    const weightStart = 60;
    const weightPct = weightNow > 0 ? Math.min(100, Math.round(((weightNow - weightStart) / (weightTarget - weightStart)) * 100)) : 0;

    root.className = 'os-card';
    root.dataset.section = 'fitness-goals';
    root.innerHTML = `
      <div class="os-card-head"><h2>Fitness Goals — 2026</h2><div class="os-card-sub">Pace · target · trajectory</div></div>
      <div class="os-fg-grid">
        <div class="os-fg-stat">
          <div class="os-fg-stat-label">Weight</div>
          <div class="os-fg-stat-val">${weightNow ? weightNow.toFixed(1) + 'kg' : '—'}</div>
          <div class="os-fg-stat-target">target ${weightTarget} kg by Dec 31</div>
          <div class="os-fg-stat-bar"><div class="os-fg-stat-fill ${weightPct >= 100 ? 'green' : ''}" style="width:${Math.max(0, weightPct)}%"></div></div>
        </div>
        <div class="os-fg-stat">
          <div class="os-fg-stat-label">Gym · this week</div>
          <div class="os-fg-stat-val">${gymThis} / ${gymTarget}</div>
          <div class="os-fg-stat-target">streak ${getStreak('gym')}d</div>
          <div class="os-fg-stat-bar"><div class="os-fg-stat-fill ${gymPct >= 100 ? 'green' : ''}" style="width:${gymPct}%"></div></div>
        </div>
      </div>
      <div class="os-fg-targets">
        <span class="os-fg-target-label">Edit · target weight</span>
        <input class="os-fg-target-input" type="number" data-fg="weightTarget" value="${weightTarget}" />
        <span class="os-fg-target-label">gym/wk</span>
        <input class="os-fg-target-input" type="number" data-fg="gymWeeklyTarget" value="${gymTarget}" />
      </div>
      <div class="os-fg-goals">
        <div class="os-fg-goals-title">2026 yearly fitness goals</div>
        ${fitnessYearly.map(g => `
          <div class="os-fg-goal ${g.done ? 'done' : ''}" data-goal-id="${g.id}">
            <input type="checkbox" class="os-check" ${g.done ? 'checked' : ''} />
            <span class="os-fg-goal-text">${escapeHtml(g.text)}</span>
            <span class="os-fg-goal-deadline">${escapeHtml(g.deadline)}</span>
          </div>
        `).join('')}
      </div>
    `;
    root.querySelector('[data-fg="weightTarget"]').addEventListener('input', e => {
      state.fitnessGoals.weightTarget = Number(e.target.value) || 70; save(); renderAll();
    });
    root.querySelector('[data-fg="gymWeeklyTarget"]').addEventListener('input', e => {
      state.fitnessGoals.gymWeeklyTarget = Number(e.target.value) || 4; save(); renderAll();
    });
    root.querySelectorAll('[data-goal-id]').forEach(el => {
      const id = el.dataset.goalId;
      el.querySelector('input').addEventListener('change', e => {
        const g = state.yearlyGoals.find(x => x.id === id);
        if (g) { g.done = e.target.checked; save(); renderAll(); }
      });
    });
  };

  // ===== MEALS =====
  const mealItems = [
    { key: 'breakfast', label: 'Breakfast', time: '10:45' },
    { key: 'amSnack1',  label: 'AM Snack 1', time: '12:15' },
    { key: 'lunch',     label: 'Lunch',      time: '12:30' },
    { key: 'amSnack2',  label: 'AM Snack 2', time: '14:30' },
    { key: 'pmSnack1',  label: 'PM Snack 1', time: '16:30' },
    { key: 'pmSnack2',  label: 'PM Snack 2', time: '17:30' },
    { key: 'dinner',    label: 'Dinner',     time: '19:10' }
  ];
  sections['meals'] = function (root) {
    const k = todayKey();
    const data = state.meals[k] || {};
    const done = mealItems.filter(m => data[m.key]).length;
    root.className = 'os-card meals';
    root.dataset.section = 'meals';
    root.innerHTML = `
      <div class="os-card-head"><h2>Meals Today</h2><div class="os-ri-count-pill">${done} / ${mealItems.length}</div></div>
      <ul class="os-ritual-list">
        ${mealItems.map(m => `
          <li class="os-ritual-item ${data[m.key] ? 'on' : ''}" data-meal="${m.key}">
            <input type="checkbox" class="os-check" ${data[m.key] ? 'checked' : ''} />
            <span class="os-ri-time">${m.time}</span>
            <span class="os-ri-text">${m.label}</span>
          </li>
        `).join('')}
      </ul>
      <div class="os-bw-since" style="margin-top:10px;">7 meals = your gaining pace (+0.25–0.5 kg/wk)</div>
    `;
    root.querySelectorAll('[data-meal]').forEach(li => {
      li.querySelector('input').addEventListener('change', e => {
        const k = todayKey();
        if (!state.meals[k]) state.meals[k] = {};
        state.meals[k][li.dataset.meal] = e.target.checked;
        save(); renderAll();
      });
    });
  };

  // ===== QURAN =====
  sections['quran'] = function (root) {
    const k = todayKey();
    const today = state.quran[k] || 0;
    const wk = isoWeek();
    let weekTotal = 0, monthTotal = 0;
    const m = monthKey();
    Object.entries(state.quran).forEach(([dk, pages]) => {
      try {
        if (isoWeekOf(new Date(dk + 'T12:00:00')) === wk) weekTotal += pages || 0;
        if (dk.startsWith(m + '-')) monthTotal += pages || 0;
      } catch (e) {}
    });
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const dk = dateKey(d);
      if ((state.quran[dk] || 0) > 0) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
    root.className = 'os-card quran';
    root.dataset.section = 'quran';
    root.innerHTML = `
      <div class="os-card-head"><h2>Quran</h2><div class="os-card-sub">Faith depth · beyond Fajr</div></div>
      <div class="os-qr-row"><label>Pages today</label><input type="number" data-qr="today" min="0" value="${today || ''}" placeholder="0" /></div>
      <div class="os-qr-stats">
        <div class="os-qr-stat"><div class="os-qr-stat-label">This week</div><div class="os-qr-stat-value">${weekTotal}</div></div>
        <div class="os-qr-stat"><div class="os-qr-stat-label">This month</div><div class="os-qr-stat-value">${monthTotal}</div></div>
        <div class="os-qr-stat"><div class="os-qr-stat-label">Streak (d)</div><div class="os-qr-stat-value">${streak}</div></div>
      </div>
    `;
    root.querySelector('[data-qr="today"]').addEventListener('input', e => {
      const v = Number(e.target.value);
      if (v && v > 0) state.quran[k] = v; else delete state.quran[k];
      save(); renderAll();
    });
  };

  // ===== FAITH GOALS =====
  sections['faith-goals'] = function (root) {
    const fajrStreak = getStreak('fajr');
    const fajrWeek = (function () {
      const w = isoWeek();
      let n = 0;
      Object.entries(state.dailyChecks).forEach(([dk, v]) => {
        if (v && v.fajr) {
          try { if (isoWeekOf(new Date(dk + 'T12:00:00')) === w) n++; } catch (e) {}
        }
      });
      return n;
    })();
    const fajrTarget = state.faithGoals.fajrWeeklyTarget || 7;
    const faithYearly = (state.yearlyGoals || []).filter(g => g.cat === 'faith');
    root.className = 'os-card faith';
    root.dataset.section = 'faith-goals';
    root.innerHTML = `
      <div class="os-card-head"><h2>Faith</h2><div class="os-card-sub">On-time · daily discipline</div></div>
      <ul class="os-faith-list">
        <li class="os-faith-item"><span class="os-faith-text">Fajr on time — this week</span><span class="os-faith-progress">${fajrWeek}/${fajrTarget}</span></li>
        <li class="os-faith-item"><span class="os-faith-text">Fajr streak</span><span class="os-faith-progress">${fajrStreak}d</span></li>
        ${faithYearly.map(g => `
          <li class="os-faith-item" data-goal-id="${g.id}" style="${g.done ? 'opacity:0.55;' : ''}">
            <input type="checkbox" class="os-check" ${g.done ? 'checked' : ''} />
            <span class="os-faith-text">${escapeHtml(g.text)}</span>
            <span class="os-faith-progress">${escapeHtml(g.deadline)}</span>
          </li>
        `).join('')}
      </ul>
    `;
    root.querySelectorAll('[data-goal-id]').forEach(el => {
      const id = el.dataset.goalId;
      el.querySelector('input').addEventListener('change', e => {
        const g = state.yearlyGoals.find(x => x.id === id);
        if (g) { g.done = e.target.checked; save(); renderAll(); }
      });
    });
  };

  // ===== BURNOUT =====
  function get7DayValues(metric) {
    const vals = [];
    const ref = new Date();
    for (let i = 6; i >= 0; i--) {
      const day = new Date(ref); day.setDate(ref.getDate() - i);
      const v = state.burnout[dateKey(day)]?.[metric];
      vals.push(typeof v === 'number' ? v : null);
    }
    return vals;
  }
  function renderSparkline(container, values, max) {
    const w = 100, h = 22, pad = 2;
    const step = (w - pad * 2) / (values.length - 1);
    let path = '', started = false;
    values.forEach((v, i) => {
      if (v === null) return;
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      path += (started ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
      started = true;
    });
    const dots = values.map((v, i) => {
      if (v === null) return '';
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="currentColor" />`;
    }).join('');
    if (!started) { container.innerHTML = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><text x="${w/2}" y="${h/2+3}" text-anchor="middle" fill="currentColor" font-size="9" opacity="0.5">no data</text></svg>`; return; }
    container.innerHTML = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />${dots}</svg>`;
  }
  sections['burnout'] = function (root) {
    const k = todayKey();
    const data = state.burnout[k] || {};
    let daysSince = '∞';
    if (state.recoveryDays.length) {
      const last = new Date(state.recoveryDays[state.recoveryDays.length - 1] + 'T00:00:00');
      const today = new Date(todayKey() + 'T00:00:00');
      daysSince = Math.max(0, Math.floor((today - last) / 86400000));
    }
    root.className = 'os-card';
    root.dataset.section = 'burnout';
    root.innerHTML = `
      <div class="os-card-head"><h2>Burnout Watch</h2><div class="os-card-sub">Early warning · daily 1–5</div></div>
      <div class="os-bw-grid">
        ${[
          ['energy','Energy',5],['focus','Focus',5],['irritability','Irritability',5],['screen','Screen (hr)',12]
        ].map(([key, label, max]) => `
          <div class="os-bw-metric">
            <div class="os-bw-metric-top">
              <label>${label}</label>
              <input type="number" min="${key==='screen'?'0':'1'}" max="${key==='screen'?'24':'5'}" step="${key==='screen'?'0.5':'1'}" data-bw="${key}" value="${data[key] ?? ''}" />
            </div>
            <div class="os-bw-spark" data-spark="${key}" data-max="${max}"></div>
          </div>
        `).join('')}
      </div>
      <button class="os-btn" data-bw-recovery>+ Mark recovery day</button>
      <div class="os-bw-since">Days since recovery: <strong>${daysSince}</strong></div>
    `;
    root.querySelectorAll('[data-bw]').forEach(inp => {
      inp.addEventListener('input', e => {
        const k = todayKey();
        if (!state.burnout[k]) state.burnout[k] = {};
        state.burnout[k][inp.dataset.bw] = e.target.value === '' ? null : Number(e.target.value);
        save();
        // Sparkline only — no full re-render to avoid losing focus
        const sparkEl = root.querySelector(`[data-spark="${inp.dataset.bw}"]`);
        if (sparkEl) renderSparkline(sparkEl, get7DayValues(inp.dataset.bw), Number(sparkEl.dataset.max));
      });
    });
    root.querySelector('[data-bw-recovery]').addEventListener('click', () => {
      const k = todayKey();
      if (!state.recoveryDays.includes(k)) { state.recoveryDays.push(k); state.recoveryDays.sort(); save(); renderAll(); }
    });
    // Initial sparklines
    root.querySelectorAll('[data-spark]').forEach(el => {
      renderSparkline(el, get7DayValues(el.dataset.spark), Number(el.dataset.max));
    });
  };

  // ===== BIG DOMINO =====
  sections['big-domino'] = function (root) {
    const k = todayKey();
    root.className = 'os-bd';
    root.dataset.section = 'big-domino';
    root.innerHTML = `
      <div class="os-bd-label">Today's One Big Domino</div>
      <input type="text" class="os-bd-input" data-bd value="${escapeHtml(state.bigDomino[k] || '')}" placeholder="If only one thing gets done today…" autocomplete="off" />
      <div class="os-bd-meta">The task that, if done, makes today a win — even if nothing else happens.</div>
    `;
    root.querySelector('[data-bd]').addEventListener('input', e => {
      state.bigDomino[todayKey()] = e.target.value; save();
    });
  };

  // ===== DAILY CHECKS =====
  const dailyCheckItems = [
    { key: 'fajr', label: 'Fajr on time' },
    { key: 'gym', label: 'Gym' },
    { key: 'zipcodes', label: 'Zip codes' },
    { key: 'aileads', label: 'AI leads' },
    { key: 'loop', label: 'Open loop' },
    { key: 'win', label: 'Deliberate win' }
  ];
  sections['daily-checks'] = function (root) {
    const k = todayKey();
    const checks = state.dailyChecks[k] || {};
    root.className = 'os-card';
    root.dataset.section = 'daily-checks';
    root.innerHTML = `
      <div class="os-card-head"><h2>Daily Checks</h2><div class="os-card-sub">Streaks build identity</div></div>
      <div class="os-dc-grid">
        ${dailyCheckItems.map(it => {
          const on = !!checks[it.key];
          const streak = getStreak(it.key);
          return `
            <label class="os-dc-row ${on ? 'on' : ''}" data-dc="${it.key}">
              <input type="checkbox" class="os-check" ${on ? 'checked' : ''} />
              <span>${it.label}</span>
              <span class="os-streak ${streak === 0 ? 'zero' : ''}">${streak ? streak + 'd' : ''}</span>
            </label>
          `;
        }).join('')}
      </div>
    `;
    root.querySelectorAll('[data-dc]').forEach(row => {
      row.querySelector('input').addEventListener('change', e => {
        const k = todayKey();
        if (!state.dailyChecks[k]) state.dailyChecks[k] = {};
        state.dailyChecks[k][row.dataset.dc] = e.target.checked;
        save(); renderAll();
      });
    });
  };

  // ===== NON-ZERO =====
  const nzItems = [
    { key: 'pray', label: 'Pray' },
    { key: 'business', label: '1 business action' },
    { key: 'meal', label: '1 meal / protein' },
    { key: 'loop', label: '1 open loop closed' },
    { key: 'plan', label: 'Plan tomorrow' }
  ];
  sections['non-zero'] = function (root) {
    const k = todayKey();
    const data = state.nonZero[k] || {};
    const count = nzItems.filter(it => data[it.key]).length;
    root.className = 'os-nz';
    root.dataset.section = 'non-zero';
    root.innerHTML = `
      <div class="os-nz-head">
        <span class="os-nz-title">Non-Zero Day · bad-day fallback</span>
        <span class="os-nz-count"><strong>${count}</strong> / 5</span>
      </div>
      <div class="os-nz-checks">
        ${nzItems.map(it => `
          <label class="os-dc-row ${data[it.key] ? 'on' : ''}" data-nz="${it.key}">
            <input type="checkbox" class="os-check" ${data[it.key] ? 'checked' : ''} />
            <span>${it.label}</span>
          </label>
        `).join('')}
      </div>
      <div class="os-nz-foot">5/5 = today still counts. Bare minimum is never zero.</div>
    `;
    root.querySelectorAll('[data-nz]').forEach(row => {
      row.querySelector('input').addEventListener('change', e => {
        const k = todayKey();
        if (!state.nonZero[k]) state.nonZero[k] = {};
        state.nonZero[k][row.dataset.nz] = e.target.checked;
        save(); renderAll();
      });
    });
  };

  // -------- PUBLIC API --------
  const tracked = new Map(); // containerEl -> sectionName
  function renderInto(name, containerOrId) {
    const el = (typeof containerOrId === 'string')
      ? document.getElementById(containerOrId) || document.querySelector(containerOrId)
      : containerOrId;
    if (!el) return;
    const fn = sections[name];
    if (!fn) { el.innerHTML = `<div class="os-empty">Unknown section: ${escapeHtml(name)}</div>`; return; }
    tracked.set(el, name);
    fn(el);
  }
  function renderAll() {
    tracked.forEach((name, el) => { try { sections[name](el); } catch (e) {} });
  }
  function refreshFromStorage() { state = load(); renderAll(); }

  window.OSAddons = {
    render: renderInto,
    refresh: renderAll,
    state: () => state,
    save: save,
    refreshFromStorage: refreshFromStorage
  };

  // -------- AUTO-INIT --------
  function boot() {
    injectCss();
    // Find all [data-os-section] containers and render them
    document.querySelectorAll('[data-os-section]').forEach(el => {
      const name = el.dataset.osSection;
      if (name) renderInto(name, el);
    });
    // Init cloud sync via existing sync.js
    function tryInitSync() {
      if (!window.initCloudSync) return false;
      window.initCloudSync({
        appKey: APP_KEY,
        syncedKeys: [KEY],
        onApplied: () => { state = load(); renderAll(); }
      });
      return true;
    }
    if (!tryInitSync()) {
      window.addEventListener('load', () => { tryInitSync(); });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
