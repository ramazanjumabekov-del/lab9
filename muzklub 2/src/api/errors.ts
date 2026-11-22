export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Достаёт читаемый текст ошибки из ответа сервера. */
export function errorText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';
  if ('detail' in data) return errorText(data.detail);
  return Object.values(data).map(errorText).filter(Boolean).join(' ');
}
