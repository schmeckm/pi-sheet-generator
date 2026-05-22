/** Lightweight markdown → HTML for admin prompt preview (no external deps). */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderSimpleMarkdown(text) {
  if (!text) return '';
  const lines = String(text).split('\n');
  const out = [];
  let inCode = false;
  let codeBuf = [];
  let listType = null;

  const flushList = () => {
    if (listType) {
      out.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
    }
  };

  const flushCode = () => {
    if (!inCode) return;
    out.push(`<pre class="md-pre"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
    codeBuf = [];
    inCode = false;
  };

  for (const raw of lines) {
    const line = raw;

    if (line.trim().startsWith('```')) {
      flushList();
      if (inCode) flushCode();
      else inCode = true;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    if (/^###\s+/.test(line)) {
      flushList();
      out.push(`<h3 class="md-h3">${inlineFormat(escapeHtml(line.replace(/^###\s+/, '')))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      flushList();
      out.push(`<h2 class="md-h2">${inlineFormat(escapeHtml(line.replace(/^##\s+/, '')))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      flushList();
      out.push(`<h1 class="md-h1">${inlineFormat(escapeHtml(line.replace(/^#\s+/, '')))}</h1>`);
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushList();
      out.push('<hr class="md-hr" />');
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (listType !== 'ul') {
        flushList();
        out.push('<ul class="md-ul">');
        listType = 'ul';
      }
      out.push(`<li>${inlineFormat(escapeHtml(line.replace(/^[-*]\s+/, '')))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (listType !== 'ol') {
        flushList();
        out.push('<ol class="md-ol">');
        listType = 'ol';
      }
      out.push(`<li>${inlineFormat(escapeHtml(line.replace(/^\d+\.\s+/, '')))}</li>`);
      continue;
    }
    if (!line.trim()) {
      flushList();
      out.push('<br />');
      continue;
    }
    flushList();
    out.push(`<p class="md-p">${inlineFormat(escapeHtml(line))}</p>`);
  }
  flushList();
  flushCode();
  return out.join('\n');
}

function inlineFormat(htmlEscaped) {
  return htmlEscaped
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
