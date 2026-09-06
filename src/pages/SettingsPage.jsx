import { Check } from 'lucide-react';
import { BACKGROUNDS } from '../lib/backgrounds';

export default function SettingsPage({ backgroundId, onSelectBackground }) {
  return (
    <div className="settings-page">
      <div className="page-date">НАСТРОЙКИ</div>
      <h1 className="page-heading">Как всё выглядит</h1>
      <p className="characters-subtitle">
        Фон появляется за карточками — сами задачи и цели остаются на непрозрачных панелях.
      </p>

      <div className="bg-grid">
        <button
          className={`bg-option bg-option-none${backgroundId === 'none' ? ' selected' : ''}`}
          onClick={() => onSelectBackground('none')}
        >
          {backgroundId === 'none' && <span className="bg-option-check"><Check size={18} /></span>}
          <span className="bg-option-label">Без фона</span>
        </button>

        {BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            className={`bg-option${backgroundId === bg.id ? ' selected' : ''}`}
            style={{ backgroundImage: `url(${bg.url})` }}
            onClick={() => onSelectBackground(bg.id)}
          >
            {backgroundId === bg.id && <span className="bg-option-check"><Check size={18} /></span>}
            <span className="bg-option-label">{bg.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
