'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Lines of "Check these" that the manager removed.
 *
 * Kept by their exact words. The words carry the number ("2 paid
 * orders…"), so when the number changes the line is new and shows again:
 * removing a warning never hides a new problem.
 */
const KEY = 'alhadeed.checkHidden';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v.slice(-200))); } catch { /* private window */ }
}

export function useDismissed() {
  const [hidden, setHidden] = useState([]);
  useEffect(() => { setHidden(read()); }, []);

  const hide = useCallback((texts) => {
    const next = Array.from(new Set([...read(), ...texts]));
    write(next);
    setHidden(next);
  }, []);

  const visible = useCallback((items) => (items || []).filter((t) => !hidden.includes(t.text)), [hidden]);

  return { hide, visible };
}
