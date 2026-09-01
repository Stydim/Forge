const snoozeByHour = [9, 8, 3, 2, 2, 2, 1, 1, 3];

export default function GnomePanel({ stage, messages }) {
  const maxVal = Math.max(...snoozeByHour);

  return (
    <aside className="gnome-panel">
      <div className="gnome-panel-header">
        <div className="gnome-panel-title">Диалог с гномом</div>
        <div className="gnome-stage-badge">СТУПЕНЬ {stage}</div>
      </div>

      <div className="gnome-chat">
        {messages.map((m, i) => (
          <div key={i} className={`gnome-bubble${m.from === 'user' ? ' user' : ''}`}>
            {m.text}
          </div>
        ))}
      </div>

      <div className="snooze-chart-label">Откладывания по часам</div>
      <div className="snooze-chart">
        {snoozeByHour.map((v, i) => (
          <div
            key={i}
            className={`snooze-bar${v >= maxVal - 1 ? ' high' : ''}`}
            style={{ height: `${(v / maxVal) * 100}%` }}
          />
        ))}
      </div>
      <div className="snooze-chart-caption">
        Утро — слабое место: 7 из 9 откладываний до 11:00.
      </div>

      <button className="gnome-switch-btn">Сменить персонажа</button>
      <div className="gnome-panel-footnote">Брифинг приходит в 8:00 в приложение и на почту</div>
    </aside>
  );
}
