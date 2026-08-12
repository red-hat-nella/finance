import { ProblemError } from '../../http/problem.js';

const RAW_HTML = /<\/?[a-z][^>]*>/i;
const DANGEROUS_LINK = /\]\(\s*(?:javascript|data|vbscript):/i;

export function sanitizeMarkdown(source: string): string {
  const canonical = source.normalize('NFC').replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    .split('\n').map((line) => line.replace(/[\t ]+$/u, '')).join('\n').trim();
  if (!canonical || Buffer.byteLength(canonical, 'utf8') > 524_288) {
    throw invalidContent('El contenido debe tener entre 1 byte y 512 KiB.');
  }
  let containsControl = false;
  for (let index = 0; index < canonical.length; index += 1) {
    const code = canonical.charCodeAt(index);
    if ((code < 32 && code !== 9 && code !== 10) || code === 127) {
      containsControl = true;
      break;
    }
  }
  if (RAW_HTML.test(canonical) || DANGEROUS_LINK.test(canonical) || containsControl) {
    throw invalidContent('El Markdown contiene HTML, enlaces o caracteres no permitidos.');
  }
  return canonical;
}

function invalidContent(detail: string): ProblemError {
  return new ProblemError({ status: 422, title: 'Contenido inválido', detail, code: 'INVALID_TERMS_CONTENT' });
}
