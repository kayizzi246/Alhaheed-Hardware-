'use client';

import { useEffect } from 'react';

/**
 * What a broken screen looks like.
 *
 * Without this file, anything thrown while rendering shows Next's own
 * message — "Application error: a client-side exception has occurred
 * (see the browser console for more information)" — on a white page.
 * That sentence tells a cashier nothing, offers them nothing, and asks
 * them to open a browser console. It is the worst screen in the system
 * and it appears at the worst moment.
 *
 * This says what happened, keeps the way back, and prints the actual
 * error so whoever looks after the shop has something to go on. The
 * rest of the panel — the rail, the bar — is still around it, because
 * only this section failed.
 */
export default function PageError({ error, reset }) {
  useEffect(() => {
    // Still log it: the console is where a developer will look.
    console.error('Screen failed to render:', error);
  }, [error]);

  return (
    <div className="screen-error">
      <h2>This screen could not be drawn</h2>
      <p>
        Nothing has been changed and the shop's records are safe. Try it again —
        it usually works the second time.
      </p>

      <div className="screen-error-actions">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => window.location.reload()}
        >
          Reload the page
        </button>
      </div>

      <details>
        <summary>What went wrong</summary>
        <code>{String(error?.message || error) || 'No message was given.'}</code>
        <p className="sub">Show this to whoever looks after the website.</p>
      </details>
    </div>
  );
}
