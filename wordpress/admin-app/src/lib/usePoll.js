import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeping a desk current.
 *
 * There is no websocket — WordPress on shared hosting has none worth
 * relying on — so the desks poll, and say when they last checked
 * rather than claiming to be live.
 *
 * A hidden tab does not poll and refreshes the moment it is looked at
 * again; a request is never fired while one is in flight; a failure
 * backs off instead of hammering a shop whose line has dropped.
 */
export function usePoll(fetcher, every = 10000) {
  const [at, setAt] = useState(null);
  const [failing, setFailing] = useState(false);
  const [ready, setReady] = useState(false);

  const busy = useRef(false);
  const misses = useRef(0);
  const saved = useRef(fetcher);
  saved.current = fetcher;

  const run = useCallback(async () => {
    if (busy.current || document.hidden) return;
    busy.current = true;
    try {
      await saved.current();
      misses.current = 0;
      setFailing(false);
      setAt(new Date());
    } catch {
      misses.current += 1;
      setFailing(true);
    } finally {
      busy.current = false;
      setReady(true);
    }
  }, []);

  useEffect(() => {
    run();
    let timer;
    const tick = () => {
      const wait = misses.current ? Math.min(every * 2 ** misses.current, 60000) : every;
      timer = setTimeout(async () => { await run(); tick(); }, wait);
    };
    tick();

    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [run, every]);

  return { at, failing, ready, refresh: run };
}

export const freshness = (at, failing) => {
  if (failing) return 'Not updating. Check the connection';
  if (!at) return 'Loading…';
  return `Updated ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};
