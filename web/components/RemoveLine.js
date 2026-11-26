'use client';

/** The small × that removes one line from "Check these". */
export function RemoveLine({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove"
      title="Remove"
      className="grid w-11 shrink-0 place-items-center text-[18px] leading-none text-ink-faint hover:bg-bad/10 hover:text-bad"
    >
      ×
    </button>
  );
}
