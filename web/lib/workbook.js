/**
 * Excel files somebody can open, read and hand on.
 *
 * Every export in the panel goes through here, so they all come out the
 * same: a cover that says what the file is and links to each tab, then
 * one table per tab with a title, a filter, headings that stay put when
 * you scroll, real numbers and real dates, and a total that follows the
 * filter. They print on A4 with the headings repeated on each page.
 *
 * The library is large and only matters to the person who presses
 * Export, so this whole file is imported on that press.
 */
import ExcelJS from 'exceljs/dist/exceljs.min.js';

const BLUE = 'FF3F7A12'; // the shop's green
const NAVY = 'FF0E201A';
const INK = 'FF0F1B33';
const MUTED = 'FF55637D';
const LINE = 'FFE2E8F2';
const BAND = 'FFF5F7FB';
const PALE = 'FFECFDF3';
const FONT = 'Calibri';

// The same formats as the shop's ALH Tracker workbook.
const FORMATS = {
  money: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)',
  int: '#,##0',
  date: '[$-409]d/mmm/yy;@',
  datetime: '[$-409]d/mmm/yy h:mm;@',
  pct: '0.00%',
};
const isNumber = (type) => type === 'money' || type === 'int' || type === 'pct';

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const rule = (argb = LINE) => ({ style: 'thin', color: { argb } });
const letter = (n) => (n > 26 ? letter(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(65 + ((n - 1) % 26));

/** Excel keeps no time zone: give it the time the screen shows. */
function cellDate(value, withTime) {
  if (!value) return null;
  const s = String(value);
  if (!withTime) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : s;
  }
  const at = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
  if (Number.isNaN(at.getTime())) return s;
  return new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()));
}

function cellValue(raw, type) {
  if (type === 'date') return cellDate(raw, false);
  if (type === 'datetime') return cellDate(raw, true);
  if (isNumber(type)) {
    // A blank stays blank: an order with no amount is not an order for 0.
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isNaN(n) ? String(raw) : n;
  }
  return raw === null || raw === undefined ? '' : String(raw);
}

/** Excel refuses tab names over 31 characters or containing : \ / ? * [ ] */
const tabName = (name) => name.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);

function page(sheet, { landscape, shop, title }) {
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: landscape ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.55, bottom: 0.6, header: 0.3, footer: 0.3 },
  };
  // & starts a code in a footer, so a name containing one is doubled.
  const safe = (s) => String(s).replace(/&/g, '&&');
  sheet.headerFooter.oddFooter = `&L&8${safe(shop)} - ${safe(title)}&R&8Page &P of &N`;
}

function banner(sheet, width, title, sub) {
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= width; c++) sheet.getCell(r, c).fill = fill('FF92D050');
  }
  sheet.mergeCells(1, 1, 1, width);
  sheet.mergeCells(2, 1, 2, width);
  Object.assign(sheet.getCell(1, 1), {
    value: title,
    font: { name: FONT, size: 14, bold: true, color: { argb: 'FF000000' } },
    alignment: { vertical: 'middle', indent: 1 },
  });
  Object.assign(sheet.getCell(2, 1), {
    value: sub,
    font: { name: FONT, size: 10, color: { argb: 'FF1F3A0A' } },
    alignment: { vertical: 'top', indent: 1 },
  });
  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 20;
}

