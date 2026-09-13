import PDFDocument from 'pdfkit';

/*
 * A statement, in the shape a bank posts one.
 *
 * The conventions being followed are not decoration — they are what makes a
 * statement checkable. Money leaving and money arriving get a column each, so
 * a side can be added up without reading minus signs; a balance runs down the
 * right, so any line can be verified against the one above it; and the opening
 * and closing figures bracket the lot, so the page proves itself: opening plus
 * paid in minus paid out equals closing.
 *
 * Drawn rather than composed from HTML so the table can be paginated properly —
 * the header repeats on every page, which matters when a statement runs long.
 */

const INK = '#111827';
const MUTED = '#6B7280';
const RULE = '#E5E7EB';
const BRAND = '#0E6B4A';

/* pdfkit's built-in fonts are WinAnsi — one byte per character — so anything
   outside Latin-1 does not survive: the rupee sign, an arrow, a note written in
   Devanagari. Embedding a Unicode font would fix it and costs about 750KB of
   binary in the repository plus a font file that has to exist on the server, so
   for now the text is folded down to what the encoding can carry. The few
   characters this app itself produces get real replacements; anything else a
   note might contain becomes a question mark rather than a broken glyph. */
const FOLD = [
  [/[\u20B9]/g, 'Rs.'], [/[\u2192\u27A1]/g, '->'], [/[\u2190]/g, '<-'],
  [/[\u2212]/g, '-'], [/[\u2013\u2014]/g, '-'], [/[\u2018\u2019]/g, "'"],
  [/[\u201C\u201D]/g, '"'], [/[\u2026]/g, '...'], [/[\u00A0]/g, ' '],
];
const safe = (v) => {
  let out = String(v ?? '');
  for (const [re, to] of FOLD) out = out.replace(re, to);
  // Anything still outside Latin-1 would render as a box or vanish silently.
  return out.replace(/[^\u0000-\u00FF]/g, '?');
};

const M = 36;                                  // page margin

/* Fixed widths measured against the widest thing each column can hold at 8.5pt
   Helvetica, plus room to spare: a date is 48.2pt, "Bank -> UPI" is 46pt, and a
   seven-figure negative balance in bold is 61pt. The date gets 68 rather than
   the 60 that would just about do — at 60 it missed by two tenths of a point
   and wrapped the year onto a line of its own on every single row. Description takes whatever is
   left over rather than a number of its own — which is the whole point.

   The first version hardcoded all six and they came to 560pt against 511pt of
   usable page, so the balance column ran off the right edge and was clipped.
   Deriving the flexible one from the real page width means the table cannot be
   wider than the paper, whatever the margin or page size is set to. */
const FIXED = [
  { k: 'date', label: 'Date', w: 68, align: 'left' },
  { k: 'description', label: 'Description', w: null, align: 'left' },
  { k: 'wallet', label: 'Wallet', w: 60, align: 'left' },
  { k: 'paidOut', label: 'Paid out', w: 68, align: 'right' },
  { k: 'paidIn', label: 'Paid in', w: 68, align: 'right' },
  { k: 'balance', label: 'Balance', w: 74, align: 'right' },
];

function columns(doc) {
  const avail = doc.page.width - M * 2;
  const spoken = FIXED.reduce((n, c) => n + (c.w || 0), 0);
  return FIXED.map((c) => (c.w ? c : { ...c, w: Math.max(80, avail - spoken) }));
}

const fmt = (n, cur) => (n === null || n === undefined
  ? ''
  : `${n < 0 ? '-' : ''}${cur}${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

const niceDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y}`;
};

function tableHeader(doc, y) {
  let x = M;
  doc.save();
  doc.rect(M, y, doc.page.width - M * 2, 20).fill(INK);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
  for (const c of columns(doc)) {
    doc.text(safe(c.label.toUpperCase()), x + 6, y + 6, { width: c.w - 12, align: c.align });
    x += c.w;
  }
  doc.restore();
  return y + 20;
}

