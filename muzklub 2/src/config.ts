import type { Choice } from './api/index.ts';

/** Список инструментов по умолчанию, пока сервер не ответил. */
export const DEFAULT_CHOICES: Choice[] = [
  { value: 'vocals', label: 'Вокал' },
  { value: 'guitar', label: 'Гитара' },
  { value: 'bass', label: 'Бас-гитара' },
  { value: 'drums', label: 'Ударные' },
  { value: 'keys', label: 'Клавишные' },
  { value: 'other', label: 'Другое' },
];
