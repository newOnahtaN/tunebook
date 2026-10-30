// Build the folk-scenes report: node build.mjs  ->  ../report/index.html
import fs from 'fs';
import path from 'path';
import { load, ORDER, SHORT, GROUPS } from './model.mjs';
import { CARDS } from './cards.mjs';
import { venueKind, VENUE_KINDS } from './venues.mjs';
import * as ch from './charts.mjs';
const { C, esc } = ch;

const ROOT = path.resolve('..');
const readC = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'central', f), 'utf8'));
const { cities } = load();
const L = ORDER.map(s => cities[s]);
const bld = readC('folk_buildings.json');
const contests = readC('fiddle_contests.json');
const contra = readC('contra_2019_2026.json');
const nea = readC('nea_fellows.json');
const dirs = readC('directory_counts.json');

const r1 = v => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
const r0 = v => Math.round(v).toLocaleString('en-US');
// Radio: broadcast (FM/AM/HD) hours only, summed per station and capped at a full week.
function radioHours(c) {
  const per = {};
  for (const r of c.data.radio || []) {
    const st = String(r.station || '');
    if (/internet|online|podcast|web ?only|stream only/i.test(st) && !/\bFM\b|HD\d|\b[KW][A-Z]{2,3}\b/.test(st)) continue;
    const key = (st.match(/\b[KW][A-Z]{2,3}\b/) || [st.split(/[ (]/)[0]])[0];
    per[key] = Math.min(168, (per[key] || 0) + (+r.hours_per_week || 0));
  }
  return Object.values(per).reduce((a, b) => a + b, 0);
}
const by = (arr, f) => [...arr].sort((a, b) => f(b) - f(a));
const corr = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; } return a / Math.sqrt(b * c); };
const REGION = {
  boston: 'Northeast', 'new-york': 'Northeast', philadelphia: 'Northeast', 'washington-dc': 'Northeast',
  chicago: 'Midwest', detroit: 'Midwest', minneapolis: 'Midwest',
  atlanta: 'South', miami: 'South', tampa: 'South', orlando: 'South', houston: 'South', 'dallas-fort-worth': 'South',
  phoenix: 'West', denver: 'West', 'los-angeles': 'West', riverside: 'West', 'san-diego': 'West', 'san-francisco': 'West', seattle: 'West',
};
const RCOL = { Northeast: C.rust, Midwest: C.plum, South: C.mustard, West: C.teal };
const regionLegend = () => `<p class="legend">${Object.entries(RCOL).map(([k, v]) => `<span><i style="background:${v}"></i>${k}</span>`).join('')}</p>`;

// ---------- headline numbers ----------
const grand = L.reduce((s, c) => s + c.total, 0);
const tradGrand = L.reduce((s, c) => s + c.trad, 0);
const popGrand = L.reduce((s, c) => s + c.pop, 0);
const eventsN = L.reduce((s, c) => s + c.events.length, 0);
const ranked = by(L, c => c.tradPerM);
const top = ranked[0], bottom = ranked[ranked.length - 1];
const nyc = cities['new-york'];

// ---------- charts ----------
const charts = {};

charts.density = ch.hbar({
  label: 'Trad meetings per million residents per month',
  rows: ranked.map(c => ({ label: c.name, value: c.tradPerM, color: RCOL[REGION[c.slug]], note: `${r0(c.trad)}/mo` })),
  labelW: 118, fmtValue: r1,
});

charts.slope = ch.slope({
  label: 'Population rank vs. density rank',
  rows: L.map(c => ({ label: c.name, a: c.pop / 1e6, b: c.tradPerM })),
  leftTitle: 'Population (millions)', rightTitle: 'Trad meetings per million',
  fmtA: v => v.toFixed(1), fmtB: v => r1(v),
});

const LABELPOS = { 'new-york': 'r', philadelphia: 'b', 'washington-dc': 'b', boston: 't', 'los-angeles': 'l', riverside: 'r', 'san-diego': 'l', 'san-francisco': 'l', seattle: 'r', tampa: 'l', orlando: 'r', miami: 'l', detroit: 'r', chicago: 'l', minneapolis: 't', denver: 't', phoenix: 'b', 'dallas-fort-worth': 't', houston: 'b', atlanta: 'l' };
const topGroupColor = { 'Tune sessions & jams': C.rust, 'Social dance': C.teal, 'Heritage community': C.mustard, Singing: C.plum, 'Open mics': C.sky, Other: C.sand };
charts.map = ch.usMap({
  label: 'Map of monthly folk meetings',
  h: 300,
  points: L.map(c => {
    const g = Object.entries(c.byGroup).sort((a, b) => b[1] - a[1])[0][0];
    return { lng: c.center[1], lat: c.center[0], r: Math.sqrt(c.total) * 1.25, color: topGroupColor[g], label: c.name, labelPos: LABELPOS[c.slug], title: `${c.name}: ${r0(c.total)} meetings a month; biggest layer: ${g}` };
  }),
  legend: 'Circle area = recurring meetings a month (all four layers)',
});

const GKEYS = ['Tune sessions & jams', 'Social dance', 'Singing', 'Open mics', 'Heritage community', 'Other'];
charts.mix = ch.stacked100({
  label: 'What kind of folk each metro does',
  keys: GKEYS, colors: { 'Tune sessions & jams': C.rust, 'Social dance': C.teal, Singing: C.plum, 'Open mics': C.sky, 'Heritage community': C.mustard, Other: C.sand },
  rows: by(L, c => (c.byGroup['Tune sessions & jams'] || 0) / c.total).map(c => ({ label: c.name, parts: c.byGroup })),
  labelW: 112,
});

// Jam fingerprint
const jamPts = L.map(c => {
  const ir = c.byCat.irish_session || 0, bg = c.byCat.bluegrass_jam || 0, ot = c.byCat.oldtime_jam || 0;
  return { slug: c.slug, a: ir, b: bg, c: ot, label: c.name, r: 3 + Math.sqrt(ir + bg + ot) * 0.75, color: RCOL[REGION[c.slug]], title: `${c.name}: Irish ${r1(ir)}, bluegrass ${r1(bg)}, old-time ${r1(ot)} a month` };
});
const TPOS = { boston: 'r', chicago: 'l', 'new-york': 'l', 'washington-dc': 'l', philadelphia: 'r', 'san-francisco': 'r', 'dallas-fort-worth': 'l', houston: 'r', atlanta: 'r', denver: 'r', phoenix: 'l', riverside: 'l', miami: 'r', seattle: 't', minneapolis: 'r', tampa: 'b', 'san-diego': 'r', orlando: 'l', 'los-angeles': 'b', detroit: 'r' };
const TCLUSTER = ['new-york', 'dallas-fort-worth', 'houston', 'san-francisco', 'san-diego', 'orlando'];
charts.ternary = ch.ternary({ label: 'Irish vs bluegrass vs old-time', corners: ['Irish sessions', 'Bluegrass jams', 'Old-time jams'], points: jamPts.map(p => ({ ...p, labelPos: TPOS[p.slug], label: TCLUSTER.includes(p.slug) ? '' : p.label })), h: 430 });

const DKEYS = ['contra_dance', 'english_country_dance', 'ceili_or_scottish_country_dance', 'international_folk_dance', 'scandinavian_dance', 'square_dance', 'morris_sword_team'];
const DNAMES = { contra_dance: 'Contra', english_country_dance: 'English country', ceili_or_scottish_country_dance: 'Céilí & Scottish', international_folk_dance: 'International & Israeli', scandinavian_dance: 'Scandinavian', square_dance: 'Old-time squares', morris_sword_team: 'Morris & sword' };
const DCOL = { Contra: C.rust, 'English country': C.rose, 'Céilí & Scottish': C.forest, 'International & Israeli': C.sky, Scandinavian: C.plum, 'Old-time squares': C.mustard, 'Morris & sword': C.sand };
charts.dance = ch.stacked100({
  label: 'Dance mix', keys: Object.values(DNAMES), colors: DCOL,
  rows: by(L, c => (c.byCat.contra_dance || 0) / (c.byGroup['Social dance'] || 1)).map(c => ({ label: `${c.name}`, parts: Object.fromEntries(DKEYS.map(k => [DNAMES[k], c.byCat[k] || 0])) })),
  labelW: 112,
});
charts.mwsd = ch.hbar({
  label: 'Modern western square-dance club nights vs contra',
  rows: by(L.filter(c => c.mwsdTotal > 0 && (c.byCat.contra_dance || 0) > 0), c => c.mwsdTotal / Math.max(c.byCat.contra_dance || 0, 0.5)).map(c => ({ label: c.name, value: c.mwsdTotal / Math.max(c.byCat.contra_dance || 0, 0.5), note: `${r0(c.mwsdTotal)} club nights vs ${r1(c.byCat.contra_dance || 0)} contras`, color: C.mustard })),
  labelW: 112, fmtValue: v => `${r1(v)}×`,
});