export function buildPdf(st, { name, email }) {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  const cur = st.currency || '₹';
  /* pdfkit's built-in fonts are WinAnsi and have no rupee sign; it would come
     out as a blank box. "Rs." is the honest fallback and is what Indian bank
     statements printed for years. */
  const sym = cur === '₹' ? 'Rs.' : cur;

  // ── letterhead ────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 96).fill(BRAND);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('My Hisab', M, 28);
  doc.font('Helvetica').fontSize(9).fillColor('#C9E6D9').text('Account statement', M, 52);
  doc.font('Helvetica').fontSize(9).fillColor('#FFFFFF')
     .text(safe(`${niceDate(st.from)} - ${niceDate(st.to)}`), M, 68);

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF')
     .text(safe(name || ''), doc.page.width - M - 220, 30, { width: 220, align: 'right' });
  doc.font('Helvetica').fontSize(8.5).fillColor('#C9E6D9')
     .text(safe(email || ''), doc.page.width - M - 220, 45, { width: 220, align: 'right' })
     .text(safe(`Wallet: ${st.scope}`), doc.page.width - M - 220, 58, { width: 220, align: 'right' })
     .text(`Issued ${niceDate(new Date().toISOString().slice(0, 10))}`, doc.page.width - M - 220, 71,
           { width: 220, align: 'right' });

  // ── the four figures that make the page prove itself ──────────────────────
  let y = 122;
  const boxW = (doc.page.width - M * 2 - 18) / 4;
  const summary = [
    ['Opening balance', st.opening],
    ['Paid in', st.paidIn],
    ['Paid out', st.paidOut],
    ['Closing balance', st.closing],
  ];
  summary.forEach(([label, value], i) => {
    const x = M + i * (boxW + 6);
    doc.roundedRect(x, y, boxW, 46, 6).fillAndStroke('#F9FAFB', RULE);
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(safe(label.toUpperCase()), x + 8, y + 9, { width: boxW - 16 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(fmt(value, sym), x + 8, y + 23, { width: boxW - 16 });
  });
  y += 62;

  doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
     .text('Opening balance + paid in - paid out = closing balance', M, y);
  y += 14;

  // ── the table ─────────────────────────────────────────────────────────────
  y = tableHeader(doc, y);
  const bottom = doc.page.height - M - 28;

  if (!st.entries.length) {
    doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(10)
       .text('No entries in this period.', M, y + 16, { width: doc.page.width - M * 2, align: 'center' });
  }

  doc.font('Helvetica').fontSize(8.5);
  const cols = columns(doc);
  const descW = cols.find((c) => c.k === 'description').w - 12;
  for (const e of st.entries) {
    const lines = Math.max(1, Math.ceil(doc.widthOfString(safe(e.description)) / descW));
    const h = Math.max(18, 8 + lines * 10);

    if (y + h > bottom) {
      doc.addPage();
      y = tableHeader(doc, M);
      doc.font('Helvetica').fontSize(8.5);
    }

    let x = M;
    const cells = {
      date: niceDate(e.date).replace(/ (\d{4})$/, ' $1'),
      description: safe(e.description),
      wallet: safe(e.wallet),
      paidOut: fmt(e.paidOut, sym),
      paidIn: fmt(e.paidIn, sym),
      balance: fmt(e.balance, sym),
    };
    for (const c of cols) {
      doc.fillColor(c.k === 'balance' ? INK : c.k === 'paidIn' ? '#0E7C55' : c.k === 'paidOut' ? '#B23A2B' : INK)
         .font(c.k === 'balance' ? 'Helvetica-Bold' : 'Helvetica')
         .text(cells[c.k] ?? '', x + 6, y + 5, { width: c.w - 12, align: c.align, lineBreak: c.k === 'description' });
      x += c.w;
    }
    doc.moveTo(M, y + h).lineTo(doc.page.width - M, y + h).lineWidth(0.5).strokeColor(RULE).stroke();
    y += h;
  }

  // ── page numbers, once every page exists ──────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    /* The footer sits below the bottom margin, and pdfkit answers text that
       crosses the margin by starting a new page — which then needs a footer of
       its own, which starts another. Nine rows came out three pages long.
       Dropping the margin for the duration is the documented way out. */
    doc.page.margins.bottom = 0;
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
       .text(`Page ${i + 1} of ${range.count}`, M, doc.page.height - M + 4,
             { width: doc.page.width - M * 2, align: 'center' });
    doc.text('This statement is generated from entries you recorded in My Hisab.',
             M, doc.page.height - M + 15, { width: doc.page.width - M * 2, align: 'center' });
  }

  doc.end();
  return doc;
}
