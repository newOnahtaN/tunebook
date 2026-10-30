import fs from 'fs';
const h = fs.readFileSync('../report/index.html', 'utf8');
const body = h.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<svg[\s\S]*?<\/svg>/g, '[chart]')
  .replace(/<(p|h1|h2|h3|li|div|figcaption|article)[^>]*>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n\s*\n+/g, '\n');
fs.writeFileSync('../report/text.txt', body);
console.log(body.length);
