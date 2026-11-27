import { formatCsvRow, sanitizeCsvCell } from './csv-sanitizer';

describe('csv-sanitizer', () => {
  it('prefixes formula-starting strings with a single quote', () => {
    expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
    expect(sanitizeCsvCell('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(sanitizeCsvCell('-cmd|calc')).toBe("'-cmd|calc");
    expect(sanitizeCsvCell('@HYPERLINK("http://evil.com")')).toBe(
      '\'@HYPERLINK("http://evil.com")',
    );
    expect(sanitizeCsvCell('\t=1+1')).toBe("'\t=1+1");
    expect(sanitizeCsvCell('\r=1+1')).toBe("'\r=1+1");
  });

  it('leaves safe values intact and handles null/undefined', () => {
    expect(sanitizeCsvCell('Farhana Islam')).toBe('Farhana Islam');
    expect(sanitizeCsvCell(3500)).toBe('3500');
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
  });

  it('formats CSV rows with proper quoting after formula sanitization', () => {
    const row = formatCsvRow(['=HYPERLINK("x")', 'Gulshan, Dhaka', 5500]);
    expect(row).toBe('"\'=HYPERLINK(""x"")","Gulshan, Dhaka",5500');
  });
});
