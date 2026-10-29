import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { NoteEmojiRow, NoteToolbar, noteEditorProps, noteExtensions, toHtml } from '../lib/noteEditor';

// Edits the selected note in place (ported from Sanct): changes are saved
// 0.7 s after typing stops, and a pending save is flushed when another note
// is opened or the editor unmounts.
export default function NoteInlineEditor({ note, onSave }) {
  const saveTimer = useRef(null);
  const noteId = useRef(note.id);
  const dirty = useRef(false);
  const resetting = useRef(false);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  const editor = useEditor({
    extensions: noteExtensions(),
    content: toHtml(note.content),
    editorProps: noteEditorProps(),
    onUpdate({ editor: ed }) {
      if (resetting.current) return;
      dirty.current = true;
      const id = noteId.current;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        dirty.current = false;
        saveRef.current(id, ed.getHTML());
      }, 700);
    },
  });

  const flush = () => {
    clearTimeout(saveTimer.current);
    if (dirty.current && editor && !editor.isDestroyed) {
      dirty.current = false;
      saveRef.current(noteId.current, editor.getHTML());
    }
  };

  // Another note opened: save the previous one, load the new content.
  useEffect(() => {
    if (!editor || noteId.current === note.id) return;
    flush();
    noteId.current = note.id;
    resetting.current = true;
    editor.commands.setContent(toHtml(note.content), { emitUpdate: false });
    resetting.current = false;
  }, [note.id, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => flush(), [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;
  return (
    <div className="note-inline">
      <NoteToolbar editor={editor} />
      <NoteEmojiRow twoRows onPick={(em) => editor.chain().focus().insertContent(em).run()} />
      <div className="note-inline-body">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
