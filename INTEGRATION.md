# Row Additions — Integration Guide

Three new pages that drop into your existing **moha-jpg/row** repo without touching a single existing file.

| File | What | App Key | Bookmark name |
|---|---|---|---|
| `day.html` | Today: Big Domino, priorities, daily checks (streaks), Non-Zero Day, schedule, meals, reset block, night shutdown, Quran, journal, plan tomorrow, date navigator | `os-day` | OS · Day |
| `strategy.html` | Strategic: War Room (ruthless caps), Levels (objective), Burnout Watch w/ sparklines, System Health, Weekly Score, KPI Dashboard w/ deltas, This Week Numbers, Mom's House, 60-day heatmap, 2026 Goals, Decision Log, Delegation Matrix | `os-strategy` | OS · Strategy |
| `brain.html` | Capture: Second Brain (tagged + searchable), Open Loops, Tree Service CRM | `os-brain` | OS · Brain |

## Architecture

These pages reuse your existing infrastructure:

- **`topbar.js`** — same script tag, injects the same Main/Health/Fitness bottom nav
- **`sync.js`** — same generic cloud-sync helper, each page calls `initCloudSync({ appKey: 'os-...' })`
- **Supabase** — same project (`ibsfotovjkpwrhszlojc.supabase.co`), same `app_state` table, three new rows keyed `os-day` / `os-strategy` / `os-brain`
- **localStorage** — each page owns one key: `os-day-v1`, `os-strategy-v1`, `os-brain-v1`. No collisions with existing keys (`goals:*`, `stack:*`, `po_water_v1`, `subs`, etc.)
- **Design language** — matches Row exactly: `#050506` bg, `#FAFAFA` text, gold accents, safe-area-inset padding, 16px inputs (no iOS auto-zoom), no pinch-zoom (inherited from `topbar.js`)

## Deploy

```bash
# In your row repo
cp day.html strategy.html brain.html .
git add day.html strategy.html brain.html INTEGRATION.md
git commit -m "Add OS pages: day, strategy, brain"
git push origin main
# Vercel auto-deploys
```

That's it. No existing files modified. Rollback is `git revert HEAD` or just `git rm` the three files.

## Try in a branch first (recommended)

```bash
git checkout -b os-pages
cp day.html strategy.html brain.html .
git add .
git commit -m "Add OS layer"
git push -u origin os-pages
# Vercel creates a preview deployment for the branch
# Test the preview URL on phone before merging
```

## Access on phone

After deploy, bookmark the 3 URLs on your phone:

- `your-row-url.vercel.app/day.html` ← daily-use page, **bookmark this one first**
- `your-row-url.vercel.app/strategy.html`
- `your-row-url.vercel.app/brain.html`

Add `day.html` to your iPhone home screen (Safari → Share → Add to Home Screen) for app-feel.

The 3 pages cross-link in their headers, so you only need one bookmark — navigate between them from there.

## Data flow

- Open `day.html` on Mac → write today's Big Domino → typing it triggers a 250ms-debounced upload to Supabase `app_state[os-day]`.
- Open `day.html` on phone 2 seconds later → Supabase realtime subscription pushes the new state → Big Domino renders.
- Same backwards.

Per-page localStorage means each page only syncs its own slice — `strategy.html` won't refetch your meals every time you tick one.

## Existing Row pages — untouched

Nothing about your `index.html`, `health.html`, `gym.html`, `finance.html`, `po-water.html`, `topbar.js`, or `sync.js` changes. They still work exactly as before. The 3 new pages just sit alongside them, sharing the bottom nav and the Supabase project.

## What's NOT duplicated from Row

I deliberately did not rebuild things you already have:

- **Water tracker** — your `po-water.html` is excellent. The new pages' schedule shows water blocks but doesn't track water itself.
- **Supplement stack** — your `health.html` owns this.
- **Workout / progressive overload / progress photos** — your `gym.html` owns this. The Day page's `Gym session` daily check just marks "I did one" — count, sets, and weights live in `gym.html`.
- **Net worth / subscriptions / wishlist / incoming orders** — your `finance.html` owns this. Mom's House is the one financial goal that lives in `strategy.html` because it's a specific personal-identity goal, not part of net-worth tracking.

## Optional: bottom-nav extension

If you ever want to add an "OS" tab to the bottom nav, edit `topbar.js` line ~165 (the `bottombarHtml`) and add:

```html
<a href="day.html" class="bottombar-tab" data-page="os">
  <span class="bottombar-tab-icon">⚙️</span><span>OS</span>
</a>
```

But that modifies an existing file. The clean path is bookmarks.

## Identity / review docs

The strategic-layer Markdown docs from the original Life-System still live separately:

- `goals/identity.md` — old self / new self / monthly rule
- `goals/2026.md` — yearly
- `goals/may-2026.md` — monthly
- `reviews/weekly-template.md` — Sunday CEO meeting
- `reviews/monthly-template.md` — month-end
- `reviews/quarterly-template.md` — quarterly
- `reviews/annual-template.md` — Dec 27–31
- `not-to-do.md`
- `SUMMARY.md`

Keep these in the Life-System folder or copy into your repo under `docs/` — they're for hand-writing reviews, not for the dashboard.
