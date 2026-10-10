/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * Thin ExcelJS helpers for bot XLSX import/export (replaces vulnerable sheetjs/xlsx).
 */

import ExcelJS from 'exceljs';

function cellToPlain(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return cellToPlain(value.result as ExcelJS.CellValue);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('hyperlink' in value) {
      const link = value as ExcelJS.CellHyperlinkValue;
      return link.text ?? link.hyperlink ?? '';
    }
  }
  return String(value);
}

/** Write a 2D array-of-arrays sheet to an .xlsx buffer. */
export async function writeSheetBuffer(sheetName: string, rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  for (const row of rows) {
    sheet.addRow(row);
  }
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

/** Read the first worksheet as array-of-arrays (header + data rows). */
export async function readFirstSheetRows(buffer: Buffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS typings expect a Node Buffer brand that conflicts with @types/node Buffer generics
  await workbook.xlsx.load(Uint8Array.from(buffer) as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    // ExcelJS row.values is 1-indexed; index 0 is unused
    const cells = values.slice(1).map((cell) => cellToPlain(cell));
    rows.push(cells);
  });
  return rows;
}
