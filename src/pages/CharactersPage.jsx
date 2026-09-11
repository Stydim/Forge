import { useRef, useState } from 'react';
import { CHARACTERS, COMING_SOON_CHARACTERS } from '../lib/characters';

// Plain photo by default; hovering plays the character's living-portrait
// video (if it has one), looping until the cursor leaves, then it's back
// to the static photo — never autoplaying unattended.
//
// First attempt branched once on matchMedia('(hover: hover)') and picked
// either mouse handlers or a tap handler — turned out to still not fire on
// a real device, most likely because some WebView reports hover support
// wrong (or reports it right but never actually dispatches mouseenter for a
// tap either way, so the branch itself doesn't matter — the real fix is to
// stop trusting a static capability check at all). Pointer Events fix this
// properly: every interaction carries its own real pointerType, checked at
// the moment it happens — onPointerEnter/Leave only react to an actual
// mouse, onClick (which fires for both a real click and a tap) is the
// universal toggle, driven by the video's own .paused rather than React
// state so it can't desync from whatever the mouse handlers just did.
function CharacterAvatar({ character }) {
  const [failed, setFailed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef(null);

  if (failed || !character.video) {
    return (
      <img
        className="character-avatar"
        src={character.avatar}
        alt={character.name}
        onError={() => setFailed(true)}
      />
    );
  }

  const crop = character.videoCrop;
  const videoStyle = crop
    ? { top: `${crop.top}%`, left: `${crop.left}%`, width: `${crop.size}%`, height: `${crop.size}%` }
    : { top: 0, left: 0, width: '100%', height: '100%' };

  const play = () => {
    setHovering(true);
    videoRef.current?.play();
  };
  const stop = () => {
    setHovering(false);
    const v = videoRef.current;
    if (v) { v.pause(); v.currentTime = 0; }
  };

  return (
    <div
      className="character-avatar character-avatar-media-wrap"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') play(); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') stop(); }}
      onClick={() => (videoRef.current?.paused === false ? stop() : play())}
    >
      <img className="character-avatar-media" src={character.avatar} alt={character.name} style={{ opacity: hovering ? 0 : 1 }} />
      <video
        ref={videoRef}
        className="character-avatar-media"
        style={{ ...videoStyle, opacity: hovering ? 1 : 0 }}
        src={character.video}
        loop
        muted
        playsInline
        preload="none"
        onError={() => setFailed(true)}
      />
    </div>
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
                <div className="character-card-info">
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
