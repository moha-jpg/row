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

/* ===== PRIORITIES (three / week) ===== */
.os-prio { display: flex; flex-direction: column; }
.os-prio-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.os-prio-row:last-child { border-bottom: none; }
.os-prio-row.done .os-prio-num { background: rgba(107,227,164,0.12); border-color: #6BE3A4; color: #6BE3A4; }
.os-prio-num { width: 22px; height: 22px; border-radius: 50%; background: #14141a; border: 1px solid rgba(255,255,255,0.10); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #76746E; flex-shrink: 0; }
.os-prio-text { flex: 1; background: transparent; border: none; color: #FAFAFA; font-size: 16px; outline: none; font-family: inherit; padding: 4px 0; }
.os-prio-text::placeholder { color: #76746E; }
.os-prio-row.done .os-prio-text { text-decoration: line-through; color: #76746E; }

/* ===== GOALS BY CATEGORY ===== */
.os-gbc { display: flex; flex-direction: column; gap: 18px; }
.os-gbc-section { padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
.os-gbc-section:first-child { padding-top: 0; border-top: none; }
.os-gbc-head { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid; }
.os-gbc-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.os-gbc-list { list-style: none; padding: 0; margin: 0; }
.os-gbc-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(20,20,26,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 4px; font-size: 13px; color: #B8B6B0; }
.os-gbc-item.done { color: #6BE3A4; background: rgba(107,227,164,0.06); border-color: rgba(107,227,164,0.25); }
.os-gbc-item.done .os-gbc-text { text-decoration: line-through; opacity: 0.7; }
.os-gbc-text { flex: 1; }
.os-gbc-dl { font-size: 9px; color: #76746E; letter-spacing: 0.1em; text-transform: uppercase; }

/* ===== MONTHLY TARGETS ===== */
.os-mg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.os-mg-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; }
.os-mg-row label { font-size: 11px; color: #76746E; text-transform: uppercase; letter-spacing: 0.08em; }
.os-mg-row input { width: 100px; background: transparent; border: none; color: #FAFAFA; text-align: right; font-size: 16px; font-weight: 600; outline: none; font-family: inherit; font-variant-numeric: tabular-nums; }

/* ===== WAR ROOM ===== */
.os-wr-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.os-wr-panel { background: rgba(20,20,26,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; min-height: 140px; }
.os-wr-panel.priorities { border-left: 3px solid #6BE3A4; }
.os-wr-panel.fires { border-left: 3px solid #FF6B6B; }
.os-wr-panel.opportunities { border-left: 3px solid #7DD3FC; }
.os-wr-panel.bottleneck { border-left: 3px solid #d4af37; background: linear-gradient(135deg, rgba(212,175,55,0.08), rgba(20,20,26,0.6)); }
.os-wr-label { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 8px; }
.os-wr-count { color: #76746E; font-weight: 600; font-size: 9px; margin-left: 6px; }
.os-wr-panel.priorities .os-wr-label { color: #6BE3A4; }
.os-wr-panel.fires .os-wr-label { color: #FF6B6B; }
.os-wr-panel.opportunities .os-wr-label { color: #7DD3FC; }
.os-wr-panel.bottleneck .os-wr-label { color: #d4af37; }
.os-wr-list { list-style: none; margin: 0 0 6px 0; padding: 0; flex: 1; }
.os-wr-li { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #B8B6B0; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.04); }
.os-wr-li:last-child { border-bottom: none; }
.os-wr-li span { flex: 1; line-height: 1.4; }
.os-wr-li button { background: transparent; border: none; color: #76746E; cursor: pointer; font-size: 13px; padding: 0 4px; }
.os-wr-li button:hover { color: #FF6B6B; }
.os-wr-add { width: 100%; background: rgba(5,5,6,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; color: #FAFAFA; padding: 6px 10px; font-size: 12px; font-family: inherit; outline: none; }
.os-wr-add:focus { border-color: #d4af37; }
.os-wr-add:disabled { background: rgba(20,20,26,0.4); color: #76746E; border-style: dashed; cursor: not-allowed; }
.os-wr-bottleneck { width: 100%; background: transparent; border: none; color: #e6c068; padding: 4px 0; font-size: 14px; font-weight: 600; font-family: inherit; outline: none; resize: none; flex: 1; min-height: 60px; }
.os-wr-bottleneck::placeholder { color: #76746E; font-weight: 400; }
@media (max-width: 700px) { .os-wr-grid { grid-template-columns: 1fr; } }

/* ===== LEVELS ===== */
.os-lv-current { display: flex; align-items: baseline; gap: 14px; margin-bottom: 8px; flex-wrap: wrap; }
.os-lv-badge { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; color: #d4af37; background: rgba(212,175,55,0.10); border: 1px solid rgba(212,175,55,0.28); padding: 4px 9px; border-radius: 4px; }
.os-lv-name { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #FAFAFA; }
.os-lv-bar { display: flex; gap: 5px; margin: 12px 0 16px; }
.os-lv-seg { flex: 1; height: 7px; background: #14141a; border-radius: 3px; }
.os-lv-seg.done { background: linear-gradient(90deg, #b8941f, #e6c068); box-shadow: 0 0 10px rgba(212,175,55,0.4); }
.os-lv-seg.current { background: rgba(212,175,55,0.10); border: 1px solid #d4af37; }
.os-lv-title { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #76746E; margin-bottom: 8px; }
.os-lv-list { list-style: none; padding: 0; margin: 0; }
.os-lv-list li { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(20,20,26,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; margin-bottom: 4px; font-size: 13px; color: #B8B6B0; }
.os-lv-list li.done { color: #6BE3A4; background: rgba(107,227,164,0.06); border-color: rgba(107,227,164,0.3); }
.os-lv-list li.done span:not(.os-check) { text-decoration: line-through; opacity: 0.7; }
.os-lv-advance { margin-top: 12px; padding: 12px; background: rgba(212,175,55,0.10); border: 1px solid #d4af37; border-radius: 10px; font-size: 13px; color: #e6c068; text-align: center; }
.os-lv-advance button { background: #d4af37; border: none; color: #050506; padding: 7px 14px; border-radius: 6px; cursor: pointer; font-weight: 700; font-family: inherit; margin-top: 6px; }
.os-lv-next { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #76746E; margin-top: 16px; margin-bottom: 8px; }
.os-lv-next strong { color: #d4af37; }
.os-lv-next-list { list-style: none; padding: 0; margin: 0; }
.os-lv-next-list li { color: #76746E; opacity: 0.6; padding: 4px 12px; font-size: 12px; }
.os-lv-next-list li::before { content: '○ '; margin-right: 4px; }

/* ===== WEEKLY SCORE ===== */
.os-ws-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.os-ws-cell { background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; text-align: center; }
.os-ws-cell label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.16em; color: #76746E; display: block; margin-bottom: 8px; font-weight: 600; }
.os-ws-input { display: flex; justify-content: center; align-items: baseline; gap: 4px; }
.os-ws-input input { width: 48px; background: transparent; border: none; color: #FAFAFA; text-align: center; font-size: 24px; font-weight: 700; outline: none; font-family: inherit; font-variant-numeric: tabular-nums; }
.os-ws-input span { font-size: 11px; color: #76746E; }
.os-ws-total { margin-top: 14px; padding: 10px 12px; background: rgba(20,20,26,0.6); border: 1px solid rgba(212,175,55,0.25); border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
.os-ws-total span:first-child { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #d4af37; font-weight: 600; }
.os-ws-total-v { font-size: 18px; font-weight: 700; color: #e6c068; font-variant-numeric: tabular-nums; }
.os-ws-q { margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
.os-ws-q label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #d4af37; margin-bottom: 8px; font-weight: 600; }
.os-ws-q textarea { width: 100%; min-height: 60px; background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; color: #FAFAFA; padding: 10px; font-size: 13px; font-family: inherit; resize: vertical; outline: none; }
.os-ws-q textarea:focus { border-color: #d4af37; }
@media (max-width: 600px) { .os-ws-grid { grid-template-columns: repeat(2, 1fr); } }

/* ===== WEEK NUMBERS ===== */
.os-wn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.os-wn-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; }
.os-wn-row label { font-size: 10px; color: #76746E; text-transform: uppercase; letter-spacing: 0.08em; }
.os-wn-row input { width: 100px; background: transparent; border: none; color: #FAFAFA; text-align: right; font-size: 16px; font-weight: 600; outline: none; font-family: inherit; font-variant-numeric: tabular-nums; }
@media (max-width: 600px) { .os-wn-grid, .os-mg-grid { grid-template-columns: 1fr; } }

/* ===== KPI DASHBOARD ===== */
.os-kpi-list { display: flex; flex-direction: column; }
.os-kpi-row { display: grid; grid-template-columns: 110px 1fr 130px; gap: 14px; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.os-kpi-row:last-child { border-bottom: none; }
.os-kpi-label { color: #76746E; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; }
.os-kpi-bar { height: 6px; background: #14141a; border-radius: 3px; overflow: hidden; }
.os-kpi-fill { height: 100%; background: linear-gradient(90deg, #b8941f, #e6c068); border-radius: 3px; box-shadow: 0 0 10px rgba(212,175,55,0.3); transition: width 0.6s; }
.os-kpi-fill.green { background: linear-gradient(90deg, #059669, #6BE3A4); }
.os-kpi-fill.red { background: linear-gradient(90deg, #b91c1c, #FF6B6B); }
.os-kpi-val { text-align: right; font-variant-numeric: tabular-nums; font-size: 13px; color: #B8B6B0; font-weight: 500; }
.os-kpi-pct { color: #d4af37; margin-left: 6px; font-size: 11px; font-weight: 700; }
.os-kpi-delta { font-size: 10px; color: #76746E; margin-top: 4px; grid-column: 2 / -1; font-variant-numeric: tabular-nums; }
.os-kpi-delta.up { color: #6BE3A4; }
.os-kpi-delta.down { color: #FF6B6B; }
@media (max-width: 600px) {
  .os-kpi-row { grid-template-columns: 90px 1fr; }
  .os-kpi-row .os-kpi-val { grid-column: 1 / -1; text-align: left; }
}

/* ===== DECISION LOG / DELEGATION (table) ===== */
.os-dl-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.os-dl-table thead th { padding: 6px 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.10); font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #76746E; }
.os-dl-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.os-dl-table tr:last-child td { border-bottom: none; }
.os-dl-table td input, .os-dl-table td select, .os-dl-table td textarea { width: 100%; background: transparent; border: none; color: #FAFAFA; font-size: 12px; font-family: inherit; outline: none; resize: vertical; min-height: 22px; }
.os-dl-table td input[type=date] { color: #76746E; font-variant-numeric: tabular-nums; }
.os-dl-table td select { text-transform: capitalize; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%2376746E' d='M5 7L1 3h8z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 4px center; padding-right: 16px; font-weight: 600; }
.os-dl-table td select option { background: #0d0d10; }
.os-dl-table td select[data-status="pending"] { color: #F2C063; }
.os-dl-table td select[data-status="executed"] { color: #6BE3A4; }
.os-dl-table td select[data-status="reviewed"] { color: #7DD3FC; }
.os-dl-table td select[data-status="failed"] { color: #FF6B6B; }
.os-dl-table td select[data-status="you-only"] { color: #FF6B6B; }
.os-dl-table td select[data-status="partial"] { color: #F2C063; }
.os-dl-table td select[data-status="fully-delegated"] { color: #7DD3FC; }
.os-dl-table td select[data-status="sopd"] { color: #6BE3A4; }
.os-dl-table td select[data-status="lead"] { color: #F2C063; }
.os-dl-table td select[data-status="talking"] { color: #7DD3FC; }
.os-dl-table td select[data-status="signed"] { color: #22d3ee; }
.os-dl-table td select[data-status="onboarding"] { color: #fb923c; }
.os-dl-table td select[data-status="live"] { color: #6BE3A4; }
.os-dl-table td select[data-status="paused"] { color: #76746E; }
.os-dl-table td select[data-status="churned"] { color: #FF6B6B; }

/* ===== SYSTEM HEALTH ===== */
.os-sh-list { list-style: none; margin: 0 0 10px 0; padding: 0; min-height: 50px; }
.os-sh-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid #76746E; border-radius: 6px; margin-bottom: 6px; }
.os-sh-item.breaking { border-left-color: #FF6B6B; }
.os-sh-item.risky { border-left-color: #F2C063; }
.os-sh-item.fixed { border-left-color: #6BE3A4; opacity: 0.5; }
.os-sh-item.fixed .os-sh-text { text-decoration: line-through; }
.os-sh-text { flex: 1; font-size: 13px; color: #B8B6B0; }
.os-sh-item select { background: #0d0d10; border: 1px solid rgba(255,255,255,0.06); color: #FAFAFA; border-radius: 4px; padding: 3px 6px; font-size: 11px; font-family: inherit; text-transform: capitalize; cursor: pointer; }
.os-sh-add { display: flex; gap: 8px; }
.os-sh-add input { flex: 1; background: #14141a; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; color: #FAFAFA; padding: 9px 12px; font-size: 13px; outline: none; font-family: inherit; }
.os-sh-add input:focus { border-color: #d4af37; }

/* ===== HEATMAP ===== */
.os-heat-grid { display: grid; grid-template-columns: repeat(15, 1fr); gap: 3px; margin-top: 6px; }
.os-heat-cell { aspect-ratio: 1; background: #14141a; border: 1px solid rgba(255,255,255,0.06); border-radius: 3px; min-width: 12px; transition: transform 0.1s; }
.os-heat-cell:hover { transform: scale(1.3); border-color: #d4af37; }
.os-heat-cell.l1 { background: rgba(212,175,55,0.15); border-color: rgba(212,175,55,0.2); }
.os-heat-cell.l2 { background: rgba(212,175,55,0.30); border-color: rgba(212,175,55,0.35); }
.os-heat-cell.l3 { background: rgba(212,175,55,0.55); }
.os-heat-cell.l4 { background: linear-gradient(135deg, #b8941f, #e6c068); box-shadow: 0 0 6px rgba(212,175,55,0.3); }
.os-heat-cell.today { outline: 2px solid #d4af37; }
.os-heat-legend { display: flex; gap: 4px; justify-content: flex-end; align-items: center; margin-top: 10px; font-size: 10px; color: #76746E; letter-spacing: 0.08em; text-transform: uppercase; }
.os-heat-chip { width: 11px; height: 11px; border-radius: 2px; border: 1px solid rgba(255,255,255,0.06); }
@media (max-width: 600px) { .os-heat-grid { grid-template-columns: repeat(10, 1fr); } }

/* ===== CAPTURE / LOOPS ===== */
.os-cap-bar { display: flex; gap: 8px; margin-bottom: 10px; align-items: stretch; flex-wrap: wrap; }
.os-cap-bar input[type=text], .os-cap-bar textarea { flex: 1; min-width: 120px; background: #14141a; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; color: #FAFAFA; padding: 9px 12px; font-size: 14px; font-family: inherit; outline: none; resize: none; }
.os-cap-bar input:focus, .os-cap-bar textarea:focus { border-color: #d4af37; }
.os-tag-sel { background: #14141a; border: 1px solid rgba(255,255,255,0.06); color: #FAFAFA; padding: 7px 10px; border-radius: 8px; font-size: 12px; font-family: inherit; cursor: pointer; outline: none; }
.os-tag-sel:focus { border-color: #d4af37; }
.os-list-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; margin-bottom: 5px; }
.os-list-item.done { opacity: 0.4; }
.os-list-item.done .os-list-text { text-decoration: line-through; }
.os-list-ts { font-size: 10px; color: #76746E; margin-top: 4px; }
.os-tag-pill { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-right: 6px; vertical-align: middle; }
.os-tag-pill.sms { background: rgba(125,211,252,0.14); color: #7DD3FC; }
.os-tag-pill.pricing { background: rgba(107,227,164,0.14); color: #6BE3A4; }
.os-tag-pill.ai { background: rgba(183,148,244,0.14); color: #b794f4; }
.os-tag-pill.growth { background: rgba(212,175,55,0.14); color: #d4af37; }
.os-tag-pill.competitor { background: rgba(255,107,107,0.14); color: #FF6B6B; }
.os-tag-pill.lesson { background: rgba(242,192,99,0.14); color: #F2C063; }
.os-tag-pill.personal { background: rgba(212,165,116,0.14); color: #d4a574; }
.os-tag-pill.untagged { background: #14141a; color: #76746E; }

/* ===== JOURNAL ===== */
.os-jr-prompt { font-size: 12px; color: #d4af37; font-style: italic; margin-bottom: 10px; }
.os-jr-area { width: 100%; min-height: 120px; background: rgba(20,20,26,0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; color: #FAFAFA; padding: 12px; font-size: 14px; font-family: inherit; line-height: 1.6; outline: none; resize: vertical; }
.os-jr-area:focus { border-color: #d4af37; }

/* ===== RITUAL VARIANTS (reset, shutdown) ===== */
.os-card.reset .os-card-head h2 { color: #7DD3FC; }
.os-card.reset { border-color: rgba(125,211,252,0.15); }
.os-card.reset .os-ritual-item input { accent-color: #7DD3FC; }
.os-card.shutdown .os-card-head h2 { color: #b794f4; }
.os-card.shutdown { border-color: rgba(183,148,244,0.15); }
.os-card.shutdown .os-ritual-item input { accent-color: #b794f4; }
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

  // ===== THREE PRIORITIES =====
  sections['three-priorities'] = function (root) {
    const k = todayKey();
    const p = state.priorities[k] || { texts: ['','',''], done: [false,false,false] };
    root.className = 'os-card';
    root.dataset.section = 'three-priorities';
    root.innerHTML = `
      <div class="os-card-head"><h2>Three Priorities</h2><div class="os-card-sub">Lock these before noon</div></div>
      <div class="os-prio">
        ${[0,1,2].map(i => `
          <div class="os-prio-row ${p.done[i] ? 'done' : ''}" data-prio="${i}">
            <span class="os-prio-num">${i+1}</span>
            <input type="text" class="os-prio-text" placeholder="Priority ${i+1}" value="${escapeHtml(p.texts[i]||'')}" />
            <input type="checkbox" class="os-check os-prio-check" ${p.done[i] ? 'checked' : ''} />
          </div>
        `).join('')}
      </div>
    `;
    root.querySelectorAll('[data-prio]').forEach(row => {
      const i = +row.dataset.prio;
      row.querySelector('.os-prio-text').addEventListener('input', e => {
        if (!state.priorities[k]) state.priorities[k] = { texts: ['','',''], done: [false,false,false] };
        state.priorities[k].texts[i] = e.target.value; save();
      });
      row.querySelector('.os-prio-check').addEventListener('change', e => {
        if (!state.priorities[k]) state.priorities[k] = { texts: ['','',''], done: [false,false,false] };
        state.priorities[k].done[i] = e.target.checked;
        row.classList.toggle('done', e.target.checked); save();
      });
    });
  };

  // ===== WEEK PRIORITIES (for Goals page) =====
  sections['week-priorities'] = function (root) {
    const w = isoWeek();
    const p = state.weekPriorities && state.weekPriorities[w] ? state.weekPriorities[w] : ['','',''];
    if (!state.weekPriorities) state.weekPriorities = {};
    root.className = 'os-card';
    root.dataset.section = 'week-priorities';
    root.innerHTML = `
      <div class="os-card-head"><h2>This Week — 3 Priorities</h2><div class="os-card-sub">Set Sunday CEO meeting</div></div>
      <div class="os-prio">
        ${[0,1,2].map(i => `
          <div class="os-prio-row" data-wp="${i}">
            <span class="os-prio-num">${i+1}</span>
            <input type="text" class="os-prio-text" placeholder="Week priority ${i+1}" value="${escapeHtml(p[i]||'')}" />
          </div>
        `).join('')}
      </div>
    `;
    root.querySelectorAll('[data-wp]').forEach(row => {
      const i = +row.dataset.wp;
      row.querySelector('.os-prio-text').addEventListener('input', e => {
        if (!state.weekPriorities[w]) state.weekPriorities[w] = ['','',''];
        state.weekPriorities[w][i] = e.target.value; save();
      });
    });
  };

  // ===== GOALS BY CATEGORY =====
  sections['goals-by-category'] = function (root) {
    const cats = [
      { id: 'faith', label: 'Faith', color: '#e6c068' },
      { id: 'family', label: 'Family', color: '#7DD3FC' },
      { id: 'health', label: 'Fitness · Health', color: '#6BE3A4' },
      { id: 'biz', label: 'Finance · Business', color: '#d4af37' },
      { id: 'life', label: 'Life', color: '#b794f4' }
    ];
    root.className = 'os-card';
    root.dataset.section = 'goals-by-category';
    root.innerHTML = `
      <div class="os-card-head"><h2>2026 Goals — by category</h2><div class="os-card-sub">Yearly direction · check off as you clear</div></div>
      <div class="os-gbc">
        ${cats.map(cat => {
          const goals = (state.yearlyGoals || []).filter(g => g.cat === cat.id);
          if (!goals.length) return '';
          return `
            <div class="os-gbc-section">
              <div class="os-gbc-head" style="color:${cat.color};border-color:${cat.color}33;"><span class="os-gbc-dot" style="background:${cat.color};box-shadow:0 0 8px ${cat.color};"></span>${cat.label}</div>
              <ul class="os-gbc-list">
                ${goals.map(g => `
                  <li class="os-gbc-item ${g.done ? 'done' : ''}" data-gid="${g.id}">
                    <input type="checkbox" class="os-check" ${g.done ? 'checked' : ''} />
                    <span class="os-gbc-text">${escapeHtml(g.text)}</span>
                    <span class="os-gbc-dl">${escapeHtml(g.deadline)}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          `;
        }).join('')}
      </div>
    `;
    root.querySelectorAll('[data-gid]').forEach(el => {
      const id = el.dataset.gid;
      el.querySelector('input').addEventListener('change', e => {
        const g = state.yearlyGoals.find(x => x.id === id);
        if (g) { g.done = e.target.checked; save(); renderAll(); }
      });
    });
  };

  // ===== MONTHLY GOALS (current month targets) =====
  sections['monthly-goals'] = function (root) {
    const m = monthKey();
    const targets = state.monthlyTargets[m] || state.monthlyTargets['2026-05'] || {};
    root.className = 'os-card';
    root.dataset.section = 'monthly-goals';
    root.innerHTML = `
      <div class="os-card-head"><h2>This Month — Targets</h2><div class="os-card-sub">${m} · edit to update</div></div>
      <div class="os-mg-grid">
        ${[
          ['revenue','Revenue ($)','number',0],
          ['clients','New clients','number',0],
          ['onboarded','Onboarded','number',0],
          ['gym','Gym sessions','number',0],
          ['sleep','Sleep avg (hr)','number',0.5],
          ['weight','Weight (kg)','number',0.1]
        ].map(([k, l, t, st]) => `
          <div class="os-mg-row">
            <label>${l}</label>
            <input type="${t}" ${st ? 'step="'+st+'"' : ''} data-mg="${k}" value="${targets[k] || ''}" placeholder="0" />
          </div>
        `).join('')}
      </div>
    `;
    root.querySelectorAll('[data-mg]').forEach(inp => {
      inp.addEventListener('input', e => {
        if (!state.monthlyTargets[m]) state.monthlyTargets[m] = {};
        state.monthlyTargets[m][inp.dataset.mg] = Number(e.target.value) || 0;
        save();
      });
    });
  };

  // ===== WAR ROOM =====
  const WR_LISTS = ['priorities','fires','opportunities'];
  const WR_MAX = 3;
  const WR_SINGULAR = { priorities: 'priority', fires: 'fire', opportunities: 'opportunity' };
  sections['war-room'] = function (root) {
    root.className = 'os-card';
    root.dataset.section = 'war-room';
    root.innerHTML = `
      <div class="os-card-head"><h2>War Room</h2><div class="os-card-sub">Clarity under pressure · what ACTUALLY matters now</div></div>
      <div class="os-wr-grid">
        ${WR_LISTS.map(key => {
          const arr = state.warRoom[key] || [];
          const sing = WR_SINGULAR[key];
          const atMax = arr.length >= WR_MAX;
          return `
            <div class="os-wr-panel ${key}">
              <div class="os-wr-label">${key.toUpperCase()} <span class="os-wr-count">${arr.length}/${WR_MAX}</span></div>
              <ul class="os-wr-list" data-wr-list="${key}">
                ${arr.map((item, i) => `<li class="os-wr-li"><span>${escapeHtml(item)}</span><button data-wr-rm="${key}:${i}">×</button></li>`).join('')}
              </ul>
              <input class="os-wr-add" data-wr-add="${key}" placeholder="${atMax ? 'MAX ' + WR_MAX + ' — kill one' : '+ ' + sing}" ${atMax ? 'disabled' : ''} />
            </div>
          `;
        }).join('')}
        <div class="os-wr-panel bottleneck">
          <div class="os-wr-label">THE ONE BOTTLENECK</div>
          <textarea class="os-wr-bottleneck" data-wr-bn placeholder="ONE thing. Not seven.">${escapeHtml(state.warRoom.bottleneck||'')}</textarea>
        </div>
      </div>
    `;
    root.querySelectorAll('[data-wr-rm]').forEach(b => b.addEventListener('click', () => {
      const [key, idx] = b.dataset.wrRm.split(':');
      state.warRoom[key].splice(+idx, 1); save(); renderAll();
    }));
    root.querySelectorAll('[data-wr-add]').forEach(inp => inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const key = inp.dataset.wrAdd;
      const v = inp.value.trim();
      if (!v) return;
      if (!state.warRoom[key]) state.warRoom[key] = [];
      if (state.warRoom[key].length >= WR_MAX) { inp.value = ''; return; }
      state.warRoom[key].push(v); inp.value = ''; save(); renderAll();
    }));
    root.querySelector('[data-wr-bn]').addEventListener('input', e => {
      state.warRoom.bottleneck = e.target.value; save();
    });
  };

  // ===== LEVELS =====
  sections['levels'] = function (root) {
    const cur = state.levels.current;
    const def = state.levels.defs.find(d => d.id === cur);
    const next = state.levels.defs.find(d => d.id === cur + 1);
    if (!state.levels.checks[cur]) state.levels.checks[cur] = def.criteria.map(() => false);
    const checks = state.levels.checks[cur];
    const allDone = checks.every(Boolean);
    root.className = 'os-card';
    root.dataset.section = 'levels';
    root.innerHTML = `
      <div class="os-card-head"><h2>Levels</h2><div class="os-card-sub">Objective progression · proof not vibes</div></div>
      <div class="os-lv-current">
        <div class="os-lv-badge">LEVEL ${cur}</div>
        <div class="os-lv-name">${escapeHtml(def.name)}</div>
      </div>
      <div class="os-lv-bar">
        ${state.levels.defs.map(d => `<div class="os-lv-seg ${d.id < cur ? 'done' : d.id === cur ? 'current' : ''}"></div>`).join('')}
      </div>
      <div class="os-lv-title">Criteria to clear this level</div>
      <ul class="os-lv-list">
        ${def.criteria.map((c, i) => `
          <li class="${checks[i] ? 'done' : ''}" data-lv="${i}">
            <input type="checkbox" class="os-check" ${checks[i] ? 'checked' : ''} />
            <span>${escapeHtml(c)}</span>
          </li>
        `).join('')}
      </ul>
      ${allDone && next ? `<div class="os-lv-advance">All criteria met. Ready to level up?<br/><button data-lv-advance>Advance →</button></div>` : ''}
      <div class="os-lv-next">Next: <strong>Level ${next ? next.id : '∞'} — ${next ? escapeHtml(next.name) : "You've built it"}</strong></div>
      ${next ? `<ul class="os-lv-next-list">${next.criteria.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
    `;
    root.querySelectorAll('[data-lv]').forEach(li => {
      li.querySelector('input').addEventListener('change', e => {
        state.levels.checks[cur][+li.dataset.lv] = e.target.checked;
        save(); renderAll();
      });
    });
    const adv = root.querySelector('[data-lv-advance]');
    if (adv) adv.addEventListener('click', () => {
      if (state.levels.current < state.levels.defs.length) { state.levels.current++; save(); renderAll(); }
    });
  };

  // ===== WEEKLY SCORE =====
  const WS_F = ['faith','finance','fitness','family','focus'];
  sections['weekly-score'] = function (root) {
    const w = isoWeek();
    const data = state.weeklyScore[w] || {};
    let total = 0;
    WS_F.forEach(k => { if (typeof data[k] === 'number') total += data[k]; });
    root.className = 'os-card';
    root.dataset.section = 'weekly-score';
    root.innerHTML = `
      <div class="os-card-head"><h2>Weekly Score</h2><div class="os-card-sub">/10 each · Sunday CEO meeting · ${w}</div></div>
      <div class="os-ws-grid">
        ${WS_F.map(k => `
          <div class="os-ws-cell">
            <label>${k.charAt(0).toUpperCase() + k.slice(1)}</label>
            <div class="os-ws-input"><input type="number" min="0" max="10" data-ws="${k}" value="${data[k] ?? ''}" /><span>/10</span></div>
          </div>
        `).join('')}
      </div>
      <div class="os-ws-total"><span>TOTAL</span><span class="os-ws-total-v"><span>${total}</span> / 50</span></div>
      <div class="os-ws-q">
        <label>What one thing would raise next week's score the most?</label>
        <textarea data-ws="lever" placeholder="One thing. Highest-leverage move.">${escapeHtml(data.lever || '')}</textarea>
      </div>
    `;
    root.querySelectorAll('[data-ws]').forEach(inp => {
      inp.addEventListener('input', e => {
        if (!state.weeklyScore[w]) state.weeklyScore[w] = {};
        const k = inp.dataset.ws;
        if (WS_F.includes(k)) state.weeklyScore[w][k] = e.target.value === '' ? null : Math.max(0, Math.min(10, Number(e.target.value)));
        else state.weeklyScore[w][k] = e.target.value;
        save();
        // Update total only (avoid re-render which loses focus on textarea)
        let t = 0; WS_F.forEach(kk => { const v = state.weeklyScore[w][kk]; if (typeof v === 'number') t += v; });
        root.querySelector('.os-ws-total-v span').textContent = t;
      });
    });
  };

  // ===== WEEK NUMBERS (input) =====
  sections['week-numbers'] = function (root) {
    const w = isoWeek();
    const m = state.weeklyMetrics[w] || {};
    root.className = 'os-card';
    root.dataset.section = 'week-numbers';
    root.innerHTML = `
      <div class="os-card-head"><h2>This Week — Numbers</h2><div class="os-card-sub">${w}</div></div>
      <div class="os-wn-grid">
        ${[
          ['revenue','Revenue ($)','number',0],
          ['clients','New Clients','number',0],
          ['onboarded','Onboarded','number',0],
          ['cancels','Cancellations','number',0],
          ['gym','Gym Sessions','number',0],
          ['sleep','Sleep Avg (hr)','number',0.5],
          ['fajrweek','Fajr (/7)','number',0],
          ['weight','Weight (kg)','number',0.1]
        ].map(([k, l, t, st]) => `
          <div class="os-wn-row">
            <label>${l}</label>
            <input type="${t}" ${st ? 'step="'+st+'"' : ''} data-wn="${k}" value="${m[k] ?? ''}" placeholder="0" />
          </div>
        `).join('')}
      </div>
    `;
    root.querySelectorAll('[data-wn]').forEach(inp => {
      inp.addEventListener('input', e => {
        if (!state.weeklyMetrics[w]) state.weeklyMetrics[w] = {};
        state.weeklyMetrics[w][inp.dataset.wn] = e.target.value === '' ? null : Number(e.target.value);
        save(); renderAll();
      });
    });
  };

  // ===== KPI DASHBOARD =====
  sections['kpi-dashboard'] = function (root) {
    const m = monthKey();
    const targets = state.monthlyTargets[m] || state.monthlyTargets['2026-05'] || {};
    const agg = { revenue: 0, clients: 0, onboarded: 0, gym: 0, fajrweek: 0 };
    let sleepSum = 0, sleepCount = 0, weightLatest = 0;
    Object.entries(state.weeklyMetrics).forEach(([wk, vals]) => {
      Object.entries(vals || {}).forEach(([k, v]) => {
        if (typeof v !== 'number') return;
        if (agg[k] !== undefined) agg[k] += v;
        if (k === 'sleep') { sleepSum += v; sleepCount++; }
        if (k === 'weight') weightLatest = v;
      });
    });
    const sleepAvg = sleepCount ? (sleepSum / sleepCount) : 0;
    const tw = state.weeklyMetrics[isoWeek()] || {};
    const lwd = new Date(); lwd.setDate(lwd.getDate() - 7);
    const lw = state.weeklyMetrics[isoWeekOf(lwd)] || {};
    function delta(k) {
      const a = typeof tw[k] === 'number' ? tw[k] : null;
      const b = typeof lw[k] === 'number' ? lw[k] : null;
      if (a === null && b === null) return null;
      if (a === null) return { txt: 'last wk: ' + b, cls: '' };
      if (b === null) return { txt: 'this wk: ' + a, cls: 'up' };
      const d = a - b;
      const arr = d > 0 ? '▲' : d < 0 ? '▼' : '·';
      return { txt: 'this wk ' + a + ' ' + arr + ' (last ' + b + ')', cls: d > 0 ? 'up' : d < 0 ? 'down' : '' };
    }
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const d = new Date();
    const rows = [
      { label: 'Revenue', v: agg.revenue, t: targets.revenue, fmt: x => '$' + (x || 0).toLocaleString(), wk: 'revenue' },
      { label: 'New Clients', v: agg.clients, t: targets.clients, fmt: x => x || 0, wk: 'clients' },
      { label: 'Onboarded', v: agg.onboarded, t: targets.onboarded, fmt: x => x || 0, wk: 'onboarded' },
      { label: 'Gym', v: agg.gym, t: targets.gym, fmt: x => x || 0, wk: 'gym' },
      { label: 'Sleep avg', v: +sleepAvg.toFixed(1), t: targets.sleep || 8.5, fmt: x => x + 'h', wk: 'sleep' },
      { label: 'Fajr / 7', v: agg.fajrweek, t: 28, fmt: x => x || 0, wk: 'fajrweek' },
      { label: 'Weight', v: weightLatest, t: targets.weight || 70, fmt: x => x ? x + 'kg' : '—', wk: 'weight' }
    ];
    root.className = 'os-card';
    root.dataset.section = 'kpi-dashboard';
    root.innerHTML = `
      <div class="os-card-head"><h2>${monthNames[d.getMonth()]} ${d.getFullYear()} — KPI Dashboard</h2><div class="os-card-sub">Live · aggregated from weekly numbers</div></div>
      <div class="os-kpi-list">
        ${rows.map(r => {
          const pct = r.t > 0 ? Math.min(100, Math.round((r.v / r.t) * 100)) : 0;
          const cls = pct >= 100 ? 'green' : pct < 25 ? 'red' : '';
          const dd = r.wk ? delta(r.wk) : null;
          return `
            <div class="os-kpi-row">
              <div class="os-kpi-label">${r.label}</div>
              <div class="os-kpi-bar"><div class="os-kpi-fill ${cls}" style="width:${pct}%"></div></div>
              <div class="os-kpi-val">${r.fmt(r.v)} <span class="os-kpi-pct">${pct}%</span></div>
              ${dd ? `<div class="os-kpi-delta ${dd.cls}">${dd.txt}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // ===== DECISION LOG =====
  const DL_ST = ['pending','executed','reviewed','failed'];
  sections['decision-log'] = function (root) {
    root.className = 'os-card';
    root.dataset.section = 'decision-log';
    root.innerHTML = `
      <div class="os-card-head"><h2>Decision Log</h2><button class="os-btn" data-dl-add>+ Decision</button></div>
      <div class="os-card-sub" style="margin-bottom:10px;">Stop repeating mistakes</div>
      <table class="os-dl-table">
        <thead><tr><th>Date</th><th>Decision</th><th>Why</th><th>Expected</th><th>Review</th><th>Status</th><th></th></tr></thead>
        <tbody>${
          !state.decisions.length
          ? '<tr><td colspan="7" class="os-empty">No decisions logged.</td></tr>'
          : state.decisions.map(d => `
            <tr data-dl-id="${d.id}">
              <td><input type="date" data-f="date" value="${d.date||''}"/></td>
              <td><textarea data-f="decision" placeholder="…">${escapeHtml(d.decision||'')}</textarea></td>
              <td><textarea data-f="why" placeholder="…">${escapeHtml(d.why||'')}</textarea></td>
              <td><textarea data-f="expected" placeholder="…">${escapeHtml(d.expected||'')}</textarea></td>
              <td><input type="date" data-f="reviewDate" value="${d.reviewDate||''}"/></td>
              <td><select data-f="status" data-status="${d.status||'pending'}">${DL_ST.map(s => `<option value="${s}" ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></td>
              <td><button class="os-btn-icon" data-dl-rm>×</button></td>
            </tr>
          `).join('')
        }</tbody>
      </table>
    `;
    root.querySelector('[data-dl-add]').addEventListener('click', () => {
      const today = todayKey();
      const review = new Date(); review.setDate(review.getDate() + 30);
      state.decisions.unshift({ id: Date.now()+'-'+Math.random().toString(36).slice(2,7), date: today, decision: '', why: '', expected: '', reviewDate: dateKey(review), status: 'pending' });
      save(); renderAll();
    });
    root.querySelectorAll('[data-dl-id]').forEach(tr => {
      const id = tr.dataset.dlId;
      const d = state.decisions.find(x => x.id === id);
      tr.querySelectorAll('[data-f]').forEach(el => {
        el.addEventListener('input', () => { d[el.dataset.f] = el.value; save(); });
        el.addEventListener('change', () => { d[el.dataset.f] = el.value; if (el.dataset.f === 'status') el.dataset.status = el.value; save(); });
      });
      tr.querySelector('[data-dl-rm]').addEventListener('click', () => {
        if (confirm('Delete this decision?')) { state.decisions = state.decisions.filter(x => x.id !== id); save(); renderAll(); }
      });
    });
  };

  // ===== DELEGATION MATRIX =====
  const DM_ST = ['you-only','partial','fully-delegated','sopd'];
  sections['delegation'] = function (root) {
    root.className = 'os-card';
    root.dataset.section = 'delegation';
    root.innerHTML = `
      <div class="os-card-head"><h2>Delegation Matrix</h2><button class="os-btn" data-dm-add>+ Task</button></div>
      <div class="os-card-sub" style="margin-bottom:10px;">Operator → Owner: every recurring task needs ≠ you</div>
      <table class="os-dl-table">
        <thead><tr><th>Recurring task</th><th>Current</th><th>Target</th><th>Status</th><th></th></tr></thead>
        <tbody>${
          !state.delegation.length
          ? '<tr><td colspan="5" class="os-empty">No tasks logged. Add the recurring stuff only YOU currently do.</td></tr>'
          : state.delegation.map(d => `
            <tr data-dm-id="${d.id}">
              <td><input data-f="task" value="${escapeHtml(d.task||'')}" placeholder="e.g. Daily campaign launch"/></td>
              <td><input data-f="currentOwner" value="${escapeHtml(d.currentOwner||'')}" placeholder="You"/></td>
              <td><input data-f="targetOwner" value="${escapeHtml(d.targetOwner||'')}" placeholder="VA / partner / AI"/></td>
              <td><select data-f="status" data-status="${d.status||'you-only'}">${DM_ST.map(s => `<option value="${s}" ${d.status===s?'selected':''}>${s.replace('-',' ')}</option>`).join('')}</select></td>
              <td><button class="os-btn-icon" data-dm-rm>×</button></td>
            </tr>
          `).join('')
        }</tbody>
      </table>
    `;
    root.querySelector('[data-dm-add]').addEventListener('click', () => {
      state.delegation.push({ id: Date.now()+'', task: '', currentOwner: 'You', targetOwner: '', status: 'you-only' });
      save(); renderAll();
    });
    root.querySelectorAll('[data-dm-id]').forEach(tr => {
      const id = tr.dataset.dmId;
      const d = state.delegation.find(x => x.id === id);
      tr.querySelectorAll('[data-f]').forEach(el => {
        el.addEventListener('input', () => { d[el.dataset.f] = el.value; save(); });
        el.addEventListener('change', () => { d[el.dataset.f] = el.value; if (el.dataset.f === 'status') el.dataset.status = el.value; save(); });
      });
      tr.querySelector('[data-dm-rm]').addEventListener('click', () => {
        if (confirm('Delete this task?')) { state.delegation = state.delegation.filter(x => x.id !== id); save(); renderAll(); }
      });
    });
  };

  // ===== SYSTEM HEALTH =====
  sections['system-health'] = function (root) {
    root.className = 'os-card';
    root.dataset.section = 'system-health';
    root.innerHTML = `
      <div class="os-card-head"><h2>System Health</h2><div class="os-card-sub">Fix before stress</div></div>
      <ul class="os-sh-list">${
        !state.systems.length
        ? '<li class="os-empty">No broken systems logged. Look harder.</li>'
        : state.systems.map(s => `
          <li class="os-sh-item ${s.status||'risky'}" data-sh-id="${s.id}">
            <span class="os-sh-text">${escapeHtml(s.name)}</span>
            <select><option value="breaking" ${s.status==='breaking'?'selected':''}>Breaking</option><option value="risky" ${s.status==='risky'?'selected':''}>Risky</option><option value="fixed" ${s.status==='fixed'?'selected':''}>Fixed</option></select>
            <button class="os-btn-icon" data-sh-rm>×</button>
          </li>
        `).join('')
      }</ul>
      <div class="os-sh-add"><input type="text" data-sh-input placeholder="Which system is breaking…"/><button class="os-btn" data-sh-add>Add</button></div>
    `;
    root.querySelectorAll('[data-sh-id]').forEach(li => {
      const id = li.dataset.shId;
      const s = state.systems.find(x => x.id === id);
      li.querySelector('select').addEventListener('change', e => { s.status = e.target.value; save(); renderAll(); });
      li.querySelector('[data-sh-rm]').addEventListener('click', () => { state.systems = state.systems.filter(x => x.id !== id); save(); renderAll(); });
    });
    const addBtn = root.querySelector('[data-sh-add]');
    const addInp = root.querySelector('[data-sh-input]');
    function doAdd() {
      const v = addInp.value.trim();
      if (!v) return;
      state.systems.push({ id: Date.now()+'', name: v, status: 'risky' });
      addInp.value = '';
      save(); renderAll();
    }
    addBtn.addEventListener('click', doAdd);
    addInp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  };

  // ===== HEATMAP =====
  sections['heatmap'] = function (root) {
    root.className = 'os-card';
    root.dataset.section = 'heatmap';
    function dens(k) {
      const c = state.dailyChecks[k] || {};
      let n = 0;
      ['fajr','gym','zipcodes','aileads','loop','win'].forEach(key => { if (c[key]) n++; });
      if (state.bigDomino[k]) n++;
      return n;
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const todayK = dateKey(today);
    let cellsHtml = '';
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const k = dateKey(d);
      const v = dens(k);
      const level = v === 0 ? '' : v <= 2 ? 'l1' : v <= 4 ? 'l2' : v <= 5 ? 'l3' : 'l4';
      cellsHtml += `<div class="os-heat-cell ${level} ${k === todayK ? 'today' : ''}" title="${k} · ${v}/7"></div>`;
    }
    root.innerHTML = `
      <div class="os-card-head"><h2>60-Day Activity</h2><div class="os-card-sub">Each cell = day · color = checks completed</div></div>
      <div class="os-heat-grid">${cellsHtml}</div>
      <div class="os-heat-legend">less<span class="os-heat-chip" style="background:#14141a;"></span><span class="os-heat-chip" style="background:rgba(212,175,55,0.15);"></span><span class="os-heat-chip" style="background:rgba(212,175,55,0.30);"></span><span class="os-heat-chip" style="background:rgba(212,175,55,0.55);"></span><span class="os-heat-chip" style="background:linear-gradient(135deg,#b8941f,#e6c068);"></span>more</div>
    `;
  };

  // ===== CAPTURE (Second Brain) =====
  const TAGS = ['sms','pricing','ai','growth','competitor','lesson','personal'];
  sections['capture'] = function (root) {
    root.className = 'os-card';
    root.dataset.section = 'capture';
    root.innerHTML = `
      <div class="os-card-head"><h2>Quick Capture · Second Brain</h2><div class="os-card-sub">Tag · search · find later</div></div>
      <div class="os-cap-bar">
        <select data-cap-tag class="os-tag-sel">
          <option value="untagged">Untagged</option>
          ${TAGS.map(t => `<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1).replace('sms','SMS angle').replace('ai','AI tools').replace('lesson','Business lesson')}</option>`).join('')}
        </select>
        <textarea data-cap-input rows="2" placeholder="Drop any thought, idea, todo…"></textarea>
        <button class="os-btn" data-cap-add>Add</button>
      </div>
      <div class="os-cap-bar">
        <input type="text" data-cap-search class="os-tag-sel" style="flex:1;" placeholder="Search entries…"/>
        <select data-cap-filter class="os-tag-sel">
          <option value="all">All tags</option>
          ${TAGS.map(t => `<option value="${t}">${t}</option>`).join('')}
          <option value="untagged">untagged</option>
        </select>
      </div>
      <div data-cap-list style="margin-top:10px;"></div>
    `;
    function rerenderList() {
      const filter = root.querySelector('[data-cap-filter]').value;
      const search = (root.querySelector('[data-cap-search]').value || '').toLowerCase().trim();
      let items = state.capture.slice().reverse();
      if (filter !== 'all') items = items.filter(i => (i.tag || 'untagged') === filter);
      if (search) items = items.filter(i => (i.text || '').toLowerCase().includes(search));
      const list = root.querySelector('[data-cap-list]');
      list.innerHTML = items.length
        ? items.map(it => `
          <div class="os-list-item ${it.done?'done':''}" data-cap-id="${it.id}">
            <input type="checkbox" class="os-check" ${it.done?'checked':''}/>
            <div style="flex:1;">
              <div><span class="os-tag-pill ${it.tag||'untagged'}">${it.tag||'untagged'}</span>${escapeHtml(it.text)}</div>
              <div class="os-list-ts">${new Date(it.ts).toLocaleString()}</div>
            </div>
            <button class="os-btn-icon" data-cap-rm>×</button>
          </div>
        `).join('')
        : '<div class="os-empty">No entries.</div>';
      list.querySelectorAll('[data-cap-id]').forEach(div => {
        const id = div.dataset.capId;
        const it = state.capture.find(x => x.id === id);
        div.querySelector('input').addEventListener('change', e => { it.done = e.target.checked; save(); rerenderList(); });
        div.querySelector('[data-cap-rm]').addEventListener('click', () => { state.capture = state.capture.filter(x => x.id !== id); save(); rerenderList(); });
      });
    }
    root.querySelector('[data-cap-add]').addEventListener('click', () => {
      const txt = root.querySelector('[data-cap-input]').value.trim();
      if (!txt) return;
      const tag = root.querySelector('[data-cap-tag]').value;
      state.capture.push({ id: Date.now()+'', text: txt, ts: Date.now(), done: false, tag });
      root.querySelector('[data-cap-input]').value = '';
      save(); rerenderList();
    });
    root.querySelector('[data-cap-input]').addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') root.querySelector('[data-cap-add]').click();
    });
    root.querySelector('[data-cap-filter]').addEventListener('change', rerenderList);
    root.querySelector('[data-cap-search]').addEventListener('input', rerenderList);
    rerenderList();
  };

  // ===== OPEN LOOPS =====
  sections['loops'] = function (root) {
    root.className = 'os-card';
    root.dataset.section = 'loops';
    root.innerHTML = `
      <div class="os-card-head"><h2>Open Loops</h2><div class="os-card-sub">When tired, close one — don't rest</div></div>
      <div class="os-cap-bar">
        <input type="text" data-lp-input placeholder="What have you been putting off…"/>
        <button class="os-btn" data-lp-add>Add</button>
      </div>
      <div data-lp-list></div>
    `;
    function rerender() {
      const list = root.querySelector('[data-lp-list]');
      list.innerHTML = state.loops.length
        ? state.loops.slice().reverse().map(it => `
          <div class="os-list-item ${it.done?'done':''}" data-lp-id="${it.id}">
            <input type="checkbox" class="os-check" ${it.done?'checked':''}/>
            <div style="flex:1;">
              <div>${escapeHtml(it.text)}</div>
              <div class="os-list-ts">${new Date(it.ts).toLocaleDateString()}</div>
            </div>
            <button class="os-btn-icon" data-lp-rm>×</button>
          </div>
        `).join('')
        : '<div class="os-empty">No open loops. Energy lives in closing them.</div>';
      list.querySelectorAll('[data-lp-id]').forEach(div => {
        const id = div.dataset.lpId;
        const it = state.loops.find(x => x.id === id);
        div.querySelector('input').addEventListener('change', e => { it.done = e.target.checked; save(); rerender(); });
        div.querySelector('[data-lp-rm]').addEventListener('click', () => { state.loops = state.loops.filter(x => x.id !== id); save(); rerender(); });
      });
    }
    root.querySelector('[data-lp-add]').addEventListener('click', () => {
      const txt = root.querySelector('[data-lp-input]').value.trim();
      if (!txt) return;
      state.loops.push({ id: Date.now()+'', text: txt, ts: Date.now(), done: false });
      root.querySelector('[data-lp-input]').value = '';
      save(); rerender();
    });
    root.querySelector('[data-lp-input]').addEventListener('keydown', e => { if (e.key === 'Enter') root.querySelector('[data-lp-add]').click(); });
    rerender();
  };

  // ===== CRM =====
  const CRM_ST = ['lead','talking','signed','onboarding','live','paused','churned'];
  sections['crm'] = function (root) {
    root.className = 'os-card';
    root.dataset.section = 'crm';
    root.innerHTML = `
      <div class="os-card-head"><h2>Tree Service Clients · CRM</h2><button class="os-btn" data-crm-add>+ Add Client</button></div>
      <div class="os-card-sub" style="margin-bottom:10px;">lead → talking → signed → onboarding → live</div>
      <table class="os-dl-table">
        <thead><tr><th>Company</th><th>Status</th><th>$/mo</th><th>Notes</th><th></th></tr></thead>
        <tbody>${
          !state.clients.length
          ? '<tr><td colspan="5" class="os-empty">No clients yet.</td></tr>'
          : state.clients.map(c => `
            <tr data-crm-id="${c.id}">
              <td><input data-f="company" value="${escapeHtml(c.company||'')}" placeholder="Company name"/></td>
              <td><select data-f="status" data-status="${c.status||'lead'}">${CRM_ST.map(s => `<option value="${s}" ${c.status===s?'selected':''}>${s}</option>`).join('')}</select></td>
              <td><input data-f="mrr" type="number" value="${c.mrr ?? ''}" placeholder="0"/></td>
              <td><input data-f="notes" value="${escapeHtml(c.notes||'')}" placeholder="…"/></td>
              <td><button class="os-btn-icon" data-crm-rm>×</button></td>
            </tr>
          `).join('')
        }</tbody>
      </table>
    `;
    root.querySelector('[data-crm-add]').addEventListener('click', () => {
      state.clients.push({ id: Date.now()+'-'+Math.random().toString(36).slice(2,7), company: '', status: 'lead', mrr: null, notes: '' });
      save(); renderAll();
    });
    root.querySelectorAll('[data-crm-id]').forEach(tr => {
      const id = tr.dataset.crmId;
      const c = state.clients.find(x => x.id === id);
      tr.querySelectorAll('[data-f]').forEach(el => {
        el.addEventListener('input', () => { c[el.dataset.f] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value; save(); });
        el.addEventListener('change', () => { c[el.dataset.f] = el.value; if (el.dataset.f === 'status') el.dataset.status = el.value; save(); });
      });
      tr.querySelector('[data-crm-rm]').addEventListener('click', () => {
        if (confirm('Delete ' + (c.company || 'this client') + '?')) { state.clients = state.clients.filter(x => x.id !== id); save(); renderAll(); }
      });
    });
  };

  // ===== JOURNAL =====
  const journalPrompts = [
    "What did you do well today? What didn't work — and why?",
    "Where did you act as the new identity? Where did you revert?",
    "What's draining you right now? Decode the emotion.",
    "What's the one thing you've been avoiding? Why?",
    "How did today move the needle on May's goals?",
    "What's one experiment you could run tomorrow?",
    "If today were 20%, did you give 20%?"
  ];
  sections['journal'] = function (root) {
    const k = todayKey();
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const prompt = journalPrompts[dayOfYear % journalPrompts.length];
    root.className = 'os-card';
    root.dataset.section = 'journal';
    root.innerHTML = `
      <div class="os-card-head"><h2>Self-Analysis</h2><div class="os-card-sub">Evening · be honest, not flattering</div></div>
      <div class="os-jr-prompt">"${escapeHtml(prompt)}"</div>
      <textarea class="os-jr-area" data-jr placeholder="Be specific. The point isn't to feel good — it's to see clearly.">${escapeHtml(state.journal[k] || '')}</textarea>
    `;
    root.querySelector('[data-jr]').addEventListener('input', e => { state.journal[todayKey()] = e.target.value; save(); });
  };

  // ===== RESET BLOCK =====
  const resetItems = [
    { key: 'shower', label: 'Shower' },
    { key: 'meal', label: 'Meal' },
    { key: 'walk', label: 'Quick walk' },
    { key: 'noPhone', label: 'No phone 20m' }
  ];
  sections['reset-block'] = function (root) {
    const k = todayKey();
    const data = state.resetBlock[k] || {};
    root.className = 'os-card reset';
    root.dataset.section = 'reset-block';
    root.innerHTML = `
      <div class="os-card-head"><h2>Reset Block</h2><div class="os-card-sub">16:45 — 17:30 · before US work</div></div>
      <ul class="os-ritual-list">
        ${resetItems.map(it => `
          <li class="os-ritual-item ${data[it.key]?'on':''}" data-rb="${it.key}">
            <input type="checkbox" class="os-check" ${data[it.key]?'checked':''}/>
            <span class="os-ri-text">${it.label}</span>
          </li>
        `).join('')}
      </ul>
    `;
    root.querySelectorAll('[data-rb]').forEach(li => {
      li.querySelector('input').addEventListener('change', e => {
        if (!state.resetBlock[k]) state.resetBlock[k] = {};
        state.resetBlock[k][li.dataset.rb] = e.target.checked;
        li.classList.toggle('on', e.target.checked); save();
      });
    });
  };

  // ===== NIGHT SHUTDOWN =====
  const shutdownItems = [
    { key: 'inbox', label: 'Inbox cleared' },
    { key: 'tomorrow', label: 'Tomorrow planned' },
    { key: 'water', label: 'Final water' },
    { key: 'skincare', label: 'Skincare' },
    { key: 'clothes', label: 'Clothes laid out' }
  ];
  sections['night-shutdown'] = function (root) {
    const k = todayKey();
    const data = state.nightShutdown[k] || {};
    root.className = 'os-card shutdown';
    root.dataset.section = 'night-shutdown';
    root.innerHTML = `
      <div class="os-card-head"><h2>Night Shutdown</h2><div class="os-card-sub">23:30 — 01:30 · sleep quality built before sleep</div></div>
      <ul class="os-ritual-list">
        ${shutdownItems.map(it => `
          <li class="os-ritual-item ${data[it.key]?'on':''}" data-ns="${it.key}">
            <input type="checkbox" class="os-check" ${data[it.key]?'checked':''}/>
            <span class="os-ri-text">${it.label}</span>
          </li>
        `).join('')}
      </ul>
    `;
    root.querySelectorAll('[data-ns]').forEach(li => {
      li.querySelector('input').addEventListener('change', e => {
        if (!state.nightShutdown[k]) state.nightShutdown[k] = {};
        state.nightShutdown[k][li.dataset.ns] = e.target.checked;
        li.classList.toggle('on', e.target.checked); save();
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
