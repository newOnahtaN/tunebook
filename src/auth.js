// Sign-in helpers for the tune book: Google ID tokens and WebAuthn passkeys.
// No dependencies; everything uses WebCrypto, so it runs the same in Workers and Node (for tests).

export class AuthError extends Error {}

export const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(s) {
  s = String(s ?? '');
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new AuthError('Malformed data.');
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  try { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); } catch { throw new AuthError('Malformed data.'); }
}

const concat = (a, b) => { const out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out; };
const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const sha256 = async bytes => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));

// ---------------------------------------------------------------- Google

const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
let certCache = { url: '', keys: null, until: 0 };

async function googleKeys(url, force) {
  if (!force && certCache.url === url && certCache.keys && certCache.until > Date.now()) return certCache.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't fetch Google's signing keys (HTTP ${res.status}).`);
  const { keys } = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  certCache = { url, keys, until: Date.now() + Math.min(maxAge, 86400) * 1000 };
  return keys;
}

// Verifies a "Sign in with Google" ID token and returns the verified email.
// maxAgeSec: the token must have been issued recently, so a leaked old token can't start a session.
export async function verifyGoogleIdToken(token, { clientId, certsUrl = GOOGLE_CERTS, now = Date.now(), maxAgeSec = 600 }) {
  if (!clientId) throw new AuthError("Google sign-in isn't set up.");
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new AuthError('Malformed Google sign-in token.');
  let header, claims;
  try {
    header = JSON.parse(dec.decode(unb64u(parts[0])));
    claims = JSON.parse(dec.decode(unb64u(parts[1])));
  } catch { throw new AuthError('Malformed Google sign-in token.'); }
  if (header.alg !== 'RS256' || !header.kid) throw new AuthError('Unexpected Google token type.');

  let keys = await googleKeys(certsUrl, false);
  let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) { keys = await googleKeys(certsUrl, true); jwk = keys.find(k => k.kid === header.kid); }
  if (!jwk) throw new AuthError("Google token was signed with a key Google doesn't list.");
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new AuthError('Google token signature is invalid.');

  const t = now / 1000, skew = 60;
  if (!GOOGLE_ISSUERS.includes(claims.iss)) throw new AuthError('Google token has the wrong issuer.');
  if (claims.aud !== clientId) throw new AuthError('Google token was issued for a different site.');
  if (!(claims.exp > t - skew)) throw new AuthError('Google sign-in expired. Try again.');
  if (!(claims.iat < t + skew) || claims.iat < t - maxAgeSec) throw new AuthError('Google sign-in is too old. Try again.');
  if (claims.email_verified !== true && claims.email_verified !== 'true') throw new AuthError("That Google account's email isn't verified.");
  if (!claims.email) throw new AuthError('Google didn\'t share an email address.');
  return { email: String(claims.email).toLowerCase(), sub: claims.sub };
}

// ---------------------------------------------------------------- WebAuthn (passkeys)

// COSE algorithm ids we accept: ES256 (almost every passkey) and RS256 (some Windows Hello keys).
const ALGS = {
  [-7]: { importAlg: { name: 'ECDSA', namedCurve: 'P-256' }, verifyAlg: { name: 'ECDSA', hash: 'SHA-256' }, der: true },
  [-257]: { importAlg: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verifyAlg: { name: 'RSASSA-PKCS1-v1_5' }, der: false },
};
export const SUPPORTED_ALGS = [-7, -257];

export function parseAuthData(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 37) throw new AuthError('Authenticator data is too short.');
  const flags = b[32];
  const out = {
    rpIdHash: b.slice(0, 32), flags,
    up: !!(flags & 0x01), uv: !!(flags & 0x04), be: !!(flags & 0x08), bs: !!(flags & 0x10), at: !!(flags & 0x40),
    signCount: ((b[33] << 24) | (b[34] << 16) | (b[35] << 8) | b[36]) >>> 0,
  };
  if (out.at) {
    if (b.length < 55) throw new AuthError('Authenticator data is too short.');
    const len = (b[53] << 8) | b[54];
    if (b.length < 55 + len) throw new AuthError('Authenticator data is too short.');
    out.credentialId = b.slice(55, 55 + len);
  }
  return out;
}

// WebAuthn ECDSA signatures are DER; WebCrypto wants raw r||s.
export function derToRaw(sig, n = 32) {
  const b = sig instanceof Uint8Array ? sig : new Uint8Array(sig);
  let i = 0;
  const bad = () => { throw new AuthError('Malformed passkey signature.'); };
  if (b[i++] !== 0x30) bad();
  let len = b[i++];
  if (len & 0x80) { const k = len & 0x7f; len = 0; for (let j = 0; j < k; j++) len = (len << 8) | b[i++]; }
  if (i + len !== b.length) bad();
  const readInt = () => {
    if (b[i++] !== 0x02) bad();
    const l = b[i++];
    if (!l || i + l > b.length) bad();
    let v = b.slice(i, i + l); i += l;
    while (v.length > n && v[0] === 0) v = v.slice(1);
    if (v.length > n) bad();
    const out = new Uint8Array(n); out.set(v, n - v.length); return out;
  };
  const r = readInt(), s = readInt();
  if (i !== b.length) bad();
  return concat(r, s);
}

function checkClientData(bytes, { type, challenge, origin }) {
  let cd;
  try { cd = JSON.parse(dec.decode(bytes)); } catch { throw new AuthError('Malformed passkey response.'); }
  if (cd.type !== type) throw new AuthError('Wrong kind of passkey response.');
  if (!challenge || cd.challenge !== challenge) throw new AuthError('The sign-in challenge didn\'t match. Try again.');
  if (cd.origin !== origin) throw new AuthError('Passkey response came from a different site.');
  if (cd.crossOrigin === true) throw new AuthError('Passkeys from embedded pages aren\'t accepted.');
}

async function checkAuthData(ad, rpId) {
  if (!sameBytes(ad.rpIdHash, await sha256(enc.encode(rpId)))) throw new AuthError('Passkey belongs to a different site.');
  if (!ad.up) throw new AuthError('The passkey wasn\'t confirmed on the device.');
  if (!ad.uv) throw new AuthError('The device didn\'t check your PIN, fingerprint or face.');
}

// Registration. The browser hands us the public key directly (getPublicKey), so no CBOR parsing is needed.
// This only runs for someone already signed in, so the key is trusted as the device reports it.
export async function verifyRegistration(c, { challenge, origin, rpId }) {
  const clientData = unb64u(c.clientDataJSON);
  checkClientData(clientData, { type: 'webauthn.create', challenge, origin });
  const ad = parseAuthData(unb64u(c.authenticatorData));
  await checkAuthData(ad, rpId);
  if (!ad.at) throw new AuthError('The device didn\'t return a new passkey.');
  const rawId = unb64u(c.rawId);
  if (!rawId.length || rawId.length > 1023 || !sameBytes(ad.credentialId, rawId)) throw new AuthError('Passkey ID mismatch.');
  const alg = Number(c.publicKeyAlgorithm);
  if (!ALGS[alg]) throw new AuthError('This passkey uses a signature type the site doesn\'t support.');
  if (!c.publicKey) throw new AuthError('The browser didn\'t share the passkey\'s public key.');
  const spki = unb64u(c.publicKey);
  try { await crypto.subtle.importKey('spki', spki, ALGS[alg].importAlg, false, ['verify']); }
  catch { throw new AuthError('The passkey\'s public key is unreadable.'); }
  const transports = Array.isArray(c.transports) ? c.transports.filter(t => typeof t === 'string').slice(0, 8) : [];
  return { id: b64u(rawId), publicKey: b64u(spki), alg, signCount: ad.signCount, transports, synced: ad.bs };
}

// Sign-in. `stored` is the saved passkey row: { publicKey, alg, signCount }.
export async function verifyAssertion(c, stored, { challenge, origin, rpId }) {
  const clientData = unb64u(c.clientDataJSON);
  checkClientData(clientData, { type: 'webauthn.get', challenge, origin });
  const authData = unb64u(c.authenticatorData);
  const ad = parseAuthData(authData);
  await checkAuthData(ad, rpId);
  const A = ALGS[stored.alg];
  if (!A) throw new AuthError('Stored passkey has an unsupported type.');
  const key = await crypto.subtle.importKey('spki', unb64u(stored.publicKey), A.importAlg, false, ['verify']);
  let sig = unb64u(c.signature);
  if (A.der) sig = derToRaw(sig);
  const ok = await crypto.subtle.verify(A.verifyAlg, key, sig, concat(authData, await sha256(clientData)));
  if (!ok) throw new AuthError('The passkey signature didn\'t check out.');
  // Synced passkeys always report 0. A counter that goes backwards means a cloned hardware key.
  if ((ad.signCount || stored.signCount) && ad.signCount <= stored.signCount) {
    throw new AuthError('This passkey\'s counter went backwards, so it was refused. Remove it and add it again.');
  }
  return { signCount: ad.signCount };
}
