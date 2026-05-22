/** Simple line diff for prompt editor (Myers-lite: LCS-based). */

export function diffLines(oldText, newText) {
  const a = (oldText || '').split('\n');
  const b = (newText || '').split('\n');
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', line: a[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'remove', line: a[i], oldLine: i + 1, newLine: null });
      i += 1;
    } else {
      rows.push({ type: 'add', line: b[j], oldLine: null, newLine: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    rows.push({ type: 'remove', line: a[i], oldLine: i + 1, newLine: null });
    i += 1;
  }
  while (j < m) {
    rows.push({ type: 'add', line: b[j], oldLine: null, newLine: j + 1 });
    j += 1;
  }
  return rows;
}
