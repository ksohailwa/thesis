import api from '../lib/api';
import { useAuth } from '../store/auth';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/spellwise.png';
import { Button } from '../components/ui/Button';

export default function DemoLogin() {
  const setAuth = useAuth(s => s.setAuth);
  const nav = useNavigate();

  async function enter() {
    const { data } = await api.post('/api/auth/demo');
    setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken || null, role: data.role, email: data.email, demo: true });
    nav('/student/join');
  }

  return (
    <div className="focus-card text-center">
      <img src={logo} alt="SpellWise" className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary-50 p-1 object-contain" />
      <h1 className="text-xl font-semibold mb-2 text-neutral-900">SpellWise Demo</h1>
      <p className="text-sm text-neutral-600 mb-4">Try SpellWise without an account. Your progress will not be saved.</p>
      <Button className="w-full" onClick={enter}>Enter Demo</Button>
    </div>
  );
}

