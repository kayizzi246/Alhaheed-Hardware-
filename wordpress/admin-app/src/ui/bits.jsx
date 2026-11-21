/**
 * The pieces every desk needs.
 *
 * A desk screen is a band at the top saying where you are, a row of
 * figures for today, and a queue. These are those three things, so each
 * desk file can be about its own work rather than its furniture.
 */
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, CONFIG, money, at, dayMonth } from '@/lib/api';
import { Badge, Card, Fresh, Skeleton, StatusBadge } from '@/ui';

/* ── The band at the top ─────────────────────────────────────────── */

export function Head({ title, sub, fresh, children }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-.02em]">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {fresh && <Fresh {...fresh} />}
      </div>
    </header>
  );
}

/* ── Today's figures ─────────────────────────────────────────────── */

/**
 * The number is the point, so it is set large, in tabular figures, with
 * its label above it rather than below: you read down the column, not
 * back up it.
 */
export function Tiles({ items, loading }) {
  if (loading) {
    return (
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((t) => <Skeleton key={t.label} className="h-[88px]" />)}
      </div>
    );
  }
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((t) => (
        <Card key={t.label} className={cn('px-4 py-3.5', t.lead && 'border-primary/30 bg-accent')}>
          <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted-foreground">{t.label}</p>
          <p className={cn('tnum mt-1.5 text-[27px] font-bold leading-none tracking-[-.02em]', t.lead && 'text-accent-foreground')}>
            {t.value}
          </p>
          {t.note && <p className="mt-1.5 text-xs text-muted-foreground">{t.note}</p>}
        </Card>
      ))}
    </div>
  );
}

/* ── A queue ─────────────────────────────────────────────────────── */

export function Queue({ children, className }) {
  return <div className={cn('divide-y divide-border', className)}>{children}</div>;
}

/**
 * One order in a queue.
 *
 * Order number and amount are the two things readable from across a
 * desk, so they are the two largest things in the row. The items are
 * folded away: a cashier taking money does not need the list, and a
 * store man packing does — so the row opens, rather than the screen
 * choosing for both of them.
 */
export function OrderRow({ order, defaultOpen = false, actions, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [items, setItems] = React.useState(order.items || null);
  const [loading, setLoading] = React.useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !items && !loading) {
      setLoading(true);
      try {
        const data = await api(`/orders/${order.id}`);
        setItems((data.order && data.order.items) || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const waited = minutesSince(order.created_at);

  return (
    <div className="px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="group flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="tnum text-[15px] font-bold tracking-[-.01em]">{order.order_no}</span>
              <StatusBadge status={order.status}>{order.status_label}</StatusBadge>
              {waited >= 20 && (
                <Badge tone="pending" dot={false}>
                  waiting {waited >= 120 ? `${Math.floor(waited / 60)}h` : `${waited}m`}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {order.ordered_by_name || 'Walk-in'}
              {order.ordered_by_phone ? ` · ${order.ordered_by_phone}` : ''}
              {' · '}
              {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
              {' · '}
              {order.fulfilment === 'delivery' ? 'Delivery' : 'Collection'}
              {' · '}
              {dayMonth(order.created_at)} {at(order.created_at)}
            </p>
          </div>
        </button>

        <div className="tnum shrink-0 text-right">
          <p className="text-[17px] font-bold tracking-[-.01em]">{money(order.total)}</p>
          {Number(order.delivery_fee) > 0 && (
            <p className="text-[11.5px] text-muted-foreground">incl. {money(order.delivery_fee)} delivery</p>
          )}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {open && (
        <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 animate-ah-in">
          {loading && <p className="text-sm text-muted-foreground">Reading the order…</p>}
          {!loading && items && items.length > 0 && (
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li key={it.id} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="min-w-0">
                    <span className="tnum font-semibold">{it.quantity} {it.unit}</span>
                    {' · '}
                    {it.product_name}
                    {it.code && <span className="ml-1.5 text-muted-foreground">{it.code}</span>}
                  </span>
                  <span className="tnum shrink-0 text-muted-foreground">{money(it.line_total)}</span>
                </li>
              ))}
            </ul>
          )}
          {!loading && items && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No lines on this order.</p>
          )}
          {order.delivery_address && (
            <p className="mt-2.5 border-t border-border pt-2.5 text-[13px]">
              <span className="font-semibold">Deliver to:</span> {order.delivery_address}
            </p>
          )}
          {order.notes && (
            <p className="mt-2 text-[13px]">
              <span className="font-semibold">Note:</span> {order.notes}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function minutesSince(stamp) {
  if (!stamp) return 0;
  const t = new Date(String(stamp).replace(' ', 'T')).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

export { CONFIG };
