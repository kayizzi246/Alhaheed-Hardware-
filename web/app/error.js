'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui';

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
    <div className="mx-auto my-10 max-w-xl rounded-lg border border-line bg-surface px-7 py-8 text-center shadow-sm">
      <h2 className="text-[19px] font-bold text-ink">This screen could not be drawn</h2>
      <p className="mx-auto mb-5 mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        Nothing has been changed and the shop&rsquo;s records are safe. Try it again.
        It usually works the second time.
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>

      <details className="mt-6 text-left">
        <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-ink-muted marker:hidden">
          <span className="select-none">▸ </span>What went wrong
        </summary>
        <code className="mt-2.5 block break-words rounded-sm border border-line bg-surface-sunk px-3.5 py-3 text-xs leading-relaxed text-ink-2">
          {String(error?.message || error) || 'No message was given.'}
        </code>
        <p className="mt-2 text-xs text-ink-faint">Show this to whoever looks after the website.</p>
      </details>
    </div>
  );
}
