'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeping a desk current.
 *
 * The old Node API pushed changes over Socket.IO. WordPress on shared
 * hosting has no websocket worth relying on, so the desks poll instead
 * — and rather than pretend otherwise with a "Live" dot that could
 * never go green, the screens say when they last checked.
 *
 * Polling is done with some care, because a counter machine leaves this
 * page open all day:
 *
 *   • a hidden tab does not poll at all, and refreshes the moment it is
 *     looked at again
 *   • a request is never fired while one is still in flight
 *   • a failure backs off rather than hammering a shop whose internet
 *     has dropped, and recovers on the next success
 *
 * @param {() => Promise<void>} fetcher  what to re-run
 * @param {number} every                 milliseconds between checks
 */
export function usePoll(fetcher, every = 10000) {
  const [at, setAt] = useState(null);
  const [failing, setFailing] = useState(false);

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
    }
  }, []);

  useEffect(() => {
    run();

    let timer;
    const tick = () => {
      // Back off while it is failing — 10s, 20s, 40s, up to a minute —
      // so a dropped connection is not made worse by the retries.
      const wait = misses.current ? Math.min(every * 2 ** misses.current, 60000) : every;
      timer = setTimeout(async () => { await run(); tick(); }, wait);
    };
    tick();

    // Back from another tab: show the truth immediately.
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [run, every]);

  return { at, failing, refresh: run };
}

/** "Updated 14:31" — or the truth, when it is not. */
export function freshness(at, failing) {
  if (failing) return 'Not updating. Check the connection';
  if (!at) return 'Loading…';
  return `Updated ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
