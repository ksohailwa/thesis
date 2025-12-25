/**
 * Parse bold markers (**word**) from LLM-generated story paragraphs.
 * Extracts target words and their positions for tracking occurrences.
 */

export interface ParsedOccurrence {
  word: string;
  paragraphIndex: number;
  sentenceIndex: number;
  charStart: number;
  charEnd: number;
}

export interface ParseResult {
  cleanParagraphs: string[];
  occurrences: ParsedOccurrence[];
}

export function parseBoldMarkers(rawParagraphs: string[]): ParseResult {
  const cleanParagraphs: string[] = [];
  const occurrences: ParsedOccurrence[] = [];

  rawParagraphs.forEach((rawPara, paraIdx) => {
    let cleanPara = '';
    let sentenceIdx = 0;

    // First try: Match **word** pattern
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    while ((match = boldRegex.exec(rawPara)) !== null) {
      const word = match[1].trim();
      const boldStart = match.index;
      const boldEnd = match.index + match[0].length;

      // Add text before bold marker
      const textBefore = rawPara.slice(lastIndex, boldStart);
      cleanPara += textBefore;
      const charStartInPara = cleanPara.length;

      // Add word without markers
      cleanPara += word;
      const charEndInPara = cleanPara.length;

      // Count sentence index by periods in text before this word
      const textUpToBold = rawPara.slice(0, boldStart);
      sentenceIdx = (textUpToBold.match(/\./g) || []).length;

      occurrences.push({
        word,
        paragraphIndex: paraIdx,
        sentenceIndex: sentenceIdx,
        charStart: charStartInPara,
        charEnd: charEndInPara,
      });

      lastIndex = boldEnd;
    }

    // Add remaining text after last bold marker
    cleanPara += rawPara.slice(lastIndex);
    cleanParagraphs.push(cleanPara);
  });

  return { cleanParagraphs, occurrences };
}
