import { useToasts } from '../store/toasts';

export default function Toaster() {
  const { toasts, remove } = useToasts();
  return (
    <div className="fixed top-3 right-3 z-[1000] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-3 py-2 rounded shadow text-white cursor-pointer pointer-events-auto ${t.type==='success' ? 'bg-emerald-600' : t.type==='error' ? 'bg-red-600' : 'bg-gray-800'}`}
          onClick={()=>remove(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
