// Turns an uploaded book file into { title, author, paragraphs: string[] }.
// Kept outside src/ since this is server-only Node code (zip/XML parsing)
// that must never end up in the client bundle.
import JSZip from 'jszip';
import { parse as parseHtml } from 'node-html-parser';

function findByLocalName(root, localName) {
  for (const el of root.querySelectorAll('*')) {
    const tag = (el.rawTagName || el.tagName || '').toLowerCase();
    if (tag === localName || tag.endsWith(':' + localName)) return el;
  }
  return null;
}

export async function parseEpub(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('Не похоже на EPUB: нет META-INF/container.xml');
  const containerDom = parseHtml(await containerFile.async('string'), { lowerCaseTagName: true });
  const opfPath = containerDom.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) throw new Error('Не похоже на EPUB: не найден путь к OPF-файлу');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('EPUB повреждён: OPF-файл отсутствует в архиве');
  const opfDom = parseHtml(await opfFile.async('string'), { lowerCaseTagName: true });

  const manifest = {};
  for (const item of opfDom.querySelectorAll('item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifest[id] = decodeURIComponent(href);
  }
  const spineIds = opfDom.querySelectorAll('itemref').map((n) => n.getAttribute('idref')).filter(Boolean);
  if (spineIds.length === 0) throw new Error('В EPUB не найден порядок глав (spine)');

  const title = findByLocalName(opfDom, 'title')?.text?.trim() || null;
  const author = findByLocalName(opfDom, 'creator')?.text?.trim() || null;

  const paragraphs = [];
  for (const id of spineIds) {
    const href = manifest[id];
    if (!href) continue;
    const docPath = opfDir + href;
    const file = zip.file(docPath);
    if (!file) continue;
    const dom = parseHtml(await file.async('string'), { lowerCaseTagName: true });
    for (const block of dom.querySelectorAll('p, h1, h2, h3, h4')) {
      const text = block.text.replace(/\s+/g, ' ').trim();
      if (text) paragraphs.push(text);
    }
  }
  if (paragraphs.length === 0) throw new Error('Не удалось извлечь текст из EPUB');
  return { title, author, paragraphs };
}

function detectXmlEncoding(buffer) {
  const head = buffer.subarray(0, 200).toString('latin1');
  const m = head.match(/encoding=["']([^"']+)["']/i);
  return m ? m[1] : 'utf-8';
}

export function parseFb2(buffer) {
  // Older Russian FB2 files are very often windows-1251, not UTF-8 — the
  // encoding declaration itself is always ASCII-readable regardless, so
  // sniff it from the raw bytes before decoding the rest.
  const encoding = detectXmlEncoding(buffer);
  let xml;
  try {
    xml = new TextDecoder(encoding).decode(buffer);
  } catch {
    xml = buffer.toString('utf-8');
  }

  // Parsed as lenient markup (like the EPUB chapters above) rather than with
  // a data-oriented XML parser: FB2 paragraphs mix plain text with inline
  // tags (<emphasis>, <strong>, ...), and a data-xml parser's object tree
  // doesn't preserve text/element interleaving order — a DOM-ish tree does,
  // via its .text getter walking children in document order.
  const dom = parseHtml(xml, { lowerCaseTagName: true });

  const title = dom.querySelector('book-title')?.text?.replace(/\s+/g, ' ').trim() || null;
  const authorEl = dom.querySelector('title-info author') || dom.querySelector('author');
  const author = authorEl
    ? [authorEl.querySelector('first-name')?.text, authorEl.querySelector('last-name')?.text]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null
    : null;

  const bodies = dom.querySelectorAll('body');
  if (bodies.length === 0) throw new Error('В FB2 не найдено текста (body)');
  // Prefer the main body — footnote/comment bodies carry a "name" attribute.
  const mainBody = bodies.find((b) => !b.getAttribute('name')) || bodies[0];

  const paragraphs = [];
  // Selecting only <p> (not <title> too) avoids double-counting: a chapter
  // heading is <title><p>...</p></title>, so its text already comes through
  // via that inner <p>.
  for (const block of mainBody.querySelectorAll('p')) {
    const text = block.text.replace(/\s+/g, ' ').trim();
    if (text) paragraphs.push(text);
  }
  if (paragraphs.length === 0) throw new Error('Не удалось извлечь текст из FB2');
  return { title, author, paragraphs };
}

export function parseTxt(buffer) {
  let text = buffer.toString('utf-8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (paragraphs.length === 0) throw new Error('Файл пустой');
  return { title: null, author: null, paragraphs };
}

export async function parseBookFile(buffer, format) {
  if (format === 'epub') return parseEpub(buffer);
  if (format === 'fb2') return parseFb2(buffer);
  if (format === 'txt') return parseTxt(buffer);
  throw new Error(`Неизвестный формат файла: ${format}`);
}
