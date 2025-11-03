export function normalizedLevenshtein(a: string, b: string): number {
  const dp: number[] = Array(b.length + 1).fill(0);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) dp[j] = prev;
      else dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = temp;
    }
  }
  const dist = dp[b.length];
  const maxLen = Math.max(a.length, b.length) || 1;
  const score = 1 - dist / maxLen;
  return Math.max(0, Math.min(1, score));
}

export function positionCorrectness(guess: string, target: string): boolean[] {
  const len = Math.max(guess.length, target.length);
  const out: boolean[] = [];
  for (let i = 0; i < len; i++) out.push(guess[i] === target[i]);
  return out;
}

