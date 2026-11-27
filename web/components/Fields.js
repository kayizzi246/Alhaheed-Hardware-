'use client';

import { cn } from '@/lib/cn';

/**
 * Fields that read clearly at a glance.
 *
 * MoneyField: "UGX" inside the box, commas as you type (1,250,000), and
 * a small × to empty it. It hands back plain digits ("1250000"), so the
 * form keeps storing what it always stored.
 *
 * MeasureField: a number with its unit inside the box (ft, mm, kg).
 */
const box =
  'group flex h-10 w-full items-center rounded-lg border border-line-firm/80 bg-surface transition-[border-color,box-shadow] duration-150 ' +
  'focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/20';

const withCommas = (digits) => (digits ? Number(digits).toLocaleString('en-US') : '');

export function MoneyField({ value, onChange, placeholder = '0', strong, className, invalid, ...rest }) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  return (
    <div className={cn(box, invalid && 'border-bad focus-within:border-bad focus-within:ring-bad/20', className)}>
      <span className="shrink-0 select-none border-r border-line px-2.5 text-[11.5px] font-bold tracking-wide text-ink-muted">UGX</span>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        value={withCommas(digits)}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, ''))}
        className={cn(
          'tnum h-full min-w-0 flex-1 bg-transparent px-2.5 text-right text-[13px] text-ink outline-none placeholder:text-ink-faint',
          strong && 'font-bold'
        )}
      />
      {digits && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear"
          onClick={() => onChange('')}
          className="mr-1.5 grid size-6 shrink-0 place-items-center rounded-md text-[14px] leading-none text-ink-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink group-focus-within:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function MeasureField({ value, onChange, unit, placeholder, className, ...rest }) {
  return (
    <div className={cn(box, className)}>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          // Digits and one point only.
          let v = e.target.value.replace(/[^\d.]/g, '');
          const dot = v.indexOf('.');
          if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
          onChange(v);
        }}
        className="tnum h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-ink outline-none placeholder:text-ink-faint"
      />
      <span className="shrink-0 select-none pr-3 text-[11.5px] font-semibold text-ink-muted">{unit}</span>
    </div>
  );
}
