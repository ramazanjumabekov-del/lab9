import type { User } from '../api/index.ts';

type Props = { user: User; disabled: boolean; onEdit: () => void; onLogout: () => void };

export default function ProfileView({ user, disabled, onEdit, onLogout }: Props) {
  const { profile } = user;
  const name = profile.first_name || user.username;

  return (
    <section className="card" aria-label="Мой профиль">
      <div className="profile-head">
        <div className="avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>
        <div>
          <h2>{name}</h2>
          <p className="muted">Логин: {user.username}</p>
        </div>
      </div>

      <dl className="facts">
        <div><dt>Имя</dt><dd>{profile.first_name || 'Не указано'}</dd></div>
        <div><dt>Инструмент</dt><dd>{profile.specialization_display || 'Не указан'}</dd></div>
        <div><dt>О себе</dt><dd>{profile.bio || 'Не заполнено'}</dd></div>
        <div><dt>Гонорар</dt><dd>{profile.fee}</dd></div>
      </dl>

      <div className="actions">
        <button className="primary" disabled={disabled} onClick={onEdit}>Редактировать профиль</button>
        <button disabled={disabled} onClick={onLogout}>Выйти из аккаунта</button>
      </div>
    </section>
  );
}
