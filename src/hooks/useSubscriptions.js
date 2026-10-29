import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';
import { daysUntil, nextBillingDate } from '../lib/subscriptions';
import { resolveDueAtWithoutTime } from '../lib/dueDate';

// Subscriptions (ported from Sanct), plus its auto reminders: an active
// subscription with auto_task gets an "Оплата: …" task auto_task_days before
// its next billing date — once per date, claimed on the server so two devices
// don't both create it.
export function useSubscriptions({ addTask } = {}) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setSubscriptions(await api.listSubscriptions());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchLocal = (id, fields) => setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));

  const add = useCallback(async (fields) => {
    try {
      const row = await api.createSubscription(fields);
      setSubscriptions((prev) => [...prev, row]);
    } catch (err) { setError(err.message); }
  }, []);

  const update = useCallback(async (id, fields) => {
    patchLocal(id, fields);
    try { await api.updateSubscription(id, fields); } catch (err) { setError(err.message); load(); }
  }, [load]);

  const remove = useCallback(async (id) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    try { await api.deleteSubscription(id); } catch (err) { setError(err.message); load(); }
  }, [load]);

  // "Оплачено": move to the next period, remembering the date for undo.
  const pay = useCallback((sub) => {
    if (!sub.next_billing_date) return;
    update(sub.id, {
      next_billing_date: nextBillingDate(sub.next_billing_date, sub.cycle),
      previous_billing_date: sub.next_billing_date,
      payments_count: (sub.payments_count || 0) + 1,
    });
  }, [update]);

  const undoPay = useCallback((sub) => {
    if (!sub.previous_billing_date) return;
    update(sub.id, {
      next_billing_date: sub.previous_billing_date,
      previous_billing_date: null,
      payments_count: Math.max(0, (sub.payments_count || 0) - 1),
    });
  }, [update]);

  useEffect(() => {
    if (!addTask) return;
    for (const sub of subscriptions) {
      if (!sub.active || !sub.auto_task || !sub.next_billing_date || sub.cycle === 'weekly') continue;
      if (sub.auto_task_last_created === sub.next_billing_date) continue;
      const days = daysUntil(sub.next_billing_date);
      if (days === null || days < 0 || days > (sub.auto_task_days ?? 3)) continue;
      const date = sub.next_billing_date;
      patchLocal(sub.id, { auto_task_last_created: date });
      api.claimSubscriptionAutoTask(sub.id, date).then(({ claimed }) => {
        if (!claimed) return;
        addTask({
          title: `Оплата: ${sub.name}`,
          description: `${sub.amount} ${sub.currency} · следующая оплата ${date.split('-').reverse().join('.')}`,
          due_at: resolveDueAtWithoutTime(date).toISOString(),
          dueHasTime: false,
          priority: 'medium',
        });
      }).catch(() => {});
    }
  }, [subscriptions, addTask]);

  return { subscriptions, loading, error, add, update, remove, pay, undoPay };
}
