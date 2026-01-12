import { normalizedLevenshtein, positionCorrectness } from '../utils/levenshtein';

describe('normalizedLevenshtein', () => {
  describe('exact matches', () => {
    it('should return 1 for identical strings', () => {
      expect(normalizedLevenshtein('hello', 'hello')).toBe(1);
      expect(normalizedLevenshtein('test', 'test')).toBe(1);
      expect(normalizedLevenshtein('SpellWise', 'SpellWise')).toBe(1);
    });

    it('should return 1 for empty strings', () => {
      expect(normalizedLevenshtein('', '')).toBe(1);
    });
  });

  describe('complete mismatches', () => {
    it('should return 0 for completely different strings of same length', () => {
      expect(normalizedLevenshtein('abc', 'xyz')).toBe(0);
      expect(normalizedLevenshtein('aaaa', 'zzzz')).toBe(0);
    });

    it('should return 0 when one string is empty', () => {
      expect(normalizedLevenshtein('hello', '')).toBe(0);
      expect(normalizedLevenshtein('', 'world')).toBe(0);
    });
  });

  describe('partial matches', () => {
    it('should return correct score for single character difference', () => {
      // "hello" vs "hallo" - 1 substitution in 5 chars = 1 - 1/5 = 0.8
      expect(normalizedLevenshtein('hello', 'hallo')).toBe(0.8);
    });

    it('should return correct score for insertion', () => {
      // "helo" vs "hello" - 1 insertion in 5 chars = 1 - 1/5 = 0.8
      expect(normalizedLevenshtein('helo', 'hello')).toBe(0.8);
    });

    it('should return correct score for deletion', () => {
      // "hello" vs "helo" - 1 deletion in 5 chars = 1 - 1/5 = 0.8
      expect(normalizedLevenshtein('hello', 'helo')).toBe(0.8);
    });

    it('should handle multiple differences', () => {
      // "kitten" vs "sitting" - 3 edits in 7 chars = 1 - 3/7 ≈ 0.571
      const score = normalizedLevenshtein('kitten', 'sitting');
      expect(score).toBeCloseTo(0.571, 2);
    });

    it('should handle transpositions', () => {
      // "ab" vs "ba" - 2 edits in 2 chars = 0
      expect(normalizedLevenshtein('ab', 'ba')).toBe(0);
    });
  });

  describe('case sensitivity', () => {
    it('should treat uppercase and lowercase as different', () => {
      expect(normalizedLevenshtein('Hello', 'hello')).toBe(0.8);
      expect(normalizedLevenshtein('ABC', 'abc')).toBe(0);
    });
  });

  describe('spelling mistakes common in education', () => {
    it('should score common spelling errors appropriately', () => {
      // "receive" vs "recieve" - common i/e swap
      expect(normalizedLevenshtein('receive', 'recieve')).toBeGreaterThan(0.7);

      // "necessary" vs "neccessary" - extra c
      expect(normalizedLevenshtein('necessary', 'neccessary')).toBeGreaterThan(0.8);

      // "definitely" vs "definately" - common mistake
      expect(normalizedLevenshtein('definitely', 'definately')).toBeGreaterThan(0.8);

      // "separate" vs "seperate" - common mistake
      expect(normalizedLevenshtein('separate', 'seperate')).toBeGreaterThan(0.8);
    });
  });

  describe('edge cases', () => {
    it('should handle single character strings', () => {
      expect(normalizedLevenshtein('a', 'a')).toBe(1);
      expect(normalizedLevenshtein('a', 'b')).toBe(0);
    });

    it('should handle very long strings', () => {
      const longA = 'a'.repeat(100);
      const longB = 'a'.repeat(99) + 'b';
      expect(normalizedLevenshtein(longA, longB)).toBe(0.99);
    });

    it('should handle strings with spaces', () => {
      expect(normalizedLevenshtein('hello world', 'hello world')).toBe(1);
      expect(normalizedLevenshtein('hello world', 'helloworld')).toBeLessThan(1);
    });

    it('should handle special characters', () => {
      expect(normalizedLevenshtein("don't", "don't")).toBe(1);
      expect(normalizedLevenshtein('café', 'cafe')).toBeLessThan(1);
    });
  });

  describe('score bounds', () => {
    it('should always return value between 0 and 1', () => {
      const testCases = [
        ['', ''],
        ['a', ''],
        ['', 'a'],
        ['abc', 'xyz'],
        ['hello', 'hello'],
        ['test', 'testing'],
        ['abcdefghij', 'klmnopqrst'],
      ];

      testCases.forEach(([a, b]) => {
        const score = normalizedLevenshtein(a, b);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('positionCorrectness', () => {
  describe('exact matches', () => {
    it('should return all true for identical strings', () => {
      expect(positionCorrectness('hello', 'hello')).toEqual([true, true, true, true, true]);
      expect(positionCorrectness('abc', 'abc')).toEqual([true, true, true]);
    });

    it('should return empty array for empty strings', () => {
      expect(positionCorrectness('', '')).toEqual([]);
    });
  });

  describe('partial matches', () => {
    it('should correctly identify wrong positions', () => {
      // "hello" vs "hallo" - position 1 is wrong
      expect(positionCorrectness('hello', 'hallo')).toEqual([true, false, true, true, true]);
    });

    it('should identify first character mismatch', () => {
      expect(positionCorrectness('hello', 'jello')).toEqual([false, true, true, true, true]);
    });

    it('should identify last character mismatch', () => {
      expect(positionCorrectness('hello', 'hella')).toEqual([true, true, true, true, false]);
    });

    it('should identify multiple mismatches', () => {
      expect(positionCorrectness('abc', 'xyz')).toEqual([false, false, false]);
    });
  });

  describe('different length strings', () => {
    it('should handle guess shorter than target', () => {
      // "hel" vs "hello" - positions 3 and 4 are missing (undefined !== 'l' and undefined !== 'o')
      const result = positionCorrectness('hel', 'hello');
      expect(result).toEqual([true, true, true, false, false]);
      expect(result.length).toBe(5);
    });

    it('should handle guess longer than target', () => {
      // "hello" vs "hel" - positions 3 and 4 have no target to compare
      const result = positionCorrectness('hello', 'hel');
      expect(result).toEqual([true, true, true, false, false]);
      expect(result.length).toBe(5);
    });

    it('should handle empty guess', () => {
      const result = positionCorrectness('', 'hello');
      expect(result).toEqual([false, false, false, false, false]);
      expect(result.length).toBe(5);
    });

    it('should handle empty target', () => {
      const result = positionCorrectness('hello', '');
      expect(result).toEqual([false, false, false, false, false]);
      expect(result.length).toBe(5);
    });
  });

  describe('case sensitivity', () => {
    it('should treat uppercase and lowercase as different', () => {
      expect(positionCorrectness('Hello', 'hello')).toEqual([false, true, true, true, true]);
      expect(positionCorrectness('HELLO', 'hello')).toEqual([false, false, false, false, false]);
    });
  });

  describe('educational use cases', () => {
    it('should help identify specific spelling mistakes', () => {
      // Student types "recieve" instead of "receive"
      const result = positionCorrectness('recieve', 'receive');
      // r-e-c-i-e-v-e vs r-e-c-e-i-v-e
      // positions: 0-1-2-3-4-5-6
      // 'i' at position 3 should be 'e', 'e' at position 4 should be 'i'
      expect(result[0]).toBe(true); // r
      expect(result[1]).toBe(true); // e
      expect(result[2]).toBe(true); // c
      expect(result[3]).toBe(false); // i vs e
      expect(result[4]).toBe(false); // e vs i
      expect(result[5]).toBe(true); // v
      expect(result[6]).toBe(true); // e
    });

    it('should handle missing letter at end', () => {
      // Student types "spel" instead of "spell"
      const result = positionCorrectness('spel', 'spell');
      expect(result).toEqual([true, true, true, true, false]);
    });

    it('should handle extra letter', () => {
      // Student types "spelll" instead of "spell"
      const result = positionCorrectness('spelll', 'spell');
      expect(result).toEqual([true, true, true, true, true, false]);
    });
  });

  describe('edge cases', () => {
    it('should handle single character strings', () => {
      expect(positionCorrectness('a', 'a')).toEqual([true]);
      expect(positionCorrectness('a', 'b')).toEqual([false]);
    });

    it('should handle spaces', () => {
      expect(positionCorrectness('a b', 'a b')).toEqual([true, true, true]);
      expect(positionCorrectness('ab', 'a b')).toEqual([true, false, false]);
    });

    it('should handle special characters', () => {
      expect(positionCorrectness("don't", "don't")).toEqual([true, true, true, true, true]);
      expect(positionCorrectness("dont", "don't")).toEqual([true, true, true, false, false]);
    });
  });
});
