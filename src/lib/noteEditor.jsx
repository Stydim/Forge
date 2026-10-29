import { useRef } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { ListItem, ListKit } from '@tiptap/extension-list';
import {
  Bold, CheckSquare, Highlighter, Italic, List, ListOrdered, Minus, Paperclip, Strikethrough, UnderlineIcon,
} from 'lucide-react';
import { uploadNoteImage } from './api';

// Shared TipTap setup for the notes (ported from Sanct): the same extensions,
// paste/copy cleanup, toolbar and emoji row in the inline editor and the modal.

// One paragraph per list item, so wrapping lines in a list makes separate items.
const SingleParaListItem = ListItem.extend({ content: 'paragraph' });

export const noteExtensions = () => [
  StarterKit.configure({ bulletList: false, orderedList: false, listItem: false, listKeymap: false }),
  Highlight.configure({ multicolor: false }),
  ListKit.configure({ listItem: false, taskItem: { nested: true } }),
  SingleParaListItem,
  Image.configure({ inline: false }),
];

// Pasted HTML keeps its structure but loses foreign spacing, colours and fonts;
// copied text carries tight spacing so it pastes cleanly elsewhere.
export const noteEditorProps = (extraEvents = {}) => ({
  attributes: { class: 'note-editor-area' },
  transformPastedHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('*').forEach((el) => {
      for (const prop of ['margin', 'marginTop', 'marginBottom', 'padding', 'paddingTop', 'paddingBottom',
        'lineHeight', 'background', 'backgroundColor', 'color', 'fontSize', 'fontFamily']) el.style[prop] = '';
    });
    return div.innerHTML;
  },
  transformPastedText: (text) => text.replace(/\n{3,}/g, '\n\n'),
  handleDOMEvents: {
    ...extraEvents,
    copy(_view, event) {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return false;
      const div = document.createElement('div');
      div.appendChild(sel.getRangeAt(0).cloneContents());
      div.querySelectorAll('p, li, h1, h2, h3, ul, ol').forEach((el) => {
        el.style.margin = '0';
        el.style.padding = '0';
        el.style.lineHeight = '1.4';
      });
      event.clipboardData.setData('text/html', div.innerHTML);
      event.clipboardData.setData('text/plain', sel.toString());
      event.preventDefault();
      return true;
    },
  },
});

// Legacy plain-text notes become paragraphs.
export const toHtml = (raw) => {
  if (!raw) return '';
  return raw.startsWith('<') ? raw : raw.split('\n').map((l) => `<p>${l || '<br>'}</p>`).join('');
};

export const NOTE_EMOJIS = ['⭐', '🔥', '💡', '✅', '📌', '🎯', '✨', '💪', '🚀', '❤️', '👍', '⚠️', '💰', '🏆', '🎉', '💬', '🔑', '🌱', '🎨', '📊', '🔍', '💎'];

// Scales an image down to 900px and uploads it; falls back to inline base64.
async function uploadImage(file) {
  const { blob, dataUrl } = await new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => resolve({ blob: b, dataUrl: canvas.toDataURL('image/jpeg', 0.72) }), 'image/jpeg', 0.72);
    };
    img.src = url;
  });
  try { return await uploadNoteImage(blob); } catch { return dataUrl; }
}

function ToolBtn({ onClick, active, title, children }) {
  return (
    <button type="button" className={`note-tool${active ? ' active' : ''}`} title={title} onMouseDown={(e) => { e.preventDefault(); onClick(); }}>
      {children}
    </button>
  );
}

// Formatting toolbar; `big` is the modal's larger variant (with strikethrough).
export function NoteToolbar({ editor, big }) {
  const fileRef = useRef(null);
  if (!editor) return null;
  const size = big ? 16 : 14;
  const chain = () => editor.chain().focus();
  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { chain().insertContent(`📎 ${file.name}`).run(); return; }
    const src = await uploadImage(file);
    chain().setImage({ src, alt: file.name }).run();
  };
  return (
    <div className={`note-toolbar${big ? ' big' : ''}`}>
      <ToolBtn onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')} title="Жирный (Ctrl+B)"><Bold size={size} /></ToolBtn>
      <ToolBtn onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')} title="Курсив (Ctrl+I)"><Italic size={size} /></ToolBtn>
      <ToolBtn onClick={() => chain().toggleUnderline().run()} active={editor.isActive('underline')} title="Подчёркнутый (Ctrl+U)"><UnderlineIcon size={size} /></ToolBtn>
      {big && <ToolBtn onClick={() => chain().toggleStrike().run()} active={editor.isActive('strike')} title="Зачёркнутый"><Strikethrough size={size} /></ToolBtn>}
      {big && <span className="note-tool-sep" />}
      <ToolBtn onClick={() => chain().toggleHighlight().run()} active={editor.isActive('highlight')} title="Маркер"><Highlighter size={size} /></ToolBtn>
      <span className="note-tool-sep" />
      <ToolBtn onClick={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Список"><List size={size} /></ToolBtn>
      <ToolBtn onClick={() => chain().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Нумерованный список"><ListOrdered size={size} /></ToolBtn>
      <ToolBtn onClick={() => chain().toggleTaskList().run()} active={editor.isActive('taskList')} title="Чек-лист"><CheckSquare size={size} /></ToolBtn>
      <span className="note-tool-sep" />
      <ToolBtn onClick={() => chain().setHorizontalRule().run()} title="Разделитель"><Minus size={size} /></ToolBtn>
      <ToolBtn onClick={() => fileRef.current?.click()} title="Вставить изображение"><Paperclip size={size} /></ToolBtn>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}

// Emoji row; `onPick` decides where the emoji goes (editor or title).
export function NoteEmojiRow({ onPick, twoRows }) {
  const rows = twoRows ? [NOTE_EMOJIS.slice(0, 11), NOTE_EMOJIS.slice(11)] : [NOTE_EMOJIS];
  return (
    <div className={`note-emoji-row${twoRows ? ' two' : ''}`}>
      {rows.map((row, i) => (
        <div key={i}>
          {row.map((em) => (
            <button key={em} type="button" onMouseDown={(e) => { e.preventDefault(); onPick(em); }}>{em}</button>
          ))}
        </div>
      ))}
    </div>
  );
}
