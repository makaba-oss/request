import { requireUser } from '@/lib/auth';
import { ActionForm } from '@/components/forms';
import { changeMyPassword } from '../actions';

export const metadata = { title: 'Пароль' };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="panel" style={{ maxWidth: 480 }}>
      <ActionForm action={changeMyPassword} submit="Сменить пароль" pending="Меняем…">
        <div><h2>Смена пароля</h2><p className="small muted" style={{ marginTop: 4 }}>Логин: <span className="cred">{user.email}</span></p></div>
        <input type="text" name="username" autoComplete="username" defaultValue={user.email} hidden readOnly />
        <label className="field"><span>Текущий пароль</span><input name="current" type="password" required autoComplete="current-password" /></label>
        <label className="field"><span>Новый пароль (не короче 8 символов)</span><input name="next" type="password" required minLength={8} autoComplete="new-password" /></label>
        <label className="field"><span>Новый пароль ещё раз</span><input name="again" type="password" required minLength={8} autoComplete="new-password" /></label>
      </ActionForm>
    </div>
  );
}
