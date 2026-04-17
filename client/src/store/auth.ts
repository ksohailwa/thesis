import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '../constants';

type Role = 'teacher' | 'student' | null;

// Check for saved student session in localStorage (survives page refresh)
// Returns the session data if valid, null otherwise
const loadStudentSessionFromStorage = (): { accessToken?: string; refreshToken?: string; username?: string } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('spellwise-student-session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.assignmentId) return null;
    // Check if session is fresh (< 12 hours)
    if (Date.now() - parsed.savedAt >= 12 * 60 * 60 * 1000) {
      localStorage.removeItem('spellwise-student-session');
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      username: parsed.username,
    };
  } catch {
    return null;
  }
};

interface AuthState {
  accessToken: string | null;
  refreshToken?: string | null;
  role: Role;
  username: string | null;
  setAuth: (a: { accessToken: string; refreshToken?: string | null; role: Exclude<Role, null>; username?: string }) => void;
  clear: () => void;
  hydrated: boolean;
  setHydrated: (ready: boolean) => void;
}

// Legacy localStorage keys were used before Zustand persistence. This keeps logins alive after refresh.
const loadLegacy = () => {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null as string | null, role: null as Role, username: null };
  const legacy = {
    accessToken: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN_KEY),
    role: (localStorage.getItem(STORAGE_KEYS.USER_ROLE_KEY) as Role) || null,
    username: localStorage.getItem(STORAGE_KEYS.USER_EMAIL_KEY), // legacy key reused
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
        username: legacy.username,
        hydrated: false,
        setHydrated: (ready: boolean) => set({ hydrated: ready }),
        setAuth: (a) => {
          set({
            accessToken: a.accessToken,
            refreshToken: a.refreshToken,
            role: a.role,
            username: a.username || null,
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
          set({ accessToken: null, refreshToken: null, role: null, username: null });
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
        username: state.username,
      }),
      onRehydrateStorage: () => (state) => {
        // If no role found in sessionStorage, check for saved student session in localStorage
        if (state && !state.role) {
          const savedSession = loadStudentSessionFromStorage();
          if (savedSession) {
            // Restore student auth state with real tokens from localStorage
            state.setAuth({
              accessToken: savedSession.accessToken || 'student-session',
              refreshToken: savedSession.refreshToken || null,
              role: 'student',
              username: savedSession.username || 'student',
            });
          }
        }
        // Ensure the app waits for hydration before gating routes.
        state?.setHydrated(true);
      },
    }
  )
);
