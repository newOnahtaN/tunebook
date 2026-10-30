// Small SVG chart toolkit for the folk-scenes report. Every chart returns an <svg> string with a viewBox
// sized for phones first (width 480), so text stays legible when scaled to ~360px and nothing scrolls sideways.
import { geoAlbersUsa, geoMercator, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import fs from 'fs';

export const C = {
  paper: '#f7f2e8', ink: '#2b2622', muted: '#8a8076', faint: '#e6dccb', rust: '#b5532d', teal: '#2a7f7a',
  mustard: '#d39b2a', plum: '#7a3b69', forest: '#4f7a3a', sky: '#4a7bb0', rose: '#c96b7a', sand: '#c9b48a',
};
export const PALETTE = [C.rust, C.teal, C.mustard, C.plum, C.forest, C.sky, C.rose, C.sand, '#5b5048', '#9a6b3f'];
export const W = 480;

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = v => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : Math.abs(v) >= 10 ? v.toFixed(1).replace(/\.0$/, '') : (+v.toFixed(2)).toString());
const svg = (h, body, label, w = W) => `<svg viewBox="0 0 ${w} ${Math.ceil(h)}" role="img" aria-label="${esc(label || '')}" class="chart" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const text = (x, y, s, o = {}) => `<text x="${x.toFixed ? x.toFixed(1) : x}" y="${y.toFixed ? y.toFixed(1) : y}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.size ? ` font-size="${o.size}"` : ''}${o.fill ? ` fill="${o.fill}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}${o.style ? ` font-style="${o.style}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}>${esc(s)}</text>`;

// Horizontal bars. rows: [{label, value, color?, note?, sub?}]
export function hbar({ rows, label = '', max, fmtValue = fmt, labelW = 150, barH = 18, gap = 6, unit = '', highlight }) {
  const m = max ?? Math.max(...rows.map(r => r.value), 1e-9);
  const plotW = W - labelW - 54;
  let y = 4, body = '';
  for (const r of rows) {
    const w = Math.max(0, (r.value / m) * plotW);
    const col = r.color || (highlight && highlight(r) ? C.rust : C.teal);
    body += text(labelW - 8, y + barH * 0.72, r.label, { anchor: 'end', size: 12, fill: C.ink });
    body += `<rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="${barH}" rx="2" fill="${col}"/>`;
    body += text(labelW + w + 5, y + barH * 0.72, fmtValue(r.value) + unit, { size: 11.5, fill: C.ink, weight: 600 });
    if (r.note) body += text(labelW + w + 5 + (fmtValue(r.value) + unit).length * 7 + 6, y + barH * 0.72, r.note, { size: 10.5, fill: C.muted });
    y += barH + gap;
  }
  return svg(y, body, label);
}

// Rank slope chart: rows [{label, a, b}] ranked independently on each side.
export function slope({ rows, leftTitle, rightTitle, label = '', fmtA = fmt, fmtB = fmt, color }) {
  const n = rows.length, rowH = 21, top = 30, h = top + n * rowH + 6;
  const ra = [...rows].sort((x, y) => y.a - x.a), rb = [...rows].sort((x, y) => y.b - x.b);
  const xa = 172, xb = W - 172;
  let body = text(xa, 16, leftTitle, { anchor: 'end', size: 11.5, weight: 700, fill: C.muted }) + text(xb, 16, rightTitle, { size: 11.5, weight: 700, fill: C.muted });
  for (const r of rows) {
    const ia = ra.indexOf(r), ib = rb.indexOf(r);
    const ya = top + ia * rowH + 10, yb = top + ib * rowH + 10;
    const moved = ia - ib;
    const col = color ? color(r) : moved >= 4 ? C.teal : moved <= -4 ? C.rust : '#b9ad9c';
    const sw = Math.abs(moved) >= 4 ? 2.2 : 1.2;
    body += `<path d="M${xa + 4},${ya} C${(xa + xb) / 2},${ya} ${(xa + xb) / 2},${yb} ${xb - 4},${yb}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
    body += text(xa - 4, ya + 4, `${r.label} ${fmtA(r.a)}`, { anchor: 'end', size: 11, fill: Math.abs(moved) >= 4 ? col : C.ink });
    body += text(xb + 4, yb + 4, `${fmtB(r.b)} ${r.label}`, { size: 11, fill: Math.abs(moved) >= 4 ? col : C.ink });
  }
  return svg(h, body, label);
}

const niceTicks = (lo, hi, n = 5) => {
  const span = hi - lo || 1, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => s >= step0);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
};

// Scatter with labels, optional log axes and least-squares fit. points: [{x,y,label,r?,color?,labelPos?}]
export function scatter({ points, xLabel, yLabel, label = '', xLog = false, yLog = false, fit = true, h = 380, xFmt = fmt, yFmt = fmt, xMin, yMin, xMax, yMax, notes = [] }) {
  const L = 44, R = 14, T = 14, B = 40, pw = W - L - R, ph = h - T - B;
  const tx = v => (xLog ? Math.log10(v) : v), ty = v => (yLog ? Math.log10(v) : v);
  const xs = points.map(p => tx(p.x)), ys = points.map(p => ty(p.y));
  let x0 = xMin != null ? tx(xMin) : Math.min(...xs), x1 = xMax != null ? tx(xMax) : Math.max(...xs);
  let y0 = yMin != null ? ty(yMin) : Math.min(...ys), y1 = yMax != null ? ty(yMax) : Math.max(...ys);
  const px = (x1 - x0) * 0.06 || 1, py = (y1 - y0) * 0.08 || 1;
  if (xMin == null) x0 -= px; if (xMax == null) x1 += px; if (yMin == null) y0 -= py; if (yMax == null) y1 += py;
  const sx = v => L + ((tx(v) - x0) / (x1 - x0)) * pw, sy = v => T + ph - ((ty(v) - y0) / (y1 - y0)) * ph;
  let body = '';
  const xt = xLog ? [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].filter(v => Math.log10(v) >= x0 && Math.log10(v) <= x1) : niceTicks(x0, x1, 5);
  const yt = yLog ? [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].filter(v => Math.log10(v) >= y0 && Math.log10(v) <= y1) : niceTicks(y0, y1, 5);
  for (const v of xt) { const X = sx(v); body += `<line x1="${X}" x2="${X}" y1="${T}" y2="${T + ph}" stroke="${C.faint}"/>` + text(X, T + ph + 14, xFmt(v), { anchor: 'middle', size: 10.5, fill: C.muted }); }
  for (const v of yt) { const Y = sy(v); body += `<line x1="${L}" x2="${L + pw}" y1="${Y}" y2="${Y}" stroke="${C.faint}"/>` + text(L - 5, Y + 3.5, yFmt(v), { anchor: 'end', size: 10.5, fill: C.muted }); }
  body += text(L + pw / 2, h - 6, xLabel, { anchor: 'middle', size: 11.5, fill: C.ink, weight: 600 });
  body += `<text transform="translate(11 ${T + ph / 2}) rotate(-90)" text-anchor="middle" font-size="11.5" font-weight="600" fill="${C.ink}">${esc(yLabel)}</text>`;
  let r2 = null;
  if (fit && points.length > 2) {
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    const b = sxy / sxx, a = my - b * mx; r2 = (sxy * sxy) / (sxx * syy);
    const X0 = x0, X1 = x1, inv = v => (xLog ? 10 ** v : v), invy = v => (yLog ? 10 ** v : v);
    body += `<line x1="${sx(inv(X0))}" y1="${sy(invy(a + b * X0))}" x2="${sx(inv(X1))}" y2="${sy(invy(a + b * X1))}" stroke="${C.muted}" stroke-dasharray="4 4" stroke-width="1.2"/>`;
    body += text(L + pw - 4, T + 12, `r² = ${r2.toFixed(2)}${sxy < 0 ? ' (negative)' : ''}`, { anchor: 'end', size: 11, fill: C.muted, style: 'italic' });
  }
  body += `<clipPath id="c${label.length}${points.length}"><rect x="${L}" y="${T}" width="${pw}" height="${ph}"/></clipPath>`;
  for (const p of points) {
    const X = sx(p.x), Y = sy(p.y);
    body += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${p.r || 5}" fill="${p.color || C.teal}" fill-opacity="0.85" stroke="#fff" stroke-width="1"/>`;
    const pos = p.labelPos || 'r';
    const off = (p.r || 5) + 3;
    const [lx, ly, anc] = pos === 'l' ? [X - off, Y + 4, 'end'] : pos === 't' ? [X, Y - off - 1, 'middle'] : pos === 'b' ? [X, Y + off + 9, 'middle'] : [X + off, Y + 4, 'start'];
    if (p.label) body += text(lx, ly, p.label, { anchor: anc, size: 10.5, fill: C.ink, cls: 'halo' });
  }
  for (const nt of notes) body += text(nt.x, nt.y, nt.text, { size: 10.5, fill: nt.color || C.muted, style: 'italic', anchor: nt.anchor });
  return { svg: svg(h, body, label), r2 };
}

// Heatmap. rows: [label], cols: [label], value(r,c) -> number, cell text optional.
export function heatmap({ rows, cols, value, label = '', labelW = 120, cellH = 20, color = C.teal, max, showValues = true, fmtCell = v => (v ? fmt(v) : '') }) {
  const cw = (W - labelW - 4) / cols.length, top = 26;
  const m = max ?? Math.max(...rows.flatMap((r, i) => cols.map((c, j) => value(i, j) || 0)), 1e-9);
  let body = '';
  cols.forEach((c, j) => { body += text(labelW + j * cw + cw / 2, 16, c, { anchor: 'middle', size: 10.5, fill: C.muted, weight: 600 }); });
  rows.forEach((r, i) => {
    const y = top + i * cellH;
    body += text(labelW - 6, y + cellH * 0.68, r, { anchor: 'end', size: 11, fill: C.ink });
    cols.forEach((c, j) => {
      const v = value(i, j) || 0, t = Math.sqrt(v / m);
      body += `<rect x="${(labelW + j * cw + 1).toFixed(1)}" y="${y + 1}" width="${(cw - 2).toFixed(1)}" height="${cellH - 2}" rx="2" fill="${v ? color : C.faint}" fill-opacity="${v ? (0.15 + 0.85 * t).toFixed(2) : 0.6}"/>`;
      if (showValues && v) body += text(labelW + j * cw + cw / 2, y + cellH * 0.68, fmtCell(v), { anchor: 'middle', size: 9.5, fill: t > 0.55 ? '#fff' : C.ink });
    });
  });
  return svg(top + rows.length * cellH + 4, body, label);
}

// Year strip / beeswarm: items [{year, label?, color?, group?}] grouped into rows.
export function yearSwarm({ items, groups, from, to, label = '', rowH = 34, labelW = 110, r = 3.6, marks = [] }) {
  const pw = W - labelW - 10, sx = y => labelW + ((y - from) / (to - from)) * pw;
  let body = '';
  const top = 6;
  for (const mk of marks) {
    const X = sx(mk.year);
    body += `<rect x="${sx(mk.year)}" y="${top}" width="${sx(mk.to ?? mk.year + 1) - X}" height="${groups.length * rowH}" fill="${mk.color || C.faint}" fill-opacity="0.5"/>`;
    body += text(X + 2, top + groups.length * rowH + 22, mk.label, { size: 9.5, fill: C.muted, style: 'italic' });
  }
  groups.forEach((g, gi) => {
    const yMid = top + gi * rowH + rowH / 2;
    body += `<line x1="${labelW}" x2="${W - 10}" y1="${yMid}" y2="${yMid}" stroke="${C.faint}"/>`;
    body += text(labelW - 6, yMid + 4, g, { anchor: 'end', size: 11, fill: C.ink });
    const its = items.filter(i => i.group === g).sort((a, b) => a.year - b.year);
    const placed = [];
    for (const it of its) {
      const X = sx(it.year);
      let k = 0, Y;
      for (; ; k++) {
        Y = yMid + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (r * 2 + 0.6);
        if (!placed.some(p => Math.hypot(p[0] - X, p[1] - Y) < r * 2)) break;
        if (k > 12) break;
      }
      placed.push([X, Y]);
      body += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${r}" fill="${it.color || C.teal}" fill-opacity="0.85"><title>${esc((it.label || '') + ' (' + it.year + ')')}</title></circle>`;
    }
  });
  const axisY = top + groups.length * rowH + 4;
  for (let y = Math.ceil(from / 20) * 20; y <= to; y += 20) body += text(sx(y), axisY + 8, y, { anchor: 'middle', size: 10, fill: C.muted });
  return svg(axisY + 28, body, label);
}

// Lifespans: items [{label, start, end (null=alive), color?}]
export function lifespans({ items, from, to, label = '', rowH = 15, labelW = 190 }) {
  const pw = W - labelW - 8, sx = y => labelW + ((y - from) / (to - from)) * pw;
  let body = '', y = 18;
  for (let t = Math.ceil(from / 20) * 20; t <= to; t += 20) body += `<line x1="${sx(t)}" x2="${sx(t)}" y1="12" y2="${18 + items.length * rowH}" stroke="${C.faint}"/>` + text(sx(t), 10, t, { anchor: 'middle', size: 10, fill: C.muted });
  for (const it of items) {
    const end = it.end ?? to;
    body += text(labelW - 6, y + rowH * 0.7, it.label, { anchor: 'end', size: 10.5, fill: C.ink });
    body += `<rect x="${sx(it.start)}" y="${y + 3}" width="${Math.max(2, sx(end) - sx(it.start))}" height="${rowH - 6}" rx="3" fill="${it.color || (it.end ? C.rust : C.teal)}" fill-opacity="0.85"/>`;
    if (it.end == null) body += `<path d="M${sx(end)},${y + 2} l5,${(rowH - 4) / 2} l-5,${(rowH - 4) / 2}z" fill="${it.color || C.teal}"/>`;
    y += rowH;
  }
  return svg(y + 4, body, label);
}

// 100% stacked bars: rows [{label, parts:{key:value}}], keys order, colors map.
export function stacked100({ rows, keys, colors, label = '', labelW = 120, barH = 16, gap = 5, legend = true, sortKey }) {
  const pw = W - labelW - 6;
  let body = '', y = 4;
  if (legend) {
    let x = 4, ly = 12;
    for (const k of keys) {
      const wk = 16 + k.length * 6.2;
      if (x + wk > W) { x = 4; ly += 16; }
      body += `<rect x="${x}" y="${ly - 9}" width="10" height="10" rx="2" fill="${colors[k]}"/>` + text(x + 13, ly, k, { size: 10.5, fill: C.ink });
      x += wk + 6;
    }
    y = ly + 10;
  }
  for (const r of rows) {
    const tot = keys.reduce((s, k) => s + (r.parts[k] || 0), 0) || 1;
    body += text(labelW - 6, y + barH * 0.75, r.label, { anchor: 'end', size: 11, fill: C.ink });
    let x = labelW;
    for (const k of keys) {
      const w = ((r.parts[k] || 0) / tot) * pw;
      if (w > 0) body += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${barH}" fill="${colors[k]}"><title>${esc(`${r.label}: ${k} ${Math.round((100 * (r.parts[k] || 0)) / tot)}%`)}</title></rect>`;
      x += w;
    }
    y += barH + gap;
  }
  return svg(y, body, label);
}

// Small-multiple sparklines: series [{label, values:[{x,y}]}]
export function sparkGrid({ series, cols = 4, label = '', cellH = 70, yMax, xFrom, xTo, color = C.teal, bar = true }) {
  const cw = W / cols;
  const m = yMax ?? Math.max(...series.flatMap(s => s.values.map(v => v.y)), 1);
  let body = '';
  series.forEach((s, i) => {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * cellH;
    body += text(cx + 4, cy + 13, s.label, { size: 10.5, fill: C.ink, weight: 600 });
    const x0 = cx + 4, x1 = cx + cw - 6, y0 = cy + cellH - 10, y1 = cy + 20;
    const sx = x => x0 + ((x - xFrom) / (xTo - xFrom)) * (x1 - x0), sy = y => y0 - (y / m) * (y0 - y1);
    body += `<line x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}" stroke="${C.faint}"/>`;
    if (bar) {
      const bw = (x1 - x0) / (xTo - xFrom + 1) - 0.6;
      for (const v of s.values) if (v.y) body += `<rect x="${(sx(v.x) - bw / 2).toFixed(1)}" y="${sy(v.y).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y0 - sy(v.y)).toFixed(1)}" fill="${v.color || color}"/>`;
    } else {
      body += `<path d="${s.values.map((v, k) => (k ? 'L' : 'M') + sx(v.x).toFixed(1) + ',' + sy(v.y).toFixed(1)).join('')}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
    }
    if (s.note) body += text(x1, cy + 13, s.note, { anchor: 'end', size: 9.5, fill: C.muted });
  });
  body += text(4, Math.ceil(series.length / cols) * cellH + 10, `${xFrom}`, { size: 9.5, fill: C.muted });
  body += text(cw - 6, Math.ceil(series.length / cols) * cellH + 10, `${xTo}`, { anchor: 'end', size: 9.5, fill: C.muted });
  return svg(Math.ceil(series.length / cols) * cellH + 14, body, label);
}

// US map with proportional circles. points [{lng, lat, r, color, label, labelPos}]
const statesTopo = JSON.parse(fs.readFileSync(new URL('./states-10m.json', import.meta.url)));
export function usMap({ points, label = '', h = 300, legend = '' }) {
  const proj = geoAlbersUsa().fitExtent([[48, 14], [W - 52, h - 4]], feature(statesTopo, statesTopo.objects.nation));
  const path = geoPath(proj);
  let body = `<path d="${path(feature(statesTopo, statesTopo.objects.nation))}" fill="#ece3d2"/>`;
  body += `<path d="${path(mesh(statesTopo, statesTopo.objects.states, (a, b) => a !== b))}" fill="none" stroke="#fff" stroke-width="0.8"/>`;
  const pts = points.map(p => ({ ...p, xy: proj([p.lng, p.lat]) })).filter(p => p.xy).sort((a, b) => b.r - a.r);
  for (const p of pts) body += `<circle cx="${p.xy[0].toFixed(1)}" cy="${p.xy[1].toFixed(1)}" r="${p.r.toFixed(1)}" fill="${p.color || C.rust}" fill-opacity="0.55" stroke="${p.color || C.rust}" stroke-width="1"><title>${esc(p.title || p.label)}</title></circle>`;
  for (const p of pts) {
    if (!p.label) continue;
    const pos = p.labelPos || 'r', off = p.r + 2;
    const [lx, ly, anc] = pos === 'l' ? [p.xy[0] - off, p.xy[1] + 4, 'end'] : pos === 't' ? [p.xy[0], p.xy[1] - off - 1, 'middle'] : pos === 'b' ? [p.xy[0], p.xy[1] + off + 9, 'middle'] : [p.xy[0] + off, p.xy[1] + 4, 'start'];
    body += text(lx, ly, p.label, { anchor: anc, size: 10, fill: C.ink, cls: 'halo' });
  }
  if (legend) body += text(6, h - 6, legend, { size: 10, fill: C.muted, style: 'italic' });
  return svg(h, body, label);
}

// Metro dot map: county features + points [{lng,lat,color,title}]
export function metroMap({ counties, points, label = '', size = 150, title }) {
  const fc = { type: 'FeatureCollection', features: counties };
  const proj = geoMercator().fitExtent([[4, 18], [size - 4, size - 4]], fc);
  const path = geoPath(proj);
  let body = `<path d="${path(fc)}" fill="#ece3d2" stroke="#fff" stroke-width="0.7"/>`;
  for (const p of points) {
    const xy = proj([p.lng, p.lat]);
    if (!xy) continue;
    body += `<circle cx="${xy[0].toFixed(1)}" cy="${xy[1].toFixed(1)}" r="2.6" fill="${p.color || C.rust}" fill-opacity="0.8"><title>${esc(p.title || '')}</title></circle>`;
  }
  if (title) body += text(4, 12, title, { size: 11, weight: 700, fill: C.ink });
  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}" class="mini" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

// Waffle of N squares: groups [{label, n, color}]
export function waffle({ groups, perRow = 20, label = '', cell = 14 }) {
  let i = 0, body = '';
  const total = groups.reduce((s, g) => s + g.n, 0), rows = Math.ceil(total / perRow);
  const x0 = (W - perRow * cell) / 2;
  for (const g of groups) for (let k = 0; k < g.n; k++, i++) body += `<rect x="${x0 + (i % perRow) * cell}" y="${Math.floor(i / perRow) * cell}" width="${cell - 2}" height="${cell - 2}" rx="2" fill="${g.color}"><title>${esc(g.label)}</title></rect>`;
  let ly = rows * cell + 14, lx = 4;
  for (const g of groups) {
    const wk = 16 + (g.label + ' ' + g.n).length * 6.2;
    if (lx + wk > W) { lx = 4; ly += 16; }
    body += `<rect x="${lx}" y="${ly - 9}" width="10" height="10" rx="2" fill="${g.color}"/>` + text(lx + 13, ly, `${g.label} ${g.n}`, { size: 10.5, fill: C.ink });
    lx += wk + 6;
  }
  return svg(ly + 6, body, label);
}

// Ternary plot: points [{a,b,c,label,r,color,labelPos}], corners [A,B,C] (top, bottom-left, bottom-right).
export function ternary({ points, corners, label = '', h = 400 }) {
  const pad = 34, side = Math.min(W - 2 * pad, (h - 2 * pad) / 0.866);
  const cx = W / 2, top = pad - 6, Ax = cx, Ay = top, Bx = cx - side / 2, By = top + side * 0.866, Cx = cx + side / 2, Cy = By;
  const xy = (a, b, c) => { const s = a + b + c || 1; a /= s; b /= s; c /= s; return [a * Ax + b * Bx + c * Cx, a * Ay + b * By + c * Cy]; };
  let body = `<path d="M${Ax},${Ay}L${Bx},${By}L${Cx},${Cy}Z" fill="#fbf7ef" stroke="${C.muted}" stroke-width="1"/>`;
  for (const t of [0.25, 0.5, 0.75]) {
    const lines = [[xy(t, 1 - t, 0), xy(t, 0, 1 - t)], [xy(1 - t, t, 0), xy(0, t, 1 - t)], [xy(1 - t, 0, t), xy(0, 1 - t, t)]];
    for (const [p, q] of lines) body += `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${C.faint}"/>`;
  }
  body += text(Ax, Ay - 8, corners[0], { anchor: 'middle', size: 12, weight: 700, fill: C.ink });
  body += text(Bx - 4, By + 18, corners[1], { anchor: 'start', size: 12, weight: 700, fill: C.ink });
  body += text(Cx + 4, Cy + 18, corners[2], { anchor: 'end', size: 12, weight: 700, fill: C.ink });
  for (const p of points) {
    const [X, Y] = xy(p.a, p.b, p.c);
    body += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${(p.r || 5).toFixed(1)}" fill="${p.color || C.teal}" fill-opacity="0.75" stroke="#fff"><title>${esc(p.title || p.label)}</title></circle>`;
    const pos = p.labelPos || 'r', off = (p.r || 5) + 3;
    const [lx, ly, anc] = pos === 'l' ? [X - off, Y + 4, 'end'] : pos === 't' ? [X, Y - off - 1, 'middle'] : pos === 'b' ? [X, Y + off + 9, 'middle'] : [X + off, Y + 4, 'start'];
    body += text(lx, ly, p.label, { anchor: anc, size: 10.5, fill: C.ink, cls: 'halo' });
  }
  return svg(By + 26, body, label);
}

// Dumbbell: rows [{label, a, b}] with legend names.
export function dumbbell({ rows, aName, bName, label = '', labelW = 120, rowH = 20, max, colorA = C.sand, colorB = C.rust, fmtV = fmt }) {
  const m = max ?? Math.max(...rows.flatMap(r => [r.a, r.b]), 1);
  const pw = W - labelW - 40, sx = v => labelW + (v / m) * pw;
  let body = `<circle cx="${labelW + 6}" cy="10" r="5" fill="${colorA}"/>` + text(labelW + 15, 14, aName, { size: 11, fill: C.ink });
  body += `<circle cx="${labelW + 30 + aName.length * 6.3}" cy="10" r="5" fill="${colorB}"/>` + text(labelW + 39 + aName.length * 6.3, 14, bName, { size: 11, fill: C.ink });
  let y = 30;
  for (const r of rows) {
    const ya = y + rowH / 2;
    body += text(labelW - 8, ya + 4, r.label, { anchor: 'end', size: 11, fill: C.ink });
    body += `<line x1="${sx(Math.min(r.a, r.b))}" x2="${sx(Math.max(r.a, r.b))}" y1="${ya}" y2="${ya}" stroke="${C.muted}" stroke-width="2"/>`;
    body += `<circle cx="${sx(r.a)}" cy="${ya}" r="5" fill="${colorA}"/><circle cx="${sx(r.b)}" cy="${ya}" r="5" fill="${colorB}"/>`;
    body += text(sx(Math.max(r.a, r.b)) + 8, ya + 4, r.note ?? `${fmtV(r.a)} → ${fmtV(r.b)}`, { size: 10.5, fill: C.muted });
    y += rowH;
  }
  return svg(y + 4, body, label);
}

// Column histogram: bins [{label, value, color}]
export function columns({ bins, label = '', h = 200, fmtV = fmt, highlight }) {
  const L = 8, B = 30, T = 18, pw = W - 2 * L, ph = h - B - T, m = Math.max(...bins.map(b => b.value), 1);
  const bw = pw / bins.length;
  let body = '';
  bins.forEach((b, i) => {
    const bh = (b.value / m) * ph, x = L + i * bw;
    body += `<rect x="${(x + 2).toFixed(1)}" y="${(T + ph - bh).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${b.color || (highlight && highlight(b) ? C.rust : C.teal)}"/>`;
    if (b.value) body += text(x + bw / 2, T + ph - bh - 4, fmtV(b.value), { anchor: 'middle', size: 10, fill: C.ink, weight: 600 });
    body += text(x + bw / 2, T + ph + 14, b.label, { anchor: 'middle', size: 10, fill: C.muted });
  });
  return svg(h, body, label);
}
