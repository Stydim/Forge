import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { READER_FONTS, READER_COLORS, MIN_SIZE, MAX_SIZE } from '../lib/readerSettings';

function FontAndColor({ title, fontId, colorId, onFont, onColor }) {
  return (
    <div className="reader-settings-group">
      <div className="reader-settings-label">{title}</div>
      <div className="reader-settings-fonts">
        {READER_FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`reader-settings-font${fontId === f.id ? ' active' : ''}`}
            style={{ fontFamily: f.css }}
            onClick={() => onFont(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="reader-settings-colors">
        {READER_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`reader-settings-color${colorId === c.id ? ' active' : ''}`}
            style={{ background: c.css }}
            onClick={() => onColor(c.id)}
            aria-label={c.label}
            title={c.label}
          />
        ))}
      </div>
    </div>
  );
}

// "Aa" toolbar button + popover with size, font and colour choices.
export default function ReaderSettingsPanel({ settings, update, reset }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="reader-settings" ref={rootRef}>
      <button
        type="button"
        className={`reader-settings-toggle${open ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Настройки текста"
        aria-expanded={open}
      >
        Aa
      </button>
      {open && (
        <div className="reader-settings-popover" role="dialog" aria-label="Настройки текста">
          <div className="reader-settings-group">
            <div className="reader-settings-label">Размер</div>
            <div className="reader-settings-size">
              <button type="button" className="reader-nav-btn" onClick={() => update({ fontSize: settings.fontSize - 1 })} disabled={settings.fontSize <= MIN_SIZE} aria-label="Уменьшить шрифт">
                <Minus size={16} />
              </button>
              <span className="reader-settings-size-value">{settings.fontSize}</span>
              <button type="button" className="reader-nav-btn" onClick={() => update({ fontSize: settings.fontSize + 1 })} disabled={settings.fontSize >= MAX_SIZE} aria-label="Увеличить шрифт">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <FontAndColor
            title="Оригинал"
            fontId={settings.origFont}
            colorId={settings.origColor}
            onFont={(origFont) => update({ origFont })}
            onColor={(origColor) => update({ origColor })}
          />
          <FontAndColor
            title="Перевод"
            fontId={settings.trFont}
            colorId={settings.trColor}
            onFont={(trFont) => update({ trFont })}
            onColor={(trColor) => update({ trColor })}
          />
          <button type="button" className="reader-btn-ghost reader-settings-reset" onClick={reset}>Сбросить</button>
        </div>
      )}
    </div>
  );
}
