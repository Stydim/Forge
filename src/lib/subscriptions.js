// Subscriptions helpers (ported from Sanct). Billing dates are 'YYYY-MM-DD'.

export const CYCLES = [
  { value: 'weekly', label: 'Еженедельно' },
  { value: 'monthly', label: 'Ежемесячно' },
  { value: 'quarterly', label: 'Каждые 3 мес.' },
  { value: 'yearly', label: 'Ежегодно' },
];

export const CYCLE_LABEL = { weekly: '/нед.', monthly: '/мес.', quarterly: '/кв.', yearly: '/год' };

export const ICONS = ['💳', '🎬', '🎵', '🎮', '📺', '☁️', '📦', '🏋️', '📰', '🔒', '🛒', '📱', '💼', '🎓', '🌐'];
export const COLORS = ['#6C5CE7', '#E17055', '#00B894', '#0984E3', '#FDCB6E', '#FF6B6B', '#A29BFE', '#fd79a8', '#55efc4', '#74b9ff'];

export const CURRENCIES = [
  { symbol: '₽', code: 'RUB', label: 'Рубль' },
  { symbol: '€', code: 'EUR', label: 'Евро' },
  { symbol: '$', code: 'USD', label: 'Доллар' },
  { symbol: 'Kč', code: 'CZK', label: 'Крона' },
  { symbol: '₹', code: 'INR', label: 'Рупия' },
];

export function toMonthly(amount, cycle) {
  if (cycle === 'yearly') return amount / 12;
  if (cycle === 'quarterly') return amount / 3;
  if (cycle === 'weekly') return (amount * 52) / 12;
  return amount;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${dateStr}T00:00:00`) - today) / 86400000);
}

// The billing date one period after `dateStr`.
export function nextBillingDate(dateStr, cycle) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (cycle === 'weekly') d.setDate(d.getDate() + 7);
  else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
