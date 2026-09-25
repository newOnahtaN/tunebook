// Matching Drive files to tunes, and small helpers for media kinds.
// Pure functions, no I/O, so they can be unit-tested in Node.

const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'wma', 'aif', 'aiff'];
const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', '3gp'];

export function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

// 'audio' | 'video' | 'pdf' | null (ignored)
export function kindOf(name, mime = '') {
  const ext = extOf(name);
  if (AUDIO_EXT.includes(ext)) return 'audio';          // .m4a often reports video/mp4
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

// Content type to serve, fixing Drive's habit of calling .m4a "video/mp4".
export function serveType(name, mime = '') {
  const ext = extOf(name);
  const map = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
    wav: 'audio/wav', flac: 'audio/flac', pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4',
    webm: 'video/webm', mkv: 'video/x-matroska' };
  return map[ext] || mime || 'application/octet-stream';
}

const TYPE_WORDS = ['polka', 'jig', 'reel', 'waltz', 'two step', 'twostep', 'hornpipe', 'strathspey', 'march', 'slide',
  'barndance', 'schottische', 'breakdown', 'rag'];
const TRAILING_JUNK = /\s+(?:slow|slower|fast|faster|chords?|pcc|version|simple|with bowing|bowing|core melody|\d+)$/;

// "HabasParaUnaAmiga-Slow" -> "habas para una amiga slow" -> key "habas para una amiga"
export function normalize(s) {
  let t = String(s || '')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')                     // extension
    .replace(/([a-z])([A-Z])/g, '$1 $2')                    // CamelCase
    .replace(/['\u2019](?=[A-Z])/g, "' ")                   // "Morris'Reel"
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')      // accents
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/\([^)]*\)?/g, ' ')                            // (slow), (Douglas Town), unclosed "(to speed up"
    .replace(/\s*'s\b/g, 's')                               // "Buntàta 's" -> "buntatas"
    .replace(/'/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  t = t.replace(/^the\s+/, '');
  let prev;
  do { prev = t; t = t.replace(TRAILING_JUNK, ''); } while (t !== prev);
  // crude stemming so "Ryan's"/"Ryans"/"Ryan" and "Chapman's"/"Chapman" agree
  return t.split(' ').filter(Boolean).map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) ? w.slice(0, -1) : w).join(' ');
}

function stripType(key) {
  for (const w of TYPE_WORDS) {
    const tw = normalize(w);
    if (key.endsWith(' ' + tw)) return { base: key.slice(0, -tw.length - 1), type: tw };
  }
  return { base: key, type: '' };
}

// All the names a tune goes by: its name (split on "/"), plus its "aka" list (comma, semicolon or slash separated).
export function tuneNames(t) {
  return [t.name, ...String(t.aka || '').split(/[,;]/)].flatMap(n => String(n || '').split('/')).map(s => s.trim()).filter(Boolean);
}

export function buildIndex(tunes) {
  const entries = [];
  for (const t of tunes) {
    for (const n of tuneNames(t)) {
      const key = normalize(n);
      if (!key) continue;
      const { base, type } = stripType(key);
      entries.push({ id: t.id, key, base, type, words: key.split(' ').length });
    }
  }
  return entries;
}

// Two keys name the same tune if they're equal, or equal once a tune-type word ("polka") is dropped from
// the one side that has it. "Jessica's Polka" never matches "Jessica's Waltz".
function sameTune(fileKey, e) {
  if (fileKey === e.key) return true;
  const f = stripType(fileKey);
  if (!e.type && f.type) return f.base === e.key;
  if (e.type && !f.type) return fileKey === e.base;
  return false;
}

function matchOne(key, index, allowPrefix) {
  if (!key) return [];
  const exact = [...new Set(index.filter(e => sameTune(key, e)).map(e => e.id))];
  if (exact.length || !allowPrefix) return exact;
  // "Soldier's Joy with Variations", "Pacific Sunrise - Cecille Leroy": the longest multi-word tune name the file starts with.
  let best = null;
  for (const e of index) {
    for (const k of [e.key, e.type ? e.base : null]) {
      if (!k || k.split(' ').length < 2) continue;
      if (key.startsWith(k + ' ') && (!best || k.length > best.len)) best = { id: e.id, len: k.length };
    }
  }
  return best ? [best.id] : [];
}

// Returns the tune ids a Drive file belongs to (possibly several for "X and Y" medleys), or [] if unsure.
export function matchFile(fileName, parentFolderName, index) {
  const key = normalize(fileName);
  const exact = matchOne(key, index, false);
  if (exact.length) return exact;
  // Medleys: "CedarPathsAndHarrisDance", "DragonSlayerThenGameOfDrones": every part must match a different tune.
  const parts = key.split(/\s+(?:and|then|into)\s+/);
  if (parts.length > 1) {
    const ids = parts.map(p => matchOne(p, index, true));
    if (ids.every(a => a.length === 1) && new Set(ids.flat()).size === parts.length) return ids.flat();
  }
  const prefixed = matchOne(key, index, true);
  if (prefixed.length) return prefixed;
  // A file inside a folder named after the tune ("Angelina Baker/Angelina Baker PCC chords.pdf").
  const folder = normalize(parentFolderName);
  const byFolder = [...new Set(index.filter(e => folder && sameTune(folder, e)).map(e => e.id))];
  return byFolder.length === 1 ? byFolder : [];
}
