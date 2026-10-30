// Load city dossiers + central datasets into one normalized model for the report.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const exists = p => fs.existsSync(path.join(ROOT, p));

export const ORDER = ['new-york', 'los-angeles', 'chicago', 'dallas-fort-worth', 'houston', 'atlanta', 'washington-dc', 'miami',
  'philadelphia', 'phoenix', 'boston', 'riverside', 'san-francisco', 'detroit', 'seattle', 'minneapolis', 'tampa', 'san-diego',
  'denver', 'orlando'];
export const SHORT = {
  'new-york': 'New York', 'los-angeles': 'Los Angeles', chicago: 'Chicago', 'dallas-fort-worth': 'Dallas–Fort Worth',
  houston: 'Houston', atlanta: 'Atlanta', 'washington-dc': 'Washington DC', miami: 'Miami', philadelphia: 'Philadelphia',
  phoenix: 'Phoenix', boston: 'Boston', riverside: 'Inland Empire', 'san-francisco': 'SF Bay', detroit: 'Detroit',
  seattle: 'Seattle', minneapolis: 'Twin Cities', tampa: 'Tampa Bay', 'san-diego': 'San Diego', denver: 'Denver', orlando: 'Orlando',
};
export const CENTER = {
  'new-york': [40.75, -73.99], 'los-angeles': [34.05, -118.25], chicago: [41.88, -87.63], 'dallas-fort-worth': [32.82, -97.0],
  houston: [29.76, -95.37], atlanta: [33.75, -84.39], 'washington-dc': [38.9, -77.04], miami: [25.95, -80.2],
  philadelphia: [39.95, -75.16], phoenix: [33.45, -112.07], boston: [42.36, -71.06], riverside: [34.0, -117.2],
  'san-francisco': [37.8, -122.3], detroit: [42.33, -83.05], seattle: [47.6, -122.33], minneapolis: [44.97, -93.2],
  tampa: [27.95, -82.5], 'san-diego': [32.8, -117.15], denver: [39.74, -104.99], orlando: [28.54, -81.38],
};

// Categories grouped into the four layers of the brief.
export const GROUPS = {
  'Tune sessions & jams': ['irish_session', 'oldtime_jam', 'bluegrass_jam', 'scottish_capebreton_session', 'other_session'],
  'Social dance': ['contra_dance', 'english_country_dance', 'square_dance', 'ceili_or_scottish_country_dance', 'international_folk_dance', 'scandinavian_dance', 'morris_sword_team'],
  'Singing': ['shape_note_singing', 'shanty_or_song_sing', 'song_circle'],
  'Open mics': ['folk_open_mic'],
  'Heritage community': ['heritage_community_event'],
  'Other': ['other'],
};
export const catGroup = c => Object.entries(GROUPS).find(([, v]) => v.includes(c))?.[0] || 'Other';

// Modern Western (club) square dancing is enumerated in some dossiers and not others, so it is kept out of totals.
export const isMWSD = e => e.category === 'square_dance' &&
  /modern western|mwsd|mainstream|\bplus\b|\(club\)|callerlab/i.test(`${e.tradition} ${e.name}`) && !/old[- ]time|traditional/i.test(e.tradition || '');
const num = v => (v == null || v === '' || isNaN(+v) ? 0 : +v);

