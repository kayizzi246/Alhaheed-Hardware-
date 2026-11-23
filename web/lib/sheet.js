'use client';

import * as XLSX from 'xlsx';

/**
 * Spreadsheets, read and written in the browser.
 *
 * The parsing happens here rather than on the server for two reasons.
 * PHP cannot read an .xlsx without a library — the format is a zip of
 * XML — and carrying one into a plugin that has to run on cheap shared
 * hosting is a lot of weight for one screen. And doing it here means
 * the person can be shown what was understood *before* anything is
 * written to the shop.
 */

/**
 * The headings this understands, and what they mean.
 *
 * Spreadsheets arrive with whatever the person who made them typed, so
 * the obvious spellings are all here. Matching ignores case, spaces and
 * punctuation, which covers "Reorder Level", "reorder_level" and
 * "REORDER LEVEL" without listing each one.
 */
const COLUMNS = {
  code: ['code', 'sku', 'productcode', 'itemcode', 'ref'],
  name: ['name', 'product', 'productname', 'description', 'item', 'itemname'],
  price: ['price', 'regularprice', 'unitprice', 'sellingprice', 'rate', 'amount'],
  stock: ['stock', 'quantity', 'qty', 'instock', 'stockavailable', 'onhand'],
  unit: ['unit', 'units', 'soldby', 'soldin', 'measure', 'uom'],
  reorderLevel: ['reorderlevel', 'reorder', 'reorderat', 'minimumstock', 'minstock', 'reorderpoint'],
  category: ['category', 'categories', 'group', 'type'],
  description: ['notes', 'remarks', 'details', 'longdescription'],
};

const flatten = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Which of our fields a spreadsheet heading means, if any. */
function fieldFor(heading) {
  const flat = flatten(heading);
  if (!flat) return null;
  for (const [field, names] of Object.entries(COLUMNS)) {
    if (names.includes(flat)) return field;
  }
  return null;
}

/**
 * Read a .xlsx, .xls or .csv into rows this app understands.
 *
 * Returns the rows, which headings were recognised and which were
 * ignored — so the screen can say "I did not know what to do with
 * 'Supplier'" instead of silently dropping a column.
 */
export async function readSheet(file) {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: 'array' });

  const sheetName = book.SheetNames[0];
  if (!sheetName) throw new Error('That file has no sheets in it.');

  const raw = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { defval: '', raw: true });
  if (!raw.length) throw new Error('That sheet has no rows under its headings.');

  const headings = Object.keys(raw[0]);
  const mapping = {};
  const ignored = [];

  for (const heading of headings) {
    const field = fieldFor(heading);
    if (field && !(field in mapping)) mapping[field] = heading;
    else if (!field) ignored.push(heading);
  }

  if (!mapping.code) {
    throw new Error(
      'No product code column. Add a column headed "Code" or "SKU" — it is how a row ' +
        'finds the product it belongs to.'
    );
  }

  const rows = raw
    .map((r) => {
      const out = {};
      for (const [field, heading] of Object.entries(mapping)) {
        const value = r[heading];
        out[field] = typeof value === 'string' ? value.trim() : value;
      }
      return out;
    })
    // A trailing blank line is the commonest thing in a hand-made sheet.
    .filter((r) => String(r.code || '').trim() !== '');

  return { rows, recognised: Object.keys(mapping), ignored, sheetName };
}

/** Hand the catalogue back as a real .xlsx, with the headings the importer reads. */
export function writeSheet(products, filename) {
  const rows = products.map((p) => ({
    Code: p.code ?? '',
    Name: p.name ?? '',
    Category: p.category ?? p.category_name ?? '',
    Price: p.price ?? 0,
    Unit: p.unit ?? '',
    Stock: p.stock ?? p.stock_available ?? 0,
    'Reorder level': p.reorderLevel ?? p.reorder_level ?? 0,
    Notes: p.description ?? '',
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);

  // Column widths, so nobody opens the file to a column of ####.
  sheet['!cols'] = [
    { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 34 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Products');
  XLSX.writeFile(book, filename);
}

/**
 * Write a workbook of several named sheets.
 *
 * The monthly report is not one table — it is takings, spending, the
 * cash book and the orders behind them. Flattening that into one sheet
 * would mean a column that holds a date on some rows and a receipt
 * number on others, which is exactly the spreadsheet an accountant
 * sends back. One tab per section instead, in reading order, with a
 * cover tab first so the file explains itself in a year's time.
 *
 * `sheets` is [{ name, rows, cols }]. A section with no rows still gets
 * its tab, carrying one line saying so — an absent tab reads as
 * "forgotten", a tab saying "nothing this month" reads as checked.
 */
export function writeWorkbook(sheets, filename) {
  const book = XLSX.utils.book_new();

  for (const { name, rows, cols } of sheets) {
    const sheet = XLSX.utils.json_to_sheet(
      rows && rows.length ? rows : [{ '': 'Nothing recorded for this section this month.' }]
    );
    if (cols) sheet['!cols'] = cols.map((wch) => ({ wch }));
    // Excel refuses tab names over 31 characters or containing : \ / ? * [ ]
    XLSX.utils.book_append_sheet(book, sheet, name.replace(/[:\/?*[\]]/g, '-').slice(0, 31));
  }

  XLSX.writeFile(book, filename);
}
