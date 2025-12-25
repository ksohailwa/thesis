import create from 'zustand';

export type Toast = { id: string; type: 'success'|'error'|'info'; message: string; timeout?: number };

type ToastState = {
  toasts: Toast[];
  add: (t: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
};

function uid() { return Math.random().toString(36).slice(2, 9); }

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  add: ({ type, message, timeout = 3000 }) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, type, message, timeout }] }));
    if (timeout) setTimeout(() => get().remove(id), timeout);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) }))
}));

export const toast = {
  success: (m: string, timeout?: number) => useToasts.getState().add({ type: 'success', message: m, timeout }),
  error: (m: string, timeout?: number) => useToasts.getState().add({ type: 'error', message: m, timeout }),
  info: (m: string, timeout?: number) => useToasts.getState().add({ type: 'info', message: m, timeout })
};

