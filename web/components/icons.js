'use client';

/**
 * The icon set.
 *
 * Drawn inline rather than pulled from a package: nine icons is not
 * worth a dependency, and a counter on a slow connection should not
 * wait on an icon font before it can see the navigation.
 *
 * All of them are 20×20 on a 24 grid, 1.6 stroke, round caps — so they
 * sit at the same optical weight beside 14px text. Every one inherits
 * `currentColor`, so the active and idle states are a colour change on
 * the parent and nothing else.
 */

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

export const Icon = {
  queue: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 14h8" />
    </svg>
  ),
  receipt: (p) => (
    <svg {...base} {...p}>
      <path d="M6 3h12v18l-3-1.6-3 1.6-3-1.6L6 21z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </svg>
  ),
  cash: (p) => (
    <svg {...base} {...p}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 10v4M18 10v4" />
    </svg>
  ),
  check: (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.3 12.2 2.5 2.5 4.9-4.9" />
    </svg>
  ),
  scales: (p) => (
    <svg {...base} {...p}>
      <path d="M12 4v16M7 20h10M4 8h16M4 8l-2 5a3 3 0 0 0 6 0zM20 8l2 5a3 3 0 0 1-6 0z" />
    </svg>
  ),
  chart: (p) => (
    <svg {...base} {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  home: (p) => (
    <svg {...base} {...p}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  box: (p) => (
    <svg {...base} {...p}>
      <path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5z" />
      <path d="M3 8.5 12 14l9-5.5M12 14v7" />
    </svg>
  ),
  people: (p) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0M16.5 5.2a3.2 3.2 0 0 1 0 5.6M18 20a6 6 0 0 0-2.3-4.7" />
    </svg>
  ),
  clock: (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.2 2" />
    </svg>
  ),
  bell: (p) => (
    <svg {...base} {...p}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  mail: (q) => (
    <svg {...base} {...q}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </svg>
  ),
  lock: (q) => (
    <svg {...base} {...q}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  eye: (q) => (
    <svg {...base} {...q}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (q) => (
    <svg {...base} {...q}>
      <path d="M9.9 5.8A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6M6.3 7.9A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 3.3-.6" />
      <path d="M10 10a3 3 0 0 0 4 4" />
      <path d="M3.5 3.5l17 17" />
    </svg>
  ),
  phone: (q) => (
    <svg {...base} {...q}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </svg>
  ),
  key: (q) => (
    <svg {...base} {...q}>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3.5M15 12v2.5" />
    </svg>
  ),
  close: (p) => (
    <svg {...base} {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  user: (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  ),
  logout: (p) => (
    <svg {...base} {...p}>
      <path d="M14 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8M17 15l3-3-3-3M20 12H10" />
    </svg>
  ),
  menu: (p) => (
    <svg {...base} {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
};
