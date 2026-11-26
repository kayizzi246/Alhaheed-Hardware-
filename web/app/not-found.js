import Link from 'next/link';

/**
 * A link that leads nowhere — an old bookmark, a mistyped address.
 *
 * Next's own page here is a bare "404 | This page could not be found"
 * with no way back. This one says what happened in plain words and
 * offers the way back to work.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md rounded-lg border border-line bg-surface px-7 py-8 text-center shadow-sm">
        <p className="text-[12px] font-bold uppercase tracking-[.08em] text-ink-muted">Page not found</p>
        <h1 className="mt-2 text-[22px] font-extrabold text-ink">There is nothing at this address</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          The link may be old, or mistyped. Nothing has been changed.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center rounded-sm bg-fill px-4 sm:px-6 text-sm font-semibold text-on-fill hover:bg-fill-dark"
        >
          Go to my desk
        </Link>
      </div>
    </div>
  );
}
