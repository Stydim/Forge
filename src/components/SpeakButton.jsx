import { useState } from 'react';
import { Loader2, Square, Volume2, VolumeX } from 'lucide-react';
import { speak, stopSpeaking } from '../lib/speech';

// Speaker button that reads `text` aloud in `lang` ('ru' | 'en'); a second
// click while playing stops it. Errors (e.g. no API key on the server) are
// shown in the tooltip, as a crossed-out speaker, and passed to onError.
export default function SpeakButton({ text, lang, size = 16, className = '', label = 'Озвучить', onError }) {
  const [state, setState] = useState('idle'); // idle | loading | playing | error
  const [error, setError] = useState(null);

  const onClick = async (e) => {
    e.stopPropagation();
    if (state === 'playing' || state === 'loading') {
      stopSpeaking();
      setState('idle');
      return;
    }
    setState('loading');
    setError(null);
    try {
      const started = await speak(text, lang, () => setState('idle'));
      setState(started ? 'playing' : 'idle');
    } catch (err) {
      setError(err.message);
      setState('error');
      onError?.(err.message);
    }
  };

  const Icon = { idle: Volume2, loading: Loader2, playing: Square, error: VolumeX }[state];
  return (
    <button
      type="button"
      className={`reader-speak-btn ${state} ${className}`.trim()}
      onClick={onClick}
      aria-label={state === 'playing' ? 'Остановить' : label}
      title={error || (state === 'playing' ? 'Остановить' : label)}
      disabled={!text}
    >
      <Icon size={size} />
    </button>
  );
}
