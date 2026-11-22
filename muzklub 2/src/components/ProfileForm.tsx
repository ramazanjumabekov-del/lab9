import type { FormEvent } from 'react';
import type { Choice, Profile, User } from '../api/index.ts';

type Props = {
  user: User;
  choices: Choice[];
  disabled: boolean;
  onSave: (profile: Profile) => void;
  onCancel: () => void;
};

export default function ProfileForm({ user, choices, disabled, onSave, onCancel }: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      first_name: String(form.get('first_name')).trim(),
      specialization: String(form.get('specialization')),
      bio: String(form.get('bio')).trim(),
      fee: String(form.get('fee')),
    });
  }

  return (
    <section className="card" aria-label="Редактировать профиль">
      <h2>Редактировать профиль</h2>
      <p className="muted">Логин: {user.username}</p>
      <form onSubmit={submit}>
        <fieldset disabled={disabled}>
          <label>Имя
            <input id="first_name" name="first_name" defaultValue={user.profile.first_name} maxLength={100} />
          </label>
          <label>Инструмент
            <select id="specialization" name="specialization" defaultValue={user.profile.specialization || 'other'}>
              {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </select>
          </label>
          <label>О себе
            <textarea id="bio" name="bio" rows={4} defaultValue={user.profile.bio} />
          </label>
          <label>Гонорар
            <input id="fee" name="fee" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={user.profile.fee || '0.00'} />
          </label>
          <div className="actions">
            <button className="primary" type="submit">Сохранить профиль</button>
            <button type="button" onClick={onCancel}>Отмена</button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
