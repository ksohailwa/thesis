import { useNavigate } from 'react-router-dom';
import logoUrl from '../../assets/spellwise.png';

export default function Consent() {
  const nav = useNavigate();
  const sessionId = sessionStorage.getItem('sessionId') || '';

  function accept() {
    if (!sessionId) { nav('/student/join'); return; }
    sessionStorage.setItem(`consent:${sessionId}`, 'yes');
    nav('/student/gap-fill');
  }

  function decline() {
    sessionStorage.setItem(`consent:${sessionId}`, 'no');
    nav('/student/join');
  }

  return (
    <div className="focus-card">
      <div className="flex flex-col items-center mb-4">
        <img src={logoUrl} alt="Spell Wise" className="w-16 h-16 rounded mb-2" />
        <div className="text-xl font-semibold">Spell Wise</div>
      </div>
      <h1 className="text-xl font-semibold mb-3">Consent Form</h1>
      <p className="text-sm text-gray-700 mb-3">
        This study collects interaction data (keypresses, attempts, hints, time-on-task) to improve spelling learning.
        No sensitive personal data is collected. By proceeding, you agree to participate and allow anonymized usage of your
        interaction data for research and product improvement.
      </p>
      <ul className="list-disc pl-5 text-sm text-gray-700 mb-3">
        <li>You can pause or leave at any time.</li>
        <li>Your email is used only for authentication and session linkage.</li>
        <li>No audio recordings from your microphone are collected.</li>
      </ul>
      <div className="flex gap-2 justify-end mt-4">
        <button className="px-3 py-2 border rounded" onClick={decline}>Decline</button>
        <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={accept}>I Agree</button>
      </div>
    </div>
  );
}
