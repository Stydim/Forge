// Quotes are always shown inside our own curly quotes, so drop a pair the
// text already has (a selection from dialogue usually comes with "..." or
// «...» around it).
const OPEN_QUOTES = '"“„«‘\'';
const CLOSE_QUOTES = '"”»’\'';

export function stripOuterQuotes(text) {
  let t = text.trim();
  while (t.length > 1 && OPEN_QUOTES.includes(t[0]) && CLOSE_QUOTES.includes(t[t.length - 1])) {
    t = t.slice(1, -1).trim();
  }
  return t;
}
