/* One 24px grid, one stroke weight, round caps and joins. Every icon is drawn
   as an outline so it inherits colour and never needs a second, filled copy. */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

const Icon = ({ children, ...rest }) => <svg {...base} {...rest}>{children}</svg>;

/* ── Navigation ──────────────────────────────────────────────────────────── */
export const IconHome = () => (
  <Icon><path d="M3.2 10.4 12 3.4l8.8 7" /><path d="M5.6 9.3V20h12.8V9.3" /><path d="M9.7 20v-5.3h4.6V20" /></Icon>
);
export const IconList = () => (
  <Icon><path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" /><path d="M3.7 6.5h.01M3.7 12h.01M3.7 17.5h.01" strokeWidth="2.4" /></Icon>
);
export const IconPeople = () => (
  <Icon><circle cx="9.2" cy="8.2" r="3.3" /><path d="M3 19.8c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" /><path d="M16.4 5.4a3.3 3.3 0 0 1 0 5.9M18 14.6c2 .7 3 2.4 3 5.2" /></Icon>
);
export const IconSavings = () => (
  <Icon><ellipse cx="12" cy="6.6" rx="7.2" ry="3.1" /><path d="M4.8 6.6v4.6c0 1.7 3.2 3.1 7.2 3.1s7.2-1.4 7.2-3.1V6.6" /><path d="M4.8 11.4V16c0 1.7 3.2 3.1 7.2 3.1s7.2-1.4 7.2-3.1v-4.6" /></Icon>
);
export const IconGear = () => (
  <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></Icon>
);

/* ── Controls ────────────────────────────────────────────────────────────── */
export const IconPlus = () => <Icon strokeWidth="2.1"><path d="M12 5.2v13.6M5.2 12h13.6" /></Icon>;
export const IconClose = () => <Icon strokeWidth="2"><path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" /></Icon>;
export const IconChevronDown = () => <Icon strokeWidth="2.2"><path d="m6.5 9.5 5.5 5.5 5.5-5.5" /></Icon>;
export const IconChevronRight = () => <Icon strokeWidth="2.2"><path d="m9.5 6.5 5.5 5.5-5.5 5.5" /></Icon>;
export const IconChevronLeft = () => <Icon strokeWidth="2.2"><path d="M14.5 6.5 9 12l5.5 5.5" /></Icon>;
export const IconSearch = () => <Icon><circle cx="10.8" cy="10.8" r="6.2" /><path d="m15.4 15.4 4.1 4.1" /></Icon>;
export const IconCheck = () => <Icon strokeWidth="2.2"><path d="m5 12.6 4.6 4.6L19 6.8" /></Icon>;
export const IconSplit = () => (
  <Icon><path d="M6 4v5a3 3 0 0 0 3 3h9" /><path d="M6 20v-5a3 3 0 0 1 3-3" /><path d="m15 9 3 3-3 3" /></Icon>
);

export const IconTrash = () => (
  <Icon><path d="M4.6 6.8h14.8M9.4 6.8V5.2a1.6 1.6 0 0 1 1.6-1.6h2a1.6 1.6 0 0 1 1.6 1.6v1.6" /><path d="M6.6 6.8 7.5 19a1.7 1.7 0 0 0 1.7 1.6h5.6a1.7 1.7 0 0 0 1.7-1.6l.9-12.2" /><path d="M10.4 10.6v6M13.6 10.6v6" /></Icon>
);
export const IconDownload = () => <Icon><path d="M12 3.8v10.6M7.8 10.4l4.2 4.2 4.2-4.2" /><path d="M4.6 17.2v1.4a1.8 1.8 0 0 0 1.8 1.8h11.2a1.8 1.8 0 0 0 1.8-1.8v-1.4" /></Icon>;
export const IconLogout = () => <Icon><path d="M14.6 16.4v1.8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2h6.6a2 2 0 0 1 2 2v1.8" /><path d="M9.6 12H20M16.6 8.4 20 12l-3.4 3.6" /></Icon>;
export const IconArrowUpRight = () => <Icon strokeWidth="2"><path d="M7.5 16.5 16.5 7.5M9.4 7.5h7.1v7.1" /></Icon>;

/* ── Theme ───────────────────────────────────────────────────────────────── */
export const IconSun = () => (
  <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2.6v2.1M12 19.3v2.1M4.3 4.3l1.5 1.5M18.2 18.2l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.3 19.7l1.5-1.5M18.2 5.8l1.5-1.5" /></Icon>
);
export const IconMoon = () => <Icon><path d="M20.2 14.4A8.4 8.4 0 1 1 9.6 3.8a6.6 6.6 0 0 0 10.6 10.6Z" /></Icon>;
export const IconAuto = () => (
  <Icon><rect x="2.8" y="4.4" width="18.4" height="12.4" rx="2.2" /><path d="M8 20.2h8" /></Icon>
);

/* ── Money & things ──────────────────────────────────────────────────────── */
export const IconWallet = () => (
  <Icon><rect x="3" y="5.6" width="18" height="12.8" rx="3.2" /><path d="M3 9.8h18" /><circle cx="16.8" cy="14.2" r="1.3" /></Icon>
);
export const IconTarget = () => <Icon><circle cx="12" cy="12" r="8.2" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" strokeWidth="2.2" /></Icon>;
export const IconSwap = () => <Icon><path d="M4 8.4h13.2l-3.4-3.4" /><path d="M20 15.6H6.8l3.4 3.4" /></Icon>;
export const IconDebt = () => (
  <Icon><circle cx="7.2" cy="7.4" r="3.1" /><path d="M2.4 19c0-3 2.1-4.9 4.8-4.9 1 0 1.9.3 2.7.8" /><path d="M13.4 15.4h7.2M17.6 12.2l3 3.2-3 3.2" /></Icon>
);