/** The headings, the rows and the total. Returns the total's row number. */
function table(sheet, columns, rows, top) {
  const head = sheet.getRow(top);
  head.height = 45;
  columns.forEach((col, i) => {
    const cell = head.getCell(i + 1);
    cell.value = col.h;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.fill = fill('FF92D050');
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { top: rule('FFBFBFBF'), bottom: rule('FFBFBFBF'), left: rule('FFBFBFBF'), right: rule('FFBFBFBF') };
  });

  rows.forEach((row, n) => {
    const line = sheet.getRow(top + 1 + n);
    columns.forEach((col, i) => {
      const cell = line.getCell(i + 1);
      cell.value = cellValue(row[col.key], col.type);
      cell.font = { name: FONT, size: 11, bold: !!col.bold };
      cell.border = { bottom: rule() };
      if (FORMATS[col.type]) cell.numFmt = FORMATS[col.type];
      cell.alignment = {
        vertical: 'top',
        horizontal: isNumber(col.type) ? 'right' : 'left',
        indent: isNumber(col.type) ? 0 : 1,
        wrapText: !!col.wrap,
      };
    });
  });

  const last = top + rows.length;
  if (rows.length) {
    sheet.autoFilter = { from: { row: top, column: 1 }, to: { row: last, column: columns.length } };
  }
  if (!rows.length || !columns.some((c) => c.total)) return null;

  // SUBTOTAL rather than SUM: filter the table and the total is of what
  // is left on the screen.
  const foot = sheet.getRow(last + 1);
  foot.height = 22;
  columns.forEach((col, i) => {
    const cell = foot.getCell(i + 1);
    if (col.total) {
      const L = letter(i + 1);
      cell.value = {
        formula: `SUBTOTAL(109,${L}${top + 1}:${L}${last})`,
        result: rows.reduce((sum, r) => sum + (Number(r[col.key]) || 0), 0),
      };
      cell.numFmt = FORMATS[col.type];
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (i === 0) {
      cell.value = 'Total';
      cell.alignment = { vertical: 'middle', indent: 1 };
    }
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: INK } };
    cell.fill = fill(PALE);
    cell.border = { top: { style: 'medium', color: { argb: BLUE } } };
  });
  return last + 1;
}

/**
 * Write a report.
 *
 * `meta`   { shop, title, period, by }
 * `figures` [{ title, rows: [[label, value, 'money'|'int']] }] for the cover
 * `sheets` [{ name, about, columns: [{ h, key, type, width, total, wrap, bold }], rows }]
 */
