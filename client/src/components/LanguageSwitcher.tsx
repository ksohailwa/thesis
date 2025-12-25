import i18n from 'i18next';
import { useState } from 'react';

export default function LanguageSwitcher() {
  const [lng, setLng] = useState<string>(i18n.language || 'en');
  const change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setLng(v);
    i18n.changeLanguage(v);
  };
  return (
    <select className="border px-2 py-1 rounded text-sm" value={lng} onChange={change} aria-label="Language">
      <option value="en">English</option>
      <option value="de">Deutsch</option>
    </select>
  );
}

