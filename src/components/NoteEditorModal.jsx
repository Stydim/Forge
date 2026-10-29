import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import { Archive, ArchiveRestore, Maximize2, Minimize2, Save, Trash2, X } from 'lucide-react';
import { NoteEmojiRow, NoteToolbar, noteEditorProps, noteExtensions, toHtml } from '../lib/noteEditor';

// New / edit note window (ported from Sanct): title, category chips, toolbar,
// emoji row (into the title or the text, whichever was focused last),
// full-screen toggle, archive and delete.
export default function NoteEditorModal({ note, categories, defaultCategory, onClose, onSave, onArchive, onDelete }) {
  const [title, setTitle] = useState(note?.title || '');
  const [category, setCategory] = useState(note?.category_id || defaultCategory || categories[0]?.id || null);
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef(null);
  const lastFocused = useRef('editor');

  const editor = useEditor({
    extensions: noteExtensions(),
    content: toHtml(note?.content),
    editorProps: noteEditorProps({ focus: () => { lastFocused.current = 'editor'; } }),
  });

  const insertEmoji = (em) => {
    const input = titleRef.current;
    if (lastFocused.current === 'title' && input) {
      const start = input.selectionStart ?? title.length;
      const end = input.selectionEnd ?? title.length;
      setTitle(title.slice(0, start) + em + title.slice(end));
      requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + em.length, start + em.length); });
    } else {
      editor?.chain().focus().insertContent(em).run();
    }
  };

  const save = () => {
    const content = editor && !editor.isEmpty ? editor.getHTML() : '';
    if (!title.trim() && !content) { onClose(); return; }
    onSave({ title, content, category_id: category });
  };

  return createPortal(
    <div className={`note-modal-overlay${fullscreen ? ' full' : ''}`} onClick={(e) => { if (!fullscreen && e.target === e.currentTarget) onClose(); }}>
      <div className="note-modal">
        <div className="note-modal-top">
          <input
            ref={titleRef}
            className="note-modal-title"
            placeholder="Заголовок..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => { lastFocused.current = 'title'; }}
            autoFocus
          />
          <button type="button" className="note-icon-btn" onClick={() => setFullscreen((v) => !v)} title={fullscreen ? 'Свернуть' : 'Во весь экран'}>
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button type="button" className="note-icon-btn" onClick={onClose} title="Закрыть"><X size={18} /></button>
        </div>

        <div className="note-modal-cats">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="note-cat-chip"
              style={{ borderColor: c.color, background: category === c.id ? c.color : 'transparent', color: category === c.id ? '#fff' : c.color }}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <NoteToolbar editor={editor} big />
        <NoteEmojiRow onPick={insertEmoji} />

        <div className="note-modal-body"><EditorContent editor={editor} /></div>

        <div className="note-modal-footer">
          <div className="note-modal-footer-left">
            {note && !confirmDelete && (
              <>
                <button type="button" className="note-icon-btn" title={note.archived ? 'Вернуть из архива' : 'В архив'} onClick={() => onArchive(note.id, !note.archived)}>
                  {note.archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
                </button>
                <button type="button" className="note-icon-btn danger" title="Удалить" onClick={() => setConfirmDelete(true)}><Trash2 size={17} /></button>
              </>
            )}
            {confirmDelete && (
              <span className="note-confirm">
                Удалить «{note.title || 'Без названия'}» насовсем?
                <button type="button" className="task-modal-btn-small subs-danger" onClick={() => onDelete(note.id)}>Да</button>
                <button type="button" className="task-modal-btn-small" onClick={() => setConfirmDelete(false)}>Нет</button>
              </span>
            )}
          </div>
          <div className="note-modal-footer-right">
            <button type="button" className="task-modal-btn cancel" onClick={onClose}>Отмена</button>
            <button type="button" className="task-modal-btn save note-save" onClick={save}><Save size={16} /> Сохранить</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
