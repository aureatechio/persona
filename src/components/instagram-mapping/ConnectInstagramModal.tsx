'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Loader2, Link2, CheckCircle2, AlertCircle, Eye, EyeOff, Terminal, FileJson, LogIn } from 'lucide-react';

interface ConnectInstagramModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: (session: { id: string; ig_username: string }) => void;
}

type Mode = 'devtools' | 'json' | 'login';

export function ConnectInstagramModal({ open, onClose, onConnected }: ConnectInstagramModalProps) {
  const [mode, setMode] = useState<Mode>('devtools');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [dsUserId, setDsUserId] = useState('');
  const [cookiesText, setCookiesText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  // Build cookie array from individual values
  const buildCookiesFromValues = () => {
    const cookies = [];
    if (sessionId.trim()) {
      cookies.push({ name: 'sessionid', value: sessionId.trim(), domain: '.instagram.com', path: '/', secure: true, httpOnly: true, sameSite: 'None' });
    }
    if (csrfToken.trim()) {
      cookies.push({ name: 'csrftoken', value: csrfToken.trim(), domain: '.instagram.com', path: '/', secure: true, httpOnly: false, sameSite: 'None' });
    }
    if (dsUserId.trim()) {
      cookies.push({ name: 'ds_user_id', value: dsUserId.trim(), domain: '.instagram.com', path: '/', secure: true, httpOnly: false, sameSite: 'None' });
    }
    return cookies;
  };

  const connectWithCookies = async (cookies: unknown) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/instagram-mapping/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ig_username: username.replace(/^@/, '').trim(),
          session_cookies: cookies,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao conectar');
        setLoading(false);
        return;
      }

      onConnected(data.session);
      onClose();
    } catch {
      setError('Erro de conexao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevtoolsConnect = () => {
    if (!username.trim()) {
      setError('Preencha o usuario');
      return;
    }
    if (!sessionId.trim()) {
      setError('O sessionid e obrigatorio');
      return;
    }
    connectWithCookies(buildCookiesFromValues());
  };

  const handleJsonConnect = () => {
    if (!username.trim() || !cookiesText.trim()) {
      setError('Preencha o usuario e cole os cookies');
      return;
    }

    try {
      const parsed = JSON.parse(cookiesText);
      connectWithCookies(parsed);
    } catch {
      setError('JSON invalido. Copie exatamente o que a extensao exportou.');
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Preencha usuario e senha');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/instagram-mapping/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ig_username: username.replace(/^@/, '').trim(),
          password: password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao conectar');
        setLoading(false);
        return;
      }

      onConnected(data.session);
      onClose();
    } catch {
      setError('Erro de conexao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: Mode; label: string; icon: React.ReactNode }[] = [
    { key: 'devtools', label: 'Cookies (F12)', icon: <Terminal size={12} /> },
    { key: 'json', label: 'JSON completo', icon: <FileJson size={12} /> },
    { key: 'login', label: 'Login direto', icon: <LogIn size={12} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className={cn(
        'relative w-full max-w-md max-h-[90vh] overflow-y-auto',
        'bg-zinc-950 border border-white/[0.08]',
        'rounded-2xl shadow-2xl shadow-black/60',
      )}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950 flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-pink-500/20">
              <Link2 size={16} className="text-pink-400" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Conectar Instagram</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex px-6 pt-4 gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setMode(tab.key); setError(''); }}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-medium transition-all duration-200',
                mode === tab.key
                  ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Username (shared) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Usuario do Instagram
            </label>
            <input
              type="text"
              placeholder="seuusuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn(
                'w-full px-4 py-3',
                'bg-white/[0.04] hover:bg-white/[0.06]',
                'border border-white/[0.08] focus:border-emerald-500/50',
                'rounded-xl text-sm text-white placeholder:text-zinc-600',
                'outline-none focus:ring-2 focus:ring-emerald-500/20',
                'transition-all duration-200',
              )}
            />
          </div>

          {/* ─── DevTools mode ─── */}
          {mode === 'devtools' && (
            <>
              <div className="space-y-2.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-400 font-medium">Como pegar o sessionid:</p>
                  <span className="text-[10px] text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15">Recomendado</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { text: 'Abra instagram.com no Chrome (logado)', bold: '' },
                    { text: 'Pressione', bold: 'F12' },
                    { text: 'Clique na aba', bold: 'Application' },
                    { text: 'No menu lateral:', bold: 'Cookies > instagram.com' },
                    { text: 'Procure', bold: 'sessionid' },
                    { text: 'Clique duas vezes no valor e copie (Ctrl+C)', bold: '' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold grid place-content-center border border-emerald-500/20">
                        {i + 1}
                      </span>
                      <p className="text-[11px] text-zinc-500 leading-relaxed pt-0.5">
                        {step.text}{step.bold && <> <code className="text-emerald-400/80 bg-emerald-500/10 px-1 py-0.5 rounded text-[10px]">{step.bold}</code></>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cookie fields */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    sessionid <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Cole o valor do sessionid"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5',
                      'bg-white/[0.04] hover:bg-white/[0.06]',
                      'border border-white/[0.08] focus:border-emerald-500/50',
                      'rounded-xl text-xs text-white placeholder:text-zinc-600 font-mono',
                      'outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-200',
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    csrftoken <span className="text-zinc-600">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Cole o valor do csrftoken"
                    value={csrfToken}
                    onChange={(e) => setCsrfToken(e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5',
                      'bg-white/[0.04] hover:bg-white/[0.06]',
                      'border border-white/[0.08] focus:border-emerald-500/50',
                      'rounded-xl text-xs text-white placeholder:text-zinc-600 font-mono',
                      'outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-200',
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    ds_user_id <span className="text-zinc-600">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Cole o valor do ds_user_id"
                    value={dsUserId}
                    onChange={(e) => setDsUserId(e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5',
                      'bg-white/[0.04] hover:bg-white/[0.06]',
                      'border border-white/[0.08] focus:border-emerald-500/50',
                      'rounded-xl text-xs text-white placeholder:text-zinc-600 font-mono',
                      'outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-200',
                    )}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300 leading-relaxed">{error}</p>
                </div>
              )}

              <button
                onClick={handleDevtoolsConnect}
                disabled={loading}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 px-5 py-3',
                  'bg-emerald-500 hover:bg-emerald-400',
                  'text-black font-semibold text-sm',
                  'rounded-xl shadow-lg shadow-emerald-500/25',
                  'active:scale-[0.97] transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Conectando...</>
                ) : (
                  <><CheckCircle2 size={14} /> Conectar</>
                )}
              </button>
            </>
          )}

          {/* ─── JSON mode ─── */}
          {mode === 'json' && (
            <>
              <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Use a extensao EditThisCookie V3 no Chrome para exportar os cookies do instagram.com como JSON.
                </p>
              </div>

              <textarea
                rows={5}
                placeholder='Cole o JSON dos cookies aqui...'
                value={cookiesText}
                onChange={(e) => setCookiesText(e.target.value)}
                className={cn(
                  'w-full px-4 py-3',
                  'bg-white/[0.04] hover:bg-white/[0.06]',
                  'border border-white/[0.08] focus:border-emerald-500/50',
                  'rounded-xl text-xs text-white placeholder:text-zinc-600',
                  'outline-none focus:ring-2 focus:ring-emerald-500/20',
                  'transition-all duration-200 font-mono resize-none',
                )}
              />

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300 leading-relaxed">{error}</p>
                </div>
              )}

              <button
                onClick={handleJsonConnect}
                disabled={loading}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 px-5 py-3',
                  'bg-emerald-500 hover:bg-emerald-400',
                  'text-black font-semibold text-sm',
                  'rounded-xl shadow-lg shadow-emerald-500/25',
                  'active:scale-[0.97] transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Conectando...</>
                ) : (
                  <><CheckCircle2 size={14} /> Conectar</>
                )}
              </button>
            </>
          )}

          {/* ─── Login mode ─── */}
          {mode === 'login' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Sua senha do Instagram"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleLogin()}
                    className={cn(
                      'w-full px-4 py-3 pr-12',
                      'bg-white/[0.04] hover:bg-white/[0.06]',
                      'border border-white/[0.08] focus:border-emerald-500/50',
                      'rounded-xl text-sm text-white placeholder:text-zinc-600',
                      'outline-none focus:ring-2 focus:ring-emerald-500/20',
                      'transition-all duration-200',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Nao funciona com verificacao em duas etapas (2FA). Se sua conta tem 2FA, use a aba DevTools.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300 leading-relaxed">{error}</p>
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 px-5 py-3',
                  'bg-emerald-500 hover:bg-emerald-400',
                  'text-black font-semibold text-sm',
                  'rounded-xl shadow-lg shadow-emerald-500/25',
                  'active:scale-[0.97] transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> Conectando... (~30s)</>
                ) : (
                  <><CheckCircle2 size={14} /> Conectar</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
