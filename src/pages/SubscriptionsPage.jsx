import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ClipboardPaste, CreditCard, ImagePlus, Plus, RefreshCw, RotateCcw, TrendingDown, X } from 'lucide-react';
import { uploadNoteImage } from '../lib/api';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { pluralRu } from '../lib/format';
import { COLORS, CURRENCIES, CYCLES, CYCLE_LABEL, ICONS, daysUntil, toMonthly } from '../lib/subscriptions';
import '../subscriptions.css';

// Subscriptions, ported from Sanct with its layout: totals in a chosen
// currency, active subscriptions sorted by the next payment, paused ones below.

const DISPLAY_KEY = 'forge:subs-display-currency';
const money = (v) => Math.round(v).toLocaleString('ru-RU');

function StatusBadge({ days }) {
  if (days === null) return null;
  let tone = 'ok';
  let label = `через ${days} дн.`;
  if (days < 0) { tone = 'late'; label = `Просрочено ${Math.abs(days)} дн.`; }
  else if (days === 0) { tone = 'late'; label = 'Сегодня'; }
  else if (days <= 3) tone = 'late';
  else if (days <= 7) tone = 'soon';
  return <span className={`subs-badge ${tone}`}>{label}</span>;
}

function SubCard({ sub, onOpen, onPay, onUndo, convert, displaySymbol }) {
  const days = daysUntil(sub.next_billing_date);
  const monthly = toMonthly(sub.amount || 0, sub.cycle);
  const converted = convert(monthly, sub.currency, displaySymbol);
  const showConverted = sub.currency !== displaySymbol && converted !== monthly;
  const count = sub.payments_count || 0;

  return (
    <div className="subs-card" onClick={() => onOpen(sub)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(sub)}>
      <div className="subs-card-cover" style={{ background: sub.image_url ? undefined : `${sub.color}22` }}>
        {sub.image_url
          ? <img src={sub.image_url} alt="" draggable={false} />
          : <span className="subs-card-cover-icon">{sub.icon}</span>}
        <span className="subs-card-cover-badge">
          {sub.active ? <StatusBadge days={days} /> : <span className="subs-badge off">Неактивна</span>}
        </span>
      </div>

      <div className="subs-card-body">
        <div className="subs-card-head">
          <span className="subs-card-name">{sub.name}</span>
          <span className="subs-card-month">
            {money(showConverted ? converted : monthly)} {showConverted ? displaySymbol : sub.currency}<small>/мес</small>
          </span>
        </div>
        <div className="subs-card-price">
          {sub.amount} {sub.currency}{CYCLE_LABEL[sub.cycle] || ''}
          {sub.next_billing_date && ` · след. ${sub.next_billing_date.split('-').reverse().join('.')}`}
        </div>
        {count > 0 && (
          <div className="subs-card-total">
            {count} {pluralRu(count, 'платёж', 'платежа', 'платежей')} · итого {((sub.amount || 0) * count).toLocaleString('ru-RU')} {sub.currency}
          </div>
        )}

        {(sub.active && sub.next_billing_date) || sub.previous_billing_date ? (
          <div className="subs-card-actions">
            {sub.active && sub.next_billing_date && (
              <button
                type="button"
                className="subs-btn pay"
                style={{ '--sub-color': sub.color }}
                title="Оплатить — перейти к следующему периоду"
                onClick={(e) => { e.stopPropagation(); onPay(sub); }}
              >
                <Check size={15} strokeWidth={2.5} /> Оплачено
              </button>
            )}
            {sub.previous_billing_date && (
              <button type="button" className="subs-btn undo" title="Отменить оплату" aria-label="Отменить оплату" onClick={(e) => { e.stopPropagation(); onUndo(sub); }}>
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Cover picker: paste (Ctrl+V anywhere in the editor or the button, which
// reads the clipboard), drop a file, or pick one from the computer.
function CoverPicker({ value, color, icon, onChange, pasteRef, busy, setBusy }) {
  const inputRef = useRef(null);
  const [err, setErr] = useState('');

  const upload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setBusy(true); setErr('');
    try { onChange(await uploadNoteImage(file)); } catch { setErr('Не удалось загрузить изображение'); }
    setBusy(false);
  };
  if (pasteRef) pasteRef.current = upload;

  const pasteFromClipboard = async () => {
    setErr('');
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) return upload(new File([await item.getType(type)], 'cover', { type }));
      }
      setErr('В буфере нет изображения');
    } catch { setErr('Нет доступа к буферу — нажмите Ctrl+V'); }
  };

  return (
    <div className="subs-cover-picker">
      <div
        className={`subs-cover-drop${busy ? ' busy' : ''}`}
        style={{ background: value ? undefined : `${color}22` }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
        role="button"
        tabIndex={0}
      >
        {value ? <img src={value} alt="" /> : <span className="subs-card-cover-icon">{icon}</span>}
        <span className="subs-cover-hint">{busy ? 'Загрузка…' : (value ? 'Заменить' : 'Ctrl+V, перетащите или выберите файл')}</span>
      </div>
      <div className="subs-cover-actions">
        <button type="button" className="task-modal-btn-small" onClick={() => inputRef.current?.click()}><ImagePlus size={14} /> С компьютера</button>
        <button type="button" className="task-modal-btn-small" onClick={pasteFromClipboard}><ClipboardPaste size={14} /> Из буфера</button>
        {value && <button type="button" className="task-modal-btn-small subs-danger" onClick={() => onChange(null)}>Убрать</button>}
      </div>
      {err && <div className="subs-cover-error">{err}</div>}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />
    </div>
  );
}

const EMPTY = {
  name: '', amount: '', currency: '₽', cycle: 'monthly', next_billing_date: '',
  icon: '💳', color: '#6C5CE7', active: true, auto_task: false, auto_task_days: 3, image_url: null,
};

function SubscriptionEditor({ sub, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(sub || {}), amount: sub ? String(sub.amount) : '' }));
  const [customCurrency, setCustomCurrency] = useState(() => !!sub && !CURRENCIES.some((c) => c.symbol === sub.currency));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));
  const coverPaste = useRef(null);
  const [uploading, setUploading] = useState(false);

  // An image pasted anywhere in the editor becomes the cover; text pastes
  // into the inputs as usual.
  const onPaste = (e) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    coverPaste.current?.(file);
  };

  const save = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      amount: parseFloat(String(form.amount).replace(',', '.')) || 0,
      currency: form.currency.trim() || '₽',
      cycle: form.cycle,
      next_billing_date: form.next_billing_date || null,
      icon: form.icon,
      color: form.color,
      image_url: form.image_url || null,
      active: form.active,
      auto_task: form.auto_task,
      auto_task_days: Math.max(0, Math.min(60, parseInt(form.auto_task_days, 10) || 0)),
    });
  };

  return createPortal(
    <div className="task-modal-overlay" onClick={onClose}>
      <form className="task-modal subs-modal" onClick={(e) => e.stopPropagation()} onSubmit={save} onPaste={onPaste}>
        <button type="button" className="task-modal-close" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
        <h2 className="task-modal-title">{sub ? 'Редактировать подписку' : 'Новая подписка'}</h2>

        <div className="task-modal-label">Обложка</div>
        <CoverPicker value={form.image_url} color={form.color} icon={form.icon} onChange={(url) => set('image_url', url)} pasteRef={coverPaste} busy={uploading} setBusy={setUploading} />

        <div className="subs-form-row">
          <div>
            <div className="task-modal-label">Иконка (без обложки)</div>
            <select className="task-modal-input subs-icon-select" value={form.icon} onChange={(e) => set('icon', e.target.value)}>
              {ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </select>
          </div>
          <div className="subs-grow">
            <div className="task-modal-label">Название</div>
            <input className="task-modal-input" placeholder="Netflix, Spotify..." value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>
        </div>

        <div className="task-modal-label">Сумма</div>
        <input className="task-modal-input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} />

        <div className="task-modal-label">Валюта</div>
        <div className="subs-currency-row">
          {CURRENCIES.map((c) => (
            <button
              key={c.symbol}
              type="button"
              className={`subs-currency-chip${!customCurrency && form.currency === c.symbol ? ' active' : ''}`}
              onClick={() => { set('currency', c.symbol); setCustomCurrency(false); }}
            >
              {c.symbol} <span>{c.label}</span>
            </button>
          ))}
          <button type="button" className={`subs-currency-chip${customCurrency ? ' active' : ''}`} onClick={() => setCustomCurrency(true)}>Другая...</button>
        </div>
        {customCurrency && (
          <input
            className="task-modal-input subs-custom-currency"
            placeholder="Символ: £, ¥..."
            value={CURRENCIES.some((c) => c.symbol === form.currency) ? '' : form.currency}
            onChange={(e) => set('currency', e.target.value)}
            autoFocus
          />
        )}

        <div className="subs-form-row">
          <div className="subs-grow">
            <div className="task-modal-label">Период</div>
            <select className="task-modal-input" value={form.cycle} onChange={(e) => set('cycle', e.target.value)}>
              {CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="subs-grow">
            <div className="task-modal-label">Следующая оплата</div>
            <input className="task-modal-input" type="date" value={form.next_billing_date || ''} onChange={(e) => set('next_billing_date', e.target.value)} />
          </div>
        </div>

        <div className="task-modal-label">Цвет</div>
        <div className="habit-color-row">
          {COLORS.map((c) => (
            <button key={c} type="button" className={`habit-color-swatch${form.color === c ? ' active' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />
          ))}
        </div>

        <label className="subs-check">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          Активная подписка
        </label>
        <label className="subs-check">
          <input type="checkbox" checked={form.auto_task} onChange={(e) => set('auto_task', e.target.checked)} />
          Задача «Оплата: {form.name.trim() || '…'}» за
          <input className="subs-days-input" type="number" min="0" max="60" value={form.auto_task_days} onChange={(e) => set('auto_task_days', e.target.value)} disabled={!form.auto_task} />
          дн. до оплаты
        </label>

        <div className="task-modal-actions">
          <div className="task-modal-actions-left">
            {sub && !confirmDelete && <button type="button" className="task-modal-btn-small subs-danger" onClick={() => setConfirmDelete(true)}>Удалить</button>}
            {confirmDelete && (
              <span className="subs-confirm">
                Точно удалить?
                <button type="button" className="task-modal-btn-small subs-danger" onClick={() => onDelete(sub.id)}>Да</button>
                <button type="button" className="task-modal-btn-small" onClick={() => setConfirmDelete(false)}>Нет</button>
              </span>
            )}
          </div>
          <div className="task-modal-actions-right">
            <button type="button" className="task-modal-btn cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="task-modal-btn save" disabled={!form.name.trim() || uploading}>Сохранить</button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export default function SubscriptionsPage({ subscriptions: subsState }) {
  const { subscriptions, loading: subsLoading, error: subsError, add, update, remove, pay, undoPay } = subsState;
  const { convert, loading, error } = useExchangeRates();
  const [editing, setEditing] = useState(null); // null | 'new' | subscription
  const [displayCurrency, setDisplayCurrency] = useState(() => {
    try { return localStorage.getItem(DISPLAY_KEY) || '₽'; } catch { return '₽'; }
  });
  const chooseCurrency = (sym) => {
    setDisplayCurrency(sym);
    try { localStorage.setItem(DISPLAY_KEY, sym); } catch { /* private mode */ }
  };

  const active = subscriptions
    .filter((s) => s.active)
    .sort((a, b) => (daysUntil(a.next_billing_date) ?? 9999) - (daysUntil(b.next_billing_date) ?? 9999));
  const inactive = subscriptions.filter((s) => !s.active);
  const monthlyTotal = active.reduce((sum, s) => sum + convert(toMonthly(s.amount || 0, s.cycle), s.currency, displayCurrency), 0);

  const cardProps = { onOpen: setEditing, onPay: pay, onUndo: undoPay, convert, displaySymbol: displayCurrency };

  return (
    <div className="goals-page subs-page">
      <div className="goals-page-header">
        <div>
          <h1 className="subs-title">Подписки</h1>
          <p className="subs-subtitle">Управляйте своими регулярными расходами.</p>
        </div>
        <button className="goals-new-btn" onClick={() => setEditing('new')}><Plus size={16} /> Добавить</button>
      </div>

      {subsError && (
        <div className="task-card urgent" style={{ marginBottom: 16 }}>
          <div className="task-card-meta">Не удалось связаться с базой: {subsError}</div>
        </div>
      )}

      {active.length > 0 && (
        <div className="subs-stats-block">
          <div className="subs-currency-picker">
            <span>Показывать в:</span>
            {CURRENCIES.map((c) => (
              <button key={c.symbol} type="button" className={displayCurrency === c.symbol ? 'active' : ''} onClick={() => chooseCurrency(c.symbol)} title={c.label}>
                {c.symbol}
              </button>
            ))}
            {loading && <RefreshCw size={13} className="subs-spin" />}
            {error && <span className="subs-rates-error">Нет данных курсов</span>}
          </div>
          <div className="subs-stats">
            <div className="subs-stat">
              <div className="subs-stat-label">В месяц</div>
              <div className="subs-stat-value accent">{loading ? '...' : `${money(monthlyTotal)} ${displayCurrency}`}</div>
            </div>
            <div className="subs-stat">
              <div className="subs-stat-label">В год</div>
              <div className="subs-stat-value">{loading ? '...' : `${money(monthlyTotal * 12)} ${displayCurrency}`}</div>
            </div>
            <div className="subs-stat">
              <div className="subs-stat-label">Активных</div>
              <div className="subs-stat-value">{active.length}</div>
            </div>
          </div>
        </div>
      )}

      <section className="subs-section">
        <div className="subs-section-head">
          <CreditCard size={18} className="subs-section-icon" />
          <h2>Активные</h2>
          <span className="subs-count">{active.length}</span>
        </div>
        {active.length === 0 ? (
          !subsLoading && (
            <div className="subs-empty">
              <div className="subs-empty-icon">💳</div>
              <p>Нет активных подписок</p>
              <button className="goals-new-btn" onClick={() => setEditing('new')}><Plus size={14} /> Добавить</button>
            </div>
          )
        ) : (
          <div className="subs-grid">
            {active.map((sub) => <SubCard key={sub.id} sub={sub} {...cardProps} />)}
          </div>
        )}
      </section>

      {inactive.length > 0 && (
        <section className="subs-section">
          <div className="subs-section-head muted">
            <TrendingDown size={18} />
            <h2>Приостановленные</h2>
            <span className="subs-count">{inactive.length}</span>
          </div>
          <div className="subs-grid paused">
            {inactive.map((sub) => <SubCard key={sub.id} sub={sub} {...cardProps} />)}
          </div>
        </section>
      )}

      {editing && (
        <SubscriptionEditor
          sub={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(fields) => { if (editing === 'new') add(fields); else update(editing.id, fields); setEditing(null); }}
          onDelete={(id) => { remove(id); setEditing(null); }}
        />
      )}
    </div>
  );
}