// Predictors
const preds = [
  ['Adults with a bachelor\'s degree', c => c.acs.pct.ba_plus_25],
  ['Median household income', c => c.acs.median_hh_income],
  ['Irish ancestry', c => c.acs.pct.irish],
  ['Owned folk buildings per million', c => (bld.by_metro[c.slug]?.owned_or_controlled || 0) / c.popM],
  ['Latitude', c => c.center[0]],
  ['Nordic ancestry', c => c.acs.pct.nordic],
  ['Folk radio hours a week', c => radioHours(c)],
  ['Median age', c => c.acs.median_age],
  ['Foreign-born share', c => c.acs.pct.foreign_born],
  ['Population', c => c.pop],
  ['Domestic migration 2021–25', c => c.census.domestic_mig_2021_25 / c.pop],
  ['Population growth since 2020', c => c.census.growth_pct],
  ['Hispanic share', c => c.acs.pct.hispanic],
];
const yT = L.map(c => c.tradPerM), yH = L.map(c => (c.byGroup['Heritage community'] || 0) / c.popM);
const rankv = v => { const s = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = []; s.forEach(([, i], k) => (r[i] = k)); return r; };
const predR = preds.map(([n, f]) => ({ n, r: corr(L.map(f), yT), rs: corr(rankv(L.map(f)), rankv(yT)), rh: corr(L.map(f), yH) })).sort((a, b) => b.r - a.r);
const pBA = predR.find(p => p.n.startsWith('Adults')), pInc = predR.find(p => p.n.startsWith('Median household'));
charts.predictors = (() => {
  const rows = predR, labelW = 196, rowH = 22, mid = labelW + (ch.W - labelW - 10) / 2, half = (ch.W - labelW - 10) / 2;
  let body = `<line x1="${mid}" x2="${mid}" y1="6" y2="${rows.length * rowH + 10}" stroke="${C.muted}"/>`;
  body += `<text x="${mid - half}" y="${rows.length * rowH + 26}" font-size="10" fill="${C.muted}">−1</text><text x="${mid}" y="${rows.length * rowH + 26}" font-size="10" fill="${C.muted}" text-anchor="middle">0</text><text x="${mid + half}" y="${rows.length * rowH + 26}" font-size="10" fill="${C.muted}" text-anchor="end">+1</text>`;
  rows.forEach((p, i) => {
    const y = 14 + i * rowH, x = mid + p.r * half, col = p.r > 0 ? C.teal : C.rust;
    body += `<text x="${labelW - 8}" y="${y + 4}" font-size="11.5" text-anchor="end" fill="${C.ink}">${esc(p.n)}</text>`;
    body += `<line x1="${mid}" x2="${x}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="5" fill="${col}"/>`;
    body += `<text x="${p.r > 0 ? x + 8 : x - 8}" y="${y + 4}" font-size="10.5" font-weight="600" fill="${C.ink}" text-anchor="${p.r > 0 ? 'start' : 'end'}">${p.r.toFixed(2)}</text>`;
  });
  return `<svg viewBox="0 0 ${ch.W} ${rows.length * rowH + 32}" class="chart" role="img" aria-label="Correlations">${body}</svg>`;
})();
const BAPOS = { boston: 'l', 'san-francisco': 'l', 'washington-dc': 't', seattle: 'r', minneapolis: 'r', 'san-diego': 'l', denver: 'b', philadelphia: 'r', chicago: 'l', tampa: 'l', 'los-angeles': 'r', atlanta: 'b', 'new-york': 't', miami: 'x', phoenix: 'l', houston: 'x', orlando: 'x', detroit: 'b', 'dallas-fort-worth': 'r', riverside: 'r' };
const baSc = ch.scatter({
  label: 'Bachelor\'s share vs density', xLabel: 'Adults 25+ with a bachelor\'s degree or more (%)', yLabel: 'Trad meetings per million',
  points: L.map(c => ({ x: c.acs.pct.ba_plus_25, y: c.tradPerM, label: BAPOS[c.slug] === 'x' ? '' : c.name, color: RCOL[REGION[c.slug]], labelPos: BAPOS[c.slug] })), h: 380, xMax: 58,
});
charts.ba = baSc.svg;
const baNote = 'The unlabeled trio at about 38% and 10–11 per million is Houston, Miami and Orlando.';
const GRPOS = { boston: 'r', 'san-francisco': 'r', 'washington-dc': 't', seattle: 'r', minneapolis: 'r', 'san-diego': 'l', denver: 'r', philadelphia: 'r', chicago: 'r', tampa: 'l', 'los-angeles': 'b', atlanta: 'r', 'new-york': 'r', miami: 't', phoenix: 'b', houston: 'l', orlando: 't', detroit: 'b', 'dallas-fort-worth': 'b', riverside: 'b' };
const grSc = ch.scatter({
  label: 'Growth vs density', xLabel: 'Population change, 2020–2025 (%)', yLabel: 'Trad meetings per million',
  points: L.map(c => ({ x: c.census.growth_pct, y: c.tradPerM, label: c.name, color: RCOL[REGION[c.slug]], labelPos: GRPOS[c.slug] })), h: 360, xMax: 15,
});
charts.growth = grSc.svg;

// Buildings
const BPOS = { minneapolis: 'r', chicago: 'b', 'san-francisco': 'r', seattle: 'r', denver: 'r', houston: 'r', boston: 'r', 'new-york': 'b', philadelphia: 'l', 'los-angeles': 't', 'san-diego': 'r', detroit: 'r', 'washington-dc': 'r', 'dallas-fort-worth': 'r', orlando: 'l', phoenix: 'r', atlanta: 't', miami: 'r', tampa: 'r', riverside: 'r' };
const bldPts = L.map(c => ({ x: bld.by_metro[c.slug]?.owned_or_controlled || 0, y: c.tradPerM, label: ['atlanta', 'miami'].includes(c.slug) ? '' : c.name, color: RCOL[REGION[c.slug]], labelPos: BPOS[c.slug] }));
const jitter = {}; for (const p of bldPts) { const k = p.x; jitter[k] = (jitter[k] || 0) + 1; }
const bSc = ch.scatter({ label: 'Buildings vs density', xLabel: 'Folk buildings the community owns or controls', yLabel: 'Trad meetings per million', points: bldPts, h: 360, xMin: -0.4, xMax: 7.4 });
charts.buildings = bSc.svg;

// Venue types
const VKEYS = [...VENUE_KINDS.map(k => k[0]), 'Unknown or varies'];
const VCOL = { 'Pub or bar': C.rust, 'Brewery, winery or café': '#d98a5f', 'Church or temple': C.plum, 'Senior or retirement center': C.rose, 'School, college or library': C.sky, 'Park or outdoors': C.forest, 'Folk venue, theatre or museum': C.mustard, 'Hall, lodge or community center': C.teal, Restaurant: C.sand, 'Private home': '#9a6b3f', 'Unknown or varies': '#d8cfc0' };
const venueAgg = {};
for (const c of L) { const o = {}; for (const e of c.events) { const k = venueKind(e); o[k] = (o[k] || 0) + e.per_month; } venueAgg[c.slug] = o; }
charts.venues = ch.stacked100({ label: 'Where folk happens', keys: VKEYS, colors: VCOL, rows: by(L, c => (venueAgg[c.slug]['Pub or bar'] || 0) / c.total).map(c => ({ label: c.name, parts: venueAgg[c.slug] })), labelW: 112 });
const share = (slug, k) => Math.round(100 * (venueAgg[slug][k] || 0) / cities[slug].total);

// Satellites
const SAT = [
  { metro: 'denver', name: 'Boulder County', pop: 328560, re: /boulder|lafayette|longmont|louisville|lyons|nederland|niwot|superior/i },
  { metro: 'detroit', name: 'Ann Arbor (Washtenaw Co.)', pop: 370214, re: /ann arbor|ypsilanti|chelsea|saline|dexter|washtenaw/i },
  { metro: 'atlanta', name: 'Athens (Clarke Co.)', pop: 129921, re: /athens/i },
];
const satRows = SAT.map(s => {
  const c = cities[s.metro];
  const ev = c.eventsOutside.filter(e => s.re.test(`${e.place} ${e.venue}`));
  const pm = ev.reduce((a, e) => a + e.per_month, 0);
  return { ...s, pm, perM: pm / (s.pop / 1e6), metroPerM: c.total / c.popM, metroName: c.name, metroTotal: c.total };
});
charts.satellites = ch.dumbbell({
  label: 'College-town satellites', aName: 'Whole metro', bName: 'College town next door', labelW: 150,
  rows: satRows.map(s => ({ label: `${s.metroName} → ${s.name.split(' (')[0]}`, a: s.metroPerM, b: s.perM, note: r0(s.perM) })),
  colorA: C.sand, colorB: C.teal,
});

