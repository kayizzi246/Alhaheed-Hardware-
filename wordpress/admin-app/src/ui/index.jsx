/**
 * The component set.
 *
 * shadcn/ui's idiom — Radix underneath where it earns its weight,
 * class-variance-authority for variants, `cn` to merge — written into
 * one file rather than thirty. Thirty files is right for a design
 * system a team shares; this is one plugin's admin, and a reader is
 * better served by being able to see the whole vocabulary at once.
 *
 * Radix is used only for Dialog and Tabs, which need focus traps,
 * escape handling and roving tabindex that are genuinely hard to get
 * right. Everything else is a button with classes on it.
 */
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Button ──────────────────────────────────────────────────────── */

const buttonVariants = cva(
  // The press is on every variant: without it the screen does not feel
  // like it heard you.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold ' +
    'transition-[transform,background-color,border-color,color] duration-150 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
    'disabled:pointer-events-none disabled:opacity-50 active:scale-[.97] ' +
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        destructive: 'bg-destructive/10 text-destructive border border-destructive/25 hover:bg-destructive/15',
        outline: 'border border-input bg-card text-secondary-foreground hover:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        success: 'bg-success text-success-foreground hover:bg-success/90',
      },
      size: {
        default: 'h-10 px-4 text-sm',
        sm: 'h-8 px-3 text-[13px]',
        lg: 'h-11 px-6 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = 'Button';

/* ── Card ────────────────────────────────────────────────────────── */

export const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('rounded-2xl border border-border bg-card text-card-foreground shadow-sm', className)}
    {...props}
  />
));
Card.displayName = 'Card';

