export function sanitizeText(text: string): string {
  return String(text || '')
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, 10000);
}

export function sanitizeTitle(title: string): string {
  return sanitizeText(title).slice(0, 200);
}

export function sanitizeWordList(words: string[]): string[] {
  return (words || [])
    .map((w) => sanitizeText(w).slice(0, 50))
    .filter((w) => w.length > 0 && /^[a-zA-Z\\s-]+$/.test(w))
    .slice(0, 10);
}
