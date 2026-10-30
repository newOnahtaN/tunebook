// Split report figures into small preview pages and screenshot them with headless Edge.
import fs from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
const dir = path.resolve('..');
const shots = path.join(dir, 'shots');
fs.mkdirSync(shots, { recursive: true });
for (const f of fs.readdirSync(shots)) fs.unlinkSync(path.join(shots, f));
const h = fs.readFileSync(path.join(dir, 'report', 'index.html'), 'utf8');
const style = h.match(/<style>[\s\S]*?<\/style>/)[0];
const figs = [...h.matchAll(/<figure id="([^"]+)">([\s\S]*?)<\/figure>/g)];
const page = body => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${style}</head><body><main>${body}</main></body></html>`;
const pages = [];
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
figs.forEach(f => { if (!only || only.test(f[1])) pages.push([f[1], page(`<figure>${f[2]}</figure>`)]); });
if (!only || only.test('cities')) {
  const arts = [...h.matchAll(/<article class="city"[\s\S]*?<\/article>/g)].map(m => m[0]);
  pages.push(['cities', page(`<div class="cities">${arts.slice(0, 3).join('')}</div>`)]);
}
if (!only || only.test('top')) pages.push(['top', h.replace(/<nav class="toc">[\s\S]*$/, '</main></body></html>')]);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
for (const [id, html] of pages) {
  const f = path.join(shots, id + '.html');
  fs.writeFileSync(f, html);
  const out = path.join(shots, id + '.png');
  try {
    execFileSync(edge, ['--headless=new', '--disable-gpu', '--mute-audio', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${process.env.TEMP}\\folkshot-${id}`, `--window-size=${process.argv[3] || 400},${process.argv[4] || 1000}`, `--screenshot=${out}`, 'file:///' + f.replace(/\\/g, '/')], { timeout: 40000, stdio: 'ignore' });
  } catch (e) { console.log('fail', id, e.message.slice(0, 80)); }
  console.log(id, fs.existsSync(out) ? fs.statSync(out).size : 'missing');
}