export const CardHeader = ({ className, ...props }) => (
  <div className={cn('flex items-start justify-between gap-3 border-b border-border px-5 py-4', className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  <h3 className={cn('text-[15px] font-semibold tracking-[-.008em]', className)} {...props} />
);

export const CardNote = ({ className, ...props }) => (
  <p className={cn('mt-0.5 text-xs text-muted-foreground', className)} {...props} />
);

export const CardBody = ({ className, ...props }) => (
  <div className={cn('p-5', className)} {...props} />
);

/* ── Badge ───────────────────────────────────────────────────────── */

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 leading-none text-[11.5px] font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-muted-foreground',
        pending: 'border-warning/20 bg-warning/10 text-warning',
        info: 'border-[hsl(var(--ah-cat-c))]/20 bg-[hsl(var(--ah-cat-c))]/10 text-[hsl(var(--ah-cat-c))]',
        success: 'border-success/20 bg-success/10 text-success',
        danger: 'border-destructive/20 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

/** A dot as well as a colour: colour alone is not a signal everyone reads. */
export function Badge({ className, tone, dot = true, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="size-[5px] rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_TONE = {
  pending_payment: 'pending',
  paid: 'info',
  payment_verified: 'info',
  released: 'success',
  cancelled: 'neutral',
  rejected: 'danger',
  refunded: 'neutral',
};

const STATUS_TEXT = {
  pending_payment: 'Pending payment',
  paid: 'Paid',
  payment_verified: 'Being packed',
  released: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  refunded: 'Refunded',
};

export const StatusBadge = ({ status, children }) => (
  <Badge tone={STATUS_TONE[status] || 'neutral'}>{children || STATUS_TEXT[status] || status}</Badge>
);

/* ── Input / Label / Field ───────────────────────────────────────── */

export const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground',
      'placeholder:text-muted-foreground',
      'transition-[border-color,box-shadow] duration-150',
      'focus:border-primary focus:ring-[3px] focus:ring-primary/20',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Label = ({ className, ...props }) => (
  <label className={cn('mb-2 block text-[13px] font-semibold text-secondary-foreground', className)} {...props} />
);

export const Field = ({ label, hint, children, className }) => (
  <div className={cn('min-w-0', className)}>
    {label && <Label>{label}</Label>}
    {children}
    {hint && <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>}
  </div>
);

/* ── Segmented control ───────────────────────────────────────────── */

/** Three choices belong on screen, not inside a dropdown. */
export function Segmented({ value, onChange, options, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex gap-1 rounded-lg bg-muted p-1">
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
              'rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Dialog ──────────────────────────────────────────────────────── */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Radix portals to <body> by default, which is outside #ah-app — and
 * every token and every utility class in this app is scoped to #ah-app.
 * A dialog portalled to the body therefore arrives with no styling at
 * all, as a stack of bare inputs at the bottom of the page. So the
 * portal goes into the app's own root instead.
 */
const portalHost = () => (typeof document === 'undefined' ? undefined : document.getElementById('ah-app'));

export const DialogContent = React.forwardRef(({ className, title, description, children, ...props }, ref) => (
  <DialogPrimitive.Portal container={portalHost()}>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[100000] bg-[hsl(210_57%_8%/.45)] backdrop-blur-[2px] data-[state=open]:animate-ah-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-[100001] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
        'rounded-lg border border-border bg-card shadow-2xl',
        // From .97, never 0 — nothing in the world appears out of nothing.
        'data-[state=open]:animate-ah-in',
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
        <div>
          <DialogPrimitive.Title className="text-base font-semibold tracking-[-.01em]">{title}</DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </div>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogBody = ({ className, ...props }) => (
  <div className={cn('px-6 py-5', className)} {...props} />
);

export const DialogFooter = ({ className, ...props }) => (
  <div className={cn('flex justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4', className)} {...props} />
);

/* ── Tabs ────────────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root;

export const TabsList = ({ className, ...props }) => (
  <TabsPrimitive.List className={cn('inline-flex gap-1 rounded-lg bg-muted p-1', className)} {...props} />
);

export const TabsTrigger = ({ className, ...props }) => (
  <TabsPrimitive.Trigger
    className={cn(
      'rounded-md px-3.5 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors',
      'data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
);

export const TabsContent = TabsPrimitive.Content;

/* ── Table ───────────────────────────────────────────────────────── */

export const Table = ({ className, ...props }) => (
  <table className={cn('w-full text-sm', className)} {...props} />
);

export const Th = ({ className, right, ...props }) => (
  <th
    className={cn(
      'border-b border-border bg-muted/50 px-5 py-3 text-[11px] font-bold uppercase tracking-[.06em] text-muted-foreground',
      right ? 'text-right' : 'text-left',
      className
    )}
    {...props}
  />
);

export const Td = ({ className, right, ...props }) => (
  <td
    className={cn('border-b border-border px-5 py-3.5 align-middle', right && 'text-right tnum', className)}
    {...props}
  />
);

/* ── States ──────────────────────────────────────────────────────── */

export const Empty = ({ icon: Icon, title, children }) => (
  <div className="px-6 py-12 text-center">
    {Icon && <Icon className="mx-auto mb-3 size-7 text-success" />}
    {title && <p className="text-base font-semibold text-foreground">{title}</p>}
    {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
  </div>
);

/** The shape of what is coming, rather than a spinner over nothing. */
export const Skeleton = ({ className }) => (
  <div
    className={cn(
      'rounded-lg border border-border bg-[linear-gradient(100deg,hsl(var(--ah-muted))_30%,hsl(var(--ah-card))_50%,hsl(var(--ah-muted))_70%)]',
      'bg-[length:220%_100%] animate-ah-shimmer',
      className
    )}
  />
);

export const Alert = ({ tone = 'danger', children }) => {
  if (!children) return null;
  return (
    <div
      className={cn(
        'mb-4 flex items-start gap-2.5 rounded-md border px-4 py-3 text-sm',
        tone === 'danger' && 'border-destructive/25 bg-destructive/10 text-destructive',
        tone === 'success' && 'border-success/25 bg-success/10 text-success',
        tone === 'warning' && 'border-warning/30 bg-warning/10 text-warning'
      )}
    >
      {children}
    </div>
  );
};

/** When the screen last checked. It polls; it does not pretend to push. */
export const Fresh = ({ at: when, failing }) => (
  <span
    className={cn(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs whitespace-nowrap',
      failing ? 'border-destructive/30 text-destructive' : 'border-border text-muted-foreground'
    )}
    title="This screen re-checks the shop on its own"
  >
    <span className={cn('size-1.5 rounded-full', failing ? 'bg-destructive' : 'bg-success')} />
    {failing ? 'Not updating' : when ? `Updated ${when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}
  </span>
);
