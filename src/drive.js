// Read-only Google Drive access through a service account (Worker secret GOOGLE_SERVICE_ACCOUNT = the key's JSON).
// Nate shares his Fiddle folder with the service account's email as Viewer; nothing else is needed.
import { b64u, enc } from './auth.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FOLDER = 'application/vnd.google-apps.folder';
let cached = { token: null, exp: 0, email: null };

export function serviceAccount(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT) return null;
  try {
    const j = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
    if (!j.client_email || !j.private_key) return null;
    // Overrides exist only so local tests can point at a fake Google.
    return { ...j, tokenUrl: env.GOOGLE_TOKEN_URL || TOKEN_URL, api: env.DRIVE_API_BASE || 'https://www.googleapis.com' };
  } catch { return null; }
}

async function accessToken(sa) {
  if (cached.token && cached.email === sa.client_email && cached.exp > Date.now() + 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64u(enc.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: TOKEN_URL, iat: now, exp: now + 3600 })));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + body)));
  const res = await fetch(sa.tokenUrl, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google refused the Drive robot account: ${j.error_description || j.error || res.status}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, email: sa.client_email };
  return cached.token;
}

// Every file under rootId, breadth first. Folders at the same depth are listed together in one query
// (OR of parents), so a whole scan takes a handful of requests.
export async function listTree(sa, rootId) {
  const token = await accessToken(sa);
  const folders = new Map([[rootId, { name: '', path: '' }]]);
  const files = [];
  let frontier = [rootId], calls = 0;
  while (frontier.length) {
    const next = [];
    for (let i = 0; i < frontier.length; i += 40) {
      const q = '(' + frontier.slice(i, i + 40).map(id => `'${id.replace(/'/g, '')}' in parents`).join(' or ') + ') and trashed = false';
      let pageToken = '';
      do {
        if (++calls > 30) throw new Error('The Drive folder is too big to scan in one go.');
        const u = new URL(sa.api + '/drive/v3/files');
        u.searchParams.set('q', q);
        u.searchParams.set('pageSize', '1000');
        u.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,webViewLink)');
        u.searchParams.set('supportsAllDrives', 'true');
        u.searchParams.set('includeItemsFromAllDrives', 'true');
        if (pageToken) u.searchParams.set('pageToken', pageToken);
        const r = await fetch(u, { headers: { authorization: 'Bearer ' + token } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`Drive listing failed: ${j.error?.message || r.status}`);
        // An empty root almost always means the folder hasn't been shared with the robot yet.
        if (calls === 1 && !(j.files || []).length) {
          throw new Error(`The Drive robot can't see anything in the Fiddle folder. Share the folder with ${sa.client_email} as a Viewer.`);
        }
        for (const f of j.files || []) {
          const parent = (f.parents || []).find(p => folders.has(p));
          const pf = folders.get(parent) || { name: '', path: '' };
          if (f.mimeType === FOLDER) {
            if (!folders.has(f.id)) {
              folders.set(f.id, { name: f.name, path: pf.path ? `${pf.path} › ${f.name}` : f.name });
              next.push(f.id);
            }
          } else {
            files.push({ id: f.id, name: f.name, mime: f.mimeType || '', size: Number(f.size || 0), modified: f.modifiedTime || '',
              folder: pf.name, path: pf.path, url: f.webViewLink || '' });
          }
        }
        pageToken = j.nextPageToken || '';
      } while (pageToken);
    }
    frontier = next;
  }
  return files;
}

// Stream one file's bytes, passing a Range header through so players can seek.
export async function fetchMedia(sa, id, range) {
  const token = await accessToken(sa);
  const headers = { authorization: 'Bearer ' + token };
  if (range) headers.range = range;
  return fetch(`${sa.api}/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { headers });
}
