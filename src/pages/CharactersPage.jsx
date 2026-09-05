import { CHARACTERS, COMING_SOON_CHARACTERS, DEFAULT_CHARACTER_ID } from '../lib/characters';

const SAMPLE_TITLE = 'Задача';

export default function CharactersPage() {
  return (
    <div className="characters-page">
      <div className="page-date">ПЕРСОНАЖИ</div>
      <h1 className="page-heading">Кто будет напоминать</h1>
      <p className="characters-subtitle">
        У каждого персонажа семь ступеней эскалации — тон меняется с каждым отложенным напоминанием.
        Фразы каждый раз сочиняются заново под характер персонажа; ниже — примерный диапазон тона.
      </p>

      <div className="characters-grid">
        {CHARACTERS.map((c) => (
          <div key={c.id} className="character-card">
            <div className="character-card-head">
              <img className="character-avatar" src={c.avatar} alt={c.name} />
              <div>
                <div className="character-name">{c.name}</div>
                <div className="character-tagline">{c.tagline}</div>
              </div>
              {c.id === DEFAULT_CHARACTER_ID && <span className="character-active-badge">Активен</span>}
            </div>

            {(c.power || c.helps) && (
              <div className="character-details">
                {c.power && <div><strong>Сила:</strong> {c.power}</div>}
                {c.helps && <div><strong>Помогает:</strong> {c.helps}</div>}
              </div>
            )}

            <div className="character-stages">
              {c.stages.map((lines, i) => (
                <div key={i} className="character-stage-row">
                  <span className="character-stage-num">{i + 1}</span>
                  <span className="character-stage-text">{lines[0].replaceAll('{title}', SAMPLE_TITLE)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {COMING_SOON_CHARACTERS.map((c) => (
          <div key={c.id} className="character-card soon">
            <div className="character-card-head">
              <div className="character-avatar placeholder">{c.name[0]}</div>
              <div>
                <div className="character-name">{c.name}</div>
                <div className="character-tagline">{c.tagline}</div>
              </div>
              <span className="character-soon-badge">Скоро</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