export function load() {
  const census = read('central/census_metros.json');
  const acs = read('central/acs_by_metro.json');
  const ts = read('central/thesession_by_metro.json');
  const titles = read('central/thesession_tune_titles.json');
  const loc = exists('central/loc_afc_by_city.json') ? read('central/loc_afc_by_city.json') : {};
  const nea = exists('central/nea_fellows.json') ? read('central/nea_fellows.json') : null;
  const dirs = exists('central/directory_counts.json') ? read('central/directory_counts.json') : null;
  const phase2 = exists('central/phase2.json') ? read('central/phase2.json') : {};
  const cities = {};
  for (const slug of ORDER) {
    const f = `cities/${slug}.json`;
    const pop = census[slug].pop2025;
    const base = { slug, name: SHORT[slug], pop, popM: pop / 1e6, census: census[slug], acs: acs[slug], center: CENTER[slug], loaded: false };
    base.sessionListings = ts.sessions.filter(s => s.metro === slug);
    base.sessionEvents = ts.events.filter(s => s.metro === slug);
    base.titles = titles[slug] || {};
    base.titleCount = new Set(Object.values(base.titles).flat()).size;
    base.loc = loc[slug] || {};
    if (exists(f)) {
      const j = read(f);
      Object.assign(base, { data: j, loaded: true });
      const counted = e => !e.outside_msa && !e.exclude_from_totals && !e.exclude_from_counts && e.counted_in_totals !== false &&
        e.count_in_totals !== false && !e.virtual && !e.online && !e.online_only && !e.unverified && !e.unverified_current &&
        !e.listen_only && e.participatory !== false && !/unverified|hiatus|uncertain|2019|defunct|ended/i.test(e.status || '');
      const solid = e => e.confidence !== 'low';
      const all = (j.recurring_events || []).filter(counted).map(e => ({ ...e, category: isMWSD(e) ? 'modern_western_square' : e.category, per_month: num(e.per_month) }));
      base.mwsd = all.filter(e => e.category === 'modern_western_square');
      base.mwsdTotal = base.mwsd.reduce((s, e) => s + e.per_month, 0);
      base.allEvents = all.filter(e => e.category !== 'modern_western_square').map(e => ({ ...e, group: catGroup(e.category) }));
      base.events = base.allEvents.filter(solid);
      base.lowTotal = base.allEvents.filter(e => !solid(e)).reduce((s, e) => s + e.per_month, 0);
      base.eventsOutside = (j.recurring_events || []).filter(e => e.outside_msa).map(e => ({ ...e, per_month: num(e.per_month) }));
      const byCat = {}, byGroup = {};
      for (const e of base.events) {
        byCat[e.category] = (byCat[e.category] || 0) + e.per_month;
        byGroup[e.group] = (byGroup[e.group] || 0) + e.per_month;
      }
      base.byCat = byCat; base.byGroup = byGroup;
      base.total = base.events.reduce((s, e) => s + e.per_month, 0);
      base.totalNoHeritage = base.total - (byGroup['Heritage community'] || 0);
      base.perM = base.total / base.popM;
      base.trad = (byGroup['Tune sessions & jams'] || 0) + (byGroup['Social dance'] || 0) + (byGroup['Singing'] || 0);
      base.tradPerM = base.trad / base.popM;
      base.outsideTotal = base.eventsOutside.reduce((s, e) => s + e.per_month, 0);
      base.festivalsActive = (j.festivals || []).filter(x => x.status === 'active' && !x.outside_msa).length;
      base.defunct = j.defunct || [];
      base.heritage = j.heritage_traditions || [];
    }
    base.nea = nea?.by_metro?.[slug] || null;
    base.dirs = {};
    if (dirs) for (const [k, d] of Object.entries(dirs.directories || {})) base.dirs[k] = d.by_metro?.[slug] || null;
    base.phase2 = phase2[slug] || {};
    cities[slug] = base;
  }
  return { cities, census, acs, ts, nea, dirs, phase2, loc };
}

if (process.argv[1] && process.argv[1].endsWith('model.mjs')) {
  const { cities } = load();
  for (const c of Object.values(cities)) {
    if (!c.loaded) { console.log(c.slug.padEnd(18), '(pending)'); continue; }
    console.log(c.slug.padEnd(18), 'mwsd', c.mwsdTotal.toFixed(1), 'events', c.events.length, 'low', c.lowTotal.toFixed(0), 'total/mo', c.total.toFixed(1), 'per M', c.perM.toFixed(1), 'trad/M', c.tradPerM.toFixed(1), 'outside', c.outsideTotal.toFixed(1), 'fests', c.festivalsActive);
  }
}
