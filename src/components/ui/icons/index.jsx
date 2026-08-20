// Referenced by name from PORTAL_NAV_SECTIONS. One geometry, one stroke weight,
// so the rail reads as a set rather than a collection.

const base = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

const IconGrid = (p) => (
  <svg {...base} {...p}>
    <rect x="2.75" y="2.75" width="6" height="6" rx="1" />
    <rect x="11.25" y="2.75" width="6" height="6" rx="1" />
    <rect x="2.75" y="11.25" width="6" height="6" rx="1" />
    <rect x="11.25" y="11.25" width="6" height="6" rx="1" />
  </svg>
);

const IconLayers = (p) => (
  <svg {...base} {...p}>
    <path d="M10 2.5l7 3.5-7 3.5-7-3.5 7-3.5z" />
    <path d="M3 10l7 3.5L17 10" />
    <path d="M3 14l7 3.5L17 14" />
  </svg>
);

const IconCheck = (p) => (
  <svg {...base} {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M6.75 10.2l2.2 2.2 4.3-4.6" />
  </svg>
);

const IconTag = (p) => (
  <svg {...base} {...p}>
    <path d="M9.4 2.75H17v7.6l-7.4 7.4a1.2 1.2 0 01-1.7 0L2.6 12.1a1.2 1.2 0 010-1.7l6.8-7.65z" />
    <circle cx="13.6" cy="6.4" r="1.15" />
  </svg>
);

const IconChart = (p) => (
  <svg {...base} {...p}>
    <path d="M3 17h14" />
    <path d="M5.5 17V9.5M10 17V4.5M14.5 17v-5" />
  </svg>
);

const IconBox = (p) => (
  <svg {...base} {...p}>
    <path d="M3 6.5l7-3.5 7 3.5v7l-7 3.5-7-3.5v-7z" />
    <path d="M3 6.5l7 3.5 7-3.5" />
    <path d="M10 10v7" />
  </svg>
);

const IconClock = (p) => (
  <svg {...base} {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 5.75V10l2.9 1.8" />
  </svg>
);

const IconCog = (p) => (
  <svg {...base} {...p}>
    <path d="M3 6h14M3 14h14" />
    <circle cx="7.5" cy="6" r="2.1" />
    <circle cx="13" cy="14" r="2.1" />
  </svg>
);

const IconExit = (p) => (
  <svg {...base} {...p}>
    <path d="M12.5 6V4.25a1.25 1.25 0 00-1.25-1.25H4.25A1.25 1.25 0 003 4.25v11.5A1.25 1.25 0 004.25 17h7a1.25 1.25 0 001.25-1.25V14" />
    <path d="M8.5 10h8.25M14.25 7.4L16.9 10l-2.65 2.6" />
  </svg>
);

const IconNote = (p) => (
  <svg {...base} {...p}>
    <path d="M4.75 2.75h7.1L16 6.9v10.35H4.75z" />
    <path d="M11.6 2.9V7h4.2" />
    <path d="M7.5 11h5M7.5 14h3.2" />
  </svg>
);

const IconPin = (p) => (
  <svg {...base} {...p}>
    <path d="M8 2.75h4l-.6 4.3 2.6 2.4H6l2.6-2.4z" />
    <path d="M10 9.45V17" />
  </svg>
);

// An awning over a counter. The set had no shop mark, and Products needed one
// that is neither the tag Listings uses nor the box Orders uses, because two
// nav entries wearing the same icon are two entries nobody can tell apart.
const IconShop = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3.5 7.5 5 4h14l1.5 3.5" />
    <path d="M3.5 7.5h17v2a2.5 2.5 0 0 1-4.25 1.77A2.5 2.5 0 0 1 12 9.5a2.5 2.5 0 0 1-4.25 1.77A2.5 2.5 0 0 1 3.5 9.5Z" />
    <path d="M5 12v8h14v-8" />
    <path d="M10 20v-4.5h4V20" />
  </svg>
);

// Attention rather than surveillance. An eye is the honest mark for a screen
// counting who looked at what, and the set had nothing close to it.
const IconEye = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3.1" />
  </svg>
);

const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="M15.4 15.4 20 20" />
  </svg>
);

// A gauge, for the shop's own dashboard. Reusing IconGrid would have put the
// same mark on Overview and on Dashboard, which the IconShop comment above
// already warns against and which I did anyway. A dial reads as a state of
// affairs rather than as a set of things, which is what that screen is.
const IconGauge = (p) => (
  <svg {...base} {...p}>
    <path d="M3.25 15.25a8.5 8.5 0 1 1 13.5 0" />
    <path d="M10 11.25l3.75-3.75" />
    <circle cx="10" cy="12" r="1.25" />
  </svg>
);

const IconMap = (p) => (
  <svg {...base} {...p}>
    <path d="M2.75 5.4l4.75-2.15 5 2.15 4.75-2.15v11.5l-4.75 2.15-5-2.15-4.75 2.15z" />
    <path d="M7.5 3.25v11.5M12.5 5.4v11.5" />
  </svg>
);

export const ICONS = {
  IconGrid,
  IconGauge,
  IconLayers,
  IconCheck,
  IconTag,
  IconChart,
  IconBox,
  IconClock,
  IconCog,
  IconExit,
  IconNote,
  IconPin,
  IconMap,
  IconShop,
  IconEye,
  IconSearch,
};

export function Icon({ name, ...rest }) {
  const Cmp = ICONS[name];
  return Cmp ? <Cmp {...rest} /> : null;
}
