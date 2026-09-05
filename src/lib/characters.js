export const CHARACTERS = [
  {
    id: 'gnome',
    name: 'Ворчливый гном',
    avatar: '/characters/gnome.jpg',
    tagline: 'Эскалирует от вежливых напоминаний до тяжёлых вздохов — и чем дольше тянешь, тем жёстче.',
    power: 'Показывает не то, кем ты хочешь казаться, а где ты реально сейчас — без стыда и без прикрас.',
    helps: 'Тем, кто врёт себе про спорт, работу, отношения. Честная точка А — единственное место, откуда начинается рост.',
    stages: [
      [
        'Просто на всякий случай — вот твой список на сегодня.',
        'Спешить некуда, но и забывать не стоит.',
      ],
      [
        '«{title}» всё ещё в списке. Ничего страшного, просто напоминаю.',
        'Сделаешь — сразу вычеркну.',
      ],
      [
        'Это уже третье напоминание про «{title}».',
        'Не подумай, что я считаю. Хотя да, считаю.',
      ],
      [
        'Опять отложил «{title}»? Гномы тоже устают ждать.',
        'Ладно-ладно, ещё немного могу подождать.',
      ],
      [
        '«{title}» ждёт с девяти. Это твой список, не мой.',
        'Ладно, молчу. Тебе виднее, я всего лишь гном.',
      ],
      [
        'Шестой раз откладываешь «{title}». Я начинаю подозревать неладное.',
        'Может, просто вычеркнем эту затею совсем?',
      ],
      [
        'Всё, я сдаюсь спорить про «{title}».',
        'Делай уже, что хочешь. Гном устал.',
      ],
    ],
    calmLines: ['Все дела сделаны. Даже я доволен.', 'Непривычно, но приятно.'],
  },
  {
    id: 'heartkeeper',
    name: 'Сердцевед',
    avatar: '/characters/heartkeeper.jpg',
    video: '/characters/heartkeeper.mp4',
    tagline: 'Называет чувство настоящим именем и показывает, что с ним делать — не подавить и не раздуть.',
    power: 'Называет чувство настоящим именем и показывает, что с ним делать (не подавить и не раздуть).',
    helps: 'Когда злость, вина или тревога рулят решениями. Эмоция перестаёт быть хозяином.',
    stages: [
      [
        'Вижу «{title}» в списке — и не тороплю.',
        'Иногда важно просто заметить дело, прежде чем к нему подойти.',
      ],
      [
        '«{title}» уже второй раз в твоём поле зрения.',
        'Что-то в нём отзывается? Не спеши отвечать — просто прислушайся.',
      ],
      [
        'Может, «{title}» вызывает раздражение?',
        'Злость — не враг. Она показывает, что что-то важно защитить.',
      ],
      [
        'Или это вина — что до сих пор не сделано «{title}»?',
        'Вина — это приглашение исправить, а не повод себя грызть.',
      ],
      [
        'А может, тревога? «{title}» кажется больше, чем есть на самом деле?',
        'Тревога просит внимания, а не контроля.',
      ],
      [
        'Ты уже пять раз откладываешь «{title}» — и это тоже информация.',
        'Назвать чувство — не значит сдаться. Значит — выбрать осознанно.',
      ],
      [
        'Я не буду давить на «{title}» — не моя роль.',
        'Ты слышишь себя. Дальше выбор за тобой.',
      ],
    ],
    calmLines: ['Ни одной неназванной эмоции. Ты слышишь себя.', 'Спокойно — и это тоже чувство. Узнаёшь его?'],
  },
];

export const COMING_SOON_CHARACTERS = [
  { id: 'sergeant', name: 'Сержант', tagline: 'Коротко, по делу, никаких «может быть».' },
  { id: 'grandma', name: 'Бабушка', tagline: 'Взывает к совести. Работает безотказно.' },
  { id: 'boss', name: 'Токсичный босс', tagline: 'Пассивная агрессия и дедлайны «ещё вчера».' },
];

export const DEFAULT_CHARACTER_ID = 'gnome';

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

// Stage is uncapped — it just tracks snoozes+1, however high that goes. The
// static `stages` array only has entries up to 7; past that we clamp ONLY the
// array lookup (used as a last-resort fallback if the AI call fails), never
// the real stage number shown to the user or sent to the AI as escalation level.
export function getCharacterState(character, focusTask) {
  if (!focusTask) return { stage: null, lines: character.calmLines };
  const stage = Math.max(1, focusTask.snooze_count + 1);
  const fallbackIndex = Math.min(character.stages.length, stage) - 1;
  const lines = character.stages[fallbackIndex].map((l) => l.replaceAll('{title}', focusTask.title));
  return { stage, lines };
}
