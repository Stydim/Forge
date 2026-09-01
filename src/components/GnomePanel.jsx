export default function GnomePanel({ stage, lines, snoozeEcho, hourBuckets, caption }) {
  const maxVal = Math.max(1, ...(hourBuckets ?? []));

  return (
    <aside className="gnome-panel">
      <div className="gnome-panel-header">
        <div className="gnome-panel-title">Диалог с гномом</div>
        <div className="gnome-stage-badge">{stage ? `СТУПЕНЬ ${stage}` : 'ВСЁ ЧИСТО'}</div>
      </div>

      <div className="gnome-chat">
        {lines.map((text, i) => (
          <div key={i} className="gnome-bubble">
            {text}
          </div>
        ))}
        {snoozeEcho && <div className="gnome-bubble user">{snoozeEcho}</div>}
      </div>

      {hourBuckets && (
        <>
          <div className="snooze-chart-label">Откладывания по часам</div>
          <div className="snooze-chart">
            {hourBuckets.map((v, i) => (
              <div
                key={i}
                className={`snooze-bar${v >= maxVal ? ' high' : ''}`}
                style={{ height: `${(v / maxVal) * 100}%` }}
              />
            ))}
          </div>
          <div className="snooze-chart-caption">
            {caption ?? 'Пока нет данных об откладываниях — и это хорошо.'}
          </div>
        </>
      )}

      <button className="gnome-switch-btn">Сменить персонажа</button>
      <div className="gnome-panel-footnote">Брифинг приходит в 8:00 в приложение и на почту</div>
    </aside>
  );
}
