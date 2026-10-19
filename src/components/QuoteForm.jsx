import { useState } from 'react';

// Quote editor used both in the shelf frame's popover (paste a quote, pick
// its book) and in the reader's text-selection popover (text and book come
// from the selection). Choosing a book fills in its author if none is set.
export default function QuoteForm({ initialText = '', initialAuthor = '', books, bookId: fixedBookId, onSave, onCancel, autoFocus }) {
  const [text, setText] = useState(initialText);
  const [author, setAuthor] = useState(initialAuthor);
  const [bookId, setBookId] = useState(fixedBookId || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pickBook = (id) => {
    setBookId(id);
    const book = books?.find((b) => b.id === id);
    if (book?.author && !author.trim()) setAuthor(book.author);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ text: text.trim(), author: author.trim(), bookId: bookId || null });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="reader-quote-form" onSubmit={submit}>
      <textarea
        className="reader-quote-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Вставьте цитату…"
        rows={4}
        maxLength={2000}
        autoFocus={autoFocus}
        aria-label="Текст цитаты"
      />
      <input
        className="reader-quote-field"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Автор (необязательно)"
        maxLength={200}
        aria-label="Автор"
      />
      {books && !fixedBookId && books.length > 0 && (
        <select className="reader-quote-field" value={bookId} onChange={(e) => pickBook(e.target.value)} aria-label="Книга">
          <option value="">Без книги</option>
          {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
      )}
      {error && <div className="reader-error">{error}</div>}
      <div className="reader-quote-actions">
        <button type="submit" className="reader-btn-solid reader-btn-coral" disabled={busy || !text.trim()}>
          {busy ? 'Сохраняю…' : 'Сохранить цитату'}
        </button>
        {onCancel && <button type="button" className="reader-btn-ghost" onClick={onCancel}>Отмена</button>}
      </div>
    </form>
  );
}
