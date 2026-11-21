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

export function clearSession() {
  for (const s of stores()) {
    try { s.removeItem(TOKEN_KEY); s.removeItem(USER_KEY); } catch { /* ignore */ }
  }
}

/** Thin fetch wrapper that attaches the bearer token and unwraps errors. */
export async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    clearSession();
    window.location.href = '/';
    throw new Error('Session expired');
  }
  if (raw) return res;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Download a CSV export through the authenticated endpoint. */
export async function downloadCsv(path, filename) {
  const res = await api(path, { raw: true });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { BASE as API_BASE };
