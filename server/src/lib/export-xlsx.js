import ExcelJS from 'exceljs';

/*
 * The spreadsheet, laid out to be read rather than merely opened.
 *
 * What that means in practice: money in real number cells with an accounting
 * format rather than text, so a column can be summed; columns wide enough for
 * their contents; the header row frozen and filterable; and a totals row that
 * is a formula, so it stays right if rows are deleted.
 */

const HEAD = '1F2937';
const RULE = 'E5E7EB';

export async function buildWorkbook(st, { name }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'My Hisab';
  wb.created = new Date();

  const ws = wb.addWorksheet('Statement', {
    views: [{ state: 'frozen', ySplit: 7 }],          // the header row stays put
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const cur = st.currency === '₹' ? '₹' : st.currency;
  // Negatives in red and in brackets, which is what accounting format is for.
  const MONEY = `${cur}#,##0.00;[Red](${cur}#,##0.00)`;

  ws.columns = [
    { key: 'date', width: 12 },
    { key: 'description', width: 42 },
    { key: 'kind', width: 14 },
    { key: 'category', width: 18 },
    { key: 'person', width: 16 },
    { key: 'wallet', width: 16 },
    { key: 'out', width: 14 },
    { key: 'in', width: 14 },
    { key: 'balance', width: 15 },
  ];

  // ── the letterhead ────────────────────────────────────────────────────────
  ws.mergeCells('A1:I1');
  Object.assign(ws.getCell('A1'), {
    value: 'My Hisab — Statement',
    font: { size: 16, bold: true, color: { argb: 'FF' + HEAD } },
  });
  ws.getCell('A1').alignment = { vertical: 'middle' };
  ws.getRow(1).height = 26;

  ws.mergeCells('A2:I2');
  ws.getCell('A2').value =
    `${name} · ${st.scope} · ${st.from || '—'} to ${st.to || '—'} · generated ${new Date().toISOString().slice(0, 10)}`;
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF6B7280' } };

  // ── the summary, as labelled pairs ────────────────────────────────────────
  const pairs = [
    ['Opening balance', st.opening],
    ['Paid in', st.paidIn],
    ['Paid out', st.paidOut],
    ['Closing balance', st.closing],
  ];
  pairs.forEach(([label, value], i) => {
    const col = 1 + i * 2;
    const k = ws.getRow(4).getCell(col);
    const v = ws.getRow(4).getCell(col + 1);
    k.value = label;
    k.font = { size: 9, bold: true, color: { argb: 'FF6B7280' } };
    v.value = value;
    v.numFmt = MONEY;
    v.font = { size: 11, bold: true };
  });
  ws.getRow(4).height = 20;

  // ── the table ─────────────────────────────────────────────────────────────
  const header = ['Date', 'Description', 'Type', 'Category', 'Person', 'Wallet', 'Paid out', 'Paid in', 'Balance'];
  const hr = ws.getRow(7);
  header.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEAD } };
    c.alignment = { vertical: 'middle', horizontal: i >= 6 ? 'right' : 'left' };
  });
  hr.height = 22;

  st.entries.forEach((e) => {
    const r = ws.addRow({
      date: e.date, description: e.description, kind: e.kind,
      category: e.category, person: e.person, wallet: e.wallet,
      out: e.paidOut, in: e.paidIn, balance: e.balance,
    });
    [7, 8, 9].forEach((i) => { r.getCell(i).numFmt = MONEY; });
    r.getCell(1).alignment = { horizontal: 'left' };
    r.getCell(2).alignment = { wrapText: false };
    r.getCell(9).font = { bold: true };
    r.eachCell((c) => { c.border = { bottom: { style: 'hair', color: { argb: 'FF' + RULE } } }; });
  });

  // ── totals, as formulas so they survive an edit ───────────────────────────
  if (st.entries.length) {
    const first = 8;
    const last = 7 + st.entries.length;
    const t = ws.addRow([]);
    t.getCell(6).value = 'Total';
    t.getCell(6).font = { bold: true };
    t.getCell(6).alignment = { horizontal: 'right' };
    t.getCell(7).value = { formula: `SUM(G${first}:G${last})` };
    t.getCell(8).value = { formula: `SUM(H${first}:H${last})` };
    [7, 8].forEach((i) => {
      t.getCell(i).numFmt = MONEY;
      t.getCell(i).font = { bold: true };
    });
    t.eachCell((c) => { c.border = { top: { style: 'thin', color: { argb: 'FF' + HEAD } } }; });

    ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: last, column: 9 } };
  }

  return wb.xlsx.writeBuffer();
}
