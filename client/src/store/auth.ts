import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '../constants';

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
    accessToken: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN_KEY),
    role: (localStorage.getItem(STORAGE_KEYS.USER_ROLE_KEY) as Role) || null,
    email: localStorage.getItem(STORAGE_KEYS.USER_EMAIL_KEY),
    demo: localStorage.getItem(STORAGE_KEYS.DEMO_MODE_KEY) === '1',
  };
  // Clear legacy tokens to avoid cross-tab collisions; new sessions live in sessionStorage.
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN_KEY);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN_KEY);
  localStorage.removeItem(STORAGE_KEYS.USER_ROLE_KEY);
  localStorage.removeItem(STORAGE_KEYS.USER_EMAIL_KEY);
  localStorage.removeItem(STORAGE_KEYS.DEMO_MODE_KEY);
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
            localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN_KEY);
            localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN_KEY);
            localStorage.removeItem(STORAGE_KEYS.USER_ROLE_KEY);
            localStorage.removeItem(STORAGE_KEYS.USER_EMAIL_KEY);
            localStorage.removeItem(STORAGE_KEYS.DEMO_MODE_KEY);
            sessionStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN_KEY);
          }
          set({ accessToken: null, refreshToken: null, role: null, email: null, demo: false });
        },
      };
    },
    {
      name: STORAGE_KEYS.AUTH_TOKEN_KEY,
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
