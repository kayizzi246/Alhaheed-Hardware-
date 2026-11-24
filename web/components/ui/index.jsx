'use client';

/**
 * The panel's component set.
 *
 * shadcn's idiom — Radix where it earns its weight, class-variance-
 * authority for variants, `cn` to merge — in one file rather than
 * thirty. Thirty files is right for a design system several teams
 * share; this is one shop's panel, and a reader is better served
 * seeing the whole vocabulary at once.
 *
 * Radix is used only for Dialog, Tabs and Select, which need focus
 * traps, escape handling, roving tabindex and type-to-jump that are
 * genuinely hard to get right. Everything else is an element with
 * classes on it.
 */

import * as React from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/icons';

/* ── Button ──────────────────────────────────────────────────────── */

const buttonVariants = cva(
  // The press is on every variant. Without it the screen does not feel
  // like it heard you.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold ' +
    'transition-[transform,background-color,border-color,color,box-shadow,filter] duration-150 ease-out ' +
    'active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        // A light edge along the top and a coloured glow beneath: the
        // button reads as something to press, not a painted rectangle.
        primary:
          'bg-[linear-gradient(180deg,rgb(var(--fill)/0.94),rgb(var(--fill)))] text-white ' +
          'shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(15_27_51/0.14),0_6px_16px_-8px_rgb(var(--fill)/0.50)] ' +
          'hover:brightness-[1.07] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.24),0_2px_4px_rgb(15_27_51/0.14),0_10px_22px_-10px_rgb(var(--fill)/0.60)]',
        outline:
          'border border-line bg-surface text-ink-2 shadow-[0_1px_2px_rgb(15_27_51/0.05)] hover:border-line-firm hover:bg-surface-2 hover:text-ink',
        ghost:
          'text-ink-muted hover:bg-surface-2 hover:text-ink',
        danger:
          'border border-bad/25 bg-bad-bg text-bad hover:border-bad/40',
        good:
          'bg-[linear-gradient(180deg,rgb(18_126_76),rgb(14_116_68))] text-white ' +
          'shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(15_27_51/0.14),0_6px_16px_-8px_rgb(var(--green)/0.7)] hover:brightness-110',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-9 w-9',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export const Button = React.forwardRef(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

/** A bare icon button, for the top bar and anywhere a label would crowd. */
export const IconButton = React.forwardRef(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'relative grid size-[38px] place-items-center rounded-sm border border-transparent',
      'text-ink-muted transition-[background-color,color,border-color,transform] duration-150 ease-out',
      'hover:border-line hover:bg-surface-2 hover:text-ink active:scale-95',
      className
    )}
    {...props}
  />
));
IconButton.displayName = 'IconButton';

/* ── Card ────────────────────────────────────────────────────────── */

export const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgb(15_27_51/0.04),0_6px_20px_-12px_rgb(15_27_51/0.12)]', className)}
    {...props}
  />
));
Card.displayName = 'Card';

