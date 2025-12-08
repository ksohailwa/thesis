import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Role = 'teacher' | 'student' | null;

interface AuthState {
  accessToken: string | null;
  refreshToken?: string | null;
  role: Role;
  email: string | null;
  demo?: boolean;
  setAuth: (a: { accessToken: string; refreshToken?: string | null; role: Exclude<Role, null>; email: string; demo?: boolean }) => void;
  clear: () => void;
  hydrated: boolean;
  setHydrated: (ready: boolean) => void;
}

// Legacy localStorage keys were used before Zustand persistence. This keeps logins alive after refresh.
const loadLegacy = () => {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null as string | null, role: null as Role, email: null, demo: false };
  const legacy = {
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    role: (localStorage.getItem('role') as Role) || null,
    email: localStorage.getItem('email'),
    demo: localStorage.getItem('demo') === '1',
  };
  // Clear legacy tokens to avoid cross-tab collisions; new sessions live in sessionStorage.
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('role');
  localStorage.removeItem('email');
  localStorage.removeItem('demo');
  return legacy;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, _get) => {
      const legacy = loadLegacy();
      return {
        accessToken: legacy.accessToken,
        refreshToken: legacy.refreshToken,
        role: legacy.role,
        email: legacy.email,
        demo: legacy.demo,
        hydrated: false,
        setHydrated: (ready: boolean) => set({ hydrated: ready }),
        setAuth: (a) => {
          set({
            accessToken: a.accessToken,
            refreshToken: a.refreshToken,
            role: a.role,
            email: a.email,
            demo: !!a.demo,
          });
        },
        clear: () => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('role');
            localStorage.removeItem('email');
            localStorage.removeItem('demo');
            sessionStorage.removeItem('spellwise-auth');
          }
          set({ accessToken: null, refreshToken: null, role: null, email: null, demo: false });
        },
      };
    },
    {
      name: 'spellwise-auth',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? sessionStorage : undefined as any)),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        role: state.role,
        email: state.email,
        demo: state.demo,
      }),
      onRehydrateStorage: () => (state) => {
        // Ensure the app waits for hydration before gating routes.
        state?.setHydrated(true);
      },
    }
  )
);
