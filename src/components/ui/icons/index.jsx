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

// Reviews. The set had nothing close, and the alternative was reusing IconCheck
// from Approved, which would have put the same mark on two nav entries in two
// different sections. The comment above IconShop warns against exactly that.
const IconStar = (p) => (
  <svg {...base} {...p}>
    <path d="M10 2.75l2.2 4.65 5 .75-3.6 3.6.85 5.05L10 14.4l-4.45 2.4.85-5.05-3.6-3.6 5-.75z" />
  </svg>
);

// Customers. Two figures rather than one, because a single head reads as an
// account or a profile and this screen is a list of other people.
const IconPeople = (p) => (
  <svg {...base} {...p}>
    <circle cx="7.75" cy="7" r="2.75" />
    <path d="M2.75 16.5c0-2.35 2.24-4.25 5-4.25s5 1.9 5 4.25" />
    <path d="M13.25 4.6a2.75 2.75 0 0 1 0 5.3" />
    <path d="M14.5 12.55c1.66.5 2.75 1.78 2.75 3.35" />
  </svg>
);

// Requests. A speech mark rather than an envelope, because an envelope is
// already what Interest and the footer both use for mail, and a request is
// somebody saying something rather than sending something.
const IconAsk = (p) => (
  <svg {...base} {...p}>
    <path d="M3.25 4.5h13.5v9h-8.4l-3.6 3v-3H3.25z" />
    <path d="M7.25 9h5.5" />
  </svg>
);

// The mailing list. An envelope with a line through the middle, which is the
// one mail mark not already spoken for in this set.
const IconEnvelope = (p) => (
  <svg {...base} {...p}>
    <rect x="2.75" y="4.75" width="14.5" height="10.5" rx="1.25" />
    <path d="M3.25 5.75L10 10.75l6.75-5" />
  </svg>
);

// Sections. Shelves rather than a folder, because a folder is a computer's
// idea of a category and this shop's are departments in a building.
const IconShelves = (p) => (
  <svg {...base} {...p}>
    <path d="M3.25 3.25v13.5M16.75 3.25v13.5" />
    <path d="M3.25 7.75h13.5M3.25 12.25h13.5" />
  </svg>
);

// Messages. Two bubbles rather than one, because IconAsk is already a single
// speech box on Requests, and a request is somebody saying something while a
// conversation is two people taking turns. The comment above IconShop warns
// against two nav entries wearing the same mark and this is the closest pair
// in the set.
const IconSpeech = (p) => (
  <svg {...base} {...p}>
    <path d="M2.75 3.25h9v5H6.25l-2.4 2.2v-2.2H2.75z" />
    <path d="M7.75 8.25h9.5v6h-6.1l-2.6 2.4v-2.4H7.75z" />
  </svg>
);

const IconMap = (p) => (
  <svg {...base} {...p}>
    <path d="M2.75 5.4l4.75-2.15 5 2.15 4.75-2.15v11.5l-4.75 2.15-5-2.15-4.75 2.15z" />
    <path d="M7.5 3.25v11.5M12.5 5.4v11.5" />
  </svg>
);


/*
 * Below here: the set stopped at the sidebar.
 *
 * Twenty-two icons, one geometry, one stroke weight, used in exactly one place,
 * while every screen in the portal explained itself in prose instead. A funnel
 * step labelled with a mark and a word is shorter and clearer than a word and a
 * sentence underneath it.
 */

// The funnel, three marks. Seen, opened, paid for.
const IconImpression = (p) => (
  <svg {...base} {...p}>
    <path d="M1.75 10s3-5 8.25-5 8.25 5 8.25 5-3 5-8.25 5-8.25-5-8.25-5Z" />
    <circle cx="10" cy="10" r="2.4" />
  </svg>
);

// A listing page, open. The first version was a mouse cursor, which reads as
// "click this" rather than "was opened": an instruction where a state was
// meant, on a label that only ever describes something already done.
const IconOpened = (p) => (
  <svg {...base} {...p}>
    <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="1.5" />
    <path d="M2.75 7.5h14.5" />
    <path d="M6 11h4.5M6 13.5h7" />
  </svg>
);

const IconBought = (p) => (
  <svg {...base} {...p}>
    <path d="M4.25 6.75h11.5l-1.1 9a1.4 1.4 0 0 1-1.4 1.25H6.75a1.4 1.4 0 0 1-1.4-1.25z" />
    <path d="M7.5 6.75V5.5a2.5 2.5 0 0 1 5 0v1.25" />
  </svg>
);

// Explanation on demand rather than on the page. Four lines of prose wrapped
// around three figures is what this replaces.
const IconInfo = (p) => (
  <svg {...base} {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 9.25v4" />
    <circle cx="10" cy="6.6" r="0.85" fill="currentColor" stroke="none" />
  </svg>
);

// Clearing a filter. Applying one was a click on a band; removing it was the
// same click again, which nobody finds.
const IconX = (p) => (
  <svg {...base} {...p}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </svg>
);

const IconRefresh = (p) => (
  <svg {...base} {...p}>
    <path d="M16.5 8.25A6.75 6.75 0 0 0 4.4 5.9" />
    <path d="M3.5 11.75A6.75 6.75 0 0 0 15.6 14.1" />
    <path d="M3.9 2.9v3.1h3.1M16.1 17.1V14h-3.1" />
  </svg>
);

// A row that opens somewhere else should say so. Leaving the portal without
// warning is the kind of small dishonesty that adds up.
const IconOut = (p) => (
  <svg {...base} {...p}>
    <path d="M8 4.25H4.5a1.25 1.25 0 0 0-1.25 1.25v10a1.25 1.25 0 0 0 1.25 1.25h10a1.25 1.25 0 0 0 1.25-1.25V12" />
    <path d="M11.5 3.25h5.25V8.5M16.25 3.75L9.5 10.5" />
  </svg>
);

const IconFilter = (p) => (
  <svg {...base} {...p}>
    <path d="M3.25 4.75h13.5l-5.25 6v5.5l-3-1.75V10.75z" />
  </svg>
);

// A single caret, rotated by the column that owns it, rather than two glyphs.
const IconCaret = (p) => (
  <svg {...base} {...p}>
    <path d="M6 8l4 4 4-4" />
  </svg>
);

export const ICONS = {
  IconGrid,
  IconGauge,
  IconStar,
  IconPeople,
  IconAsk,
  IconEnvelope,
  IconShelves,
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
  IconSpeech,
  IconImpression,
  IconOpened,
  IconBought,
  IconInfo,
  IconX,
  IconRefresh,
  IconOut,
  IconFilter,
  IconCaret,
};

export function Icon({ name, ...rest }) {
  const Cmp = ICONS[name];
  return Cmp ? <Cmp {...rest} /> : null;
}
