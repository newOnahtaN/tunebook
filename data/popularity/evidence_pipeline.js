// Gathers popularity evidence for every tune and builds the payload for POST /fiddle/api/popularity/import.
// Run in a signed-in browser tab on https://nategrimwood.com (no CSP there; the Google Sheets gviz CSV
// endpoints and raw.githubusercontent.com both allow cross-origin reads). Inputs:
//   window.__PANEL_LISTS = { stl: "...", clt: "...", scvfa: "...", bg: "...", vic: "..." }   (comma-separated titles;
//                          falls back to localStorage '__PANEL_LISTS' on nategrimwood.com)
//   window.__HEARSAY     = [ {id, score, confidence, note, sources, recordings}, ... ]       (hearsay research; falls
//                          back to /fiddle/popularity-hearsay.json, which lives in the repo at public/fiddle/)
// To add hearsay research for a tune: add an entry to public/fiddle/popularity-hearsay.json, deploy, rerun this.
// Result: window.__payload (send it with POST) and window.__report (coverage summary).
window.__done = null;
(async () => {
const TODAY = new Date().toISOString().slice(0, 10);
if (!window.__PANEL_LISTS) { try { window.__PANEL_LISTS = JSON.parse(localStorage.getItem('__PANEL_LISTS') || 'null'); } catch {} }
if (!window.__HEARSAY) window.__HEARSAY = await fetch('/fiddle/popularity-hearsay.json?' + Date.now()).then(r => r.json());
const csv = t => { const rows=[]; let row=[], f='', q=false; for (let i=0;i<t.length;i++){ const c=t[i]; if(q){ if(c==='"'){ if(t[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; } else { if(c==='"') q=true; else if(c===','){row.push(f);f='';} else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';} else if(c!=='\r') f+=c; } } if(f||row.length){row.push(f);rows.push(row);} return rows; };
const nm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\(.*?\)/g,' ').replace(/,\s*(the|le|la|les|l')\s*$/,'').replace(/[’'`]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\b(the|le|la|les|reel|jig|de|du|des|a|an|l)\b/g,' ').replace(/\s+/g,' ').trim();
const base = s => { s=String(s||'').replace(/\b[A-Z]{4,}\b/g,' '); s=s.replace(/,\s*(The|Le|La|Les|L')\s*$/i,''); s=s.replace(/\s+-\s+.*$/,'').replace(/,.*$/,''); return nm(s); };
const lev = (a,b) => { if (Math.abs(a.length-b.length)>2) return 9; const d=Array.from({length:a.length+1},(_,i)=>[i]); for(let j=1;j<=b.length;j++) d[0][j]=j; for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[a.length][b.length]; };
const TW=/\b(polka|waltz|march|hornpipe|slide|barndance|strathspey|schottische|air|mazurka)\b/g;
const pd = s => { if(!s) return null; const [m,d,y]=s.trim().split('/').map(Number); if(!y) return null; return new Date(y<100?2000+y:y,m-1,d); };
const iso = d => d ? d.toISOString().slice(0,10) : '';
const NOW=new Date(), CUT=new Date(NOW.getFullYear()-2, NOW.getMonth(), NOW.getDate());
const SHEETS = {
  columbia: { id:'1u17fwk_FlBi-WLIxICy0MMA76M7j4yhYgZGuS5EqNs4', tab:'All, by Date' },
  quebecois:{ id:'1TYyk_Rh9XSIJ3T1KP6P_Ga8DdJiExfQAXUXQcBwiROo', tab:'All Tunes All Time' },
  couth:    { id:'17PrThLHRKfPzFQ0vrwHWSXugxHbJLsvFBNr8oKJRi9w', tab:'Session tunes' },
  otb:      { id:'1MN3yAbPryeJf_YXJdOBh7T9qSDht_VhD-pfU6tdUDeU', tab:'' },
};
const sheetUrl = k => `https://docs.google.com/spreadsheets/d/${SHEETS[k].id}`;
const gv = k => fetch(`${sheetUrl(k)}/gviz/tq?tqx=out:csv&headers=1${SHEETS[k].tab?'&sheet='+encodeURIComponent(SHEETS[k].tab):''}`).then(r=>r.text());
const gh='https://raw.githubusercontent.com/adactio/TheSession-data/main/csv/';
const [D, cc, qq, cb, ot, tp, al, tt] = await Promise.all([
  fetch('/fiddle/api/data',{cache:'no-store'}).then(r=>r.json()), gv('columbia'), gv('quebecois'), gv('couth'), gv('otb'),
  fetch(gh+'tune_popularity.csv').then(r=>r.text()), fetch(gh+'aliases.csv').then(r=>r.text()), fetch(gh+'tunes.csv').then(r=>r.text())]);
if (!D.editor) throw new Error('Sign in as the editor first');
const namesOf=t=>{ const out=new Set(); for(const s of [t.name, ...t.name.split(/\s*\/\s*/), ...String(t.aka||'').split(/[,;\/]/)]){ const a=base(s); if(a&&a.length>2){ out.add(a); const b=a.replace(TW,' ').replace(/\s+/g,' ').trim(); if(b.length>2) out.add(b); } } return [...out]; };
const links=new Map(); for(const s of D.session_sources){ if(!links.has(s.tune_id)) links.set(s.tune_id,new Set()); links.get(s.tune_id).add(s.sheet_key); }
const ev=[]; const lists=[];

// ---- Columbia City Jam: full dated log. Families by full title, grouped by base title.
const CR=csv(cc).slice(1).filter(r=>r[1]&&r[3]);
const allNights=new Set(CR.map(r=>r[1])), recentNights=new Set(CR.filter(r=>pd(r[1])>=CUT).map(r=>r[1]));
const fam=new Map(); for(const r of CR){ const full=nm(r[3].replace(/\b[A-Z]{4,}\b/g,' ').replace(/[()]/g,' ')); const b=base(r[3]); if(!b) continue; if(!fam.has(full)) fam.set(full,{b,rows:[],txt:''}); const f=fam.get(full); f.rows.push(r); f.txt+=' '+(r[3]+' '+r[4]).toLowerCase(); }
const byBase=new Map(); for(const f of fam.values()){ if(!byBase.has(f.b)) byBase.set(f.b,[]); byBase.get(f.b).push(f); }
const ccStat=fs=>{ const n=new Set(), rc=new Set(); let last=null; for(const f of fs) for(const r of f.rows){ n.add(r[1]); const d=pd(r[1]); if(d>=CUT) rc.add(r[1]); if(!last||d>last) last=d; } return {nights:n.size, recent:rc.size, variants:fs.length, last:iso(last)}; };
let ccMax=0, ccRMax=0; const famStats=[...fam.values()].map(f=>ccStat([f])); for(const s of famStats){ ccMax=Math.max(ccMax,s.nights); ccRMax=Math.max(ccRMax,s.recent); }
const ccMetric=s=>0.5*Math.log(1+s.nights)/Math.log(1+ccMax)+0.5*Math.log(1+s.recent)/Math.log(1+ccRMax);
const baseMetrics=[...byBase.values()].map(fs=>ccMetric(ccStat(fs)));
lists.push({ source:'columbia', label:'Columbia City Jam', url:sheetUrl('columbia'), as_of:TODAY,
  stats:{ max:ccMax, maxRecent:ccRMax, nights:allNights.size, recentNights:recentNights.size, rows:CR.length, titles:byBase.size,
    first:iso([...allNights].map(pd).sort((a,b)=>a-b)[0]), last:iso([...allNights].map(pd).sort((a,b)=>b-a)[0]) } });
// ---- Québécois and Couth Buzzard: play counts per tune (every slash alternative indexed)
const QR=csv(qq).filter(r=>r[0]&&/^\d+$/.test((r[7]||'').trim())), BR=csv(cb).filter(r=>r[0]&&/^\d+$/.test((r[6]||'').trim()));
const idxList=(rows,ci,lastOf)=>{ const m=new Map(); for(const r of rows){ const v={plays:+r[ci], last:iso(lastOf(r)), raw:r[0].trim()}; v.rank=1+rows.filter(x=>+x[ci]>v.plays).length; for(const part of [r[0], ...r[0].split(/[\/(]/)]){ const k=base(part.replace(/\)/g,'')); if(k && (!m.has(k)||m.get(k).plays<v.plays)) m.set(k,v); } } return m; };
const QM=idxList(QR,7,r=>pd(r[6])), BM=idxList(BR,6,r=>[pd(r[5]),pd(r[7])].filter(Boolean).sort((a,b)=>b-a)[0]||null);
lists.push({ source:'quebecois', label:'PNW Québécois session', url:sheetUrl('quebecois'), as_of:TODAY, stats:{ max:Math.max(...QR.map(r=>+r[7])), tunes:QR.length, plays:QR.reduce((a,r)=>a+ +r[7],0) } });
lists.push({ source:'couth', label:'Couth Buzzard Irish session', url:sheetUrl('couth'), as_of:TODAY, stats:{ max:Math.max(...BR.map(r=>+r[6])), tunes:BR.length, plays:BR.reduce((a,r)=>a+ +r[6],0) } });
const OTB=new Set(csv(ot).slice(1).filter(r=>r[0]).map(r=>base(r[0])));
lists.push({ source:'otb', label:'Old Time Buddies list', url:sheetUrl('otb'), as_of:TODAY, stats:{ tunes:OTB.size, curated:true } });
lists.push({ source:'nwsf', label:'NW Scottish Fiddlers top tunes', url:'https://www.nwscottishfiddlers.org/wp-content/uploads/2024/09/TOP-FIDDLE-TUNES.docx', as_of:TODAY, stats:{ tunes:73, curated:true, revised:'2024' } });
// ---- The Session (bulk dataset on GitHub)
const TP=new Map(csv(tp).slice(1).filter(r=>r[1]).map(r=>[r[1],{name:r[0],tb:+r[2]}])); const TY=new Map(); for(const r of csv(tt).slice(1)) if(r[0]&&!TY.has(r[0])) TY.set(r[0],r[3]);
const SI=new Map(); const add=(k,id)=>{ if(!k) return; if(!SI.has(k)) SI.set(k,new Set()); SI.get(k).add(id); }; for(const [id,v] of TP) add(nm(v.name),id); for(const r of csv(al).slice(1)) if(r[0]&&TP.has(r[0])) add(nm(r[1]),r[0]);
const SESSION_OVERRIDE = { 3:'Little Beggarman, The' };        // Red Haired Boy is The Little Beggarman on The Session
const SESSION_BLOCK = new Set([197, 206]);                      // wrong matches (Huckleberry, Casey's Pig)
const tmap={breakdown:'reel',reel:'reel','song tune':'reel','two-step':'polka',jig:'jig','slip jig':'slip jig',hornpipe:'hornpipe',strathspey:'strathspey',waltz:'waltz',march:'march',polka:'polka',slide:'slide',schottische:'barndance',barndance:'barndance','pipe march':'march',rag:'reel',clog:'hornpipe'};
const RT=new Map(D.research.map(r=>[r.tune_id,r]));
lists.push({ source:'session', label:'The Session', url:'https://github.com/adactio/TheSession-data', as_of:TODAY, stats:{ tunes:TP.size } });
// ---- Jam-list panel
const PANEL_META={ stl:['Friends of Old Time jam, St. Louis',1,'https://musicfolk.com/friends-of-old-time-jam-tune-list/'], clt:['Charlotte Folk Society old-time jam',1,'https://folksociety.org/wp-content/uploads/2022/01/Old-time-list-Charlotte-folk-society.pdf'], scvfa:['Santa Clara Valley Fiddlers slow jam',1,'https://www.fiddlers.org/slow-jam-tunes/'], bg:['Monroe Mandolin Camp jam tunes',1,'https://monroemandolincamp.com/wp-content/uploads/2026/02/2026-Suggested-Jam-Tunes-.pdf'], vic:["Wendy's Old-Time Tunes List, Victoria BC",0.5,'https://people.geog.uvic.ca/wanthony/website/OldTime/WendysOldTimeTunesList.htm'] };
const PANEL=Object.fromEntries(Object.entries(window.__PANEL_LISTS||{}).map(([k,v])=>[k,new Set(v.split(/,\s*/).map(base))]));
lists.push({ source:'jamlists', label:'Published jam lists', url:'', as_of:TODAY, stats:{ lists:Object.entries(PANEL_META).map(([k,[label,weight,url]])=>({key:k,label,weight,url,tunes:PANEL[k]?.size||0})) } });
const HEARSAY=new Map((window.__HEARSAY||[]).map(h=>[h.id,h]));
lists.push({ source:'hearsay', label:'Hearsay research', url:'', as_of:TODAY, stats:{ tunes:HEARSAY.size } });

const report={ columbia:0, quebecois:0, couth:0, otb:0, nwsf:0, session:0, jamlists:0, hearsay:0, curatedNoOnline:[], weak:[] };
const tok=s=>new Set(s.split(' ').filter(w=>w.length>2));
for (const t of D.tunes) {
  const L=links.get(t.id)||new Set(), names=namesOf(t), grp=/Old-time|Bluegrass|Western swing|Waltz/.test(t.genre)?'americana':'other';
  // Columbia: exact base title, then near-spellings (one letter off), then a token match for linked tunes
  let fs=[]; for(const n of [...names, ...names.map(n=>n.replace(/^old /,''))]) if(byBase.has(n)){ fs=byBase.get(n); break; }
  if(!fs.length) for(const n of names){ if(n.length<8) continue; for(const [b,list] of byBase) if(lev(n,b)===1){ fs=fs.concat(list); } if(fs.length) break; }
  else for(const n of names){ if(n.length<8) continue; for(const [b,list] of byBase) if(b!==n && lev(n,b)===1) fs=fs.concat(list); }
  if(!fs.length && L.has('columbia_city_jam')){ const a=tok(base(t.name)); let best=null,bs=0; for(const [b,list] of byBase){ const B=tok(b); const j=[...a].filter(x=>B.has(x)||[...B].some(y=>y.startsWith(x.slice(0,4)))).length/Math.max(a.size,B.size); if(j>bs){bs=j;best=list;} } if(bs>=0.6) fs=best; }
  const qual=(t.name.match(/\(([^)]*?)\s*setting\)/i)||[])[1]; if(qual&&fs.length>1){ const w=qual.split(/[\s.]+/).filter(x=>x.length>2).pop().toLowerCase().slice(0,4); const sel=fs.filter(f=>f.txt.includes(w)); if(sel.length) fs=sel; }
  if(fs.length){ const s=ccStat(fs); const m=ccMetric(s); const rank=1+baseMetrics.filter(x=>x>m+1e-9).length; ev.push({tune_id:t.id, source:'columbia', value:s.nights, extra:{recent:s.recent, variants:s.variants, last:s.last, rank}, url:sheetUrl('columbia'), as_of:TODAY}); report.columbia++; }
  for (const [M,src] of [[QM,'quebecois'],[BM,'couth']]) for(const n of names) if(M.has(n)){ const v=M.get(n); ev.push({tune_id:t.id, source:src, value:v.plays, extra:{last:v.last, rank:v.rank, title:v.raw}, url:sheetUrl(src), as_of:TODAY}); report[src]++; break; }
  if(L.has('old_time_buddies_ritz')||names.some(n=>OTB.has(n))){ ev.push({tune_id:t.id, source:'otb', value:1, extra:{}, url:sheetUrl('otb'), as_of:TODAY}); report.otb++; }
  if(L.has('nw_scottish_fiddlers')){ ev.push({tune_id:t.id, source:'nwsf', value:1, extra:{}, url:'https://www.nwscottishfiddlers.org/wp-content/uploads/2024/09/TOP-FIDDLE-TUNES.docx', as_of:TODAY}); report.nwsf++; }
  // The Session: same-type match; otherwise an exact-name match of the tune itself (not via an alias)
  let S=null;
  if(SESSION_OVERRIDE[t.id]){ for(const [i,v] of TP) if(v.name===SESSION_OVERRIDE[t.id]) S={id:i,...v,type:TY.get(i)}; }
  else if(!SESSION_BLOCK.has(t.id)){
    const want=tmap[(RT.get(t.id)?.type||'').toLowerCase()]; const ids=new Set(); names.forEach(n=>(SI.get(n)||[]).forEach(i=>ids.add(i)));
    const c=[...ids].map(i=>({id:i,...TP.get(i),type:TY.get(i)})); const typed=c.filter(x=>want&&x.type===want).sort((a,b)=>b.tb-a.tb);
    const direct=c.filter(x=>names.includes(nm(x.name))||names.includes(nm(x.name).replace(TW,' ').replace(/\s+/g,' ').trim())).sort((a,b)=>b.tb-a.tb);
    S=typed[0]||direct[0]||null;
  }
  if(S){ ev.push({tune_id:t.id, source:'session', value:S.tb, extra:{id:S.id, name:S.name, type:S.type}, url:`https://thesession.org/tunes/${S.id}`, as_of:TODAY}); report.session++; }
  // Jam lists (old-time, bluegrass, waltz)
  let k=0, on=[]; if(grp==='americana'){ for(const [key,[label,w]] of Object.entries(PANEL_META)) if(names.some(n=>PANEL[key]?.has(n))){ k+=w; on.push(label); } }
  if(k>0){ ev.push({tune_id:t.id, source:'jamlists', value:k, extra:{lists:on}, as_of:TODAY}); report.jamlists++; }
  // Hearsay
  const H=HEARSAY.get(t.id); if(H){ ev.push({tune_id:t.id, source:'hearsay', value:H.score, extra:{confidence:H.confidence, sources:H.sources||[], recordings:H.recordings||[]}, note:H.note, url:(H.sources||[])[0]||'', as_of:H.as_of||TODAY}); report.hearsay++; }
  const hasOnline = !!S || k>0 || !!H;
  if((L.has('nw_scottish_fiddlers')||L.has('old_time_buddies_ritz')||names.some(n=>OTB.has(n))) && !hasOnline) report.curatedNoOnline.push(`${t.id}|${t.name}|${t.genre}`);
  if(!H && !S && k<=1 && !(fs.length||QM.has(names[0])||BM.has(names[0]))) report.weak.push(`${t.id}|${t.name}|${t.genre}`);
  if(!H && !S && k>0 && k<=1) report.weak.push(`${t.id}|${t.name}|${t.genre}|one jam list`);
}
window.__payload={ reason:'Popularity evidence import '+TODAY, lists, replace_sources:['columbia','quebecois','couth','otb','nwsf','session','jamlists','hearsay'], evidence:ev };
window.__report=report; window.__done='ok';
})().catch(e=>{ window.__done='ERR '+e.message; });
