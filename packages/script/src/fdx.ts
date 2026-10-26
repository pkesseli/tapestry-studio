/** Named XML entities Final Draft files use. */
const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Decodes XML character and entity references.
 * @param text Text possibly containing `&amp;`, `&#39;` or `&#x27;`.
 */
function decodeXml(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi,
    (whole, dec?: string, hex?: string, named?: string) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return XML_ENTITIES[named ?? ''] ?? whole;
    },
  );
}

/**
 * Converts a Final Draft (`.fdx`) screenplay to Fountain text, which the normal parser then reads. Only the
 * paragraph structure is used (scene headings, action, characters, dialogue, parentheticals, transitions); layout,
 * revisions and notes are dropped.
 * @param xml Contents of the .fdx file.
 */
export function fdxToFountain(xml: string): string {
  const out: string[] = [];
  let inDialogue = false;
  for (const paragraph of xml.matchAll(/<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/g)) {
    const type = /Type="([^"]*)"/.exec(paragraph[1] ?? '')?.[1] ?? 'Action';
    const text = decodeXml(
      [...(paragraph[2] ?? '').matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/g)]
        .map((t) => t[1] ?? '')
        .join(''),
    )
      .replace(/\s*\n\s*/g, ' ')
      .trim();
    if (!text) continue;
    if (type === 'Character') {
      out.push('', text.toUpperCase());
      inDialogue = true;
    } else if (type === 'Dialogue' || type === 'Parenthetical') {
      const line = type === 'Parenthetical' && !text.startsWith('(') ? `(${text})` : text;
      if (!inDialogue) out.push('', '@' + line);
      else out.push(line);
    } else {
      inDialogue = false;
      if (type === 'Scene Heading')
        out.push(
          '',
          /^(int|ext|est|i\/e)/i.test(text) ? text.toUpperCase() : `.${text.toUpperCase()}`,
        );
      else if (type === 'Transition') out.push('', `> ${text}`);
      else out.push('', text);
    }
  }
  return out.join('\n').replace(/^\n/, '') + '\n';
}