// Contra 2019 vs 2026
const cRows = L.map(c => ({ c, v: contra.by_metro[c.slug] })).filter(x => x.v.y2019.per_month_total != null && (x.v.y2019.per_month_total > 0 || x.v.y2026.per_month_total > 0));
charts.contra = ch.dumbbell({
  label: 'Contra dances a month, 2019 vs 2026', aName: '2019', bName: 'Oct 2026', labelW: 112,
  rows: by(cRows, x => x.v.y2026.per_month_total - x.v.y2019.per_month_total).map(x => ({ label: x.c.name, a: x.v.y2019.per_month_total, b: x.v.y2026.per_month_total })),
  colorA: C.sand, colorB: C.rust, fmtV: r1, max: 30,
});

// Fiddle contests
const milesOf = v => { if (v.active.length) return 0; if (v.nearest_outside?.miles) return v.nearest_outside.miles; const m = String(v.nearest_outside?.name || '').match(/~\s?(\d+)/); return m ? +m[1] : null; };
const contestRows = L.map(c => ({ c, v: contests.by_metro[c.slug], m: milesOf(contests.by_metro[c.slug]) }));
charts.contests = ch.hbar({
  label: 'Miles to the nearest fiddle contest',
  rows: by(contestRows, x => x.m ?? -1).map(x => ({ label: x.c.name, value: x.m ?? 0, color: x.m === 0 ? C.forest : C.rust, note: x.m === 0 ? `inside the metro (${x.v.active.length})` : x.m == null ? 'unclear' : '' })),
  labelW: 112, fmtValue: v => (v === 0 ? '0' : `${r0(v)} mi`),
});

// Week heatmap
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayOf = d => { const m = String(d || '').match(/mon|tue|wed|thu|fri|sat|sun/gi); return m ? [...new Set(m.map(x => x[0].toUpperCase() + x.slice(1, 3).toLowerCase()))] : []; };
const HCATS = [['irish_session', 'Irish sessions'], ['bluegrass_jam', 'Bluegrass jams'], ['oldtime_jam', 'Old-time jams'], ['contra_dance', 'Contra'], ['english_country_dance', 'English country'], ['ceili_or_scottish_country_dance', 'Céilí & Scottish'], ['international_folk_dance', 'Intl. folk dance'], ['shape_note_singing', 'Shape-note'], ['song_circle', 'Song circles'], ['folk_open_mic', 'Folk open mics'], ['heritage_community_event', 'Heritage events']];
const week = {};
for (const c of L) for (const e of c.events) { const ds = dayOf(e.day); for (const d of ds) { week[e.category] = week[e.category] || {}; week[e.category][d] = (week[e.category][d] || 0) + e.per_month / ds.length; } }
charts.week = ch.heatmap({ label: 'When folk happens', rows: HCATS.map(h => h[1]), cols: DAYS, value: (i, j) => { const o = week[HCATS[i][0]] || {}; const tot = Object.values(o).reduce((a, b) => a + b, 0) || 1; return 100 * (o[DAYS[j]] || 0) / tot; }, max: 50, fmtCell: v => `${Math.round(v)}%`, labelW: 112 });
const tod = {};
for (const c of L) for (const e of c.events) { const m = String(e.time || '').match(/^\D*(\d{1,2})/); if (!m) continue; let h = +m[1]; if (/pm/i.test(e.time) && h < 12) h += 12; tod[e.category] = tod[e.category] || { d: 0, t: 0 }; tod[e.category].t += e.per_month; if (h < 17) tod[e.category].d += e.per_month; }
charts.daytime = ch.hbar({ label: 'Share of meetings that start before 5 pm', rows: by(HCATS.filter(h => tod[h[0]]?.t > 20), h => tod[h[0]].d / tod[h[0]].t).map(h => ({ label: h[1], value: 100 * tod[h[0]].d / tod[h[0]].t, color: C.mustard })), labelW: 112, fmtValue: v => `${Math.round(v)}%`, max: 100 });

// Survival
const KIND = k => { k = String(k || '').toLowerCase(); if (/irish|pub session|seisi/.test(k)) return 'Irish & pub sessions'; if (/contra|dance series|barn dance/.test(k)) return 'Contra & dance series'; if (/coffee|listening|folk club|nightclub|^club|venue|concert series|music hall|cabaret/.test(k)) return 'Clubs & coffeehouses'; if (/festival|fest\b/.test(k)) return 'Festivals'; if (/radio/.test(k)) return 'Radio shows'; if (/jam/.test(k)) return 'Bluegrass & old-time jams'; if (/morris|sword|rapper/.test(k)) return 'Morris & sword teams'; if (/contest|convention/.test(k)) return 'Fiddle contests'; return null; };
const dead = [];
for (const c of L) for (const d of c.defunct) { const m = String(d.years || '').match(/(1[6-9]\d\d|20[0-2]\d)\D{1,12}(1[6-9]\d\d|20[0-2]\d)/); if (!m || +m[2] < +m[1]) continue; dead.push({ s: +m[1], e: +m[2], kind: KIND(d.kind), c: c.slug, n: d.name, why: String(d.why_it_ended || '') }); }
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const kinds = {}; for (const d of dead) if (d.kind) (kinds[d.kind] = kinds[d.kind] || []).push(d.e - d.s);
const kindRows = Object.entries(kinds).filter(([, v]) => v.length >= 6).map(([k, v]) => ({ label: k, value: med(v), note: `n=${v.length}` }));
charts.lifespan = ch.hbar({ label: 'Median lifespan of things that ended', rows: by(kindRows, r => r.value).map(r => ({ ...r, color: C.plum })), labelW: 160, max: 40, fmtValue: v => `${r1(v)} yrs` });
const WHY = [['Pub/venue owner, landlord or rent', /owner|landlord|rent|lease|sold|evict|manage|new owner|bar (closed|changed)|pub (closed|changed)/i], ['COVID-19', /covid|pandemic|lockdown/i], ['Organizer died, retired or moved', /died|death|retire|moved away|passed away|relocat/i], ['Demolition or redevelopment', /demol|redevelop|razed|torn down|condo/i], ['Money or attendance', /attendance|funding|money|financ|deficit|cost|declin|sustainab/i], ['Fire, storm or flood', /fire|hurricane|flood|storm/i]];
const whyCount = WHY.map(([n, re]) => ({ label: n, value: dead.filter(d => re.test(d.why)).length }));
charts.why = ch.hbar({ label: 'Why things ended', rows: by(whyCount, r => r.value).map(r => ({ ...r, color: C.rust })), labelW: 196, fmtValue: v => `${v}` });
const founded = []; for (const c of L) for (const e of c.events) if (+e.founded > 1800 && +e.founded <= 2026) founded.push(+e.founded);
const fBins = [['pre-1950', y => y < 1950], ['1950s', y => y >= 1950 && y < 1960], ['1960s', y => y >= 1960 && y < 1970], ['1970s', y => y >= 1970 && y < 1980], ['1980s', y => y >= 1980 && y < 1990], ['1990s', y => y >= 1990 && y < 2000], ['2000s', y => y >= 2000 && y < 2010], ['2010s', y => y >= 2010 && y < 2020], ['2020s', y => y >= 2020]];
charts.founded = ch.columns({ label: 'Founding decade of today\'s events', bins: fBins.map(([l, f]) => ({ label: l, value: founded.filter(f).length, color: l === '2020s' ? C.rust : C.teal })), h: 190 });
const since2010 = founded.filter(y => y >= 2010).length, since2020 = founded.filter(y => y >= 2020).length;

// The Session vs verified
charts.session = ch.dumbbell({
  label: 'Irish sessions: listed vs verified', aName: 'Listed on thesession.org', bName: 'Verified series', labelW: 112,
  rows: by(L, c => c.events.filter(e => e.category === 'irish_session').length).map(c => ({ label: c.name, a: c.sessionListings.length, b: c.events.filter(e => e.category === 'irish_session').length })),
  colorA: C.sand, colorB: C.teal, fmtV: v => r0(v), max: 48,
});
const listedR = corr(L.map(c => c.sessionListings.length / c.popM), L.map(c => (c.byCat.irish_session || 0) / c.popM));
const sinceListing = { n: L.reduce((s, c) => s + c.sessionListings.filter(x => x.date >= '2022').length, 0), t: L.reduce((s, c) => s + c.sessionListings.length, 0) };

