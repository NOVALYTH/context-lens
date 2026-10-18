#!/usr/bin/env node
// Assemble the guide chapters into one PDF. Zero dependency: a small Markdown converter + a Chromium-based browser
// (Edge or Chrome) in headless mode for printing. Requires a browser installed; override with CHROME_BIN.
//   node guide/build-pdf.mjs            -> guide/context-lens-guide.pdf  (and guide/context-lens-guide.html)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PARTS = ['_front.md', '01-measured-workspace.md', '02-token-economy.md', '03-free-prompts.md', '04-skills.md', '_appendix.md'];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}

export function mdToHtml(md) {
  const lines = md.split(/\r?\n/); const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\s*---\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^\|/.test(l) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) {
      const row = (r) => r.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
      const head = row(l); i += 2; const body = [];
      while (i < lines.length && /^\|/.test(lines[i])) body.push(row(lines[i++]));
      out.push('<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' + body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l);
    if (li) {
      const ordered = /\d/.test(li[2]); const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) { items.push(m[3]); i++; } else if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; } else break;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>` + items.map((t) => `<li>${inline(t)}</li>`).join('') + `</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    if (l.trim() === '') { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(```|#{1,4}\s|\||\s*([-*]|\d+\.)\s)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

const CSS = `
@page { size: A4; margin: 22mm 20mm 22mm 20mm; @bottom-center { content: counter(page); font: 9pt sans-serif; color: #666; } }
body { font: 10.5pt/1.5 Georgia, 'Times New Roman', serif; color: #1a1a1a; }
h1 { font: 700 20pt/1.2 Arial, sans-serif; margin: 0 0 8pt; page-break-before: always; }
h1.first { page-break-before: avoid; }
h2 { font: 700 13.5pt/1.3 Arial, sans-serif; margin: 16pt 0 5pt; page-break-after: avoid; }
h3 { font: 700 11.5pt/1.3 Arial, sans-serif; margin: 12pt 0 4pt; page-break-after: avoid; }
p { margin: 0 0 7pt; } ul, ol { margin: 0 0 7pt 18pt; padding: 0; } li { margin-bottom: 2pt; }
code { font: 9pt Consolas, 'Courier New', monospace; background: #f1f1f1; padding: 0 2pt; border-radius: 2pt; }
pre { background: #f5f5f5; border: 1px solid #ddd; padding: 6pt 8pt; overflow-wrap: anywhere; white-space: pre-wrap; page-break-inside: avoid; margin: 0 0 8pt; }
pre code { background: none; padding: 0; font-size: 8.8pt; }
table { border-collapse: collapse; width: 100%; margin: 0 0 9pt; font: 9.5pt Arial, sans-serif; page-break-inside: avoid; }
th, td { border: 1px solid #bbb; padding: 3pt 5pt; text-align: left; vertical-align: top; } th { background: #eee; }
a { color: #0b4f9e; text-decoration: none; } hr { border: 0; border-top: 1px solid #ccc; margin: 10pt 0; }
`;

export function build() {
  const body = PARTS.map((f, n) => {
    let html = mdToHtml(readFileSync(join(here, f), 'utf8'));
    if (n === 0) html = html.replace('<h1>', '<h1 class="first">');
    return html;
  }).join('\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>context-lens guide</title><style>${CSS}</style></head><body>${body}</body></html>`;
  const htmlPath = join(here, 'context-lens-guide.html'); const pdfPath = join(here, 'context-lens-guide.pdf');
  writeFileSync(htmlPath, html);
  const candidates = [process.env.CHROME_BIN, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const bin = candidates.find((p) => existsSync(p));
  if (!bin) throw new Error('no Chromium-based browser found; set CHROME_BIN');
  execFileSync(bin, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: 'ignore' });
  return pdfPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log('wrote ' + build());
