/*
 * The shop's icon set.
 *
 * Hand drawn rather than a library, because a library brings nine hundred
 * icons in somebody else's drawing style and the fifteen this shop needs would
 * fight the mark.
 *
 * One grid, 24 by 24. One stroke, 1.7, round cap, round join. Everything
 * inherits currentColor and takes its size from the `size` prop, which is 16
 * inline, 20 in a control and 24 decorative. No other value.
 *
 * Every icon here is decorative: it sits beside a label, or inside a control
 * that carries its own aria-label. None of them is ever the only thing naming
 * an action.
 */

function Icon({ size = 20, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></Icon>
);

export const BasketIcon = (p) => (
  <Icon {...p}>
    <path d="M4 8h16l-1.6 11.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8L4 8Z" />
    <path d="M8.6 8V6a3.4 3.4 0 0 1 6.8 0v2" />
  </Icon>
);

export const HeartIcon = (p) => (
  <Icon {...p}><path d="M12 20.3l-7.1-7a4.4 4.4 0 1 1 7.1-5 4.4 4.4 0 1 1 7.1 5l-7.1 7Z" /></Icon>
);

export const VanIcon = (p) => (
  <Icon {...p}>
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" />
  </Icon>
);

export const ReturnIcon = (p) => (
  <Icon {...p}><path d="M4 12a8 8 0 1 1 2.6 5.9" /><path d="M4 19v-5h5" /></Icon>
);

export const LockIcon = (p) => (
  <Icon {...p}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>
);

export const ShieldIcon = (p) => (
  <Icon {...p}><path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3Z" /><path d="M9 12l2 2 4-4" /></Icon>
);

export const PlusIcon = (p) => (<Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>);
export const MinusIcon = (p) => (<Icon {...p}><path d="M5 12h14" /></Icon>);
export const CloseIcon = (p) => (<Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>);
export const MenuIcon = (p) => (<Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>);

export const ChevronRightIcon = (p) => (<Icon {...p}><path d="M9 5l7 7-7 7" /></Icon>);
export const ChevronDownIcon = (p) => (<Icon {...p}><path d="M5 9l7 7 7-7" /></Icon>);
export const ArrowRightIcon = (p) => (<Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>);

// The one solid icon in the set. A hollow star reads as an empty rating.
export const StarIcon = ({ size = 12, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true" focusable="false" {...rest}>
    <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8 6.6 19.7l1.2-6.1L3.3 9.4l6.1-.8L12 3Z" />
  </svg>
);

export const InstagramIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

export const TiktokIcon = (p) => (
  <Icon {...p}><path d="M14 4v10.6a3.6 3.6 0 1 1-3-3.55" /><path d="M14 6.2A5 5 0 0 0 19 9.4" /></Icon>
);

// Asking about a product. Two boxes rather than one, because a conversation is
// two people taking turns and a single speech box already reads as a notice.
export const MessageIcon = (p) => (
  <Icon {...p}>
    <path d="M3 4h11v7H8l-3.5 3v-3H3z" />
    <path d="M9 14h6.5l3.5 3v-3H21V7h-3" />
  </Icon>
);

export const MailIcon = (p) => (
  <Icon {...p}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M4 7.5l8 5.5 8-5.5" /></Icon>
);
