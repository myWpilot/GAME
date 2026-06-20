import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth() {
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username || email.split('@')[0] } },
        });
        if (err) throw err;
        setInfo('Hesap oluşturuldu. E-postanı kontrol edip onayladıktan sonra giriş yapabilirsin.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Mail veya şifre hatalı.' : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (err) setError(err.message);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card panel">
        <h1 className="display auth-title">King</h1>
        <p className="auth-sub">Arkadaşlarınla masaya otur.</p>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'auth-tab-active' : ''} onClick={() => setMode('login')} type="button">
            Giriş Yap
          </button>
          <button className={mode === 'signup' ? 'auth-tab-active' : ''} onClick={() => setMode('signup')} type="button">
            Hesap Oluştur
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <input placeholder="Görünen ad" value={username} onChange={(e) => setUsername(e.target.value)} required />
          )}
          <input type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Bekleyin...' : mode === 'signup' ? 'Hesap Oluştur' : 'Giriş Yap'}
          </button>
        </form>

        <div className="auth-divider"><span>veya</span></div>

        <button type="button" className="btn-google" onClick={handleGoogle}>
          Google ile devam et
        </button>
      </div>
      <footer className="site-footer">Volkan Eren · volkaneren34@hotmail.com</footer>
    </div>
  );
}
