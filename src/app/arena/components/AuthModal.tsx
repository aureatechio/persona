// Arena PWA — Auth Modal (Login/Signup)

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, ChevronDown, Search, Eye, EyeOff, Camera, Loader2 } from 'lucide-react';
import { useAuthStore } from '../authStore';
import { BRAZILIAN_STATES } from '../constants';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ visible, onClose, onSuccess }: AuthModalProps) {
  const { signUp, signIn } = useAuthStore();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ideology, setIdeology] = useState<'esquerda' | 'centro' | 'direita' | null>(null);
  const [selectedState, setSelectedState] = useState('');
  const [city, setCity] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [error, setError] = useState('');

  // Fetch cities when state changes
  useEffect(() => {
    if (!selectedState || selectedState === 'brasil') {
      setCitySuggestions([]);
      return;
    }
    setLoadingCities(true);
    setCitySuggestions([]);
    fetch(`/api/arena/cities?state=${selectedState}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const cities = data.map((c: any) => (typeof c === 'string' ? c : c.city || c.name || '')).filter(Boolean);
          setCitySuggestions(cities.slice(0, 100));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCities(false));
  }, [selectedState]);

  const filteredCities = citySearch.length >= 1 && !city
    ? citySuggestions.filter((c) => c.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 8)
    : [];

  const canSubmitSignup = name.trim() && email.trim() && password.length >= 6 && ideology && selectedState;
  const canSubmitSignin = email.trim() && password.length >= 6;

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        const result = await signUp({
          email: email.trim(),
          password,
          name: name.trim(),
          ideology: ideology!,
          state: selectedState,
          city: city || undefined,
        });
        if (result.error) { setError(result.error); return; }
      } else {
        const result = await signIn(email.trim(), password);
        if (result.error) { setError(result.error); return; }
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }, [mode, email, password, name, ideology, selectedState, city, signUp, signIn, onSuccess]);

  const inputCls = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[15px] text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200';

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed inset-x-0 bottom-0 top-8 z-[60] bg-black rounded-t-2xl overflow-y-auto overscroll-contain"
          >
            <div className="p-5 pb-40 max-w-md mx-auto">
              {/* Header */}
              <div className="flex justify-end mb-2">
                <button onClick={onClose} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>

              {/* Avatar (signup) */}
              {mode === 'signup' && (
                <div className="flex flex-col items-center mb-5">
                  <div className="w-20 h-20 rounded-full border-[1.5px] border-dashed border-emerald-500/20 bg-emerald-500/[0.03] flex items-center justify-center">
                    <Camera size={28} className="text-emerald-400/40" />
                  </div>
                  <span className="text-[11px] text-emerald-400 mt-1.5">Adicionar foto</span>
                </div>
              )}

              {/* Title */}
              <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">
                {mode === 'signup' ? 'Criar conta' : 'Entrar'}
              </h2>
              <p className="text-[13px] text-zinc-500 mb-6">
                {mode === 'signup' ? 'Preencha seus dados para começar a analisar' : 'Acesse sua conta para continuar'}
              </p>

              {/* Error */}
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 mb-4">
                  <p className="text-sm text-rose-400">{error}</p>
                </div>
              )}

              {/* Form */}
              <div className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-1.5 block">Nome</label>
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" autoCapitalize="words" />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-1.5 block">Email</label>
                  <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoCapitalize="none" />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-1.5 block">Senha</label>
                  <div className="relative">
                    <input
                      className={inputCls + ' pr-12'}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoCapitalize="none"
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
                      {showPassword ? <EyeOff size={18} className="text-zinc-500" /> : <Eye size={18} className="text-zinc-500" />}
                    </button>
                  </div>
                </div>

                {mode === 'signup' && (
                  <>
                    {/* Ideology */}
                    <div>
                      <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-1.5 block">Posicionamento Político</label>
                      <div className="grid grid-cols-3 gap-2.5">
                        {([
                          { val: 'esquerda', label: '← Esquerda', color: '#fb7185' },
                          { val: 'centro', label: 'Centro', color: '#a78bfa' },
                          { val: 'direita', label: 'Direita →', color: '#38bdf8' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.val}
                            onClick={() => setIdeology(opt.val)}
                            className={`py-3.5 rounded-xl border text-sm font-bold transition-all duration-200 active:scale-95 ${
                              ideology === opt.val
                                ? 'border-white/[0.15] bg-white/[0.06]'
                                : 'border-white/[0.08] bg-white/[0.04] text-zinc-400'
                            }`}
                            style={ideology === opt.val ? { color: opt.color, borderColor: `${opt.color}33`, backgroundColor: `${opt.color}10` } : undefined}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* State */}
                    <div>
                      <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-1.5 block">Estado *</label>
                      <button
                        onClick={() => setShowStateDropdown(!showStateDropdown)}
                        className="w-full flex items-center justify-between bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 transition-all duration-200"
                      >
                        <span className={selectedState ? 'text-[15px] text-white' : 'text-[15px] text-zinc-600'}>
                          {selectedState ? BRAZILIAN_STATES.find((st) => st.value === selectedState)?.label : 'Selecione seu estado'}
                        </span>
                        <ChevronDown size={16} className="text-zinc-500" />
                      </button>
                      {showStateDropdown && (
                        <div className="mt-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl max-h-48 overflow-y-auto">
                          {BRAZILIAN_STATES.map((st) => (
                            <button
                              key={st.value}
                              onClick={() => { setSelectedState(st.value); setShowStateDropdown(false); setCity(''); setCitySearch(''); }}
                              className={`w-full text-left px-4 py-3 border-b border-white/[0.04] text-sm transition-colors ${
                                selectedState === st.value ? 'text-emerald-400 bg-emerald-500/[0.06]' : 'text-zinc-300 hover:bg-white/[0.04]'
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* City */}
                    {selectedState !== 'brasil' && (
                    <div>
                      <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-1.5 block">Cidade (opcional)</label>
                      <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4">
                        <Search size={16} className="text-zinc-600 shrink-0" />
                        <input
                          className="flex-1 bg-transparent py-3.5 text-[15px] text-white placeholder:text-zinc-600 outline-none"
                          style={{ fontSize: '16px' }}
                          value={citySearch}
                          onChange={(e) => { setCitySearch(e.target.value); setCity(''); }}
                          placeholder={loadingCities ? 'Carregando...' : !selectedState ? 'Selecione o estado primeiro' : 'Buscar cidade...'}
                          disabled={!selectedState || loadingCities}
                        />
                      </div>
                      {filteredCities.length > 0 && (
                        <div className="mt-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl max-h-48 overflow-y-auto">
                          {filteredCities.map((c) => (
                            <button
                              key={c}
                              onClick={() => { setCity(c); setCitySearch(c); }}
                              className="w-full text-left px-4 py-3 border-b border-white/[0.04] text-sm text-zinc-300 hover:bg-white/[0.04] transition-colors"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    )}

                    {/* Info */}
                    <div className="flex items-start gap-2.5 bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl p-3">
                      <MapPin size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Análises serão baseadas na sua localização. Se informar só o estado, a análise será estadual. Se informar a cidade, será municipal.
                      </p>
                    </div>
                  </>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading || (mode === 'signup' ? !canSubmitSignup : !canSubmitSignin)}
                  className="w-full h-[52px] rounded-xl bg-emerald-500 text-black font-bold text-[15px] shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : mode === 'signup' ? 'Criar conta' : 'Entrar'}
                </button>

                {/* Toggle */}
                <button
                  onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}
                  className="w-full text-center py-2"
                >
                  <span className="text-[13px] text-zinc-500">
                    {mode === 'signup' ? 'Já tem conta? ' : 'Não tem conta? '}
                    <span className="text-emerald-400 font-bold">{mode === 'signup' ? 'Entrar' : 'Criar conta'}</span>
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
