import {
  StoryLabel,
  DbLabel,
  isStoryA,
  isStoryB,
  toStoryKey,
  toDbLabel,
  toApiLabel,
  toConditionLabel,
  normalizeLabel,
  safeNormalizeLabel,
  getTtsPath,
  getTtsSegmentPath,
  STORY_A_LABELS,
  STORY_B_LABELS,
} from '../utils/labelMapper';

describe('labelMapper', () => {
  describe('STORY_A_LABELS and STORY_B_LABELS', () => {
    it('should have correct A labels', () => {
      expect(STORY_A_LABELS.has('1')).toBe(true);
      expect(STORY_A_LABELS.has('H')).toBe(true);
      expect(STORY_A_LABELS.has('A')).toBe(true);
      expect(STORY_A_LABELS.has('story1')).toBe(true);
      expect(STORY_A_LABELS.has('2')).toBe(false);
    });

    it('should have correct B labels', () => {
      expect(STORY_B_LABELS.has('2')).toBe(true);
      expect(STORY_B_LABELS.has('N')).toBe(true);
      expect(STORY_B_LABELS.has('B')).toBe(true);
      expect(STORY_B_LABELS.has('story2')).toBe(true);
      expect(STORY_B_LABELS.has('1')).toBe(false);
    });
  });

  describe('isStoryA', () => {
    it.each(['1', 'H', 'A', 'story1'] as StoryLabel[])(
      'should return true for %s',
      (label) => {
        expect(isStoryA(label)).toBe(true);
      }
    );

    it.each(['2', 'N', 'B', 'story2'] as StoryLabel[])(
      'should return false for %s',
      (label) => {
        expect(isStoryA(label)).toBe(false);
      }
    );
  });

  describe('isStoryB', () => {
    it.each(['2', 'N', 'B', 'story2'] as StoryLabel[])(
      'should return true for %s',
      (label) => {
        expect(isStoryB(label)).toBe(true);
      }
    );

    it.each(['1', 'H', 'A', 'story1'] as StoryLabel[])(
      'should return false for %s',
      (label) => {
        expect(isStoryB(label)).toBe(false);
      }
    );
  });

  describe('toStoryKey', () => {
    it.each([
      ['1', 'story1'],
      ['H', 'story1'],
      ['A', 'story1'],
      ['story1', 'story1'],
      ['2', 'story2'],
      ['N', 'story2'],
      ['B', 'story2'],
      ['story2', 'story2'],
    ] as [StoryLabel, 'story1' | 'story2'][])(
      'should convert %s to %s',
      (input, expected) => {
        expect(toStoryKey(input)).toBe(expected);
      }
    );
  });

  describe('toDbLabel', () => {
    it.each([
      ['1', 'A'],
      ['H', 'A'],
      ['A', 'A'],
      ['story1', 'A'],
      ['2', 'B'],
      ['N', 'B'],
      ['B', 'B'],
      ['story2', 'B'],
    ] as [StoryLabel, DbLabel][])(
      'should convert %s to %s',
      (input, expected) => {
        expect(toDbLabel(input)).toBe(expected);
      }
    );
  });

  describe('toApiLabel', () => {
    it.each([
      ['1', '1'],
      ['H', '1'],
      ['A', '1'],
      ['story1', '1'],
      ['2', '2'],
      ['N', '2'],
      ['B', '2'],
      ['story2', '2'],
    ] as [StoryLabel, '1' | '2'][])(
      'should convert %s to %s',
      (input, expected) => {
        expect(toApiLabel(input)).toBe(expected);
      }
    );
  });

  describe('toConditionLabel', () => {
    it.each([
      ['1', 'H'],
      ['H', 'H'],
      ['A', 'H'],
      ['story1', 'H'],
      ['2', 'N'],
      ['N', 'N'],
      ['B', 'N'],
      ['story2', 'N'],
    ] as [StoryLabel, 'H' | 'N'][])(
      'should convert %s to %s',
      (input, expected) => {
        expect(toConditionLabel(input)).toBe(expected);
      }
    );
  });

  describe('normalizeLabel', () => {
    it('should normalize various A formats to A', () => {
      expect(normalizeLabel('a')).toBe('A');
      expect(normalizeLabel('A')).toBe('A');
      expect(normalizeLabel('1')).toBe('A');
      expect(normalizeLabel('h')).toBe('A');
      expect(normalizeLabel('H')).toBe('A');
      expect(normalizeLabel('story1')).toBe('A');
      expect(normalizeLabel('STORY1')).toBe('A');
    });

    it('should normalize various B formats to B', () => {
      expect(normalizeLabel('b')).toBe('B');
      expect(normalizeLabel('B')).toBe('B');
      expect(normalizeLabel('2')).toBe('B');
      expect(normalizeLabel('n')).toBe('B');
      expect(normalizeLabel('N')).toBe('B');
      expect(normalizeLabel('story2')).toBe('B');
      expect(normalizeLabel('STORY2')).toBe('B');
    });

    it('should handle whitespace', () => {
      expect(normalizeLabel('  A  ')).toBe('A');
      expect(normalizeLabel('  B  ')).toBe('B');
    });

    it('should throw for invalid labels', () => {
      expect(() => normalizeLabel('C')).toThrow('Invalid story label: C');
      expect(() => normalizeLabel('3')).toThrow('Invalid story label: 3');
      expect(() => normalizeLabel('')).toThrow('Invalid story label: ');
      expect(() => normalizeLabel('invalid')).toThrow('Invalid story label: invalid');
    });
  });

  describe('safeNormalizeLabel', () => {
    it('should normalize valid labels', () => {
      expect(safeNormalizeLabel('A')).toBe('A');
      expect(safeNormalizeLabel('B')).toBe('B');
      expect(safeNormalizeLabel('1')).toBe('A');
      expect(safeNormalizeLabel('2')).toBe('B');
    });

    it('should return undefined for invalid inputs', () => {
      expect(safeNormalizeLabel(undefined)).toBeUndefined();
      expect(safeNormalizeLabel(null)).toBeUndefined();
      expect(safeNormalizeLabel('')).toBeUndefined();
      expect(safeNormalizeLabel('invalid')).toBeUndefined();
    });
  });

  describe('getTtsPath', () => {
    it('should generate correct TTS paths', () => {
      expect(getTtsPath('exp123', 'A')).toBe('/static/audio/exp123/H.mp3');
      expect(getTtsPath('exp123', 'B')).toBe('/static/audio/exp123/N.mp3');
      expect(getTtsPath('exp456', '1')).toBe('/static/audio/exp456/H.mp3');
      expect(getTtsPath('exp456', '2')).toBe('/static/audio/exp456/N.mp3');
    });
  });

  describe('getTtsSegmentPath', () => {
    it('should generate correct TTS segment paths', () => {
      expect(getTtsSegmentPath('exp123', 'A', 0)).toBe('/static/audio/exp123/H_s0.mp3');
      expect(getTtsSegmentPath('exp123', 'A', 5)).toBe('/static/audio/exp123/H_s5.mp3');
      expect(getTtsSegmentPath('exp123', 'B', 0)).toBe('/static/audio/exp123/N_s0.mp3');
      expect(getTtsSegmentPath('exp123', 'B', 10)).toBe('/static/audio/exp123/N_s10.mp3');
    });
  });

  describe('bidirectional consistency', () => {
    it('should maintain consistency across all transformations', () => {
      const aLabels: StoryLabel[] = ['1', 'H', 'A', 'story1'];
      const bLabels: StoryLabel[] = ['2', 'N', 'B', 'story2'];

      // All A labels should produce consistent results
      aLabels.forEach((label) => {
        expect(toDbLabel(label)).toBe('A');
        expect(toStoryKey(label)).toBe('story1');
        expect(toApiLabel(label)).toBe('1');
        expect(toConditionLabel(label)).toBe('H');
        expect(isStoryA(label)).toBe(true);
        expect(isStoryB(label)).toBe(false);
      });

      // All B labels should produce consistent results
      bLabels.forEach((label) => {
        expect(toDbLabel(label)).toBe('B');
        expect(toStoryKey(label)).toBe('story2');
        expect(toApiLabel(label)).toBe('2');
        expect(toConditionLabel(label)).toBe('N');
        expect(isStoryA(label)).toBe(false);
        expect(isStoryB(label)).toBe(true);
      });
    });
  });
});
