'use client';

import * as XLSX from 'xlsx';

/**
 * Spreadsheets, read in the browser. Writing them is lib/workbook.js.
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
  reorderQty: ['reorderquantity', 'reorderqty', 'orderquantity', 'orderqty', 'ordersize'],
  cost: ['cost', 'buyprice', 'buyingprice', 'costprice', 'purchaseprice', 'unitcost', 'buy'],
  supplier: ['supplier', 'vendor', 'suppliername'],
  shelf: ['shelf', 'location', 'bin', 'shelflocation'],
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
      'No product code column. Add a column headed "Code" or "SKU". It is how a row ' +
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