export const CardHead = ({ className, children, ...props }) => (
  <div
    className={cn(
      'flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle = ({ className, ...props }) => (
  <h2 className={cn('text-[15.5px] font-bold text-ink', className)} {...props} />
);

export const CardNote = ({ className, ...props }) => (
  <p className={cn('mt-0.5 text-[12.5px] text-ink-muted', className)} {...props} />
);

export const CardBody = ({ className, ...props }) => (
  <div className={cn('p-4 sm:p-6', className)} {...props} />
);

/* ── Chip ────────────────────────────────────────────────────────── */

const chipVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[5px] text-[11.5px] leading-none font-semibold',
  {
    variants: {
      tone: {
        grey: 'bg-surface-sunk text-ink-muted',
        pending: 'bg-warn-bg text-warn',
        info: 'bg-info-bg text-info',
        good: 'bg-ok-bg text-ok',
        bad: 'bg-bad-bg text-bad',
      },
    },
    defaultVariants: { tone: 'grey' },
  }
);

/** A dot as well as a colour: colour alone is not a signal everyone reads. */
export function Chip({ tone, dot = true, className, children, ...props }) {
  return (
    <span className={cn(chipVariants({ tone }), className)} {...props}>
      {dot && <span className="size-[5px] shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_TONE = {
  pending_payment: 'pending',
  paid: 'info',
  payment_verified: 'info',
  released: 'good',
  cancelled: 'grey',
  refunded: 'grey',
  rejected: 'bad',
};

export const StatusChip = ({ status, children }) => (
  <Chip tone={STATUS_TONE[status] || 'grey'}>{children}</Chip>
);

/* ── Form ────────────────────────────────────────────────────────── */

// `text-base sm:text-sm` is not a typographic choice. Safari on iOS
// zooms the whole page in whenever a field it is focusing has text
// under 16px, and then leaves it zoomed — so tapping into a form threw
// the layout sideways on every phone. 16px on a phone, back to 14px
// from the small breakpoint up, where no browser does this.
const fieldBase =
  'w-full rounded-sm border border-line-firm/80 bg-surface px-3.5 text-base sm:text-sm text-ink ' +
  'placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 ease-out ' +
  'focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...props} />
));
Input.displayName = 'Input';

/**
 * A dropdown that looks like it belongs to this panel.
 *
 * The browser's own <select> draws its list in the operating system's
 * style — a grey Windows box on a computer, a different one on every
 * phone — and cannot be made to match. This keeps the same way of being
 * used everywhere it already is (`value`, `onChange(e)` reading
 * `e.target.value`, <option> children), so no screen had to change,
 * and draws the list itself: rounded, the chosen one ticked, the one
 * under the pointer lit, opening from the field rather than out of
 * nowhere. Keyboard, type-to-jump and screen readers come from Radix.
 */
const EMPTY = '__ah_none__'; // Radix will not take '' as an item's value.
const enc = (v) => (v === '' || v === null || v === undefined ? EMPTY : String(v));
const dec = (v) => (v === EMPTY ? '' : v);

export const Select = React.forwardRef(
  ({ value, onChange, children, className, disabled, name, id, placeholder = 'Choose…', ...rest }, ref) => {
    const options = React.Children.toArray(children)
      .filter((c) => React.isValidElement(c) && c.type === 'option')
      .map((c) => ({
        value: c.props.value !== undefined ? String(c.props.value) : String(c.props.children),
        label: c.props.children,
        disabled: !!c.props.disabled,
      }));

    return (
      <SelectPrimitive.Root
        value={value === undefined ? undefined : enc(String(value))}
        onValueChange={(v) => onChange?.({ target: { value: dec(v), name }, currentTarget: { value: dec(v), name } })}
        disabled={disabled}
        name={name}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          aria-label={rest['aria-label']}
          className={cn(
            fieldBase,
            'group inline-flex h-11 items-center justify-between gap-2 text-left shadow-[0_1px_2px_rgb(15_27_51/0.04)]',
            'hover:border-line-firm data-[state=open]:border-brand data-[state=open]:ring-[3px] data-[state=open]:ring-brand/20',
            'data-[placeholder]:text-ink-faint [&>span]:min-w-0 [&>span]:truncate',
            className
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-4 shrink-0 text-ink-muted transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
            >
              <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              'z-[60] min-w-[var(--radix-select-trigger-width)] max-w-[min(92vw,420px)] overflow-hidden',
              'max-h-[min(360px,var(--radix-select-content-available-height))]',
              'rounded-xl border border-line bg-surface p-1 text-ink',
              'shadow-[0_16px_40px_-12px_rgb(15_27_51/0.22),0_3px_8px_rgb(15_27_51/0.06)]',
              'origin-[var(--radix-select-content-transform-origin)] data-[state=open]:animate-pop-in'
            )}
          >
            <SelectPrimitive.Viewport className="max-h-[inherit]">
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={enc(o.value)}
                  disabled={o.disabled}
                  className={cn(
                    'relative flex min-h-10 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-[14px] outline-none',
                    'transition-colors duration-100',
                    'data-[highlighted]:bg-surface-2 data-[state=checked]:font-semibold data-[state=checked]:text-brand-dark',
                    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45'
                  )}
                >
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex text-brand">
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
                      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  }
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-[88px] py-2.5', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Label = ({ className, ...props }) => (
  <label className={cn('mb-2 block text-[13px] font-semibold text-ink-2', className)} {...props} />
);

export const Field = ({ label, hint, error, children, className }) => (
  <div className={cn('min-w-0', className)}>
    {label && <Label>{label}</Label>}
    {children}
    {hint && !error && <p className="mt-1.5 text-[12.5px] text-ink-muted">{hint}</p>}
    {error && <p className="mt-1.5 text-[12.5px] font-medium text-bad">{error}</p>}
  </div>
);

/** A checkbox that looks the same in every browser. */
export function Checkbox({ label, className, ...props }) {
  return (
    <label className={cn('inline-flex cursor-pointer select-none items-center gap-2 text-[13.5px] text-ink-2', className)}>
      <span className="relative grid place-items-center">
        <input type="checkbox" className="peer sr-only" {...props} />
        <span
          aria-hidden="true"
          className={cn(
            'size-[17px] rounded-[5px] border border-line-firm bg-surface',
            'transition-[background-color,border-color] duration-150 ease-out',
            'peer-checked:border-brand peer-checked:bg-fill',
            'peer-focus-visible:ring-[3px] peer-focus-visible:ring-brand/25'
          )}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute size-3 scale-50 text-white opacity-0 transition-[opacity,transform] duration-150 ease-out peer-checked:scale-100 peer-checked:opacity-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      {label}
    </label>
  );
}

/** Two or three choices belong on screen, not inside a dropdown. */
export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-sm bg-surface-sunk p-1">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-[7px] px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150 ease-out',
              on ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Table ───────────────────────────────────────────────────────── */

/** Wraps a table so a narrow screen scrolls it rather than squashing it. */
export const TableWrap = ({ className, ...props }) => (
  <div className={cn('w-full overflow-x-auto', className)} {...props} />
);

export const Table = ({ className, ...props }) => (
  <table className={cn('w-full border-collapse text-sm', className)} {...props} />
);

export const Th = ({ className, num, ...props }) => (
  <th
    className={cn(
      'whitespace-nowrap border-b border-line bg-surface-2 px-4 py-3 sm:first:pl-6 sm:last:pr-6',
      'text-[11px] font-bold uppercase tracking-[.06em] text-ink-muted',
      num ? 'text-right' : 'text-left',
      className
    )}
    {...props}
  />
);

export const Td = ({ className, num, ...props }) => (
  <td
    className={cn('border-b border-line px-4 py-3.5 align-middle sm:first:pl-6 sm:last:pr-6 text-ink-2', num && 'tnum text-right', className)}
    {...props}
  />
);

export const Tr = ({ className, ...props }) => (
  <tr className={cn('transition-colors duration-150 hover:bg-surface-2', className)} {...props} />
);

/* ── States ──────────────────────────────────────────────────────── */

export const Empty = ({ title, children, action, icon }) => (
  <div className="px-6 py-12 text-center">
    <span
      aria-hidden="true"
      className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-faint ring-1 ring-inset ring-line [&>svg]:size-[22px]"
    >
      {icon || Icon.queue()}
    </span>
    {title && <p className="text-base font-semibold text-ink">{title}</p>}
    {children && <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">{children}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/**
 * A screen that could not get its data.
 *
 * Never an empty list in its place. "Waiting for payment: 0 — queue is
 * clear" on a dropped connection tells a cashier the queue is empty
 * when it is not; "opening 0, closing 0" tells Accounts the till holds
 * nothing. A failure is said to be a failure, with the way to retry.
 */
export const LoadFailed = ({ children, onRetry, title = 'This could not be loaded' }) => (
  <div role="alert" className="px-6 py-12 text-center">
    <p className="text-base font-semibold text-ink">{title}</p>
    <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
      {children || 'The shop could not be reached.'} Nothing has been changed.
    </p>
    {onRetry && (
      <div className="mt-5">
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    )}
  </div>
);

/** The shape of what is coming, rather than a spinner over nothing. */
export const Skeleton = ({ className }) => (
  <div className={cn('animate-shimmer rounded-sm bg-surface-sunk', className)} />
);

export function Alert({ kind = 'bad', children, onDone }) {
  React.useEffect(() => {
    if (kind === 'ok' && onDone) {
      const t = setTimeout(onDone, 4000);
      return () => clearTimeout(t);
    }
  }, [kind, onDone]);

  if (!children) return null;

  return (
    <div
      role={kind === 'bad' ? 'alert' : 'status'}
      className={cn(
        'mb-6 animate-rise-in rounded-sm border px-4 py-3 text-[13.5px]',
        kind === 'bad' && 'border-bad/25 bg-bad-bg text-bad',
        kind === 'ok' && 'border-ok/25 bg-ok-bg text-ok'
      )}
    >
      {children}
    </div>
  );
}

export const Loading = ({ children = 'Loading…' }) => (
  <div className="px-6 py-14 text-center text-[13.5px] text-ink-muted">{children}</div>
);

export const Spinner = ({ className }) => (
  <span
    role="status"
    aria-label="Working"
    className={cn(
      'inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]',
      className
    )}
  />
);

/* ── Page furniture ──────────────────────────────────────────────── */

export const PageHead = ({ title, sub, children }) => (
  <header className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
    <div className="min-w-0">
      <h1 className="text-[26px] leading-tight text-ink">{title}</h1>
      {sub && <p className="mt-1 text-sm text-ink-muted">{sub}</p>}
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </header>
);

/**
 * One figure, read down a column: label above, number below.
 * `lead` marks the one that matters most on the screen.
 */
/**
 * One figure, the panel's standard tile — every desk's screen uses it.
 *
 * A large tight number as the one thing to read; a coloured icon, when
 * there is one, carrying the figure's state (amber waiting, red low,
 * green fine) so the number itself stays plain. The figure that matters
 * most on a screen is the hero — deep blue, white text — and a tile
 * that leads somewhere is a link to the place you would act on it.
 *
 * `lead` and `hero` mean the same. Without an icon, `tone` colours the
 * number instead (cash in green, cash out red), as it always has.
 */
const STAT_TONES = {
  brand: 'bg-brand-soft text-brand',
  neutral: 'bg-surface-sunk text-ink-muted',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
};

export function Stat({ label, value, note, lead, hero, tone, icon, href, delta, spark, className }) {
  const big = !!(hero || lead);
  const Box = href ? Link : 'div';
  return (
    <Box
      {...(href ? { href } : {})}
      className={cn(
        'group relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl p-4 [container-type:inline-size] sm:p-6',
        'transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
        big
          ? 'bg-[linear-gradient(135deg,rgb(var(--fill))_0%,rgb(var(--fill-dark))_100%)] text-white shadow-[0_12px_32px_-12px_rgb(var(--fill)/0.40)]'
          : 'border border-line bg-surface shadow-[0_1px_2px_rgb(15_27_51/0.04),0_6px_20px_-12px_rgb(15_27_51/0.12)]',
        href && (big
          ? 'hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-14px_rgb(var(--fill)/0.50)] active:scale-[0.985]'
          : 'hover:-translate-y-0.5 hover:border-line-firm hover:shadow-[0_2px_4px_rgb(15_27_51/0.05),0_14px_32px_-14px_rgb(15_27_51/0.22)] active:scale-[0.985]'),
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/30',
        className
      )}
    >
      {big && (
        // A soft light in the corner, so the blue has depth.
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-white/15 blur-3xl" />
      )}

      <div className="flex min-h-9 items-center gap-3">
        {icon && (
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-xl [&>svg]:size-[18px]',
              big ? 'bg-white/15 text-white ring-1 ring-inset ring-white/20' : STAT_TONES[tone] || STAT_TONES.brand
            )}
          >
            {icon}
          </span>
        )}
        <span
          className={cn(
            'min-w-0 flex-1 text-[13px] font-semibold leading-tight [overflow-wrap:anywhere]',
            
            big ? 'text-white/90' : 'text-ink-muted'
          )}
        >
          {label}
        </span>
        {href && (
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100',
              
              big ? 'text-white/90' : 'text-ink-faint'
            )}
          >
            <path d="M5 11l6-6M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <strong
        className={cn(
          'tnum block font-display font-extrabold leading-none tracking-[-0.03em]',
          icon ? 'mt-4' : 'mt-3',
          String(value ?? '').length > 11 ? 'text-[clamp(18px,10.5cqi,30px)]' : 'text-[clamp(24px,15cqi,32px)]',
          big ? 'text-white' : !icon && tone === 'ok' ? 'text-ok' : !icon && tone === 'bad' ? 'text-bad' : 'text-ink'
        )}
      >
        {value}
      </strong>

      {(note || (delta !== null && delta !== undefined)) && (
        <span className={cn('mt-3 flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px] leading-snug', big ? 'text-white/90' : 'text-ink-muted')}>
          {delta !== null && delta !== undefined && (
            <span
              className={cn(
                'tnum inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold',
                big ? 'bg-white/20 text-white' : delta >= 0 ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'
              )}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true" className={cn('size-3', delta < 0 && 'rotate-180')}>
                <path d="M6 2.5v7M3 5.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {Math.abs(delta)}%
            </span>
          )}
          {note && <span className="min-w-0">{note}</span>}
        </span>
      )}

      {spark && <Sparkline values={spark} />}
    </Box>
  );
}

/**
 * A run of figures drawn faintly in the hero tile's corner — not for
 * reading values from, but for seeing at a glance which way things went.
 */
function Sparkline({ values }) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [
    values.length === 1 ? 50 : (i / (values.length - 1)) * 100,
    30 - (v / max) * 24,
  ]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 right-0 -z-10 h-[42%] w-[56%]"
    >
      <defs>
        <linearGradient id="stat-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.22" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,32 L0,32 Z`} fill="url(#stat-spark)" />
      <path d={line} fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="1.6" fill="white" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Two across even on a phone. One per row filled the whole first screen
// with figures and pushed the actual work — the queue — out of sight.
export const Stats = ({ children, className }) => (
  <div className={cn('mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 lg:gap-5 xl:grid-cols-4', className)}>{children}</div>
);

/** When the screen last checked. It polls; it does not pretend to push. */
export const Fresh = ({ at, failing }) => (
  <span
    title="This screen re-checks the shop on its own"
    className={cn(
      'inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs',
      failing ? 'border-bad/30 text-bad' : 'border-line text-ink-muted'
    )}
  >
    <span className={cn('size-1.5 rounded-full', failing ? 'bg-bad' : 'bg-ok')} />
    {failing
      ? 'Not updating'
      : at
        ? `Updated ${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        : 'Loading…'}
  </span>
);

/* ── Dialog ──────────────────────────────────────────────────────── */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef(
  ({ className, title, description, children, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-deep/40 backdrop-blur-[6px] data-[state=open]:animate-pop-in" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
          // Tall content scrolls inside the dialog rather than pushing
          // its buttons off the bottom of a laptop screen.
          'max-h-[min(88vh,840px)] overflow-y-auto',
          'rounded-2xl border border-line/80 bg-surface shadow-[0_24px_64px_-16px_rgb(15_27_51/0.35),0_4px_12px_-4px_rgb(15_27_51/0.12)]',
          // A modal is not anchored to a trigger, so it scales from its
          // own centre — and from .96, never 0. `dialog-in` rather than
          // `pop-in` because this box is centred by a translate, and
          // pop-in's final `transform: none` would throw that away.
          'data-[state=open]:animate-dialog-in',
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-base font-bold text-ink">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <IconButton className="size-8" aria-label="Close">{Icon.close()}</IconButton>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
);
DialogContent.displayName = 'DialogContent';

export const DialogBody = ({ className, ...props }) => (
  <div className={cn('px-4 py-5 sm:px-6', className)} {...props} />
);

export const DialogFoot = ({ className, ...props }) => (
  <div className={cn('flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2/70 px-4 py-4 sm:px-6', className)} {...props} />
);

/**
 * The older dialog, kept.
 *
 * Pages call this with `open`, `title`, `onClose`, `footer`. That shape
 * is fine and it is used in a dozen places, so it stays — only what is
 * underneath changed, from a hand-rolled backdrop to Radix, which
 * brings the focus trap, the escape key, the scroll lock and the
 * `aria` wiring that the hand-rolled one only half had.
 *
 * `open` still defaults to true, because some call sites decide by
 * rendering it or not. Without that default, a page that keeps the
 * element mounted and sets open to false had a dialog that could not
 * be dismissed — which is exactly what happened to the cancel-order
 * box.
 */
export function Modal({ open = true, title, description, onClose, children, footer }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent title={title} description={description}>
        <DialogBody>{children}</DialogBody>
        {footer && <DialogFoot>{footer}</DialogFoot>}
      </DialogContent>
    </Dialog>
  );
}

/* ── Tabs ────────────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root;

export const TabsList = ({ className, ...props }) => (
  <TabsPrimitive.List className={cn('inline-flex gap-1 rounded-sm bg-surface-sunk p-1', className)} {...props} />
);

export const TabsTrigger = ({ className, ...props }) => (
  <TabsPrimitive.Trigger
    className={cn(
      'rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold text-ink-muted transition-colors duration-150',
      'data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
);

export const TabsContent = TabsPrimitive.Content;
