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
 * Radix is used only for Dialog and Tabs, which need focus traps,
 * escape handling and roving tabindex that are genuinely hard to get
 * right. Everything else is an element with classes on it.
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/icons';

/* ── Button ──────────────────────────────────────────────────────── */

const buttonVariants = cva(
  // The press is on every variant. Without it the screen does not feel
  // like it heard you.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold ' +
    'transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out ' +
    'active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-white shadow-sm hover:bg-brand-dark',
        outline:
          'border border-line bg-surface text-ink-2 hover:border-line-firm hover:text-ink',
        ghost:
          'text-ink-muted hover:bg-surface-2 hover:text-ink',
        danger:
          'border border-bad/25 bg-bad-bg text-bad hover:border-bad/40',
        good:
          'bg-ok text-white hover:brightness-110',
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
    className={cn('rounded-lg border border-line bg-surface shadow-sm', className)}
    {...props}
  />
));
Card.displayName = 'Card';

export const CardHead = ({ className, children, ...props }) => (
  <div
    className={cn(
      'flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4',
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
  <div className={cn('p-5', className)} {...props} />
);

/* ── Chip ────────────────────────────────────────────────────────── */

const chipVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-semibold',
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
  'w-full rounded-sm border border-line bg-surface px-3 text-base sm:text-sm text-ink ' +
  'placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 ease-out ' +
  'focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...props} />
));
Input.displayName = 'Input';

export const Select = React.forwardRef(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, 'h-11 pr-8', className)} {...props} />
));
Select.displayName = 'Select';

export const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-[88px] py-2.5', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Label = ({ className, ...props }) => (
  <label className={cn('mb-1.5 block text-xs font-semibold text-ink-muted', className)} {...props} />
);

export const Field = ({ label, hint, error, children, className }) => (
  <div className={cn('min-w-0', className)}>
    {label && <Label>{label}</Label>}
    {children}
    {hint && !error && <p className="mt-1 text-[11.5px] text-ink-muted">{hint}</p>}
    {error && <p className="mt-1 text-[11.5px] font-medium text-bad">{error}</p>}
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
            'peer-checked:border-brand peer-checked:bg-brand',
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
      'whitespace-nowrap border-b border-line bg-surface-2 px-4 py-2.5',
      'text-[11px] font-bold uppercase tracking-[.06em] text-ink-muted',
      num ? 'text-right' : 'text-left',
      className
    )}
    {...props}
  />
);

export const Td = ({ className, num, ...props }) => (
  <td
    className={cn('border-b border-line px-4 py-3 align-middle text-ink-2', num && 'tnum text-right', className)}
    {...props}
  />
);

export const Tr = ({ className, ...props }) => (
  <tr className={cn('transition-colors duration-150 hover:bg-surface-2', className)} {...props} />
);

/* ── States ──────────────────────────────────────────────────────── */

export const Empty = ({ title, children, action }) => (
  <div className="px-6 py-14 text-center">
    {title && <p className="text-base font-semibold text-ink">{title}</p>}
    {children && <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">{children}</p>}
    {action && <div className="mt-5">{action}</div>}
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
        'mb-4 animate-rise-in rounded-sm border px-4 py-3 text-[13.5px]',
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
  <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
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
export function Stat({ label, value, note, lead, tone }) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border border-line bg-surface px-3 py-3 shadow-sm [container-type:inline-size] sm:px-4 sm:py-3.5',
        lead && 'border-brand/30 bg-brand-soft'
      )}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-[.06em] text-ink-muted sm:text-[11px] sm:tracking-[.07em]">{label}</p>
      <p
        className={cn(
          // Big for short figures ("7", "UGX 849K"); only a long full
          // amount ("UGX 12,345,000") steps down to fit its tile.
          String(value ?? '').length > 11
            ? 'tnum mt-1.5 text-[clamp(15px,10cqi,27px)] font-extrabold leading-none text-ink'
            : 'tnum mt-1.5 text-[clamp(20px,14cqi,27px)] font-extrabold leading-none text-ink',
          lead && 'text-brand-dark',
          tone === 'ok' && 'text-ok',
          tone === 'bad' && 'text-bad'
        )}
      >
        {value}
      </p>
      {note && <p className="mt-1.5 truncate text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

// Two across even on a phone. One per row filled the whole first screen
// with figures and pushed the actual work — the queue — out of sight.
export const Stats = ({ children, className }) => (
  <div className={cn('mb-5 grid grid-cols-2 gap-2.5 sm:mb-6 sm:gap-3 xl:grid-cols-4', className)}>{children}</div>
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
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-deep/45 backdrop-blur-[2px] data-[state=open]:animate-pop-in" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
          // Tall content scrolls inside the dialog rather than pushing
          // its buttons off the bottom of a laptop screen.
          'max-h-[min(88vh,840px)] overflow-y-auto',
          'rounded-lg border border-line bg-surface shadow-lg',
          // A modal is not anchored to a trigger, so it scales from its
          // own centre — and from .96, never 0. `dialog-in` rather than
          // `pop-in` because this box is centred by a translate, and
          // pop-in's final `transform: none` would throw that away.
          'data-[state=open]:animate-dialog-in',
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
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
  <div className={cn('px-5 py-4', className)} {...props} />
);

export const DialogFoot = ({ className, ...props }) => (
  <div className={cn('flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3.5', className)} {...props} />
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