export function buildReport({ meta, figures, sheets }) {
  const book = new ExcelJS.Workbook();
  book.creator = meta.by || meta.shop;
  book.company = meta.shop;
  book.title = `${meta.title} - ${meta.period}`;
  book.created = new Date();

  const made = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const line = `${meta.shop}   |   ${meta.period}   |   Amounts in UGX`;

  // ── The cover ─────────────────────────────────────────────────────
  const cover = book.addWorksheet('Summary', { properties: { tabColor: { argb: NAVY } }, views: [{ showGridLines: false }] });
  cover.columns = [{ width: 42 }, { width: 20 }, { width: 46 }];
  banner(cover, 3, meta.title, `${meta.shop}   |   ${meta.period}`);

  let r = 4;
  const small = (label, value) => {
    const row = cover.getRow(r++);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    row.getCell(1).font = { name: FONT, size: 10, color: { argb: MUTED } };
    row.getCell(2).font = { name: FONT, size: 10, bold: true, color: { argb: INK } };
    row.getCell(1).alignment = { indent: 1 };
  };
  small('Prepared by', meta.by || '');
  small('Prepared on', made);
  small('Currency', 'Ugandan shillings (UGX)');

  const heading = (text) => {
    r++;
    cover.mergeCells(r, 1, r, 3);
    const cell = cover.getCell(r, 1);
    cell.value = text;
    cell.font = { name: FONT, size: 12, bold: true, color: { argb: BLUE } };
    cell.alignment = { indent: 1 };
    for (let c = 1; c <= 3; c++) cover.getCell(r, c).border = { bottom: { style: 'medium', color: { argb: BLUE } } };
    r++;
  };

  for (const block of figures) {
    heading(block.title);
    for (const [label, value, type = 'money', strong] of block.rows) {
      const row = cover.getRow(r++);
      row.height = 19;
      const a = row.getCell(1);
      const b = row.getCell(2);
      a.value = label;
      b.value = cellValue(value, type);
      if (FORMATS[type]) b.numFmt = FORMATS[type];
      a.alignment = { indent: 1, vertical: 'middle' };
      b.alignment = { horizontal: 'right', vertical: 'middle' };
      for (const c of [a, b]) {
        c.font = { name: FONT, size: 11, bold: !!strong, color: { argb: INK } };
        c.border = { bottom: rule() };
        if (strong) c.fill = fill(PALE);
      }
    }
  }

  heading('In this file');
  for (const s of sheets) {
    const row = cover.getRow(r++);
    row.getCell(1).value = { text: s.name, hyperlink: `#'${tabName(s.name)}'!A1` };
    row.getCell(1).font = { name: FONT, size: 11, underline: true, color: { argb: BLUE } };
    row.getCell(2).value = s.rows.length;
    row.getCell(2).numFmt = `#,##0 "${s.rows.length === 1 ? 'row' : 'rows'}"`;
    row.getCell(3).value = s.about;
    row.getCell(2).font = { name: FONT, size: 11, color: { argb: INK } };
    row.getCell(3).font = { name: FONT, size: 10, color: { argb: MUTED } };
    row.getCell(1).alignment = { indent: 1, vertical: 'top' };
    row.getCell(2).alignment = { horizontal: 'right', vertical: 'top' };
    row.getCell(3).alignment = { indent: 1, wrapText: true, vertical: 'top' };
    for (let c = 1; c <= 3; c++) row.getCell(c).border = { bottom: rule() };
  }
  page(cover, { landscape: false, shop: meta.shop, title: meta.title });

  // ── One tab per table, laid out like the ALH Tracker sheets ──────
  const FMT = { money: 'money', int: 'int', date: 'date', datetime: 'datetime', pct: 'pct' };
  for (const sh of sheets) {
    trackerSheet(book, sh.name, sh.columns.map((c) => ({
      h: c.h,
      w: c.width + (isNumber(c.type) ? 2 : 0),
      fmt: FMT[c.type],
      total: !!c.total,
      get: (row) => {
        const v = row[c.key];
        if (c.type === 'datetime') return cellDate(v, true);
        if (isNumber(c.type)) return v === null || v === undefined || v === '' ? null : Number(v);
        return v === null || v === undefined ? '' : v;
      },
    })), sh.rows, 1);
  }
  return book;
}

/**
 * The catalogue. Laid out differently on purpose: the importer reads
 * this file back, so the headings stay on the first row and there is no
 * banner or total to be mistaken for a product.
 */
