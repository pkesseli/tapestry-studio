/**
 * Reads comma-separated text, including quoted cells that contain commas, quotes ("" is one quote) and line breaks.
 * @param {string} text The file content.
 * @returns {string[][]} One array of cells per row; blank lines are skipped.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const endRow = () => {
    row.push(cell);
    cell = '';
    if (row.some((value) => value !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') endRow();
    else if (char !== '\r') cell += char;
  }
  endRow();
  return rows;
}

/**
 * Writes rows as comma-separated text, quoting only the cells that need it.
 * @param {string[][]} rows The rows.
 * @returns {string} CSV with `\n` line ends and a final newline.
 */
export function toCsv(rows) {
  const quote = (value) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return `${rows.map((row) => row.map(quote).join(',')).join('\n')}\n`;
}
