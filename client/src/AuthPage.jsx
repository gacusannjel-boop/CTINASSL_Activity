import { useState } from 'react';

export default function AuthPage({ registering, onSubmit, onSwitch }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const credentials = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await onSubmit(credentials);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section subpage">
      <div className="eyebrow">LISTENING JOURNAL</div>
      <h2>{registering ? 'Create an account.' : 'Welcome back.'}</h2>
      <p>{registering ? 'Start your own listening journal.' : 'Log in to access your listening journal.'}</p>
      <div className="journal-layout">
        <form className="journal" onSubmit={submit}>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" maxLength={254} required />
          </label>
          <label>
            Password
            <input name="password" type="password" required maxLength={128}
              minLength={registering ? 8 : undefined}
              autoComplete={registering ? 'new-password' : 'current-password'} />
          </label>
          {registering && <small>Use at least 8 characters.</small>}
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button className="primary" disabled={busy}>{registering ? 'Register' : 'Log in'}</button>
            <button type="button" className="secondary" onClick={onSwitch} disabled={busy}>
              {registering ? 'Log in instead' : 'Create an account'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
