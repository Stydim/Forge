import { useState } from 'react';
import { Trash2 } from 'lucide-react';

const COLORS = ['#6C5CE7', '#E17055', '#00B894', '#FF6B6B', '#FDCB6E', '#0984E3', '#00CEC9', '#E84393'];

// New / edit note category (ported from Sanct). A category with active notes
// can't be deleted.
export default function NoteCategoryModal({ category, inUse, onClose, onSave, onDelete }) {
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || COLORS[0]);

  const del = () => {
    if (inUse) {
      alert('Нельзя удалить категорию, в которой есть активные заметки. Сначала удалите или переместите их.');
      return;
    }
    onDelete(category.id);
  };

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <form className="task-modal note-cat-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave({ name: name.trim(), color }); }}>
        <button type="button" className="task-modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <h2 className="task-modal-title">{category ? 'Изменить категорию' : 'Новая категория'}</h2>

        <label className="task-modal-label" htmlFor="note-cat-name">Название</label>
        <input id="note-cat-name" className="task-modal-input" placeholder="Например: Идеи для блога" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <div className="task-modal-label">Цвет</div>
        <div className="habit-color-row">
          {COLORS.map((c) => (
            <button key={c} type="button" className={`habit-color-swatch${color === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>

        <div className="task-modal-actions">
          <div className="task-modal-actions-left">
            {category && <button type="button" className="task-modal-btn-small subs-danger" onClick={del} title="Удалить"><Trash2 size={15} /></button>}
          </div>
          <div className="task-modal-actions-right">
            <button type="button" className="task-modal-btn cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="task-modal-btn save" disabled={!name.trim()}>Сохранить</button>
          </div>
        </div>
      </form>
    </div>
  );
}
