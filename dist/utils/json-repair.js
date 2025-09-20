"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractJson = extractJson;
exports.repairJsonIfNeeded = repairJsonIfNeeded;
exports.safeParseJson = safeParseJson;
function extractJson(raw) {
    let content = raw.trim();
    content = content.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const first = content.indexOf('{');
    if (first === -1)
        throw new Error('No JSON object boundaries found');
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIndex = -1;
    for (let i = first; i < content.length; i++) {
        const ch = content[i];
        if (inString) {
            if (escape) {
                escape = false;
            }
            else if (ch === '\\') {
                escape = true;
            }
            else if (ch === '"') {
                inString = false;
            }
        }
        else {
            if (ch === '"')
                inString = true;
            else if (ch === '{')
                depth++;
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
        content = content.slice(first);
    }
    else {
        const tail = content.slice(endIndex + 1).trim();
        content = tail.length === 0 ? content.slice(first, endIndex + 1) : content.slice(first);
    }
    content = content.replace(/,\s*(}|])/g, '$1');
    return content.trim();
}
function repairJsonIfNeeded(content) {
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (closeBraces < openBraces) {
        content = content + '}'.repeat(openBraces - closeBraces);
    }
    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/]/g) || []).length;
    if (closeBrackets < openBrackets) {
        content = content + ']'.repeat(openBrackets - closeBrackets);
    }
    return content;
}
function safeParseJson(raw) {
    let prepared = extractJson(raw);
    const tryParse = (s) => JSON.parse(s);
    const balance = (s) => {
        const ob = (s.match(/{/g) || []).length;
        const cb = (s.match(/}/g) || []).length;
        if (cb < ob)
            s += '}'.repeat(ob - cb);
        const obr = (s.match(/\[/g) || []).length;
        const cbr = (s.match(/]/g) || []).length;
        if (cbr < obr)
            s += ']'.repeat(obr - cbr);
        const quoteCount = (s.match(/"/g) || []).length;
        if (quoteCount % 2 === 1)
            s += '"';
        return s;
    };
    try {
        return tryParse(prepared);
    }
    catch {
        prepared = balance(prepared.replace(/,\s*(}|])/g, '$1'));
        try {
            return tryParse(prepared);
        }
        catch { }
    }
    for (let trim = 1; trim <= 150 && prepared.length - trim > 20; trim++) {
        let candidate = prepared.slice(0, prepared.length - trim).trim();
        candidate = candidate.replace(/[\[{,]$/, '');
        candidate = balance(candidate);
        try {
            return tryParse(candidate);
        }
        catch { }
    }
    try {
        return tryParse(balance(prepared));
    }
    catch (e) {
        throw e;
    }
}
//# sourceMappingURL=json-repair.js.map