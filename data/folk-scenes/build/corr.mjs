import fs from 'fs';
import { load } from './model.mjs';
const { cities, nea } = load();
const L = Object.values(cities).filter(c => c.loaded);
const bld = JSON.parse(fs.readFileSync('../central/folk_buildings.json'));
const corr = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; } return a / Math.sqrt(b * c); };
const rank = v => { const s = [...v].map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = []; s.forEach(([, i], k) => (r[i] = k)); return r; };
const spear = (x, y) => corr(rank(x), rank(y));
const y = L.map(c => c.tradPerM);
const preds = {
  growth: c => c.census.growth_pct, domMig: c => c.census.domestic_mig_2021_25 / c.pop * 100, irish: c => c.acs.pct.irish, celtic: c => c.acs.pct.celtic,
  nordic: c => c.acs.pct.nordic, ba: c => c.acs.pct.ba_plus_25, age: c => c.acs.median_age, income: c => c.acs.median_hh_income, rent: c => c.acs.median_rent,
  foreign: c => c.acs.pct.foreign_born, hispanic: c => c.acs.pct.hispanic, pop: c => c.pop, buildings: c => bld.by_metro[c.slug]?.owned_or_controlled || 0,
  buildingsPerM: c => (bld.by_metro[c.slug]?.owned_or_controlled || 0) / c.popM, nea: c => c.nea?.count || 0, sessionsListed: c => c.sessionListings.length / c.popM,
  lat: c => c.center[0], radio: c => (c.data.radio || []).reduce((s, r) => s + (+r.hours_per_week || 0), 0),
};
console.log('n =', L.length, 'cities');
for (const [k, f] of Object.entries(preds)) { const x = L.map(f); console.log(k.padEnd(14), 'pearson', corr(x, y).toFixed(2), 'spearman', spear(x, y).toFixed(2)); }
console.log('\nrank by tradPerM');
for (const c of [...L].sort((a, b) => b.tradPerM - a.tradPerM)) console.log(c.slug.padEnd(18), c.tradPerM.toFixed(1).padStart(6), 'growth', c.census.growth_pct, 'BA', c.acs.pct.ba_plus_25, 'bld', bld.by_metro[c.slug]?.owned_or_controlled, 'heritageShare', ((c.byGroup['Heritage community'] || 0) / c.total * 100).toFixed(0) + '%', 'foreign', c.acs.pct.foreign_born);
