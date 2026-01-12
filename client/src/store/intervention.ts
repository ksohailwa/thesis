import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface WordMetadata {
  word: string;
  definition: string;
  partOfSpeech: string;
  distractorDefinitions: string[];
  commonCollocations: string[];
  exampleSentences: string[];
  syllables: string[];
}

interface InterventionState {
  // State
  isActive: boolean;
  interventionId: string | null;
  targetWord: string | null;
  wordMetadata: WordMetadata | null;
  currentExercise: 1 | 2 | 3;
  mcqCompleted: boolean;
  jumbleCompleted: boolean;
  sentenceCompleted: boolean;
  selectedBaseWord: string | null;

  // Context for API calls
  experimentId: string | null;
  storyLabel: 'A' | 'B' | null;
  occurrenceIndex: number | null;
  paragraphIndex: number | null;

  // Actions
  startIntervention: (params: {
    interventionId: string;
    targetWord: string;
    wordMetadata: WordMetadata;
    experimentId: string;
    storyLabel: 'A' | 'B';
    occurrenceIndex: number;
    paragraphIndex: number;
    currentExercise?: 1 | 2 | 3;
    mcqCompleted?: boolean;
    jumbleCompleted?: boolean;
    sentenceCompleted?: boolean;
  }) => void;
  setCurrentExercise: (exercise: 1 | 2 | 3) => void;
  completeMCQ: () => void;
  completeJumble: () => void;
  completeSentence: () => void;
  setSelectedBaseWord: (word: string) => void;
  finishIntervention: () => void;
  reset: () => void;
}

const initialState = {
  isActive: false,
  interventionId: null,
  targetWord: null,
  wordMetadata: null,
  currentExercise: 1 as const,
  mcqCompleted: false,
  jumbleCompleted: false,
  sentenceCompleted: false,
  selectedBaseWord: null,
  experimentId: null,
  storyLabel: null,
  occurrenceIndex: null,
  paragraphIndex: null,
};

export const useIntervention = create<InterventionState>()(
  persist(
    (set, _get) => ({
      ...initialState,

      startIntervention: (params) => {
        set({
          isActive: true,
          interventionId: params.interventionId,
          targetWord: params.targetWord,
          wordMetadata: params.wordMetadata,
          experimentId: params.experimentId,
          storyLabel: params.storyLabel,
          occurrenceIndex: params.occurrenceIndex,
          paragraphIndex: params.paragraphIndex,
          currentExercise: params.currentExercise || 1,
          mcqCompleted: params.mcqCompleted || false,
          jumbleCompleted: params.jumbleCompleted || false,
          sentenceCompleted: params.sentenceCompleted || false,
          selectedBaseWord: params.wordMetadata.commonCollocations[0] || 'make',
        });
      },

      setCurrentExercise: (exercise) => {
        set({ currentExercise: exercise });
      },

      completeMCQ: () => {
        set({ mcqCompleted: true, currentExercise: 2 });
      },

      completeJumble: () => {
        set({ jumbleCompleted: true, currentExercise: 3 });
      },

      completeSentence: () => {
        set({ sentenceCompleted: true });
      },

      setSelectedBaseWord: (word) => {
        set({ selectedBaseWord: word });
      },

      finishIntervention: () => {
        set(initialState);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'spellwise-intervention',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : (undefined as any)
      ),
      partialize: (state) => ({
        isActive: state.isActive,
        interventionId: state.interventionId,
        targetWord: state.targetWord,
        wordMetadata: state.wordMetadata,
        currentExercise: state.currentExercise,
        mcqCompleted: state.mcqCompleted,
        jumbleCompleted: state.jumbleCompleted,
        sentenceCompleted: state.sentenceCompleted,
        selectedBaseWord: state.selectedBaseWord,
        experimentId: state.experimentId,
        storyLabel: state.storyLabel,
        occurrenceIndex: state.occurrenceIndex,
        paragraphIndex: state.paragraphIndex,
      }),
    }
  )
);
