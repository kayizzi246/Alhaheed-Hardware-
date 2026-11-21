import { useCallback, useEffect, useState } from 'react';

const KEY = 'ah.admin.theme';

/**
 * Light or dark, for the desk screens inside wp-admin.
 *
 * Light is the default and "system" is deliberately not offered. The
 * WordPress chrome around this app — the sidebar, the admin bar — is
 * light unless the person has chosen one of WordPress's own dark
 * colour schemes, and nothing here can change that. A desk that went
 * dark on its own because the laptop was in dark mode would sit in a
 * white frame looking broken. So it is a switch, and it stays where
 * the person put it.
 *
 * Kept per browser, like the web panel's: it belongs to the screen on
 * the counter, not to whoever is signed in at the time.
 */
const root = () => document.getElementById('ah-app');

function paint(theme) {
  const el = root();
  if (!el) return;

  if (theme === 'dark') el.setAttribute('data-theme', 'dark');
  else el.removeAttribute('data-theme');

  // wp-admin paints the content area white, and it shows around the
  // app's edges — a dark panel in a white frame looks like a styling
  // bug rather than a choice. The class lets index.css darken those
  // wrappers too, so the whole region goes with it. WordPress's own
  // sidebar is already dark in the default scheme.
  document.body.classList.toggle('ah-dark', theme === 'dark');
}

export function useTheme() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    let saved = 'light';
    try { saved = localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { /* blocked */ }
    setTheme(saved);
    paint(saved);
  }, []);

  const toggle = useCallback(() => {
    setTheme((was) => {
      const next = was === 'dark' ? 'light' : 'dark';
      paint(next);
      try { localStorage.setItem(KEY, next); } catch { /* private window */ }
      return next;
    });
  }, []);

  return { theme, toggle };
}
