/** Resolve a step parameter value by field name (for scale target/tolerance links). */
export function getStepParamValue(step, fieldName) {
  if (!fieldName || !step?.params) return null;
  const p = step.params.find((x) => x.name === fieldName);
  if (!p) return null;
  const raw = p.value ?? p.default_value;
  if (raw == null || raw === '') return null;
  const num = Number(String(raw).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) ? num : raw;
}

export function getMaterialInfo(step) {
  const material = step?.params?.find((p) => /material/i.test(p.name));
  const batch = step?.params?.find((p) => /charge|batch/i.test(p.name));
  return {
    number: material?.value || material?.default_value || '',
    name: material?.value || material?.default_value || '',
    batch: batch?.value || batch?.default_value || '',
  };
}

export function parseTolerancePercent(step, fieldName, fallback = 1) {
  const v = getStepParamValue(step, fieldName);
  if (v == null) return fallback;
  if (typeof v === 'number') return v;
  const s = String(v).replace('%', '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}
