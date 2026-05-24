import { i18n } from '@/i18n';

function extractErrorParts(err) {
  if (err?.response?.data) {
    return {
      code: err.response.data.code,
      serverMessage: err.response.data.error,
      details: err.response.data.details,
    };
  }
  return {
    code: err?.code,
    serverMessage: err?.message || err?.error,
    details: err?.details,
  };
}

/**
 * Map API/SSE error to localized summary + optional technical detail.
 */
export function resolveChatErrorPayload(err) {
  const { code, serverMessage, details: rawDetails } = extractErrorParts(err);

  let summary = null;
  if (code) {
    const key = `chat.errors.${code}`;
    const params = typeof rawDetails === 'object' && rawDetails !== null && !Array.isArray(rawDetails)
      ? rawDetails
      : {};
    const translated = i18n.global.t(key, params);
    if (translated !== key) summary = translated;
  }

  if (!summary) {
    summary =
      serverMessage ||
      i18n.global.t('chat.errors.LLM_GENERIC');
  }

  let detail = null;
  if (typeof rawDetails === 'string' && rawDetails.trim()) {
    detail = rawDetails.trim();
  } else if (
    code === 'LLM_GENERIC' &&
    serverMessage?.trim() &&
    summary.trim() !== serverMessage.trim()
  ) {
    detail = serverMessage.trim();
  }

  return { summary, detail, code: code || null };
}

/**
 * Map API/SSE `code` to localized chat error text (DE/EN via portal locale).
 */
export function resolveChatError(err) {
  const { summary, detail } = resolveChatErrorPayload(err);
  if (!detail) return summary;
  return `${summary} — ${detail}`;
}

/** Browser/proxy dropped an SSE body (common behind HTTP/2 reverse proxies). */
export function isStreamTransportError(err) {
  const msg = String(err?.message || err || '');
  return /HTTP2_PROTOCOL_ERROR|ERR_HTTP2|INCOMPLETE_CHUNKED|Failed to fetch|network error|Stream ended without result|502|Bad Gateway/i.test(
    msg
  );
}

export function resolveStreamError(payload) {
  return resolveChatErrorPayload(payload).summary;
}

export function contextTrimmedMessage(sections = []) {
  const list = Array.isArray(sections) ? sections.join(', ') : String(sections || '');
  return i18n.global.t('chat.contextTrimmed', { sections: list });
}
