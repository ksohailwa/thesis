import create from 'zustand';

interface GamifyState {
  xp: number;
  streak: number; // consecutive no-hint completions
  totalTasks: number;
  completedTasks: number;
  reset: () => void;
  addXP: (n: number) => void;
  bumpStreak: (noHint: boolean) => void;
  markTaskDone: () => void;
}

export const useGamify = create<GamifyState>((set) => ({
  xp: 0,
  streak: 0,
  totalTasks: 0,
  completedTasks: 0,
  reset: () => set({ xp: 0, streak: 0, totalTasks: 0, completedTasks: 0 }),
  addXP: (n) => set((s) => ({ xp: s.xp + Math.max(0, Math.floor(n)) })),
  bumpStreak: (noHint) => set((s) => ({ streak: noHint ? s.streak + 1 : 0 })),
  markTaskDone: () => set((s) => ({ completedTasks: Math.min(s.totalTasks, s.completedTasks + 1) })),
}));

