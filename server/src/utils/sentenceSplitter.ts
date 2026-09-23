const NON_TERMINAL_ABBREVIATIONS = new Set([
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'st.', 'mt.', 'vs.',
  'etc.', 'no.', 'approx.', 'fig.', 'e.g.', 'i.e.',
])

function isBoundary(text: string, index: number) {
  const character = text[index]
  if (!'.!?'.includes(character)) return false
  if (index < text.length - 1 && !/\s/.test(text[index + 1])) return false

  if (character === '.') {
    const tokenStart = Math.max(text.lastIndexOf(' ', index - 1), text.lastIndexOf('\n', index - 1)) + 1
    const token = text.slice(tokenStart, index + 1).toLowerCase()
    if (NON_TERMINAL_ABBREVIATIONS.has(token)) return false
  }
  return true
}

export function splitSentences(text?: string): string[] {
  if (!text?.trim()) return []
  const sentences: string[] = []
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    if (!isBoundary(text, index)) continue
    const sentence = text.slice(start, index + 1).trim()
    if (sentence) sentences.push(sentence)
    start = index + 1
  }
  const remainder = text.slice(start).trim()
  if (remainder) sentences.push(remainder)
  return sentences.length ? sentences : [text.trim()]
}
