'use client';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const TOKEN_KEY = 'alhadeed.token';
export const USER_KEY = 'alhadeed.user';

/**
 * Where the session lives.
 *
 * "Keep me signed in" is the difference between localStorage, which
 * survives closing the browser, and sessionStorage, which does not.
 * On a shared counter machine the second is the safer answer, so it is
 * offered rather than assumed — both are read on the way back out, so
 * it does not matter which one holds it.
 */
const stores = () =>
  typeof window === 'undefined' ? [] : [window.localStorage, window.sessionStorage];

const read = (key) => {
  for (const s of stores()) {
    try {
      const v = s.getItem(key);
      if (v) return v;
    } catch { /* blocked storage in a private window */ }
  }
  return null;
};

export const getToken = () => read(TOKEN_KEY);

export const getUser = () => {
  try { return JSON.parse(read(USER_KEY) || 'null'); } catch { return null; }
};

export function setSession(token, user, { remember = true } = {}) {
  clearSession();
  const store = remember ? window.localStorage : window.sessionStorage;
  try {
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* nothing to be done if storage is blocked */ }
}

/**
 * The last answer to each GET, in memory, for showing a screen at once.
 *
 * Every request to the shop's server costs most of a second before it
 * replies, however small. Going back to a screen you were on a minute
 * ago should not mean staring at "Loading…" for that second again — so
 * a screen can start from what it showed last time (peek) and replace
 * it as soon as the fresh answer arrives. It is never used *instead* of
 * asking: only to fill the gap while asking.
 *
 * Memory only, and emptied on sign-out, so on a shared counter computer
 * the next person never sees the last person's screen.
 */
const lastSeen = new Map();
export const peek = (path) => lastSeen.get(path) ?? null;

export function clearSession() {
  lastSeen.clear();
  for (const s of stores()) {
    try { s.removeItem(TOKEN_KEY); s.removeItem(USER_KEY); } catch { /* ignore */ }
  }
}

/**
 * An error that has already been put into words a person can act on.
 *
 * `kind` says what sort of failure it was, for a screen that wants to
 * react differently — a "Try again" button makes sense after `network`
 * or `timeout`, not after `denied`.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'server', code = null, retryAfter = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/**
 * How long to wait for the shop before saying so.
 *
 * Without a limit a request on a weak mobile signal can hang for
 * minutes with a spinner and no word. Long enough for a slow server
 * on a bad day; short enough that the person is told something.
 */
const TIMEOUT_MS = 25000;

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Send a request; turn every way it can fail into one plain sentence. */
async function send(path, init, { timeout = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(BASE + path, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new ApiError(
        'The shop is taking too long to answer. Check the internet connection and try again.',
        { kind: 'timeout' }
      );
    }
    // fetch() only throws for no connection at all: no signal, the
    // server down, or the address blocked.
    throw new ApiError(
      offline()
        ? 'You are offline. Reconnect to the internet and try again.'
        : 'Cannot reach the shop right now. Check the internet connection and try again.',
      { kind: 'network' }
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A 401 means "your session has ended" only when there was a session.
 *
 * It used to mean that always — so a wrong password on the sign-in
 * page, which is also a 401, reloaded the page, cleared what had been
 * typed and showed nothing. The cashier was left thinking the site was
 * broken.
 */
function sessionEnded(res, path, hadToken) {
  if (res.status !== 401 || !hadToken || path.startsWith('/api/auth/')) return false;
  if (typeof window !== 'undefined') {
    clearSession();
    window.location.href = '/?ended=1';
  }
  return true;
}

/** Read the reply, whatever it turned out to be. */
async function read_(res) {
  const text = await res.text().catch(() => '');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    // An HTML page where JSON was expected: the host's error page, a
    // maintenance screen, a login wall. Not something to show anyone.
    return null;
  }
}

function sayFailure(res, data) {
  const fromServer = data && (data.error || data.message);
  const code = data && data.code;

  // A route the server does not know: the panel is newer than the
  // plugin on the site. Said plainly, because the fix is an upload.
  if (code === 'rest_no_route') {
    return 'This part needs the latest version of the shop’s plugin. Ask whoever manages the website to update it.';
  }
  if (fromServer && res.status < 500) return fromServer;

  switch (true) {
    case res.status === 429: return 'Too many tries. Wait a few minutes and try again.';
    case res.status === 403: return 'You do not have access to this.';
    case res.status === 404: return 'That could not be found. It may have been removed.';
    case res.status === 413: return 'That file is too big to send.';
    case res.status === 502 || res.status === 503 || res.status === 504 || res.status === 520 || res.status === 521 || res.status === 522 || res.status === 524:
      return 'The shop’s server is not answering just now. Wait a moment and try again.';
    case res.status >= 500:
      return fromServer
        ? `The shop’s server had a problem: ${fromServer}`
        : `The shop’s server had a problem (error ${res.status}). Try again. If it keeps happening, tell the manager.`;
    default:
      return fromServer || `Something went wrong (error ${res.status}). Try again.`;
  }
}

function fail(res, data) {
  throw new ApiError(sayFailure(res, data), {
    status: res.status,
    kind: res.status === 403 ? 'denied' : res.status === 429 ? 'limited' : res.status >= 500 ? 'server' : 'refused',
    code: data && data.code,
    retryAfter: data && data.data && data.data.retryAfter,
  });
}

/** Attaches the token, waits a sensible time, and puts every failure into words. */
export async function api(path, { method = 'GET', body, raw, timeout } = {}) {
  const token = getToken();
  const res = await send(
    path,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    { timeout }
  );

  if (sessionEnded(res, path, !!token)) {
    throw new ApiError('Your session has ended. Sign in again.', { status: 401, kind: 'session' });
  }
  if (raw) return res;

  const data = await read_(res);
  if (!res.ok) fail(res, data);
  if (data === null) {
    throw new ApiError(
      'The shop’s server sent back something unexpected. Try again. If it keeps happening, tell the manager.',
      { status: res.status, kind: 'server' }
    );
  }
  if (method === 'GET') lastSeen.set(path, data);
  return data;
}

export { BASE as API_BASE };

/**
 * Send a file.
 *
 * Separate from `api()` because that sets `Content-Type:
 * application/json`, and multipart must be left to the browser — it
 * appends the boundary marker that tells the server where each part
 * starts. Set the header by hand and the body is unreadable at the
 * other end. A longer wait, because a photo over a mobile connection
 * takes longer than a list.
 */
export async function upload(path, formData) {
  const token = getToken();
  const res = await send(
    path,
    { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData },
    { timeout: 60000 }
  );
  if (sessionEnded(res, path, !!token)) {
    throw new ApiError('Your session has ended. Sign in again.', { status: 401, kind: 'session' });
  }
  const data = await read_(res);
  if (!res.ok) fail(res, data);
  return data || {};
}
