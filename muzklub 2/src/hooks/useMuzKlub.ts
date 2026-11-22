import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/index.ts';
import type { Choice, Profile, User } from '../api/index.ts';
import { DEFAULT_CHOICES } from '../config.ts';

export type Mode = 'login' | 'register';

/** Состояние приложения и действия: вход, регистрация, профиль, выход. */
export function useMuzKlub() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [editing, setEditing] = useState(false);
  const [choices, setChoices] = useState<Choice[]>(DEFAULT_CHOICES);
  const [loading, setLoading] = useState('Загрузка...');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.specializations().then(setChoices).catch(() => {
      setMessage('Не удалось загрузить список инструментов. Обновите страницу.');
    });
    api.profile().then(setUser).catch((error: unknown) => {
      if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) {
        setMessage('Не удалось загрузить профиль. Попробуйте ещё раз.');
      }
    }).finally(() => setLoading(''));
  }, []);

  function showError(error: unknown) {
    if (error instanceof ApiError && error.status === 401 && user) {
      setUser(null);
      setEditing(false);
      setMode('login');
      setMessage('Сессия закончилась. Войдите снова.');
      return;
    }
    setMessage(error instanceof Error ? error.message : 'Произошла ошибка.');
  }

  function changeMode(next: Mode) {
    setMode(next);
    setMessage('');
  }

  function startEditing() {
    setEditing(true);
    setMessage('');
  }

  function cancelEditing() {
    setEditing(false);
    setMessage('');
  }

  async function authenticate(username: string, password: string, confirmation?: string) {
    if (loading) return;
    if (mode === 'register' && password !== confirmation) {
      setMessage('Пароли не совпадают.');
      return;
    }
    setLoading('Загрузка...');
    setMessage('');
    try {
      if (mode === 'register') await api.register(username, password);
      else await api.login(username, password);
      setUser(await api.profile());
      setEditing(mode === 'register');
      setMessage(mode === 'register' ? 'Аккаунт создан.' : 'Вы вошли в аккаунт.');
    } catch (error) {
      showError(error);
    } finally {
      setLoading('');
    }
  }

  async function saveProfile(profile: Profile) {
    if (loading) return;
    setLoading('Сохранение...');
    setMessage('');
    try {
      await api.updateProfile(profile);
      setUser(await api.profile());
      setEditing(false);
      setMessage('Изменения сохранены.');
    } catch (error) {
      showError(error);
    } finally {
      setLoading('');
    }
  }

  async function logout() {
    if (loading) return;
    setLoading('Выход...');
    setMessage('');
    try {
      await api.logout();
      setUser(null);
      setEditing(false);
      setMode('login');
      setMessage('Вы вышли из аккаунта.');
    } catch (error) {
      showError(error);
    } finally {
      setLoading('');
    }
  }

  return {
    user, mode, editing, choices, loading, message,
    changeMode, startEditing, cancelEditing, authenticate, saveProfile, logout,
  };
}
