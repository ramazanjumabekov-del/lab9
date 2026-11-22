import AuthForm from './components/AuthForm.tsx';
import Header from './components/Header.tsx';
import Notices from './components/Notices.tsx';
import ProfileForm from './components/ProfileForm.tsx';
import ProfileView from './components/ProfileView.tsx';
import { useMuzKlub } from './hooks/useMuzKlub.ts';

export default function App() {
  const app = useMuzKlub();
  const busy = !!app.loading;

  return (
    <main>
      <Header />
      <Notices loading={app.loading} message={app.message} />

      {!app.user ? (
        <AuthForm mode={app.mode} disabled={busy} onModeChange={app.changeMode} onSubmit={app.authenticate} />
      ) : app.editing ? (
        <ProfileForm user={app.user} choices={app.choices} disabled={busy} onSave={app.saveProfile} onCancel={app.cancelEditing} />
      ) : (
        <ProfileView user={app.user} disabled={busy} onEdit={app.startEditing} onLogout={app.logout} />
      )}
    </main>
  );
}
