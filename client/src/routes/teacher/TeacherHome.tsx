import { useNavigate } from 'react-router-dom';

export default function TeacherHome() {
  const nav = useNavigate();
  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="grid md:grid-cols-2 gap-4">
        <button className="p-6 bg-white rounded border shadow hover:shadow-md transition-all" onClick={()=>nav('/teacher/create')}>
          <div className="text-lg font-semibold text-gray-900">Create Experiment</div>
        </button>
        <button className="p-6 bg-white rounded border shadow hover:shadow-md transition-all" onClick={()=>nav('/teacher/experiments')}>
          <div className="text-lg font-semibold text-gray-900">My Experiments</div>
        </button>
      </div>
    </div>
  );
}
