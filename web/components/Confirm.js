'use client';

import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * "Are you sure?", in the panel's own clothes instead of the browser's
 * grey box. Call it from anywhere:
 *
 *   if (!(await confirmAction({ title: 'Delete this count?', body: '…', confirm: 'Delete' }))) return;
 *
 * ConfirmHost (mounted once, in the Shell) draws it. For anything that
 * deletes, Cancel has the focus, so a stray Enter never deletes.
 */
let open = null;

export function confirmAction({ title, body, confirm = 'Delete', cancel = 'Cancel', tone = 'danger', points = [] }) {
  return new Promise((resolve) => {
    if (!open) {
      // Not mounted (a page outside the Shell): fall back to the browser.
      resolve(window.confirm(`${title}\n\n${body || ''}`));
      return;
    }
    open({ title, body, confirm, cancel, tone, points, resolve });
  });
}

const Bin = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

const Question = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
  </svg>
);

export function ConfirmHost() {
  const [ask, setAsk] = useState(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    open = (a) => setAsk(a);
    return () => { open = null; };
  }, []);

  const finish = (yes) => {
    ask?.resolve(yes);
    setAsk(null);
  };

  const danger = ask?.tone === 'danger';

  return (
    <DialogPrimitive.Root open={!!ask} onOpenChange={(v) => !v && finish(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-navy-deep/40 backdrop-blur-[6px] data-[state=open]:animate-pop-in" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus(); }}
          className={cn(
            'fixed left-1/2 top-1/2 z-[60] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            // Centred on the page, beside the menu, like every other pop-up.
            'lg:left-[calc(50%+var(--sidebar-w)/2)]',
            'rounded-2xl border border-line/80 bg-surface px-4 pb-6 pt-7 text-center',
            'shadow-[0_24px_64px_-16px_rgb(15_27_51/0.35),0_4px_12px_-4px_rgb(15_27_51/0.12)]',
            'data-[state=open]:animate-dialog-in'
          )}
        >
          {ask && (
            <>
              <span className={cn('mx-auto grid size-12 place-items-center rounded-full', danger ? 'bg-bad-bg text-bad' : 'bg-brand-soft text-brand')}>
                {danger ? <Bin /> : <Question />}
              </span>
              <DialogPrimitive.Title className="mt-4 text-[14px] font-bold leading-snug text-ink">{ask.title}</DialogPrimitive.Title>
              {ask.body && (
                <DialogPrimitive.Description className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{ask.body}</DialogPrimitive.Description>
              )}
              {ask.points?.length > 0 && (
                <ul className="mx-auto mt-4 max-w-[320px] space-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-left text-[11.5px] text-ink-2">
                  {ask.points.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true" className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', danger ? 'bg-bad' : 'bg-brand')} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button ref={cancelRef} variant="outline" onClick={() => finish(false)}>{ask.cancel}</Button>
                <Button
                  onClick={() => finish(true)}
                  // A solid red that reads the same in both themes: this is the one that cannot be undone.
                  className={danger ? 'border-transparent bg-[#b42318] text-white hover:bg-[#99190f] [background-image:none]' : undefined}
                >
                  {ask.confirm}
                </Button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
