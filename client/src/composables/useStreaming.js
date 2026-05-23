import { useAuthStore } from '@/stores/auth';
import { api } from '@/composables/useApi';

import { resolveChatError, resolveStreamError } from '@/utils/chatErrors';

const baseURL = import.meta.env.VITE_API_URL || '/api';
const STREAM_TIMEOUT_MS = 180_000;

function parseSseStream(url, body, handlers = {}) {
  const auth = useAuthStore();
  const { onChunk, onTools, onMeta, onStatus, signal: externalSignal } = handlers;

  const controller = new AbortController();

  const promise = new Promise((resolve, reject) => {
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
        if (data.type === 'status') onStatus?.(data);
        if (data.type === 'chunk') onChunk?.(data.text, data);
        if (data.type === 'tools') onTools?.(data.tools);
        if (data.type === 'complete') finishOk(data);
        if (data.type === 'error') finishErr({ message: data.message, code: data.code });
      } catch {
        /* ignore malformed lines */
      }
      return false;
    }

    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    (async () => {
      const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
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
          err.name === 'AbortError'
            ? externalSignal?.aborted
              ? 'Request aborted by user'
              : `Request timed out after ${STREAM_TIMEOUT_MS / 1000}s`
            : err.message;
        finishErr(msg);
      } finally {
        clearTimeout(timeoutId);
      }
    })();
  });

  promise.controller = controller;
  promise.abort = () => controller.abort();
  return promise;
}

function withHandle(promise, normalizer) {
  const wrapped = promise.then(normalizer);
  wrapped.abort = promise.abort;
  wrapped.controller = promise.controller;
  return wrapped;
}

/** Unified streaming entry point — server decides mode via meta event. */
export function streamChat(prompt, opts = {}) {
  const url = `${baseURL.replace(/\/$/, '')}/chat/stream`;
  const sse = parseSseStream(
    url,
    { prompt, locale: opts.locale || 'de' },
    opts
  );
  return withHandle(sse, (data) => normalizeStreamResult(data));
}

/** SSE PI sheet generation stream. */
export function streamChatGenerate(prompt, opts = {}) {
  const url = `${baseURL.replace(/\/$/, '')}/chat/generate-stream`;
  const sse = parseSseStream(
    url,
    { prompt, locale: opts.locale || 'de' },
    { ...opts, onTools: (tools) => opts.onChunk?.(`\n🔧 ${tools?.join(', ')}\n`) }
  );
  return withHandle(sse, (data) => normalizeStreamResult(data));
}

/** SSE equipment / Q&A stream. */
export function streamChatQa(prompt, opts = {}) {
  const url = `${baseURL.replace(/\/$/, '')}/chat/qa-stream`;
  const sse = parseSseStream(
    url,
    { prompt, locale: opts.locale || 'de' },
    opts
  );
  return withHandle(sse, (data) => ({
    text: data.message || '',
    requestMode: data.requestMode || 'qa',
    usage: data.usage,
  }));
}

function normalizeStreamResult(data) {
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
    return {
      ...out,
      text: data.message,
      requestMode: data.requestMode || 'qa',
      usage: data.usage,
    };
  }
  return { ...out, ...data };
}

/** Best-effort server-side abort using a known streamId. */
export async function abortChatStream(streamId) {
  if (!streamId) return;
  try {
    await api.post(`/chat/abort/${streamId}`);
  } catch {
    /* ignore network errors */
  }
}
