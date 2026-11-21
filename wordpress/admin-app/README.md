# The desk app

The four desk screens inside wp-admin — Cashier, Accounts, Store,
Manager — as a React app, built into the plugin.

## Why it is a build step

The shop installs the plugin by uploading a zip, on hosting with no
Node and no shell. So the bundle is committed:
`wordpress/al-hadeed-hardware/assets/app/app.js` and `app.css`. Nobody
installing the plugin ever runs anything here.

```
npm install
npm run build     # writes into ../al-hadeed-hardware/assets/app/
```

Run the build whenever you change anything in `src/`, and commit the
two files it writes along with the source. If the bundle is missing —
a fresh checkout with no build — the plugin falls back to the
server-rendered desks in `class-ah-admin.php`, which do the same work
without JavaScript.

## How it reaches WordPress

`AH_Admin::assets()` enqueues the two files on the desk pages only, and
prints `window.AH_BOOT` before them:

| key | what it is |
| --- | --- |
| `root` | `https://shop/wp-json/alhadeed/v1` |
| `nonce` | `wp_create_nonce('wp_rest')` — the REST nonce |
| `user` | id, display name, `desk` (the screen to draw), `canSee` |
| `desks` | each desk this person may open, and its admin URL |
| `shop` | name and currency |

There is no token. Inside wp-admin the cookie is the session and the
nonce proves the request came from our page, so `src/lib/api.js` sends
`credentials: 'same-origin'` and the `X-WP-Nonce` header. The same REST
endpoints serve the phone app and the Next.js panel with a bearer
token instead; `AH_Auth::current()` accepts either.

`desk` is worked out from the admin page that was opened, not from the
role, so a manager clicking **Cashier** in the WordPress sidebar gets
the cashier's queue and the sidebar keeps telling the truth. The tabs
in the app are ordinary links to those pages for the same reason.

## Shape of the code

```
src/
  index.css      tokens, scoped to #ah-app, and the wp-admin resets
  lib/api.js     the nonce-authenticated client, money and time
  lib/usePoll.js polling with a hidden-tab skip and backoff
  ui/index.jsx   the component set — Button, Card, Dialog, Table…
  ui/bits.jsx    Head, Tiles, Queue, OrderRow
  desks/*.jsx    one file per desk
  App.jsx        picks the screen, catches what a screen throws
```

## Two traps, both already sprung

**Tailwind's preflight is off** and every utility is scoped to
`#ah-app` (`important: '#ah-app'` in the config), because a reset
loose in wp-admin would repaint WordPress's own screens. The cost is
that bare `<button>` and `<a>` elements keep wp-admin's styling, so
`index.css` neutralises them by hand. If something arrives wearing a
grey box, that is why.

**Radix portals to `<body>`**, which is outside `#ah-app` — so a
dialog portalled there gets neither the tokens nor the utilities, and
renders as unstyled inputs at the bottom of the page. `DialogContent`
passes `container={document.getElementById('ah-app')}` to stop that.
Anything else that portals needs the same.

## Checking it

There is no test runner here. The way these screens were verified is
the way to verify them again: run the plugin against a real WordPress
with WooCommerce and real orders, then drive one order from the
cashier's queue through to released, in the browser. Every bug worth
finding in this app — a chart with no bars, a dialog in the wrong
place, the wrong desk on the wrong page — was invisible until then.