export function buildCatalogue(products, shop) {
  const book = new ExcelJS.Workbook();
  book.creator = shop;
  const sheet = book.addWorksheet('Products', {
    properties: { tabColor: { argb: BLUE } },
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1, showGridLines: false }],
  });
  const columns = [
    { h: 'Code', key: 'code', width: 16, bold: true },
    { h: 'Name', key: 'name', width: 36 },
    { h: 'Category', key: 'category', width: 18 },
    { h: 'Buy price', key: 'cost', width: 14, type: 'money' },
    { h: 'Price', key: 'price', width: 14, type: 'money' },
    { h: 'Unit', key: 'unit', width: 10 },
    { h: 'Stock', key: 'stock', width: 11, type: 'int' },
    { h: 'Reorder level', key: 'reorderLevel', width: 15, type: 'int' },
    { h: 'Reorder quantity', key: 'reorderQty', width: 17, type: 'int' },
    { h: 'Supplier', key: 'supplier', width: 26 },
    { h: 'Shelf', key: 'shelf', width: 12 },
    { h: 'Notes', key: 'description', width: 44, wrap: true },
  ];
  sheet.columns = columns.map((c) => ({ width: c.width + (isNumber(c.type) ? 4 : 0) }));
  const rows = [...products].sort((a, b) =>
    String(a.category || '').localeCompare(String(b.category || '')) || String(a.name || '').localeCompare(String(b.name || '')));
  table(sheet, columns, rows, 1);

  // What needs ordering stands out, and keeps up as the file is edited.
  if (rows.length) {
    sheet.addConditionalFormatting({
      ref: `G2:G${rows.length + 1}`,
      rules: [{
        type: 'expression',
        priority: 1,
        formulae: ['AND($H2>0,$G2<=$H2)'],
        style: { font: { bold: true, color: { argb: 'FFC02B2B' } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFDECEC' } } },
      }],
    });
  }
  page(sheet, { landscape: true, shop, title: 'Products' });
  sheet.pageSetup.printTitlesRow = '1:1';
  return book;
}

export async function saveBook(book, filename) {
  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── The tracker's own look ───────────────────────────────────────────
 * The shop ran its steel business in "ALH Tracker.xlsx" before this
 * system. These sheets are laid out the way that file is, so the owner
 * reads them without learning anything new: green headings on row 1,
 * the totals on row 2 (which carries the filter), the lines from row 3,
 * accounting numbers and d/mmm/yy dates.
 */
const LIME = 'FF92D050';
const ACC = '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)';
const TFMT = { money: ACC, qty: ACC, kg: '0.00', m: '0.000', pct: '0.00%', date: '[$-409]d/mmm/yy;@', datetime: '[$-409]d/mmm/yy h:mm;@', int: '#,##0' };

function trackerSheet(book, name, columns, rows, freezeX = 0) {
  const ws = book.addWorksheet(tabName(name), {
    views: [{ state: 'frozen', xSplit: freezeX, ySplit: 2 }],
  });
  ws.columns = columns.map((c) => ({ width: c.w }));
  const head = ws.getRow(1);
  head.height = 45;
  columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.h;
    cell.fill = fill(LIME);
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    cell.border = { top: rule('FFBFBFBF'), bottom: rule('FFBFBFBF'), left: rule('FFBFBFBF'), right: rule('FFBFBFBF') };
  });

  const first = 3;
  const last = first + rows.length - 1;
  rows.forEach((row, n) => {
    const r = first + n;
    const line = ws.getRow(r);
    columns.forEach((c, i) => {
      const cell = line.getCell(i + 1);
      let v = c.get(row, n, r);
      if (v && typeof v === 'object' && 'f' in v) v = { formula: v.f, result: v.v ?? undefined };
      else if (c.fmt === 'date') v = cellDate(v, false);
      cell.value = v === undefined || v === '' ? null : v;
      cell.font = { name: FONT, size: 11 };
      if (TFMT[c.fmt]) cell.numFmt = TFMT[c.fmt];
    });
  });

  // Row 2: the totals, written as SUBTOTAL so a filter changes them.
  const tot = ws.getRow(2);
  columns.forEach((c, i) => {
    const cell = tot.getCell(i + 1);
    if (c.total && rows.length) {
      const L = letter(i + 1);
      cell.value = { formula: `SUBTOTAL(9,${L}${first}:${L}${last})`, result: rows.reduce((s, row, n) => {
        const v = c.get(row, n, first + n);
        return s + (Number(v && typeof v === 'object' ? v.v : v) || 0);
      }, 0) };
      cell.numFmt = TFMT[c.fmt] || ACC;
    }
    cell.font = { name: FONT, size: 11, bold: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: Math.max(2, last), column: columns.length } };
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.pageSetup.printTitlesRow = '1:2';
  if (!rows.length) {
    ws.getCell(3, 1).value = 'Nothing in this period.';
    ws.getCell(3, 1).font = { name: FONT, size: 11, italic: true };
  }
  return ws;
}

/** The size columns every tracker sheet starts with, read from the item. */
const sizeColumns = (item) => [
  { h: 'Item Short', w: 6.7, get: (r) => item(r)?.item_short || '' },
  { h: 'Width\nft', w: 7.7, get: (r) => item(r)?.width_ft ?? null },
  { h: 'Width\nm', w: 8.3, fmt: 'm', get: (r, n, row) => (item(r)?.width_ft ? { f: `ROUNDDOWN((C${row}/3.281),3)`, v: Math.floor((item(r).width_ft / 3.281) * 1000) / 1000 } : null) },
  { h: 'Length\nft', w: 7.7, get: (r) => item(r)?.length_ft ?? null },
  { h: 'Length\nm', w: 8.4, fmt: 'm', get: (r, n, row) => (item(r)?.length_ft ? { f: `ROUNDDOWN((E${row}/3.281),3)`, v: Math.floor((item(r).length_ft / 3.281) * 1000) / 1000 } : null) },
  { h: 'Thickness\nmm', w: 8.9, get: (r) => item(r)?.thickness_mm ?? null },
  { h: 'Item Description', w: 32.6, get: (r) => item(r)?.name || '' },
  { h: 'Weight Per Pcs (Kg)', w: 8.3, fmt: 'kg', get: (r) => item(r)?.weight_kg ?? null },
];

/**
 * The four sheets of the tracker, from /manager/stock/tracker.
 */
export function buildTracker(d) {
  const book = new ExcelJS.Workbook();
  book.creator = d.shop;
  book.title = `${d.shop} tracker ${d.from} to ${d.to}`;
  const byId = new Map(d.items.map((i) => [i.id, i]));
  const vat = 1 + (d.vatRate || 0.18);
  const exVat = (n) => (d.vatIncluded ? n / vat : n);
  const inVat = (n) => (d.vatIncluded ? n : n * vat);

  // ── Purchase: every delivery, its FDN and the company ─────────────
  const pItem = (r) => byId.get(r.product_id);
  const boughtIn = new Map();
  for (const p of d.purchases) boughtIn.set(p.product_id, (boughtIn.get(p.product_id) || 0) + p.qty);
  const sizesP = sizeColumns(pItem);
  trackerSheet(book, 'Purchase', [
    { h: 'No', w: 5.3, get: (r, n) => n + 1 },
    ...sizesP,
    { h: 'Total Weight', w: 11.6, fmt: 'kg', total: true, get: (r, n, row) => (pItem(r)?.weight_kg ? { f: `K${row}*I${row}`, v: r.qty * pItem(r).weight_kg } : null) },
    { h: 'QTY', w: 7.3, total: true, get: (r) => r.qty },
    { h: 'Unit Price inclusive VAT', w: 14.1, fmt: 'money', get: (r) => inVat(r.unit_cost) },
    { h: 'Total Amount inclusive VAT', w: 17.8, fmt: 'money', total: true, get: (r, n, row) => ({ f: `L${row}*K${row}`, v: inVat(r.unit_cost) * r.qty }) },
    { h: 'FDN', w: 14.7, get: (r) => r.fdn },
    { h: 'FDN Date', w: 13.7, fmt: 'date', get: (r) => r.date },
    { h: 'Company', w: 16, get: (r) => r.supplier },
    { h: 'Total QTY Purchased', w: 9.7, fmt: 'qty', get: (r) => boughtIn.get(r.product_id) },
    { h: 'Unit Price without VAT', w: 12.6, fmt: 'money', get: (r, n, row) => ({ f: `L${row}/${vat}`, v: inVat(r.unit_cost) / vat }) },
    { h: 'Total without VAT', w: 16.7, fmt: 'money', total: true, get: (r, n, row) => ({ f: `R${row}*K${row}`, v: (inVat(r.unit_cost) / vat) * r.qty }) },
    { h: `${Math.round((vat - 1) * 100)}% VAT`, w: 13.1, fmt: 'money', get: (r, n, row) => ({ f: `R${row}*${(vat - 1).toFixed(2)}`, v: (inVat(r.unit_cost) / vat) * (vat - 1) }) },
    { h: 'Total VAT', w: 15.1, fmt: 'money', total: true, get: (r, n, row) => ({ f: `T${row}*K${row}`, v: (inVat(r.unit_cost) / vat) * (vat - 1) * r.qty }) },
    { h: 'Total Amount inclusive VAT', w: 16.7, fmt: 'money', get: (r, n, row) => ({ f: `M${row}`, v: inVat(r.unit_cost) * r.qty }) },
    { h: 'Sale Price', w: 13.1, fmt: 'money', get: (r) => pItem(r)?.price || null },
    { h: 'Profit', w: 11.1, fmt: 'money', get: (r, n, row) => (pItem(r)?.price ? { f: `W${row}-L${row}`, v: pItem(r).price - inVat(r.unit_cost) } : null) },
    { h: 'Total Profit', w: 16.7, fmt: 'money', total: true, get: (r, n, row) => (pItem(r)?.price ? { f: `X${row}*K${row}`, v: (pItem(r).price - inVat(r.unit_cost)) * r.qty } : null) },
  ], d.purchases, 16);

  // ── Sell Detail: every line sold ──────────────────────────────────
  const sItem = (r) => byId.get(r.product_id);
  const soldOf = new Map();
  for (const s of d.sales) soldOf.set(s.product_id, (soldOf.get(s.product_id) || 0) + s.qty);
  trackerSheet(book, 'Sell Detail', [
    { h: 'Invoice No', w: 9, get: (r) => r.order.no },
    { h: 'Date', w: 11.4, fmt: 'date', get: (r) => r.date },
    { h: 'Item Description', w: 32.6, get: (r) => sItem(r)?.name || '' },
    { h: 'Weight Per Pcs (Kg)', w: 7, fmt: 'kg', get: (r) => sItem(r)?.weight_kg ?? null },
    { h: 'Total Weight', w: 8.3, fmt: 'kg', total: true, get: (r, n, row) => (sItem(r)?.weight_kg ? { f: `D${row}*F${row}`, v: sItem(r).weight_kg * r.qty } : null) },
    { h: 'QTY', w: 7.6, total: true, get: (r) => r.qty },
    { h: 'Unit Sale Price inclusive VAT', w: 13, fmt: 'money', get: (r) => r.unit_price },
    { h: 'Total Sale Amount inclusive VAT', w: 16.7, fmt: 'money', total: true, get: (r, n, row) => ({ f: `G${row}*F${row}`, v: r.unit_price * r.qty }) },
    { h: 'Ref Name/No', w: 16, get: (r) => r.order.customer },
    { h: 'Paid Amount', w: 9, get: (r) => (r.order.paid ? 'Yes' : 'No') },
    { h: 'Refrence', w: 14.8, get: (r) => r.order.receipt },
    { h: 'Total QTY of Sale', w: 10.1, fmt: 'qty', get: (r) => soldOf.get(r.product_id) },
    { h: 'Purchase Unit Price', w: 15.1, fmt: 'money', get: (r) => r.unit_cost || sItem(r)?.avg_cost || null },
    { h: 'Total Purchase Price', w: 17.8, fmt: 'money', total: true, get: (r, n, row) => ({ f: `M${row}*F${row}`, v: (r.unit_cost || sItem(r)?.avg_cost || 0) * r.qty }) },
    { h: 'Gross Profit', w: 15.1, fmt: 'money', total: true, get: (r, n, row) => ({ f: `H${row}-N${row}`, v: (r.unit_price - (r.unit_cost || sItem(r)?.avg_cost || 0)) * r.qty }) },
    { h: 'Zakat', w: 14.1, fmt: 'money', total: true, get: (r, n, row) => ({ f: `O${row}*2.5%`, v: (r.unit_price - (r.unit_cost || sItem(r)?.avg_cost || 0)) * r.qty * 0.025 }) },
    { h: 'Net Profit after Zakat', w: 15.1, fmt: 'money', total: true, get: (r, n, row) => ({ f: `O${row}-P${row}`, v: (r.unit_price - (r.unit_cost || sItem(r)?.avg_cost || 0)) * r.qty * 0.975 }) },
  ], d.sales, 3);

  // ── Balance Material Final: bought, sold and left, per item ───────
  const self = (r) => r;
  const onDay = new Date(`${d.to}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }).replace(/\//g, '-');
  trackerSheet(book, 'Balance Material Final', [
    { h: 'No', w: 5.3, get: (r, n) => n + 1 },
    ...sizeColumns(self),
    { h: 'Total Weight', w: 11.1, fmt: 'money', total: true, get: (r, n, row) => (r.weight_kg ? { f: `M${row}*I${row}`, v: r.weight_kg * r.stock } : null) },
    { h: 'Total QTY Purchased', w: 10, fmt: 'qty', total: true, get: (r) => r.bought },
    { h: 'Total QTY Sold', w: 10.1, fmt: 'qty', total: true, get: (r) => r.sold },
    { h: `Available Stock ${onDay}`, w: 12.6, fmt: 'qty', total: true, get: (r) => r.stock },
    { h: 'Sale Price', w: 12.6, fmt: 'money', get: (r) => r.price || null },
    { h: 'Purchase Price', w: 14.7, fmt: 'money', get: (r) => r.last_cost || r.cost || null },
    { h: 'Profit', w: 12.6, fmt: 'pct', get: (r, n, row) => (r.price && (r.last_cost || r.cost) ? { f: `1-O${row}/N${row}`, v: 1 - (r.last_cost || r.cost) / r.price } : null) },
    { h: 'Total Stock', w: 16, fmt: 'money', total: true, get: (r, n, row) => ({ f: `O${row}*M${row}`, v: (r.last_cost || r.cost || 0) * r.stock }) },
  ], d.items, 8);

  // ── Code: each item's latest buy price and who it came from ───────
  trackerSheet(book, 'Code', [
    { h: 'Item Description', w: 32.7, get: (r) => r.name },
    { h: 'Weight', w: 8.9, fmt: 'kg', get: (r) => r.weight_kg ?? null },
    { h: 'Latest Purchase Price', w: 13.1, fmt: 'money', get: (r) => r.last_cost || null },
    { h: 'Company for Latest Purchase Price', w: 18, get: (r) => r.last_supplier || '' },
    { h: 'Expected Purchase Price', w: 15, fmt: 'money', get: (r) => r.expected_cost || null },
    { h: 'Latest Sale Price', w: 14, fmt: 'money', get: (r) => r.price || null },
    { h: 'Expected Sell Price', w: 12.6, fmt: 'money', get: (r) => r.expected_price || null },
  ], d.items, 1);

  return book;
}

/** One customer's credit statement: every line with the balance after. */
export function buildCreditStatement(d) {
  const book = new ExcelJS.Workbook();
  const a = d.account;
  const lines = [...d.statement].reverse();
  trackerSheet(book, 'Statement', [
    { h: 'Date', w: 11.5, fmt: 'date', get: (r) => r.date },
    { h: 'What', w: 24, get: (r) => r.what },
    { h: 'Order', w: 10, get: (r) => r.orderNo || '' },
    { h: 'Receipt / Ref', w: 14, get: (r) => r.ref || '' },
    { h: 'Bought (Debit)', w: 15, fmt: 'money', total: true, get: (r) => r.debit || null },
    { h: 'Paid (Credit)', w: 15, fmt: 'money', total: true, get: (r) => r.credit || null },
    { h: 'Balance', w: 15, fmt: 'money', get: (r) => r.balance },
    { h: 'Due', w: 11, fmt: 'date', get: (r) => r.due || null },
    { h: 'By', w: 14, get: (r) => r.by || '' },
    { h: 'Note', w: 30, get: (r) => r.note || '' },
  ], lines, 1);
  const info = book.addWorksheet('Account');
  info.columns = [{ width: 24 }, { width: 22 }];
  const rows = [
    ['Customer', a.name], ['Phone', a.phone || ''], ['Limit', a.limit], ['Days to pay', a.termsDays],
    ['Owes', a.owed], ['Left to use', a.available], ['Late', a.overdue], ['Status', a.status],
    ['Up to 7 days', a.aging.current], ['8 to 30 days', a.aging.d30], ['31 to 60 days', a.aging.d60],
    ['61 to 90 days', a.aging.d90], ['Over 90 days', a.aging.over90],
  ];
  rows.forEach(([k, v], i) => {
    const r = info.getRow(i + 1);
    r.getCell(1).value = k;
    r.getCell(2).value = v;
    r.getCell(1).font = { name: FONT, size: 11, bold: true };
    r.getCell(1).fill = fill('FF92D050');
    if (typeof v === 'number' && !['Days to pay'].includes(k)) r.getCell(2).numFmt = ACC;
  });
  return book;
}

/**
 * The "Cash and Credit Sales Detailed Report", the way the shop's own
 * report lays it out: cash sales, credit sales, and the grand total.
 */
export function buildSalesReport(d) {
  const book = new ExcelJS.Workbook();
  const cols = [
    { h: 'Date', w: 11.5, fmt: 'date', get: (r) => r.date },
    { h: 'Reference', w: 18, get: (r) => r.reference },
    { h: 'Customer', w: 18, get: (r) => r.customer },
    { h: 'Stock Item', w: 34, get: (r) => r.item },
    { h: 'Qty', w: 7, fmt: 'qty', total: true, get: (r) => r.qty },
    { h: 'Unit Price', w: 13, fmt: 'money', get: (r) => r.unitPrice },
    { h: 'Amount', w: 15, fmt: 'money', total: true, get: (r) => r.amount },
  ];
  const cashTotal = d.cash.reduce((n, r) => n + r.amount, 0);
  const creditTotal = d.credit.reduce((n, r) => n + r.amount, 0);

  const sum = book.addWorksheet('Summary');
  sum.columns = [{ width: 30 }, { width: 18 }];
  const title = sum.getRow(1);
  title.getCell(1).value = `Cash and Credit Sales, ${d.from === d.to ? d.from : `${d.from} to ${d.to}`}`;
  title.getCell(1).font = { name: FONT, size: 13, bold: true };
  const put = (n, k, v, strong) => {
    const r = sum.getRow(n);
    r.getCell(1).value = k;
    r.getCell(2).value = v;
    r.getCell(2).numFmt = ACC;
    r.getCell(1).font = { name: FONT, size: 11, bold: !!strong };
    r.getCell(2).font = { name: FONT, size: 11, bold: !!strong };
    if (strong) { r.getCell(1).fill = fill('FF92D050'); r.getCell(2).fill = fill('FF92D050'); }
  };
  put(3, 'Total Cash Sale', cashTotal);
  put(4, 'Total Credit Sale', creditTotal);
  put(5, 'Grand Total', cashTotal + creditTotal, true);
  // Credit sales by customer, like "Ben Sale" in the notebook.
  const by = {};
  for (const r of d.credit) by[r.customer] = (by[r.customer] || 0) + r.amount;
  let n = 7;
  sum.getRow(n).getCell(1).value = 'Credit sales by customer';
  sum.getRow(n).getCell(1).font = { name: FONT, size: 11, bold: true };
  for (const [who, v] of Object.entries(by).sort((x, y) => y[1] - x[1])) put(++n, who, v);

  trackerSheet(book, 'Cash Sale', cols, d.cash, 3);
  trackerSheet(book, 'Credit Sale', cols, d.credit, 3);
  return book;
}