/* Money arriving at, and leaving, a floor line. Two strokes each — they stay
   readable at 16px where a pictogram would not. */
export const IconIncoming = () => (
  <Icon><path d="M12 3.6v9.8M8 10l4 3.9 4-3.9" /><path d="M4.4 19.4h15.2" strokeWidth="1.9" /></Icon>
);
export const IconOutgoing = () => (
  <Icon><path d="M12 13.4V3.6M8 7.5l4-3.9 4 3.9" /><path d="M4.4 19.4h15.2" strokeWidth="1.9" /></Icon>
);
export const IconSpark = () => (
  <Icon><path d="M12 3.4 13.7 9l5.6 1.7-5.6 1.7-1.7 5.6-1.7-5.6L4.7 10.7 10.3 9 12 3.4Z" /><path d="M18.6 16.4l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7.7-2.2Z" /></Icon>
);
export const IconInfo = () => <Icon><circle cx="12" cy="12" r="8.4" /><path d="M12 11v5.2M12 7.9h.01" strokeWidth="2.1" /></Icon>;
export const IconAlert = () => <Icon><path d="M12 3.8 21 19.4H3L12 3.8Z" /><path d="M12 10v4M12 17.1h.01" strokeWidth="2.1" /></Icon>;
export const IconCloudOff = () => (
  <Icon><path d="M7.4 18.4h9.2a4 4 0 0 0 .8-7.9 5.6 5.6 0 0 0-8.7-3.4" /><path d="M6.6 10.6a4 4 0 0 0 .8 7.8" /><path d="m3.4 3.4 17.2 17.2" /></Icon>
);
export const IconSync = () => (
  <Icon><path d="M20 11.4A8 8 0 0 0 6.3 6.3L4 8.6" /><path d="M4 4.6v4h4" /><path d="M4 12.6A8 8 0 0 0 17.7 17.7L20 15.4" /><path d="M20 19.4v-4h-4" /></Icon>
);
export const IconUser = () => <Icon><circle cx="12" cy="8.4" r="3.8" /><path d="M4.8 20.2c0-3.7 3.2-6.1 7.2-6.1s7.2 2.4 7.2 6.1" /></Icon>;

/* Show / hide what you are typing into a password box. The struck-through eye
   is the "hidden" state, so the mark always shows what a tap would do. */
export const IconEye = () => (
  <Icon><path d="M2.6 12S6.4 5.9 12 5.9 21.4 12 21.4 12 17.6 18.1 12 18.1 2.6 12 2.6 12Z" /><circle cx="12" cy="12" r="3.1" /></Icon>
);
export const IconEyeOff = () => (
  <Icon>
    <path d="M9.9 6.3A8.9 8.9 0 0 1 12 6c5.6 0 9.4 6 9.4 6a17 17 0 0 1-3.2 3.8" />
    <path d="M6.5 7.8A16.6 16.6 0 0 0 2.6 12s3.8 6 9.4 6a8.8 8.8 0 0 0 3.6-.75" />
    <path d="M9.9 9.9a3.1 3.1 0 0 0 4.3 4.3" />
    <path d="M4.2 4.2 19.8 19.8" />
  </Icon>
);
export const IconTag = () => (
  <Icon><path d="M11.1 3.6H19a1.5 1.5 0 0 1 1.5 1.5v7.9a1.5 1.5 0 0 1-.44 1.06l-6.1 6.1a1.5 1.5 0 0 1-2.12 0l-7.36-7.36a1.5 1.5 0 0 1 0-2.12l6.1-6.1A1.5 1.5 0 0 1 11.1 3.6Z" /><circle cx="16.1" cy="8" r="1.25" /></Icon>
);
export const IconInbox = () => (
  <Icon><path d="M3.6 13.4h4l1.2 2.4h6.4l1.2-2.4h4" /><path d="M6.3 4.8h11.4l2.7 8.6v3.8a2.4 2.4 0 0 1-2.4 2.4H6a2.4 2.4 0 0 1-2.4-2.4v-3.8l2.7-8.6Z" /></Icon>
);

/* One mark per ledger kind — arrows read direction at a glance, and the two
   dir-0 kinds (settled, transfer) get shapes that imply "no cash moved". */
const KIND_PATHS = {
  expense:        <path d="M12 19V5M12 5 6 11M12 5l6 6" />,
  income:         <path d="M12 5v14M12 19l6-6M12 19l-6-6" />,
  lent:           <path d="M5 12h14M14 7l5 5-5 5" />,
  repay_paid:     <path d="M5 12h14M14 7l5 5-5 5" />,
  borrowed:       <path d="M19 12H5M10 7l-5 5 5 5" />,
  repay_received: <path d="M19 12H5M10 7l-5 5 5 5" />,
  saving_in:      <><path d="M4 9.5 12 4l8 5.5" /><path d="M6 10v9h12v-9" /><path d="M12 16.5v-5M9.6 13.4 12 11l2.4 2.4" /></>,
  saving_out:     <><path d="M4 9.5 12 4l8 5.5" /><path d="M6 10v9h12v-9" /><path d="M12 11.5v5M9.6 14.1 12 16.5l2.4-2.4" /></>,
  settle_received: <path d="m5 13 4.5 4.5L19 7" />,
  settle_paid:     <path d="m5 13 4.5 4.5L19 7" />,
  transfer:       <><path d="M4 8h13l-3.5-3.5" /><path d="M20 16H7l3.5 3.5" /></>,
  pass_through:   <><path d="M3 12h18" /><path d="M15 7.5 19.5 12 15 16.5" /><path d="M9 9v6" /></>,
};

export function KindIcon({ kind }) {
  return <Icon>{KIND_PATHS[kind] || KIND_PATHS.expense}</Icon>;
}