// NEA
const NPOS = { 'new-york': 'l', 'los-angeles': 'r', chicago: 'r', 'washington-dc': 'r', 'san-francisco': 'l', philadelphia: 'r', boston: 'l', seattle: 'r', minneapolis: 'r', 'san-diego': 'r', denver: 'r', tampa: 'b', atlanta: 'r', detroit: 'b', miami: 'l', orlando: 't', houston: 'r', phoenix: 'b', 'dallas-fort-worth': 't', riverside: 'b' };
const NEA_UNL = ['tampa', 'atlanta', 'miami', 'houston', 'orlando', 'phoenix', 'dallas-fort-worth'];
charts.nea = ch.scatter({ label: 'NEA Heritage Fellows vs density', xLabel: 'NEA National Heritage Fellows living in the metro (1982–2026)', yLabel: 'Trad meetings per million', points: L.map(c => ({ x: c.nea?.count || 0, y: c.tradPerM, label: NEA_UNL.includes(c.slug) ? '' : c.name, color: RCOL[REGION[c.slug]], labelPos: NPOS[c.slug] })), h: 360, fit: false, xMin: -2, xMax: 44 }).svg;
const neaCats = {}; for (const f of nea.fellows) if (f.metro) neaCats[f.category] = (neaCats[f.category] || 0) + 1;
const neaMetroTotal = nea.fellows.filter(f => f.metro).length;

// Radio, cost, tunes
const radio = L.map(c => ({ c, h: radioHours(c) }));
charts.radio = ch.hbar({ label: 'Folk radio hours a week', rows: by(radio, x => x.h).map(x => ({ label: x.c.name, value: x.h, color: x.h > 100 ? C.teal : C.sky })), labelW: 112, fmtValue: v => `${r0(v)} h` });
const freeShare = L.map(c => { const k = c.events.filter(e => e.cost_usd !== null && e.cost_usd !== '' && e.cost_usd !== undefined && !isNaN(+e.cost_usd)); const pm = a => a.reduce((s, e) => s + e.per_month, 0); return { c, v: 100 * pm(k.filter(e => +e.cost_usd === 0)) / pm(k), n: k.length }; });
const contraPrice = L.map(c => ({ c, p: +c.data.costs?.contra_dance_admission_usd || null })).filter(x => x.p);
charts.price = ch.hbar({ label: 'Minutes of median household income for one contra admission', rows: by(contraPrice, x => x.p / (x.c.acs.median_hh_income / 2080 / 60)).map(x => ({ label: x.c.name, value: x.p / (x.c.acs.median_hh_income / 2080 / 60), note: `$${x.p}`, color: C.mustard })), labelW: 112, max: 32, fmtValue: v => `${Math.round(v)} min` });
const freeAll = (() => { let f = 0, t = 0; for (const x of freeShare) { const c = x.c; for (const e of c.events) if (e.cost_usd !== null && e.cost_usd !== '' && e.cost_usd !== undefined && !isNaN(+e.cost_usd)) { t += e.per_month; if (+e.cost_usd === 0) f += e.per_month; } } return 100 * f / t; })();
const AMBIG = new Set(['Washington', 'Mississippi', 'Delaware', 'Michigan', 'Minnesota', 'Arizona', 'Colorado', 'Ontario', 'Windsor', 'Aurora', 'Riverside', 'Cambridge', 'Concord', 'Salem', 'Lexington', 'Gloucester', 'Camden', 'Wilmington', 'Phoenix', 'Mesa', 'Quincy', 'Broadway', 'Queens', 'Bellevue', 'Arlington', 'Alexandria', 'Georgetown', 'Marin', 'Alameda', 'Pasadena', 'Decatur', 'Marietta', 'Newark', 'Charlestown', 'Denton', 'Mount Vernon', 'Clearwater']);
const cleanTitles = c => [...new Set(Object.entries(c.titles).filter(([k]) => !AMBIG.has(k)).flatMap(([, v]) => v))];
const tuneRows = L.map(c => ({ c, n: cleanTitles(c).length, ex: Object.entries(c.titles).sort((a, b) => b[1].length - a[1].length)[0] })).filter(x => x.n > 0);
charts.tunes = ch.hbar({ label: 'Tunes on The Session named for places in each metro', rows: by(tuneRows, x => x.n).map(x => ({ label: x.c.name, value: x.n, color: C.forest })), labelW: 112, fmtValue: v => `${v}` });
const bostonTitles = cleanTitles(cities.boston).slice(0, 6).map(t => t.replace(/ \[.*\]$/, ''));

// Heritage
const hv = L.map(c => { const v = {}; for (const h of c.heritage) v[h.vitality] = (v[h.vitality] || 0) + 1; return { c, v }; });
charts.heritage = ch.stacked100 ? (() => {
  const keys = ['thriving', 'active', 'niche', 'fading', 'historic_only'];
  const cols = { thriving: C.forest, active: C.teal, niche: C.sky, fading: C.sand, historic_only: '#d8cfc0' };
  const max = Math.max(...hv.map(x => keys.reduce((s, k) => s + (x.v[k] || 0), 0)));
  const labelW = 112, pw = ch.W - labelW - 30, rowH = 18;
  let body = '', lx = 4;
  for (const k of keys) { body += `<rect x="${lx}" y="3" width="10" height="10" rx="2" fill="${cols[k]}"/><text x="${lx + 13}" y="12" font-size="10.5" fill="${C.ink}">${k.replace('_only', ' only')}</text>`; lx += 20 + k.length * 6.3; }
  let y = 24;
  for (const x of by(hv, x => (x.v.thriving || 0) + (x.v.active || 0))) {
    body += `<text x="${labelW - 6}" y="${y + 12}" font-size="11" text-anchor="end" fill="${C.ink}">${esc(x.c.name)}</text>`;
    let xx = labelW;
    for (const k of keys) { const w = (x.v[k] || 0) / max * pw; if (w) body += `<rect x="${xx}" y="${y + 2}" width="${w}" height="${rowH - 4}" fill="${cols[k]}"><title>${esc(`${x.c.name}: ${x.v[k]} ${k}`)}</title></rect>`; xx += w; }
    body += `<text x="${xx + 4}" y="${y + 12}" font-size="10.5" fill="${C.muted}">${(x.v.thriving || 0) + (x.v.active || 0)}</text>`;
    y += rowH;
  }
  return `<svg viewBox="0 0 ${ch.W} ${y + 4}" class="chart" role="img" aria-label="Heritage traditions">${body}</svg>`;
})() : '';
const foreignR = corr(L.map(c => c.acs.pct.foreign_born), hv.map(x => (x.v.thriving || 0) + (x.v.active || 0)));

// Shape note: heartland vs revival using directory counts
const sh = L.map(c => ({ c, v: c.byCat.shape_note_singing || 0 }));

