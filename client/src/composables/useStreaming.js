import { useAuthStore } from '@/stores/auth';

import { resolveChatError, resolveStreamError } from '@/utils/chatErrors';

const baseURL = import.meta.env.VITE_API_URL || '/api';

function parseSseStream(url, body, { onChunk, onTools, onMeta } = {}) {
  const auth = useAuthStore();

  return new Promise((resolve, reject) => {
    let settled = false;

    function finishOk(payload) {
      if (settled) return;
      settled = true;
      resolve(payload);
    }

    function finishErr(errPayload) {
      if (settled) return;
      settled = true;
      const message =
        typeof errPayload === 'string'
          ? errPayload
          : resolveStreamError(errPayload);
      const err = new Error(message);
      if (typeof errPayload === 'object' && errPayload?.code) err.code = errPayload.code;
      reject(err);
    }

    function handleEventLine(line) {
      if (!line.startsWith('data: ')) return false;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') return payload === '[DONE]';
      try {
        const data = JSON.parse(payload);
        if (data.type === 'meta') onMeta?.(data);
        if (data.type === 'chunk') onChunk?.(data.text);
        if (data.type === 'tools') onTools?.(data.tools);
        if (data.type === 'complete') finishOk(data);
        if (data.type === 'error') finishErr({ message: data.message, code: data.code });
      } catch {
        /* ignore malformed lines */
      }
      return false;
    }

    (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          finishErr({ message: resolveChatError({ response: { data: err } }), code: err.code });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (handleEventLine(line)) return;
          }
        }

        for (const line of buffer.split('\n')) {
          if (handleEventLine(line)) return;
        }

        if (!settled) finishErr('Stream ended without result');
      } catch (err) {
        const msg =
          err.name === 'AbortError' ? 'Request timed out after 120s' : err.message;
        finishErr(msg);
      } finally {
        clearTimeout(timeoutId);
      }
    })();
  });
}

/** SSE PI sheet generation stream. */
export function streamChatGenerate(prompt, { locale = 'de', onChunk, onMeta } = {}) {
  const url = `${baseURL.replace(/\/$/, '')}/chat/generate-stream`;
  return parseSseStream(url, { prompt, locale }, {
    onChunk,
    onMeta,
    onTools: (tools) => onChunk?.(`\n🔧 ${tools?.join(', ')}\n`),
  }).then((data) => {
    const out = {
      contextTrimmed: data.contextTrimmed,
      trimmedSections: data.trimmedSections,
    };
    if (data.requestMode === 'qa' && data.message) {
      return { ...out, text: data.message, requestMode: 'qa', usage: data.usage };
    }
    if (data.piSheet) {
      return { ...out, piSheet: data.piSheet, requestMode: 'pi_sheet', usage: data.usage };
    }
    if (data.message) {
      return { ...out, text: data.message, requestMode: data.requestMode || 'qa', usage: data.usage };
    }
    return { ...out, ...data };
  });
}

/** SSE equipment / Q&A stream. */
export function streamChatQa(prompt, { locale = 'de', onChunk, onTools, onMeta } = {}) {
  const url = `${baseURL.replace(/\/$/, '')}/chat/qa-stream`;
  return parseSseStream(url, { prompt, locale }, { onChunk, onTools, onMeta }).then((data) => ({
    text: data.message || '',
    requestMode: data.requestMode || 'qa',
    usage: data.usage,
  }));
}
