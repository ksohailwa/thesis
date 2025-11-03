import create from 'zustand';

type Role = 'teacher' | 'student' | null;

interface AuthState {
  accessToken: string | null;
  role: Role;
  email: string | null;
  demo?: boolean;
  setAuth: (a: { accessToken: string; role: Exclude<Role, null>; email: string; demo?: boolean }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  role: null,
  email: null,
  demo: false,
  setAuth: (a) => {
    localStorage.setItem('accessToken', a.accessToken);
    localStorage.setItem('role', a.role);
    localStorage.setItem('email', a.email);
    if (a.demo) localStorage.setItem('demo', '1'); else localStorage.removeItem('demo');
    set(a);
  },
  clear: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    localStorage.removeItem('demo');
    set({ accessToken: null, role: null, email: null, demo: false });
  }
}));
