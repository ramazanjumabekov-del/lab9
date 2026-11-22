import type { FormEvent } from 'react';
import type { Mode } from '../hooks/useMuzKlub.ts';

type Props = {
  mode: Mode;
  disabled: boolean;
  onModeChange: (mode: Mode) => void;
  onSubmit: (username: string, password: string, confirmation?: string) => void;
};

export default function AuthForm({ mode, disabled, onModeChange, onSubmit }: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(
      String(form.get('username')).trim(),
      String(form.get('password')),
      mode === 'register' ? String(form.get('password_confirmation')) : undefined,
    );
  }

  return (
    <section className="card" aria-label={mode === 'login' ? 'Вход' : 'Регистрация'}>
      <div className="tabs" role="group" aria-label="Режим">
        <button type="button" aria-pressed={mode === 'login'} disabled={disabled} onClick={() => onModeChange('login')}>Вход</button>
        <button type="button" aria-pressed={mode === 'register'} disabled={disabled} onClick={() => onModeChange('register')}>Регистрация</button>
      </div>

      <form key={mode} onSubmit={submit}>
        <fieldset disabled={disabled}>
          <label>Логин
            <input id="username" name="username" required maxLength={150} autoComplete="username" />
          </label>
          <label>Пароль
            <input id="password" name="password" type="password" required minLength={mode === 'register' ? 6 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {mode === 'register' && (
            <label>Повторите пароль
              <input id="password_confirmation" name="password_confirmation" type="password" required minLength={6} autoComplete="new-password" />
            </label>
          )}
          <button className="primary" type="submit">{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
        </fieldset>
      </form>
    </section>
  );
}
