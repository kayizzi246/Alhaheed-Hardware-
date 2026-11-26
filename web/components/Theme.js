'use client';

import { useEffect, useState } from 'react';

export const THEME_KEY = 'alhadeed.theme';

/**
 * Light, dark, or whatever the device says.
 *
 * The counter is usually under a fluorescent tube and wants light; the
 * back office at eight in the evening does not. "System" is the
 * default, so most people never touch this and the screen matches
 * everything else on their machine.
 *
 * The choice is written to the <html> element as `data-theme`, which
 * is what globals.css reads. It is kept per browser, not per account:
 * it is a property of the screen you are sitting at, and the counter
 * machine should not change its mind when a different cashier signs
 * in.
 */

export function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(next) {
  const root = document.documentElement;
  if (next === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', next);
}

export function saveTheme(next) {
  applyTheme(next);
  try {
    if (next === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
  } catch { /* private window: it still applies for this visit */ }
}

/**
 * The script that runs before anything is painted.
 *
 * Without it the page draws light, then switches to dark once React
 * has started — a white flash in a dark room, every single navigation.
 * It has to be inline and synchronous in <head> for that reason.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;

const OPTIONS = [
  ['light', 'Light', '☀'],
  ['dark', 'Dark', '☾'],
  ['system', 'System', '◐'],
];

/** Three named choices, for the account menu. */
export function ThemeChoice() {
  const [theme, setTheme] = useState('system');

  useEffect(() => { setTheme(readTheme()); }, []);

  const pick = (next) => { setTheme(next); saveTheme(next); };

  return (
    <div className="border-b border-line px-3.5 py-3">
      <span className="mb-2 block font-display text-[10.5px] font-bold uppercase tracking-[.07em] text-ink-faint">
        Appearance
      </span>
      <div className="grid grid-cols-3 gap-1 rounded-sm bg-surface-sunk p-[3px]" role="radiogroup" aria-label="Appearance">
        {OPTIONS.map(([value, label, glyph]) => {
          const on = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(value)}
              className={[
                'flex flex-col items-center gap-0.5 rounded-[7px] px-1 pb-1.5 pt-[7px]',
                'text-[11px] font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[.97]',
                on ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              <b className="text-[12px] font-normal leading-none" aria-hidden="true">{glyph}</b>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One button that cycles, for the sign-in page where there is no menu. */
export function ThemeToggle() {
  const [theme, setTheme] = useState('system');

  useEffect(() => { setTheme(readTheme()); }, []);

  const cycle = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    saveTheme(next);
  };

  const label = theme === 'system' ? 'Appearance: follows your device' : `Appearance: ${theme}`;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={[
        'grid size-9 place-items-center rounded-sm border border-line bg-surface text-[13px] text-ink-2',
        'transition-[border-color,color,transform] duration-150 ease-out',
        'hover:border-line-firm hover:text-ink active:scale-95',
      ].join(' ')}
    >
      {theme === 'light' ? '☀' : theme === 'dark' ? '☾' : '◐'}
    </button>
  );
}
