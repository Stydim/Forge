import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ChevronLeft, GripVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useNotes } from '../hooks/useNotes';
import NoteInlineEditor from '../components/NoteInlineEditor';
import NoteEditorModal from '../components/NoteEditorModal';
import NoteCategoryModal from '../components/NoteCategoryModal';
import '../notes.css';

// Notes, ported from Sanct with its three-column layout: categories | list |
// the selected note, edited in place. Columns are resizable (widths remembered
// on this device), notes and categories reorder by drag and drop.

const MIN_CAT = 140;
const MIN_LIST = 180;
const MIN_CONTENT = 200;
const ARCHIVE = '__archive';

const stored = (key, fallback) => {
  try { return Number(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};
const store = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch { /* private mode */ }
};
const dateShort = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const plain = (html) => (html || '').replace(/<[^>]+>/g, ' ');

export default function NotesPage() {
  const {
    notes, categories, loading, error,
    addNote, updateNote, deleteNote, reorderNotes,
    addCategory, updateCategory, deleteCategory, reorderCategories,
  } = useNotes();
  const [activeCategory, setActiveCategory] = useState(null); // null = all, ARCHIVE, or an id
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | note
  const [catEditing, setCatEditing] = useState(null); // null | 'new' | category
  const [confirmNote, setConfirmNote] = useState(null);

  const [noteDragOver, setNoteDragOver] = useState(null);
  const [catDragOver, setCatDragOver] = useState(null);
  const noteDragSrc = useRef(null);
  const catDragSrc = useRef(null);

  // Resizable columns, clamped to the page width.
  const containerRef = useRef(null);
  const [catWidth, setCatWidth] = useState(() => stored('forge:notes-cat-width', 200));
  const [listWidth, setListWidth] = useState(() => stored('forge:notes-list-width', 280));
  const widths = useRef({ catWidth, listWidth });
  widths.current = { catWidth, listWidth };

  useEffect(() => {
    const clamp = () => {
      const w = containerRef.current?.offsetWidth || window.innerWidth;
      const cat = Math.max(MIN_CAT, Math.min(widths.current.catWidth, w - MIN_LIST - MIN_CONTENT - 16));
      setCatWidth(cat);
      setListWidth(Math.max(MIN_LIST, Math.min(widths.current.listWidth, w - cat - MIN_CONTENT - 16)));
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, []);

  const startResize = useCallback((which, e) => {
    e.preventDefault();
    const start = { x: e.clientX, ...widths.current };
    const onMove = (ev) => {
      const dx = ev.clientX - start.x;
      const w = containerRef.current?.offsetWidth || window.innerWidth;
      if (which === 'cat') {
        const next = Math.max(MIN_CAT, Math.min(start.catWidth + dx, w - start.listWidth - MIN_CONTENT));
        setCatWidth(next);
        store('forge:notes-cat-width', next);
      } else {
        const next = Math.max(MIN_LIST, Math.min(start.listWidth + dx, w - start.catWidth - MIN_CONTENT));
        setListWidth(next);
        store('forge:notes-list-width', next);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const activeNotes = notes.filter((n) => !n.archived);
  const archivedNotes = notes.filter((n) => n.archived);
  const getCat = (id) => categories.find((c) => c.id === id);
  const selected = notes.find((n) => n.id === selectedId) || null;

  const q = query.trim().toLowerCase();
  const listNotes = (activeCategory === ARCHIVE ? archivedNotes : activeNotes)
    .filter((n) => !activeCategory || activeCategory === ARCHIVE || n.category_id === activeCategory)
    .filter((n) => !q || n.title.toLowerCase().includes(q) || plain(n.content).toLowerCase().includes(q))
    .sort((a, b) => {
      const ao = a.sort_order ?? Infinity;
      const bo = b.sort_order ?? Infinity;
      if (ao !== bo) return ao - bo;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

  const listTitle = activeCategory === ARCHIVE ? 'Архив' : activeCategory ? getCat(activeCategory)?.name : 'Все';

  const dropNote = (idx) => {
    const from = noteDragSrc.current;
    noteDragSrc.current = null;
    setNoteDragOver(null);
    if (from === null || from === idx) return;
    const ordered = [...listNotes];
    const [moved] = ordered.splice(from, 1);
    ordered.splice(idx, 0, moved);
    reorderNotes(ordered.map((n) => n.id));
  };

  const dropCategory = (idx) => {
    const from = catDragSrc.current;
    catDragSrc.current = null;
    setCatDragOver(null);
    if (from === null || from === idx) return;
    const ordered = [...categories];
    const [moved] = ordered.splice(from, 1);
    ordered.splice(idx, 0, moved);
    reorderCategories(ordered.map((c) => c.id));
  };

  const saveNote = async (fields) => {
    if (editing === 'new') {
      const row = await addNote(fields);
      if (row) setSelectedId(row.id);
    } else {
      updateNote(editing.id, fields);
    }
    setEditing(null);
  };

  const removeNote = (id) => {
    deleteNote(id);
    if (selectedId === id) setSelectedId(null);
  };

  const selectedCat = selected && getCat(selected.category_id);

  return (
    <div ref={containerRef} className={`notes-layout${selected ? ' note-selected' : ''}`}>
      {/* Left: categories */}
      <div className="notes-categories" style={{ width: catWidth, minWidth: catWidth, maxWidth: catWidth }}>
        <div className="notes-categories-header">
          <span>Категории</span>
          <button type="button" className="note-icon-btn small" title="Новая категория" onClick={() => setCatEditing('new')}><Plus size={15} /></button>
        </div>

        <div className={`notes-cat-item${activeCategory === null ? ' active' : ''}`} onClick={() => setActiveCategory(null)}>
          <span className="notes-cat-dot" style={{ background: 'var(--accent-teal)' }} />
          <span className="notes-cat-name">Все</span>
          <span className="notes-cat-count">{activeNotes.length}</span>
        </div>

        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            className={`notes-drag${catDragOver === idx ? ' over' : ''}`}
            draggable
            onDragStart={() => { catDragSrc.current = idx; }}
            onDragOver={(e) => { e.preventDefault(); setCatDragOver(idx); }}
            onDrop={(e) => { e.preventDefault(); dropCategory(idx); }}
            onDragEnd={() => { catDragSrc.current = null; setCatDragOver(null); }}
          >
            <div className={`notes-cat-item${activeCategory === cat.id ? ' active' : ''}`} onClick={() => setActiveCategory(cat.id)}>
              <GripVertical size={11} className="notes-grip" />
              <span className="notes-cat-dot" style={{ background: cat.color }} />
              <span className="notes-cat-name">{cat.name}</span>
              <span className="notes-cat-count">{activeNotes.filter((n) => n.category_id === cat.id).length}</span>
              <button type="button" className="notes-cat-edit" title="Изменить" onClick={(e) => { e.stopPropagation(); setCatEditing(cat); }}><Pencil size={11} /></button>
            </div>
          </div>
        ))}

        {archivedNotes.length > 0 && (
          <div className={`notes-cat-item notes-cat-archive${activeCategory === ARCHIVE ? ' active' : ''}`} onClick={() => setActiveCategory(ARCHIVE)}>
            <Archive size={12} />
            <span className="notes-cat-name">Архив</span>
            <span className="notes-cat-count">{archivedNotes.length}</span>
          </div>
        )}
      </div>

      <div className="notes-resize-handle" onMouseDown={(e) => startResize('cat', e)} />

      {/* Middle: notes list */}
      <div className="notes-list" style={{ width: listWidth, minWidth: listWidth, maxWidth: listWidth }}>
        <div className="notes-list-header">
          <span>{listTitle} · {listNotes.length}</span>
          <button type="button" className="notes-new-btn" onClick={() => setEditing('new')}><Plus size={15} /> Новая</button>
        </div>
        <div className="notes-search">
          <Search size={14} />
          <input placeholder="Поиск по заметкам" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {error && <div className="notes-error">Не удалось связаться с базой: {error}</div>}

        {!loading && listNotes.length === 0 ? (
          <div className="notes-empty">
            <div className="notes-empty-icon">📝</div>
            <p>Нет заметок</p>
          </div>
        ) : (
          listNotes.map((note, idx) => {
            const cat = getCat(note.category_id);
            return (
              <div
                key={note.id}
                className={`notes-drag${noteDragOver === idx ? ' over' : ''}`}
                draggable
                onDragStart={() => { noteDragSrc.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); setNoteDragOver(idx); }}
                onDrop={(e) => { e.preventDefault(); dropNote(idx); }}
                onDragEnd={() => { noteDragSrc.current = null; setNoteDragOver(null); }}
              >
                <GripVertical size={13} className="notes-grip notes-list-grip" />
                <div className={`notes-list-item${selectedId === note.id ? ' active' : ''}`} onClick={() => setSelectedId(note.id)}>
                  <div className="notes-list-row">
                    <div className="notes-list-title">{note.title || 'Без названия'}</div>
                    {cat && <span className="notes-list-tag" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.name}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="notes-resize-handle" onMouseDown={(e) => startResize('list', e)} />

      {/* Right: the selected note */}
      <div className="notes-content">
        {selected ? (
          <>
            <div className="notes-content-header">
              <button type="button" className="note-icon-btn notes-back-btn" title="Назад к списку" onClick={() => setSelectedId(null)}><ChevronLeft size={20} /></button>
              <div className="notes-content-titles">
                {selectedCat && <span className="notes-content-tag" style={{ background: `${selectedCat.color}22`, color: selectedCat.color }}>{selectedCat.name}</span>}
                <h2>{selected.title || 'Без названия'}</h2>
                <div className="notes-content-date">{dateShort(selected.updated_at)}{selected.archived && ' · в архиве'}</div>
              </div>
              <div className="notes-content-actions">
                <button type="button" className="note-icon-btn" title="Редактировать" onClick={() => setEditing(selected)}><Pencil size={16} /></button>
                <button type="button" className="note-icon-btn danger" title="Удалить" onClick={() => setConfirmNote(selected)}><Trash2 size={16} /></button>
              </div>
            </div>
            <NoteInlineEditor key={editing ? 'paused' : 'live'} note={selected} onSave={(id, content) => updateNote(id, { content })} />
          </>
        ) : (
          <div className="notes-empty full">
            <div className="notes-empty-icon">👆</div>
            <p>Выберите заметку</p>
          </div>
        )}
      </div>

      {editing && (
        <NoteEditorModal
          note={editing === 'new' ? null : editing}
          categories={categories}
          defaultCategory={activeCategory && activeCategory !== ARCHIVE ? activeCategory : null}
          onClose={() => setEditing(null)}
          onSave={saveNote}
          onArchive={(id, archived) => { updateNote(id, { archived }); setEditing(null); if (archived && selectedId === id) setSelectedId(null); }}
          onDelete={(id) => { removeNote(id); setEditing(null); }}
        />
      )}

      {catEditing && (
        <NoteCategoryModal
          category={catEditing === 'new' ? null : catEditing}
          inUse={catEditing !== 'new' && activeNotes.some((n) => n.category_id === catEditing.id)}
          onClose={() => setCatEditing(null)}
          onSave={(fields) => { if (catEditing === 'new') addCategory(fields); else updateCategory(catEditing.id, fields); setCatEditing(null); }}
          onDelete={(id) => { deleteCategory(id); if (activeCategory === id) setActiveCategory(null); setCatEditing(null); }}
        />
      )}

      {confirmNote && (
        <div className="task-modal-overlay" onClick={() => setConfirmNote(null)}>
          <div className="task-modal note-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="task-modal-title">Удалить заметку?</h2>
            <p className="task-modal-subtitle">«{confirmNote.title || 'Без названия'}» будет удалена без возможности восстановления.</p>
            <div className="task-modal-actions">
              <div className="task-modal-actions-right">
                <button type="button" className="task-modal-btn cancel" onClick={() => setConfirmNote(null)}>Отмена</button>
                <button type="button" className="task-modal-btn save" onClick={() => { removeNote(confirmNote.id); setConfirmNote(null); }}>Удалить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
