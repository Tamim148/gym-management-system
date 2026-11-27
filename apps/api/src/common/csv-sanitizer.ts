const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (FORMULA_PREFIX_RE.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function formatCsvRow(cells: unknown[]): string {
  return cells
    .map((cell) => {
      const safe = sanitizeCsvCell(cell);
      if (/[",\n\r]/.test(safe)) {
        return `"${safe.replace(/"/g, '""')}"`;
      }
      return safe;
    })
    .join(',');
}
