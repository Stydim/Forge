import { useState } from 'react';
import { CHARACTERS, COMING_SOON_CHARACTERS } from '../lib/characters';

function CharacterAvatar({ character }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="character-avatar missing">{character.name[0]}</div>;
  if (character.video) {
    return (
      <div className="character-avatar character-avatar-video-wrap">
        <video
          className="character-avatar-video"
          src={character.video}
          poster={character.avatar}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <img
      className="character-avatar"
      src={character.avatar}
      alt={character.name}
      onError={() => setFailed(true)}
    />
  );
}

export default function CharactersPage({ activeCharacterId, onSelectCharacter }) {
  return (
    <div className="characters-page">
      <div className="page-date">ПЕРСОНАЖИ</div>
      <h1 className="page-heading">Кто будет напоминать</h1>
      <p className="characters-subtitle">
        Тон эскалирует с каждым отложенным напоминанием — от мягкого к резкому. Реплики каждый раз
        сочиняются заново под конкретную задачу и характер персонажа.
      </p>

      <div className="characters-grid">
        {CHARACTERS.map((c) => {
          const isActive = c.id === activeCharacterId;
          return (
            <div key={c.id} className="character-card">
              <div className="character-card-head">
                <CharacterAvatar character={c} />
                <div>
                  <div className="character-name">{c.name}</div>
                  <div className="character-tagline">{c.tagline}</div>
                </div>
                {isActive ? (
                  <span className="character-active-badge">Активен</span>
                ) : (
                  <button className="btn-pill btn-pill-outline-teal character-select-btn" onClick={() => onSelectCharacter(c.id)}>
                    Выбрать
                  </button>
                )}
              </div>

              {(c.power || c.helps) && (
                <div className="character-details">
                  {c.power && <div><strong>Сила:</strong> {c.power}</div>}
                  {c.helps && <div><strong>Помогает:</strong> {c.helps}</div>}
                </div>
              )}
            </div>
          );
        })}

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
