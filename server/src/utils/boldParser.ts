/**
 * Parse bold markers (**word**) and noise markers (++word++) from LLM-generated story paragraphs.
 * Extracts target words and noise words with their positions for tracking occurrences.
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
  noiseOccurrences: ParsedOccurrence[];
}

interface MarkerMatch {
  word: string;
  start: number;
  end: number;
  type: 'target' | 'noise';
}

export function parseBoldMarkers(rawParagraphs: string[]): ParseResult {
  const cleanParagraphs: string[] = [];
  const occurrences: ParsedOccurrence[] = [];
  const noiseOccurrences: ParsedOccurrence[] = [];

  rawParagraphs.forEach((rawPara, paraIdx) => {
    // Find all markers (both target **word** and noise ++word++)
    const markers: MarkerMatch[] = [];

    // Match **word** pattern for target words
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;
    while ((match = boldRegex.exec(rawPara)) !== null) {
      markers.push({
        word: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
        type: 'target',
      });
    }

    // Match ++word++ pattern for noise words
    const noiseRegex = /\+\+([^+]+)\+\+/g;
    while ((match = noiseRegex.exec(rawPara)) !== null) {
      markers.push({
        word: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
        type: 'noise',
      });
    }

    // Sort markers by position
    markers.sort((a, b) => a.start - b.start);

    // Build clean paragraph and track occurrences
    let cleanPara = '';
    let lastIndex = 0;

    for (const marker of markers) {
      // Add text before this marker
      const textBefore = rawPara.slice(lastIndex, marker.start);
      cleanPara += textBefore;
      const charStartInPara = cleanPara.length;

      // Add word without markers
      cleanPara += marker.word;
      const charEndInPara = cleanPara.length;

      // Count sentence index by sentence-ending punctuation before this word
      const textUpToMarker = rawPara.slice(0, marker.start);
      const sentenceIdx = (textUpToMarker.match(/[.!?]+/g) || []).length;

      const occ: ParsedOccurrence = {
        word: marker.word,
        paragraphIndex: paraIdx,
        sentenceIndex: sentenceIdx,
        charStart: charStartInPara,
        charEnd: charEndInPara,
      };

      if (marker.type === 'target') {
        occurrences.push(occ);
      } else {
        noiseOccurrences.push(occ);
      }

      lastIndex = marker.end;
    }

    // Add remaining text after last marker
    cleanPara += rawPara.slice(lastIndex);
    cleanParagraphs.push(cleanPara);
  });

  return { cleanParagraphs, occurrences, noiseOccurrences };
}
