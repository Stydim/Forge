export const CHARACTERS = [
  {
    id: 'gnome',
    name: 'Ворчливый гном',
    avatar: '/characters/gnome.jpg',
    tagline: 'Эскалирует от вежливых напоминаний до тяжёлых вздохов за 7 ступеней.',
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

export function getCharacterState(character, focusTask) {
  if (!focusTask) return { stage: null, lines: character.calmLines };
  const stage = Math.min(character.stages.length, Math.max(1, focusTask.snooze_count + 1));
  const lines = character.stages[stage - 1].map((l) => l.replaceAll('{title}', focusTask.title));
  return { stage, lines };
}
