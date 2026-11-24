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

const BLUE = 'FF2158E8';
const NAVY = 'FF111C38';
const INK = 'FF0F1B33';
const MUTED = 'FF55637D';
const LINE = 'FFE2E8F2';
const BAND = 'FFF5F7FB';
const PALE = 'FFEDF3FF';
const FONT = 'Calibri';

const FORMATS = {
  money: '#,##0;[Red]-#,##0;0',
  int: '#,##0',
  date: 'dd mmm yyyy',
  datetime: 'dd mmm yyyy hh:mm',
  pct: '0.0%',
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
    for (let c = 1; c <= width; c++) sheet.getCell(r, c).fill = fill(NAVY);
  }
  sheet.mergeCells(1, 1, 1, width);
  sheet.mergeCells(2, 1, 2, width);
  Object.assign(sheet.getCell(1, 1), {
    value: title,
    font: { name: FONT, size: 16, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { vertical: 'middle', indent: 1 },
  });
  Object.assign(sheet.getCell(2, 1), {
    value: sub,
    font: { name: FONT, size: 10, color: { argb: 'FFC9D8FF' } },
    alignment: { vertical: 'top', indent: 1 },
  });
  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 20;
}

/** The headings, the rows and the total. Returns the total's row number. */
function table(sheet, columns, rows, top) {
  const head = sheet.getRow(top);
  head.height = 24;
  columns.forEach((col, i) => {
    const cell = head.getCell(i + 1);
    cell.value = col.h;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(BLUE);
    cell.alignment = { vertical: 'middle', horizontal: isNumber(col.type) ? 'right' : 'left', indent: isNumber(col.type) ? 2 : 1 };
  });

  rows.forEach((row, n) => {
    const line = sheet.getRow(top + 1 + n);
    columns.forEach((col, i) => {
      const cell = line.getCell(i + 1);
      cell.value = cellValue(row[col.key], col.type);
      cell.font = { name: FONT, size: 11, bold: !!col.bold, color: { argb: INK } };
      cell.border = { bottom: rule() };
      if (n % 2) cell.fill = fill(BAND);
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

  // ── One tab per table ─────────────────────────────────────────────
  const TOP = 4;
  for (const s of sheets) {
    const wide = s.columns.reduce((n, c) => n + c.width, 0) > 95;
    const sheet = book.addWorksheet(tabName(s.name), {
      properties: { tabColor: { argb: BLUE } },
      views: [{ state: 'frozen', xSplit: 1, ySplit: TOP, showGridLines: false }],
    });
    // Room on number columns for the filter arrow beside the heading.
    sheet.columns = s.columns.map((c) => ({ width: c.width + (isNumber(c.type) ? 4 : 0) }));
    banner(sheet, s.columns.length, s.name, line);

    // An empty section keeps its tab: a missing one reads as forgotten,
    // one saying "nothing" reads as checked.
    table(sheet, s.columns, s.rows, TOP);
    if (!s.rows.length) {
      const cell = sheet.getCell(TOP + 1, 1);
      cell.value = 'Nothing recorded in this period.';
      cell.font = { name: FONT, size: 11, italic: true, color: { argb: MUTED } };
      cell.alignment = { indent: 1 };
    }
    sheet.pageSetup.printTitlesRow = `${TOP}:${TOP}`;
    page(sheet, { landscape: wide, shop: meta.shop, title: s.name });
    sheet.pageSetup.printTitlesRow = `${TOP}:${TOP}`;
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
    { h: 'Price', key: 'price', width: 14, type: 'money' },
    { h: 'Unit', key: 'unit', width: 10 },
    { h: 'Stock', key: 'stock', width: 11, type: 'int' },
    { h: 'Reorder level', key: 'reorderLevel', width: 15, type: 'int' },
    { h: 'Notes', key: 'description', width: 44, wrap: true },
  ];
  sheet.columns = columns.map((c) => ({ width: c.width + (isNumber(c.type) ? 4 : 0) }));
  const rows = [...products].sort((a, b) =>
    String(a.category || '').localeCompare(String(b.category || '')) || String(a.name || '').localeCompare(String(b.name || '')));
  table(sheet, columns, rows, 1);

  // What needs ordering stands out, and keeps up as the file is edited.
  if (rows.length) {
    sheet.addConditionalFormatting({
      ref: `F2:F${rows.length + 1}`,
      rules: [{
        type: 'expression',
        priority: 1,
        formulae: ['AND($G2>0,$F2<=$G2)'],
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