// City cards
const pct = (a, b) => Math.round(100 * a / b);
function card(c) {
  const k = CARDS[c.slug];
  const rank = ranked.indexOf(c) + 1;
  const g = c.byGroup;
  const bar = GKEYS.map(key => { const w = 100 * (g[key] || 0) / c.total; return w ? `<span style="width:${w.toFixed(1)}%;background:${({ 'Tune sessions & jams': C.rust, 'Social dance': C.teal, Singing: C.plum, 'Open mics': C.sky, 'Heritage community': C.mustard, Other: C.sand })[key]}" title="${esc(key)} ${Math.round(w)}%"></span>` : ''; }).join('');
  const top3 = Object.entries(c.byCat).filter(([k]) => k !== 'heritage_community_event' && k !== 'other').sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${({ irish_session: 'Irish sessions', bluegrass_jam: 'bluegrass jams', oldtime_jam: 'old-time jams', international_folk_dance: 'international folk dance', ceili_or_scottish_country_dance: 'céilí & Scottish dance', contra_dance: 'contra', english_country_dance: 'English country dance', folk_open_mic: 'folk open mics', song_circle: 'song circles', other_session: 'other sessions', shape_note_singing: 'shape-note singing', scandinavian_dance: 'Scandinavian dance', morris_sword_team: 'morris', shanty_or_song_sing: 'shanty & song sings', square_dance: 'old-time squares', scottish_capebreton_session: 'Scottish/Cape Breton sessions' })[k] || k} ${r0(v)}`).join(' · ');
  return `<article class="city" id="city-${c.slug}">
  <h3><span class="rank">#${rank}</span> ${esc(c.name)} <small>${(c.pop / 1e6).toFixed(1)}M people</small></h3>
  <p class="tag">${esc(k.tag)}</p>
  <div class="stats"><div><b>${r0(c.total)}</b><span>meetings a month</span></div><div><b>${r1(c.tradPerM)}</b><span>trad per million</span></div><div><b>${c.festivalsActive}</b><span>active festivals</span></div><div><b>${bld.by_metro[c.slug]?.owned_or_controlled || 0}</b><span>owned buildings</span></div></div>
  <div class="minibar">${bar}</div>
  <p class="busiest">Busiest: ${esc(top3)} a month</p>
  <ul>${k.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
  <p class="more"><a href="../cities/${c.slug}.md">Full dossier</a> · <a href="../cities/${c.slug}.json">data</a></p>
</article>`;
}

// ---------- page ----------
const fig = (id, title, svg, caption = '') => `<figure id="${id}"><figcaption class="ft">${title}</figcaption>${svg}${caption ? `<figcaption class="cap">${caption}</figcaption>` : ''}</figure>`;
const v = s => cities[s];
const ratioTopBottom = top.tradPerM / bottom.tradPerM;
const mw = by(L, c => c.mwsdTotal);
const cBorn = Object.values(contra.by_metro).reduce((s, m) => s + (m.born_since_2020 || []).length, 0);
const cDied = Object.values(contra.by_metro).reduce((s, m) => s + (m.died_since_2020 || []).length, 0);
const noContest = contestRows.filter(x => x.m !== 0).map(x => x.c.name);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Where the tunes live: folk scenes of America's 20 biggest metros</title>
<style>
:root{--paper:${C.paper};--ink:${C.ink};--muted:${C.muted};--rust:${C.rust};--teal:${C.teal}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 Georgia,'Iowan Old Style','Palatino Linotype',serif;overflow-x:hidden}
main{max-width:760px;margin:0 auto;padding:0 18px 80px}
header.hero{padding:44px 0 18px;border-bottom:3px double #cdbfa8}
.kicker{font:600 12px/1.3 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--rust)}
h1{font-size:clamp(30px,6.4vw,48px);line-height:1.08;margin:.25em 0 .3em;letter-spacing:-.01em}
h2{font-size:clamp(23px,4.6vw,31px);line-height:1.18;margin:2.2em 0 .4em}
h2 .q{display:block;font:600 12px/1.4 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--rust);margin-bottom:.3em}
h3{font-size:21px;margin:0 0 .1em}
p{margin:.7em 0}a{color:var(--teal)}
.dek{font-size:19px;color:#4a423b}
.big{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:22px 0}@media (min-width:700px){.big{grid-template-columns:repeat(4,1fr)}}
.big div{background:#fffaf1;border:1px solid #e6dccb;border-radius:10px;padding:12px 14px}
.big b{display:block;font-size:30px;line-height:1.1;color:var(--rust)}.big span{font:13px/1.35 system-ui,sans-serif;color:var(--muted)}
figure{margin:22px 0 26px;padding:14px 12px 10px;background:#fffaf1;border:1px solid #e6dccb;border-radius:12px}
.ft{font:700 14.5px/1.35 system-ui,sans-serif;margin:0 0 8px}
.cap{font:13px/1.45 system-ui,sans-serif;color:var(--muted);margin-top:8px}
svg.chart{width:100%;height:auto;display:block;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
svg .halo{paint-order:stroke;stroke:#fffaf1;stroke-width:3px;stroke-linejoin:round}
.legend{font:12px/1.6 system-ui,sans-serif;color:var(--muted);margin:4px 0 0}.legend span{margin-right:12px;white-space:nowrap}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.answer{border-left:4px solid var(--teal);padding:2px 0 2px 14px;margin:14px 0;font-size:17.5px}
.answer b:first-child{color:var(--teal)}
.notes{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.notes div{background:#fffaf1;border:1px solid #e6dccb;border-radius:10px;padding:12px 14px;font-size:15.5px}
.notes h4{margin:0 0 4px;font:700 14px/1.3 system-ui,sans-serif;color:var(--rust)}
nav.toc{font:14.5px/1.7 system-ui,sans-serif;background:#fffaf1;border:1px solid #e6dccb;border-radius:12px;padding:12px 16px;margin:20px 0}
nav.toc ol{margin:0;padding-left:20px}
.cities{display:grid;gap:14px}
article.city{background:#fffaf1;border:1px solid #e6dccb;border-radius:12px;padding:14px 16px}
article.city h3 small{font:13px system-ui,sans-serif;color:var(--muted);font-weight:400}
.rank{font:700 13px system-ui,sans-serif;color:#fff;background:var(--rust);border-radius:6px;padding:1px 6px;vertical-align:3px}
.tag{font-style:italic;color:#5a5048;margin:.1em 0 .5em}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0 8px}
.stats div{text-align:center}.stats b{display:block;font-size:20px}.stats span{font:11px/1.2 system-ui,sans-serif;color:var(--muted)}
.minibar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:#eee6d6}.minibar span{display:block;height:100%}
.busiest{font:13px/1.45 system-ui,sans-serif;color:var(--muted);margin:.5em 0}
article.city ul{margin:.4em 0;padding-left:20px;font-size:15.5px}article.city li{margin:.3em 0}
.more{font:13px system-ui,sans-serif;margin:.3em 0 0}
.method{font:14.5px/1.55 system-ui,sans-serif;color:#4a423b}
.method li{margin:.35em 0}
@media (max-width:520px){body{font-size:16px}.stats b{font-size:17px}}
</style></head><body><main>
<header class="hero">
<div class="kicker">A field survey · October 2026</div>
<h1>Where the tunes live</h1>
<p class="dek">An attempt to count every Irish session, old-time jam, contra dance, shape-note singing, song circle and heritage practice in America's 20 largest metro areas, and then to ask what the counts mean.</p>
<div class="big">
<div><b>${r0(grand)}</b><span>recurring folk meetings a month across the 20 metros</span></div>
<div><b>${r0(eventsN)}</b><span>verified series, each with 2024–26 evidence</span></div>
<div><b>${r1(ratioTopBottom)}×</b><span>${esc(top.name)}'s trad density vs. ${esc(bottom.name)}'s</span></div>
<div><b>${r0(freeAll)}%</b><span>of priced meetings are free</span></div>
</div>
</header>

<nav class="toc"><b>Contents</b><ol>
<li><a href="#scoreboard">The scoreboard</a></li>
<li><a href="#fingerprints">Every city's folk fingerprint</a></li>
<li><a href="#questions">Twelve questions the research raised</a></li>
<li><a href="#notes">Patterns that kept turning up</a></li>
<li><a href="#cities">The 20 cities</a></li>
<li><a href="#method">How this was made</a></li>
</ol></nav>

<p>Ten research sessions spent a day reading organizer calendars, association jam lists, church bulletins, Meetup pages, radio schedules, archives, obituaries and oral histories for two metros each. They wrote a dossier and a structured census of recurring events for every metro. A coordinator then pulled in the Census, the full thesession.org database, every NEA National Heritage Fellow since 1982, national dance and singing directories, and four follow-up studies. In total: ${r0(eventsN)} counted series, ${r0(L.reduce((s, c) => s + c.defunct.length, 0))} dead ones, ${r0(L.reduce((s, c) => s + (c.data.people || []).length, 0))} people and ${r0(L.reduce((s, c) => s + (c.data.sources || []).length, 0))} cited sources.</p>
<p>"Folk" here means four layers: tune sessions and social dance; song circles, folk clubs and open mics; traditional singing; and the living heritage practice of each metro's communities. A meeting counts if it recurs, is open to the public, meets inside the metro's counties, and had evidence in 2024–26. Modern western club square dancing is reported separately. "Trad meetings" means the first three layers.</p>

<h2 id="scoreboard"><span class="q">Part 1</span>The scoreboard</h2>
<p>Raw counts favor big cities, so the fair comparison is per person. On that measure, <b>${esc(top.name)}</b> leads with ${r1(top.tradPerM)} trad meetings a month per million residents. <b>${esc(bottom.name)}</b> trails at ${r1(bottom.tradPerM)}. A fiddler moving from Riverside to Boston gets about ${Math.round(ratioTopBottom)} times as many chances to play per neighbor.</p>
${fig('f-density', 'Trad meetings per million residents, per month', charts.density + regionLegend(), 'Sessions, jams, social dance and traditional singing inside each Census metro (MSA), counting only medium/high-confidence series with 2024–26 evidence. Number at right: meetings a month.')}
<p>New York has the most of everything (${r0(nyc.total)} meetings a month, ${r0(nyc.byCat.irish_session || 0)} of them Irish sessions) but spreads it over 20 million people, so it ranks ${ranked.indexOf(nyc) + 1}th. The three metros that punch furthest above their size are Boston, the SF Bay and Washington. All three are old, rich, highly educated metros, a pattern Part 3 picks up.</p>
${fig('f-slope', 'Big isn\'t busy: population rank vs. density rank', charts.slope, 'Teal lines rise four or more places; rust lines fall four or more.')}
${fig('f-map', 'How much happens, and what kind', charts.map + `<p class="legend">${Object.entries(topGroupColor).slice(0, 5).map(([k, v]) => `<span><i style="background:${v}"></i>${k}</span>`).join('')}</p>`, 'Color is the largest of the four layers in each metro.')}

<h2 id="fingerprints"><span class="q">Part 2</span>Every city's folk fingerprint</h2>
<p>The same word, "folk," covers very different weeks. In ${esc(by(L, c => (c.byGroup['Tune sessions & jams'] || 0) / c.total)[0].name)}, ${pct(by(L, c => (c.byGroup['Tune sessions & jams'] || 0) / c.total)[0].byGroup['Tune sessions & jams'], by(L, c => (c.byGroup['Tune sessions & jams'] || 0) / c.total)[0].total)}% of all meetings are tune sessions and jams. In ${esc(by(L, c => (c.byGroup['Social dance'] || 0) / c.total)[0].name)} and Los Angeles, dancers dominate. In ${esc(by(L, c => (c.byGroup['Heritage community'] || 0) / c.total)[0].name)}, ${pct(by(L, c => (c.byGroup['Heritage community'] || 0) / c.total)[0].byGroup['Heritage community'], by(L, c => (c.byGroup['Heritage community'] || 0) / c.total)[0].total)}% of the calendar is heritage practice: Puerto Rican bomba and plena, Colombian cumbia, Haitian twoubadou, mariachi, Greek dance, powwow.</p>
${fig('f-mix', 'The four layers, by share of meetings', charts.mix)}
<p>The jam scene alone splits the country three ways. Plot every city by its share of Irish sessions, bluegrass jams and old-time jams and you get a map without geography. The Northeast and Chicago crowd the Irish corner; the Sun Belt slides toward bluegrass; and almost nobody is near the old-time corner. Old-time, the music this tune book is fullest of, is the rarest of the three in 17 of the 20 metros. The exceptions are a surprise: in Miami and Tampa Bay old-time jams outnumber Irish sessions, and in Atlanta they tie. By raw count its strongest showings are the Twin Cities (${r1(v('minneapolis').byCat.oldtime_jam || 0)} jams a month), Boston (${r1(v('boston').byCat.oldtime_jam || 0)}) and Seattle (${r1(v('seattle').byCat.oldtime_jam || 0)}).</p>
${fig('f-ternary', 'The jam triangle: Irish vs. bluegrass vs. old-time', charts.ternary + regionLegend(), 'Each dot\'s position is its mix of the three jam types; dot size is their combined monthly count. The unlabeled cluster at center left, roughly half Irish and half bluegrass, is New York, the SF Bay, Houston, Dallas–Fort Worth, San Diego and Orlando.')}
<p>Dance is just as regional. Contra, the New England dance that most of these scenes grew from, is the biggest dance form only in a handful of cities. Los Angeles, San Diego and San Francisco are international and Israeli folk dance towns; Philadelphia and Chicago lean on céilí and Scottish country dance; Seattle and the Twin Cities have real Scandinavian scenes.</p>
${fig('f-dance', 'Who dances what', charts.dance, 'Share of each metro\'s social-dance meetings. Modern western club square dancing is excluded here and shown below.')}
<p>Then there is the other square dance. Modern western square dancing, the club form with callers, levels and petticoats, is the largest dance form in much of the Sun Belt and in the Bay Area. In ${esc(mw[0].name)} its clubs list ${r0(mw[0].mwsdTotal)} club nights a month. It is counted separately because only some dossiers listed every club.</p>
${fig('f-mwsd', 'Modern western square-dance club nights per contra dance', charts.mwsd, `Metros where the dossier enumerated club nights. The Inland Empire is off the chart: ${r0(cities.riverside.mwsdTotal)} club nights a month and no contra at all. Boston, Philadelphia, Chicago, Detroit, Seattle, Denver and the Twin Cities either have few clubs or did not list them.`)}

<h2 id="questions"><span class="q">Part 3</span>Twelve questions the research raised</h2>
<p>Every dossier ended with questions. Many recurred across cities, so these twelve got follow-up research and data of their own.</p>

<h2><span class="q">Question 1</span>What actually predicts a big folk scene?</h2>
<p>The obvious guesses are size, Irish heritage or a southern fiddling past. None of them is the strongest predictor. That is <b>education and money</b>, which travel together. The share of adults with a bachelor's degree explains about ${Math.round(baSc.r2 * 100)}% of the variation in trad density (r = ${pBA.r.toFixed(2)}), and median household income does about as well (r = ${pInc.r.toFixed(2)}). By rank, which is less swayed by Boston and the Bay Area, education is the clearer signal (${pBA.rs.toFixed(2)} vs. ${pInc.rs.toFixed(2)}). Irish ancestry, owned buildings and latitude come next. Population size doesn't predict density at all.</p>
${fig('f-pred', 'Correlation of each factor with trad meetings per million', charts.predictors, 'Pearson r across the 20 metros. Sources: ACS 2024 1-year, Census Vintage 2025 estimates, folk-building survey, dossier radio listings. Correlation, not causation, and n = 20.')}
${fig('f-ba', 'The college effect', charts.ba + regionLegend(), baNote)}
<p class="answer"><b>Answer:</b> the revival scenes (sessions, contra, shape-note, song circles) behave like a college-educated pastime. Heritage practice doesn't: heritage events per million have almost no correlation with education (r = ${pBA.rh.toFixed(2)}). The revival and heritage layers are two separate folk worlds with different social bases.</p>

<h2><span class="q">Question 2</span>Do folk scenes follow the U-Haul?</h2>
<p>Since 2020 Americans have poured into Dallas, Houston, Orlando, Phoenix and Tampa, and out of New York, LA, San Francisco and Chicago. If musicians move with everyone else, the boomtowns should be catching up.</p>
${fig('f-growth', 'Population growth vs. scene density', charts.growth + regionLegend())}
<p class="answer"><b>Answer:</b> not yet. Four of the five fastest-growing metros (Dallas–Fort Worth, Orlando, Houston, Phoenix) rank 14th to 19th for density, and the fifth, Tampa Bay, is 10th (r = ${predR.find(p => p.n.startsWith('Population growth')).r.toFixed(2)}). The dossiers suggest why: scenes take decades and institutions to build, and Sun Belt metros grew by suburbs. Their jams run on weekday mornings at senior centers and RV resorts (Phoenix), in parking lots (Orlando's Friday jam behind a Pizza Hut since about 1990), and around the winter snowbird calendar. Florida's numbers swell from November to April.</p>

<h2><span class="q">Question 3</span>Does owning the building matter?</h2>
<p>The Twin Cities dossier noticed that its densest block, Minnehaha Avenue, is anchored by a hall the dance community owns. Detroit's scene lost a 24-year contra series when Henry Ford's museum gave it four days' notice. A follow-up survey catalogued every folk facility a community owns or controls across the 20 metros: ${bld.facilities.length} facilities (${bld.facilities.length - bld.facilities.filter(f => f.tenure === 'precarious').length} owned, long-leased or public), plus ${bld.losses.length} documented losses.</p>
${fig('f-bld', 'Owned folk buildings vs. density', charts.buildings + regionLegend(), 'Owned or long-leased folk schools, dance halls, listening rooms and ethnic halls that host folk dance. The unlabeled dots at zero are Atlanta and Miami; Tampa and the Inland Empire have none either.')}
<p class="answer"><b>Answer:</b> mostly yes (r = ${Math.sqrt(bSc.r2).toFixed(2)} for the raw count, ${predR.find(p => p.n.startsWith('Owned')).r.toFixed(2)} per capita). Ownership seems to buy protection from landlords rather than guarantee success: Chicago's Swedish Club owned its building for 88 years and still closed. The losses read like a list of folk landmarks: Gerde's Folk City (rent nearly tripled), Peoples' Voice Cafe (its church was sold for a condo tower), Lovett Hall (four days' notice), DC's Potter's House (closed January 2026). A third model works too: public land plus a nonprofit partner. Glen Echo Park, Balboa Park's international cottages and Phoenix's Irish Cultural Center all run that way.</p>

<h2><span class="q">Question 4</span>Where does folk actually happen?</h2>
<p>Every counted event's venue was sorted into kinds by keyword. Each city's folk has a home address, and they differ a lot.</p>
${fig('f-venues', 'Where the meetings happen', charts.venues, 'Share of monthly meetings by venue type, classified from venue names. About 16% couldn\'t be classified.')}
<p class="answer"><b>Answer:</b> pubs in the Irish North (${share('chicago', 'Pub or bar')}% of Chicago's meetings, ${share('boston', 'Pub or bar')}% of Boston's); churches in the South (${share('houston', 'Church or temple')}% in Houston, ${share('atlanta', 'Church or temple')}% in Atlanta, where fellowship halls host jams and the Sacred Harp lives in country churches); halls and lodges where communities own them (${share('minneapolis', 'Hall, lodge or community center')}% in the Twin Cities). The Inland Empire meets in parks and schools, and Phoenix and LA in senior centers and retirement villages.</p>

<h2><span class="q">Question 5</span>Is the real scene in the college town next door?</h2>
<p>Three dossiers independently said that their metro's most intense scene sits just outside the Census boundary, in a university town.</p>
${fig('f-sat', 'Meetings per million: the metro vs. its college-town neighbor', charts.satellites, 'Meetings a month per million residents. Satellite counts include only events the metro dossier recorded as outside the MSA, so they are lower bounds.')}
<p class="answer"><b>Answer:</b> yes, dramatically. Boulder County runs about ${r0(satRows[0].perM)} meetings per million residents a month, roughly ${Math.round(satRows[0].perM / satRows[0].metroPerM)} times the Denver metro. Ann Arbor out-plays the whole Detroit metro per person by about ${Math.round(satRows[1].perM / satRows[1].metroPerM)} to 1; Detroit's own Comhaltas branch has met there since 2010. Inside the metros the same thing happens at smaller scale: Cambridge and Somerville for Boston, Berkeley for the Bay. The college effect from Question 1 shows up at town level too.</p>

<h2><span class="q">Question 6</span>Did contra dancing survive COVID?</h2>
<p>Several dossiers described contra as hit hard: SF had none from 2020 to 2024, and San Diego went from weekly to twice a month. A follow-up study rebuilt each metro's 2019 contra calendar from Wayback Machine snapshots of organizer sites and contradancelinks.com.</p>
${fig('f-contra', 'Contra dances a month, 2019 vs. October 2026', charts.contra, 'The 2026 counts used more sources than the 2019 snapshots, so gains are overstated where small series were missed in 2019 (Boston, Philadelphia). Orlando is omitted (no reliable 2019 baseline).')}
<p class="answer"><b>Answer:</b> in the strong scenes, yes. Every flagship weekly dance in Boston, Seattle, Chicago, the Twin Cities, Philadelphia and Atlanta is still weekly. Where contra was already thin it shrank further: Miami, Dallas–Fort Worth, San Diego and Denver lost about half or more. The study counted ${cBorn} series born since 2020 and ${cDied} that died. Several of the "COVID deaths" were declining before 2020. Gender-neutral calling (larks and robins) is now near-universal, but it spread before the pandemic: Boston's gender-free contra dates to 1988, and Philadelphia scheduled its vote for March 2020.</p>

<h2><span class="q">Question 7</span>Where did the fiddle contests go?</h2>
<p>Fiddle contests were the original public stage for American fiddling: Atlanta's Georgia Old-Time Fiddlers' Conventions filled a 5,000-seat auditorium for 22 years. Is contest culture still urban?</p>
${fig('f-contests', 'Miles to the nearest fiddle contest', charts.contests, 'Green = a contest with a 2024–26 edition inside the metro. Includes Texas-style, old-time, bluegrass, Scottish and Irish fleadh competitions.')}
<p class="answer"><b>Answer:</b> mostly not. ${noContest.length} of the 20 metros have no fiddle contest inside them, including Chicago, Houston, Philadelphia, the Bay Area and Seattle. Contests survive in the West's fiddlers'-association country (Phoenix, Denver, LA's Topanga since 1961), in Texas, and in Minnesota. Elsewhere state associations are run from small towns 100–300 miles away. A small counter-tradition: Berkeley (1968) and San Diego's Balboa Park (1970s) both ran mock contests with rutabagas as prizes. The Balboa Park contests ended when the park stopped supplying power for the PA.</p>

<h2><span class="q">Question 8</span>When does America play?</h2>
<p>Every event with a day of the week was pooled across all 20 cities.</p>
${fig('f-week', 'Share of each kind of meeting by day of week', charts.week, 'Each row sums to 100%.')}
${fig('f-daytime', 'Share of meetings that start before 5 pm', charts.daytime)}
<p class="answer"><b>Answer:</b> Sunday is session day: ${Math.round(100 * (week.irish_session?.Sun || 0) / Object.values(week.irish_session || {}).reduce((a, b) => a + b, 0))}% of Irish sessions fall on Sunday, often in the afternoon. That is why NFL Sundays keep evicting them (see Patterns). Weeknights belong to dancers, and Saturday is contra's night. Song circles, old-time jams and shape-note singings are the most daytime traditions, with about half starting before 5 pm. Seattle's best-documented old-time jams meet at 2 pm on weekdays, and Phoenix's bluegrass meets on weekday mornings. Open mics and contra are almost entirely evening events.</p>

<h2><span class="q">Question 9</span>How long do things last, and why do they die?</h2>
<p>The dossiers recorded ${r0(L.reduce((s, c) => s + c.defunct.length, 0))} dead sessions, venues, dances, festivals and radio shows; ${dead.length} have start and end years.</p>
${fig('f-life', 'Median lifespan of things that ended', charts.lifespan, 'Only categories with at least six dated endings. Survivorship cuts the other way too: what is still running isn\'t in this chart.')}
${fig('f-why', 'Why they ended (keyword count of recorded reasons)', charts.why)}
${fig('f-founded', 'When today\'s events were founded', charts.founded, `${founded.length} of ${eventsN} counted series have a known founding year.`)}
<p class="answer"><b>Answer:</b> a pub session that ended lasted a median of five years, and it usually ended because the pub changed, not because the players quit. Tampa's dossier found that every session that died was cut by the owner. Dallas lost one to a BMI licensing threat; New York's Cabaret Law limited unlicensed rooms to three musicians and no wind instruments. Of today's series with a known start date, ${pct(since2010, founded.length)}% began after 2010 and ${pct(since2020, founded.length)}% after 2020. The scene is old in its traditions but young in its institutions, constantly rebuilt by new hosts.</p>

<h2><span class="q">Question 10</span>Does thesession.org tell the truth?</h2>
<p>Thesession.org is the closest thing to a national census of Irish sessions. Several dossiers found it stale; Phoenix, the fifth-largest metro, has one listing.</p>
${fig('f-session', 'Irish sessions: thesession.org listings vs. verified series', charts.session, 'Listings = active thesession.org entries geolocated inside each metro (Oct 2026 dump). Verified = recurring Irish sessions with 2024–26 evidence.')}
<p class="answer"><b>Answer:</b> it's a good relative guide (listings per capita correlate at r = ${listedR.toFixed(2)} with verified sessions per capita) but a poor absolute one. It misses a fifth to a half of the sessions in Chicago, Boston and the Bay Area. In New York it errs the other way: its 38 listings outnumber the 24 sessions verified at medium or high confidence, because dead sessions linger. Half the current listings in these metros (${sinceListing.n} of ${sinceListing.t}) were added or edited since 2022, which suggests renewed community upkeep.</p>

<h2><span class="q">Question 11</span>Who gets the medals?</h2>
<p>The NEA National Heritage Fellowship is the country's highest honor for traditional artists: ${nea.fellows.length} people (502 awards) since 1982. ${neaMetroTotal} of them lived in one of these 20 metros.</p>
${fig('f-nea', 'NEA Heritage Fellows vs. scene density', charts.nea + regionLegend(), 'The unlabeled Sun Belt cluster (0–4 fellows, 7–17 meetings per million) is Atlanta, Tampa Bay, Miami, Houston, Orlando, Phoenix and Dallas–Fort Worth.')}
<p class="answer"><b>Answer:</b> honors and everyday activity barely overlap. New York has 40 fellows (klezmer and Yiddish song, Irish, Greek, Balkan, Jewish liturgical music) but low per-capita density. Boston, the densest scene, has 8; Seattle has 2; Denver has 1; Phoenix has none, because all five Arizona fellows live in Tucson or on reservations. The fellowship rewards tradition bearers in heritage communities, while the busiest calendars belong to the revival, so the two measure different things. Bess Lomax Hawes, who created the fellowship, had taught mass guitar classes in 1950s Los Angeles.</p>

<h2><span class="q">Question 12</span>What does it cost, and who's on the radio?</h2>
<p>Folk is overwhelmingly free: ${r0(freeAll)}% of priced meetings cost nothing, because sessions, jams and song circles don't charge. Dances do. Contra admission runs $10–20 everywhere, which in the Bay Area is about ${Math.round(contraPrice.find(x => x.c.slug === 'san-francisco')?.p / (cities['san-francisco'].acs.median_hh_income / 2080 / 60) || 0)} minutes of median household income and in Detroit about ${Math.round(contraPrice.find(x => x.c.slug === 'detroit')?.p / (cities.detroit.acs.median_hh_income / 2080 / 60) || 0)}.</p>
${fig('f-price', 'A night of contra, in minutes of median household income', charts.price, 'Typical adult admission from each dossier ÷ (ACS 2024 median household income ÷ 2,080 hours).')}
${fig('f-radio', 'Folk and traditional radio, hours a week', charts.radio, 'Weekly hours of folk, Celtic, bluegrass and traditional programming on broadcast stations (FM, AM and HD subchannels) serving each metro, from the dossiers. Each station is counted once, capped at 168 hours; internet-only streams are excluded. Boston\'s WUMB and the Twin Cities\' Radio Heartland (MPR) are full-time folk.')}
<p class="answer"><b>Answer:</b> radio is splitting into haves and have-nots. Boston (WUMB) and the Twin Cities have full-time folk stations; Orlando has no FM folk show at all, and its best-known folk "program" is Roger McGuinn's monthly Folk Den website. Public stations keep dropping folk shows (WFUV in 2023 and 2026, WDET in 2009), while community and college stations keep them.</p>

<h2 id="notes"><span class="q">Part 4</span>Patterns that kept turning up</h2>
<p>Some patterns were too odd to chart and appeared in city after city.</p>
<div class="notes">
<div><h4>Football vs. the session</h4>NFL Sundays have evicted Irish sessions in Houston (at least five pubs), Phoenix (the session moved to Saturday after a pub's NFL package ousted it in 2013) and Denver (the Abbey Tavern session shifts to 6 pm in season and cancels for Broncos playoff games).</div>
<div><h4>One building carries the scene</h4>Glen Echo (DC), the Irish Center in Mount Airy (Philadelphia), Minnehaha Avenue (Twin Cities), First Lutheran in Midtown Houston (five traditions in one church), the Canadian American Club (Watertown), Balboa Park (San Diego). Many scenes depend on one roof.</div>
<div><h4>One family, one host</h4>One family's three pubs host about 80 Boston sessions a month. One host runs all three of Tampa's Irish sessions. Orlando's session hosts bought their pub, and rebuilt it when it was demolished.</div>
<div><h4>Tunes from unlikely places</h4>"Waiting for Nancy" (San Diego, 1972). "Spotted Pony" (a Seattle LP editing error). "Flop-Eared Mule" possibly from the 1854 "Detroit Schottische". "Orange Blossom Special" (a Miami resident). Boston has ${cleanTitles(cities.boston).length} tune titles on The Session.</div>
<div><h4>Firsts in unexpected cities</h4>The first country fiddle record (New York, 1922), the first radio barn dance (Fort Worth, 1923), the word "hootenanny" (Seattle, 1941), the word "zydeco" on record (Houston, c. 1947), US international folk dance (San Francisco, 1938), Western swing named (LA, 1942).</div>
<div><h4>Queer dance as a revival engine</h4>Gender-free contra began in Jamaica Plain (1988); the international gay square-dance association was founded in SF (1983). Today there are LGBTQ+ square clubs in Atlanta, NYC, LA and Miami, a monthly Queer Square Dance in Detroit, and queer contras in Chicago and the Twin Cities.</div>
</div>
${fig('f-tunes', 'Tunes on The Session whose titles name each metro\'s places', charts.tunes, `Title and alias matches for unambiguous city and neighborhood names (not state names or places shared with Britain or Canada) among ${'23,385'} tunes and their aliases. Boston's include ${bostonTitles.slice(0, 4).map(t => `"${t}"`).join(', ')}.`)}
<p>Heritage traditions: the dossiers documented ${L.reduce((s, c) => s + c.heritage.length, 0)} heritage traditions and rated each by vitality. The SF Bay and New York have the most thriving or active traditions, and the count tracks foreign-born share (r = ${foreignR.toFixed(2)}). Even the quietest trad metros are busy here: the Inland Empire has Cahuilla bird singing, Phoenix O'odham waila and Yaqui pascola, Houston zydeco, Miami Haitian and Afro-Cuban drumming, Tampa Greek Dodecanese music, Detroit Arab and Chaldean music.</p>
${fig('f-heritage', 'Living heritage traditions by vitality', charts.heritage, 'Number of heritage traditions each dossier documented, rated by evidence of current practice (classes, ensembles, community events). Number = thriving + active.')}

<h2 id="cities"><span class="q">Part 5</span>The 20 cities</h2>
<p>Ordered by population. The rank badge is each metro's trad-density rank. The bar shows the four layers (<span style="color:${C.rust}">sessions</span>, <span style="color:${C.teal}">dance</span>, <span style="color:${C.plum}">singing</span>, <span style="color:${C.sky}">open mics</span>, <span style="color:${C.mustard}">heritage</span>). Each card links to that city's full dossier.</p>
<div class="cities">${L.map(card).join('\n')}</div>

<h2 id="method"><span class="q">Appendix</span>How this was made</h2>
<div class="method"><ul>
<li><b>Geography.</b> The 20 largest Metropolitan Statistical Areas by Census Bureau Vintage 2025 estimates (July 1, 2025), from New York (20.1M) to Orlando (2.96M; Charlotte missed by 19,000). Only events inside each MSA's counties count; college towns just outside (Boulder, Ann Arbor, Athens, Princeton, Palo Alto) are reported separately.</li>
<li><b>Research.</b> Ten parallel research sessions, each covering two metros with four sub-threads (trad and dance, song and media, heritage, history and people), read primary sources: organizer and association calendars, church and hall schedules, Meetup and event pages, radio schedules, Library of Congress and state folklife archives, newspapers and oral histories. Every series needed a URL and 2024–26 evidence. Each wrote a 7,000–25,000-word dossier.</li>
<li><b>Counting.</b> Frequency is converted to meetings a month (weekly 4.33, twice-monthly 2, monthly 1, annual 1/12). Headline figures use only medium- and high-confidence series; ${r0(L.reduce((s, c) => s + c.lowTotal, 0))} meetings a month of low-confidence listings are excluded. Also excluded: online-only events, listen-only concerts, series with stale evidence, and modern western club square dancing (${r0(L.reduce((s, c) => s + c.mwsdTotal, 0))} club nights a month where enumerated), whose coverage varied by dossier. "Trad" = sessions, jams, social dance and singing; open mics and heritage events are in totals but not in trad density.</li>
<li><b>Central datasets.</b> Census Vintage 2025 population and migration estimates; ACS 2024 1-year ancestry, education, income, nativity (via Census Reporter); thesession.org's public data dump (sessions, events, ${'23,385'} tunes and aliases) geolocated to counties by point-in-polygon; all ${nea.fellows.length} NEA National Heritage Fellows scraped from arts.gov and geocoded; the Sacred Harp 2026 directory, trycontra.com, contradancelinks.com, strathspey.org, the Tradfolk morris map and comhaltas.ie.</li>
<li><b>Follow-up studies.</b> Folk buildings owned or controlled (${bld.facilities.length} facilities, ${bld.losses.length} losses); contra 2019 vs. 2026 (Wayback Machine); fiddle contests and state associations; venue classification by keyword.</li>
<li><b>Known gaps.</b> Facebook- and Instagram-only groups are undercounted everywhere, especially heritage ensembles, gospel and church traditions, and house concerts. Web search was heavily rate-limited, so some threads fell back to direct page fetches. The Traditional Tune Archive and some organizer sites blocked automated access. Sun Belt bluegrass lists are often stale. With 20 data points, correlations are suggestive, not proof. Every number links back to a dossier with its sources.</li>
</ul></div>
<p class="method">Compiled October 30, 2026. Data and dossiers: <a href="../cities/">cities/</a> (dossiers and data) · <a href="../central/">central/</a> (cross-city datasets).</p>
</main></body></html>`;

fs.mkdirSync(path.join(ROOT, 'report'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'report', 'index.html'), html);
const stats = { grand, tradGrand, eventsN, ranked: ranked.map(c => [c.slug, +c.tradPerM.toFixed(1), Math.round(c.total)]), predR, satRows: satRows.map(s => [s.name, Math.round(s.pm), Math.round(s.perM), Math.round(s.metroPerM)]), freeAll, since2010, since2020, founded: founded.length, dead: dead.length, kindRows, whyCount, listedR, noContest };
fs.writeFileSync(path.join(ROOT, 'report', 'stats.json'), JSON.stringify(stats, null, 1));
console.log('wrote report', (html.length / 1024).toFixed(0) + ' KB');
console.log(JSON.stringify({ grand: Math.round(grand), eventsN, top: top.slug, bottom: bottom.slug, sat: stats.satRows, since2010, since2020, founded: founded.length, dead: dead.length, kindRows, whyCount, listedR: listedR.toFixed(2), noContest: noContest.length, freeAll: Math.round(freeAll) }, null, 0));
