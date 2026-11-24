/**
 * The shell.
 *
 * WordPress already supplies a sidebar, so this does not draw a second
 * one. It shows the desk the person belongs to, and — for a manager,
 * who is the only person entitled to look over somebody's shoulder —
 * tabs to the others.
 *
 * Routing is the hash, not a router library. There are four screens.
 */
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CONFIG } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/ui';
import Cashier from '@/desks/Cashier';
import Accounts from '@/desks/Accounts';
import Store from '@/desks/Store';
import Manager from '@/desks/Manager';

const DESKS = {
  cashier: { label: 'Cashier', Screen: Cashier },
  accounts: { label: 'Accounts', Screen: Accounts },
  store: { label: 'Store', Screen: Store },
  manager: { label: 'Manager', Screen: Manager },
};

export default function App() {
  const allowed = (CONFIG.user.canSee || []).filter((d) => DESKS[d]);

  // Which desk to draw is the server's answer, taken from the admin
  // page that was opened. The tabs below are ordinary links to those
  // pages rather than client-side routes, so WordPress's own sidebar
  // keeps marking where you actually are.
  const desk = DESKS[CONFIG.user.desk] ? CONFIG.user.desk : allowed[0];

  if (!desk) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 size-7 text-warning" />
        <h1 className="text-lg font-semibold">No desk is assigned to this account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ask the manager to set your role to Cashier, Accounts, Store or Manager.
        </p>
      </div>
    );
  }

  const { Screen } = DESKS[desk];

  return (
    <div className="pb-10 pt-3">
      {allowed.length > 1 && (
        <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Desks">
          {allowed.map((d) => (
            <Button
              key={d}
              asChild
              size="sm"
              variant={d === desk ? 'default' : 'ghost'}
              className={cn(d !== desk && 'border border-border no-underline')}
            >
              <a href={(CONFIG.desks || {})[d] || '#'} aria-current={d === desk ? 'page' : undefined}>
                {DESKS[d].label}
              </a>
            </Button>
          ))}
        </nav>
      )}

      <Boundary key={desk}>
        <Screen />
      </Boundary>
    </div>
  );
}

/**
 * A screen that throws should not take the whole page with it. The old
 * panel showed "a client-side exception has occurred", which tells a
 * cashier nothing and leaves them stuck; this at least names the desk
 * and offers the way back.
 */
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  render() {
    if (this.state.err) {
      return (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-6">
          <h2 className="text-base font-semibold text-destructive">This screen could not be drawn</h2>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
            The shop's data is safe. Nothing has been changed. Reloading usually clears it. If it
            keeps happening, show this line to whoever looks after the site:
          </p>
          <code className="mt-3 block overflow-x-auto rounded-md border border-border bg-card px-3 py-2 text-xs">
            {String(this.state.err && this.state.err.message)}
          </code>
          <Button className="mt-4" onClick={() => window.location.reload()}>Reload the page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
