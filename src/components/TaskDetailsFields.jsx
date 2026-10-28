import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  CATEGORY_COLORS, CATEGORY_ICONS, EMOJIS, PRIORITIES, TAG_COLORS, newChecklistItem,
} from '../lib/taskDetails';

// Quick-insert emoji row: puts the emoji at the caret of whichever field
// (title or description) was focused last. onMouseDown + preventDefault so
// the field keeps its focus and caret.
export function EmojiRow({ onPick }) {
  return (
    <div className="td-emoji-row" role="toolbar" aria-label="Смайлики">
      {EMOJIS.map((em) => (
        <button key={em} type="button" className="td-emoji" onMouseDown={(e) => { e.preventDefault(); onPick(em); }}>
          {em}
        </button>
      ))}
    </div>
  );
}

export function PriorityPicker({ value, onChange }) {
  return (
    <div className="td-priority-row">
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          type="button"
          className={`td-priority${value === p.value ? ' active' : ''}`}
          style={{ '--prio': p.color }}
          onClick={() => onChange(p.value)}
        >
          <span className="td-dot" style={{ background: p.color }} />
          {p.label}
        </button>
      ))}
    </div>
  );
}

// Inline editor for a category (new or existing): name, emoji icon, colour.
export function CategoryEditor({ initial, onSave, onDelete, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [icon, setIcon] = useState(initial?.icon || '📦');
  const [color, setColor] = useState(initial?.color || CATEGORY_COLORS[1]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try { await onSave({ name: name.trim(), icon, color }); } finally { setBusy(false); }
  };

  return (
    <div className="td-panel">
      <div className="td-panel-row">
        <span className="td-cat-preview" style={{ background: color }}>{icon}</span>
        <input
          className="task-modal-input td-panel-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
          placeholder="Название категории"
          autoFocus
          maxLength={40}
        />
      </div>
      <div className="td-icon-grid">
        {CATEGORY_ICONS.map((ic) => (
          <button key={ic} type="button" className={`td-icon${icon === ic ? ' active' : ''}`} onClick={() => setIcon(ic)}>{ic}</button>
        ))}
      </div>
      <div className="td-color-row">
        {CATEGORY_COLORS.map((c) => (
          <button key={c} type="button" className={`td-color${color === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label="Цвет" />
        ))}
      </div>
      {confirmDelete ? (
        <div className="td-panel-actions">
          <span className="td-panel-warn">Удалить категорию? Задачи останутся, но без категории.</span>
          <button type="button" className="task-modal-btn-small" onClick={() => setConfirmDelete(false)}>Нет</button>
          <button type="button" className="task-modal-btn-small danger" onClick={onDelete}>Удалить</button>
        </div>
      ) : (
        <div className="td-panel-actions">
          {onDelete && (
            <button type="button" className="task-modal-delete-btn" onClick={() => setConfirmDelete(true)} aria-label="Удалить категорию">
              <Trash2 size={15} />
            </button>
          )}
          <span className="td-spacer" />
          <button type="button" className="task-modal-btn-small" onClick={onCancel}>Отмена</button>
          <button type="button" className="task-modal-btn-small primary" onClick={save} disabled={!name.trim() || busy}>
            {initial ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      )}
    </div>
  );
}

// Category chips (one or none selected) with create / edit in place.
export function CategoryPicker({ categories, value, onChange, meta }) {
  const [editing, setEditing] = useState(null); // 'new' | category
  return (
    <>
      <div className="td-chip-row">
        <button type="button" className={`td-chip${!value ? ' active' : ''}`} onClick={() => onChange(null)}>Без категории</button>
        {categories.map((c) => (
          <span key={c.id} className="td-chip-wrap">
            <button
              type="button"
              className={`td-chip${value === c.id ? ' active' : ''}`}
              style={value === c.id ? { background: c.color, borderColor: c.color, color: '#fff' } : { borderColor: c.color }}
              onClick={() => onChange(value === c.id ? null : c.id)}
            >
              <span>{c.icon}</span> {c.name}
            </button>
            <button type="button" className="td-chip-edit" onClick={() => setEditing(c)} aria-label={`Изменить «${c.name}»`}>
              <Pencil size={11} />
            </button>
          </span>
        ))}
        <button type="button" className="td-chip td-chip-add" onClick={() => setEditing('new')} aria-label="Новая категория">
          <Plus size={14} />
        </button>
      </div>
      {editing && (
        <CategoryEditor
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={async (fields) => {
            if (editing === 'new') {
              const cat = await meta.addCategory(fields);
              onChange(cat.id);
            } else {
              await meta.updateCategory(editing.id, fields);
            }
            setEditing(null);
          }}
          onDelete={editing === 'new' ? null : async () => {
            await meta.deleteCategory(editing.id);
            if (value === editing.id) onChange(null);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

// Tag pills (any number selected) with create / rename+recolour / delete.
export function TagPicker({ tags, value, onChange, meta }) {
  const [form, setForm] = useState(null); // { id?, name, color }
  const [busy, setBusy] = useState(false);
  const selected = new Set(value);
  const toggle = (name) => onChange(selected.has(name) ? value.filter((n) => n !== name) : [...value, name]);

  const save = async () => {
    const name = form.name.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      if (form.id) {
        const before = tags.find((t) => t.id === form.id);
        const tag = await meta.updateTag(form.id, { name, color: form.color });
        if (before && before.name !== tag.name && selected.has(before.name)) {
          onChange(value.map((n) => (n === before.name ? tag.name : n)));
        }
      } else {
        const tag = await meta.addTag({ name, color: form.color });
        if (!selected.has(tag.name)) onChange([...value, tag.name]);
      }
      setForm(null);
    } finally { setBusy(false); }
  };

  const remove = async () => {
    const tag = tags.find((t) => t.id === form.id);
    await meta.deleteTag(form.id);
    if (tag) onChange(value.filter((n) => n !== tag.name));
    setForm(null);
  };

  return (
    <>
      <div className="td-chip-row">
        {tags.map((t) => {
          const on = selected.has(t.name);
          return (
            <span key={t.id} className="td-chip-wrap">
              <button
                type="button"
                className={`td-chip td-tag${on ? ' active' : ''}`}
                style={on ? { background: t.color, borderColor: t.color, color: '#fff' } : { borderColor: t.color, color: t.color }}
                onClick={() => toggle(t.name)}
              >
                {t.name}
              </button>
              <button type="button" className="td-chip-edit" onClick={() => setForm({ id: t.id, name: t.name, color: t.color })} aria-label={`Изменить тег «${t.name}»`}>
                <Pencil size={11} />
              </button>
            </span>
          );
        })}
        <button type="button" className="td-chip td-chip-add" onClick={() => setForm({ name: '', color: TAG_COLORS[0] })} aria-label="Новый тег">
          <Plus size={14} />
        </button>
      </div>
      {form && (
        <div className="td-panel">
          <input
            className="task-modal-input td-panel-input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') setForm(null); }}
            placeholder="Название тега"
            autoFocus
            maxLength={30}
          />
          <div className="td-color-row">
            {TAG_COLORS.map((c) => (
              <button key={c} type="button" className={`td-color${form.color === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setForm((f) => ({ ...f, color: c }))} aria-label="Цвет" />
            ))}
          </div>
          <div className="td-panel-actions">
            {form.id && (
              <button type="button" className="task-modal-delete-btn" onClick={remove} aria-label="Удалить тег" title="Удалить тег из всех задач">
                <Trash2 size={15} />
              </button>
            )}
            <span className="td-spacer" />
            <button type="button" className="task-modal-btn-small" onClick={() => setForm(null)}>Отмена</button>
            <button type="button" className="task-modal-btn-small primary" onClick={save} disabled={!form.name.trim() || busy}>
              {form.id ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Free-form checklist ("подзадачи" in Sanct): add, tick, rename, remove.
export function ChecklistEditor({ items, onChange }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...items, newChecklistItem(t)]);
    setDraft('');
  };
  const done = items.filter((i) => i.done).length;
  return (
    <div className="td-checklist">
      {items.length > 0 && <div className="td-checklist-count">{done} из {items.length}</div>}
      {items.map((it) => (
        <div key={it.id} className={`td-check-item${it.done ? ' done' : ''}`}>
          <button
            type="button"
            className="td-check-box"
            onClick={() => onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
            aria-label={it.done ? 'Снять отметку' : 'Отметить выполненным'}
          >
            {it.done && <Check size={13} />}
          </button>
          <input
            className="td-check-input"
            value={it.title}
            onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
          />
          <button type="button" className="td-check-remove" onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label="Удалить пункт">
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="td-check-add">
        <input
          className="task-modal-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Добавить пункт"
        />
        <button type="button" className="task-modal-counter-btn" onClick={add} aria-label="Добавить пункт"><Plus size={16} /></button>
      </div>
    </div>
  );
}
