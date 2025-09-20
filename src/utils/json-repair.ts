/**
 * Lightweight JSON repair utility to handle common LLM response issues:
 * - Wrapped in markdown code fences
 * - Trailing commas before closing brackets/braces
 * - Extra commentary before/after JSON
 * - Incomplete closing braces (attempts best-effort fix)
 */
export function extractJson(raw: string): string {
  let content = raw.trim();
  // Remove common code fences
  content = content.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

    const first = content.indexOf('{');
    if (first === -1) throw new Error('No JSON object boundaries found');

    // Brace-depth scan to find balanced root; if never balanced, take remainder (truncated JSON)
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIndex = -1;
    for (let i = first; i < content.length; i++) {
      const ch = content[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else {
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            endIndex = i;
            break;
          }
        }
      }
    }

    if (endIndex === -1) {
      // Truncated: take rest and allow repair to close braces
      content = content.slice(first);
    } else {
      // If there is extra non-whitespace after balanced root, we may have concatenated text; keep only root
      const tail = content.slice(endIndex + 1).trim();
      content = tail.length === 0 ? content.slice(first, endIndex + 1) : content.slice(first);
    }

  // Remove trailing commas before closing } or ]
  content = content.replace(/,\s*(}|])/g, '$1');

  return content.trim();
}

export function repairJsonIfNeeded(content: string): string {
  // Quick validation by counting braces
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  if (closeBraces < openBraces) {
    content = content + '}'.repeat(openBraces - closeBraces);
  }
  // Basic bracket balance (we don't expect top-level arrays, but just in case)
  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/]/g) || []).length;
  if (closeBrackets < openBrackets) {
    content = content + ']'.repeat(openBrackets - closeBrackets);
  }
  return content;
}

export function safeParseJson(raw: string): any {
  let prepared = extractJson(raw);
    const tryParse = (s: string) => JSON.parse(s);

    const balance = (s: string): string => {
      // Balance braces
      const ob = (s.match(/{/g) || []).length;
      const cb = (s.match(/}/g) || []).length;
      if (cb < ob) s += '}'.repeat(ob - cb);
      // Balance brackets
      const obr = (s.match(/\[/g) || []).length;
      const cbr = (s.match(/]/g) || []).length;
      if (cbr < obr) s += ']'.repeat(obr - cbr);
      // Balance quotes (naive – counts unescaped quotes)
      const quoteCount = (s.match(/"/g) || []).length;
      if (quoteCount % 2 === 1) s += '"';
      return s;
    };

    try {
      return tryParse(prepared);
    } catch {
      // First repair pass
      prepared = balance(prepared.replace(/,\s*(}|])/g, '$1'));
      try {
        return tryParse(prepared);
      } catch {}
    }

    // Second strategy: incrementally trim from end while balancing
    for (let trim = 1; trim <= 150 && prepared.length - trim > 20; trim++) {
      let candidate = prepared.slice(0, prepared.length - trim).trim();
      candidate = candidate.replace(/[\[{,]$/,'');
      candidate = balance(candidate);
      try {
        return tryParse(candidate);
      } catch {/* continue */}
    }

    // Final attempt: wrap in root if missing
    try {
      return tryParse(balance(prepared));
    } catch (e) {
      throw e;
    }
}
