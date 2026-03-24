// Arena PWA — ProfileSheet (exact match of mobile ProfileSheet.tsx)

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Pencil, Check, ChevronDown, Search, Loader2, History, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../authStore';
import { useArenaStore } from '../store';
import { BRAZILIAN_STATES, scoreToEmoji } from '../constants';

interface ProfileSheetProps {
  visible: boolean;
  onClose: () => void;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function ProfileSheet({ visible, onClose }: ProfileSheetProps) {
  const { profile, signOut, updateProfile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [ideology, setIdeology] = useState<'esquerda' | 'centro' | 'direita' | null>(null);
  const [selectedState, setSelectedState] = useState('');
  const [city, setCity] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const loadFromHistory = useArenaStore((s) => s.loadFromHistory);

  useEffect(() => {
    if (visible && profile) {
      setName(profile.name || '');
      setIdeology(profile.ideology || null);
      setSelectedState(profile.state || '');
      setCity(profile.city || '');
      setCitySearch(profile.city || '');
      setEditing(false);

      // Fetch history
      setLoadingHistory(true);
      fetch('/api/arena/history')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setHistoryItems(data); })
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [visible, profile]);

  useEffect(() => {
    if (!selectedState || selectedState === 'brasil') { setCitySuggestions([]); return; }
    fetch(`/api/arena/cities?state=${selectedState}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCitySuggestions(data.map((c: any) => (typeof c === 'string' ? c : c.city || '')).filter(Boolean).slice(0, 100));
      })
      .catch(() => {});
  }, [selectedState]);

  const filteredCities = citySearch.length >= 1 && city !== citySearch
    ? citySuggestions.filter((c) => c.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 6)
    : [];

  if (!profile) return null;

  const stateLabel = BRAZILIAN_STATES.find((st) => st.value === profile.state)?.label || profile.state || '—';
  const ideologyLabel = profile.ideology === 'esquerda' ? '← Esquerda' : profile.ideology === 'centro' ? 'Centro' : profile.ideology === 'direita' ? 'Direita →' : '—';

  const handleSignOut = async () => { await signOut(); onClose(); };
  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfile({ name: name.trim(), ideology: ideology || undefined, state: selectedState || undefined, city: city || undefined });
    setSaving(false);
    if (!result.error) setEditing(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl px-5 pb-10"
            style={{ backgroundColor: '#09090b', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3"><div className="w-10 h-1 rounded-full bg-white/[0.15]" /></div>

            {/* Avatar + name */}
            <div className="flex items-center gap-3.5 mb-5 mt-2">
              <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                <span className="text-lg font-extrabold text-zinc-400">{getInitials(profile.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <input className="text-lg font-extrabold text-white tracking-tight bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 w-full outline-none" value={name} onChange={(e) => setName(e.target.value)} />
                ) : (
                  <>
                    <p className="text-lg font-extrabold text-white tracking-tight truncate">{profile.name}</p>
                    <p className="text-[13px] text-zinc-500 mt-0.5">{profile.email}</p>
                  </>
                )}
              </div>
              <button onClick={onClose} className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <X size={18} className="text-zinc-500" />
              </button>
            </div>

            {!editing ? (
              <>
                {/* Info card */}
                <div className="rounded-[14px] overflow-hidden mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                  {[{ l: 'Posicionamento', v: ideologyLabel }, { l: 'Estado', v: stateLabel }, { l: 'Cidade', v: profile.state === 'brasil' ? 'Nacional' : (profile.city || 'Não informada') }].map((row, i) => (
                    <div key={row.l}>
                      <div className="flex justify-between items-center px-4 py-3.5">
                        <span className="text-[13px] text-zinc-500">{row.l}</span>
                        <span className="text-[13px] font-semibold text-white">{row.v}</span>
                      </div>
                      {i < 2 && <div className="h-[0.5px]" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />}
                    </div>
                  ))}
                </div>

                <button onClick={() => setEditing(true)} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[14px] mb-3" style={{ backgroundColor: 'rgba(52,211,153,0.06)', border: '0.5px solid rgba(52,211,153,0.15)' }}>
                  <Pencil size={14} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Editar perfil</span>
                </button>
              </>
            ) : (
              <>
                {/* Ideology */}
                <div className="mb-3.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-1.5 block">Posicionamento</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {([{ val: 'esquerda', label: '← Esquerda', color: '#fb7185' }, { val: 'centro', label: 'Centro', color: '#a78bfa' }, { val: 'direita', label: 'Direita →', color: '#38bdf8' }] as const).map((opt) => (
                      <button key={opt.val} onClick={() => setIdeology(opt.val)} className="py-3 rounded-[14px] text-sm font-bold border active:scale-95 transition-all"
                        style={ideology === opt.val ? { color: opt.color, borderColor: `${opt.color}33`, backgroundColor: `${opt.color}10` } : { color: '#a1a1aa', borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* State */}
                <div className="mb-3.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-1.5 block">Estado</label>
                  <button onClick={() => setShowStateDropdown(!showStateDropdown)} className="w-full flex items-center justify-between rounded-[14px] px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                    <span className={selectedState ? 'text-sm text-white' : 'text-sm text-zinc-600'}>{selectedState ? BRAZILIAN_STATES.find((st) => st.value === selectedState)?.label : 'Selecione'}</span>
                    <ChevronDown size={16} className="text-zinc-500" />
                  </button>
                  {showStateDropdown && (
                    <div className="mt-1.5 rounded-[14px] max-h-44 overflow-y-auto" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                      {BRAZILIAN_STATES.map((st) => (
                        <button key={st.value} onClick={() => { setSelectedState(st.value); setShowStateDropdown(false); setCity(''); setCitySearch(''); }} className="w-full text-left px-4 py-2.5 text-[13px] border-b border-white/[0.04]" style={{ color: selectedState === st.value ? '#34d399' : '#d4d4d8', backgroundColor: selectedState === st.value ? 'rgba(52,211,153,0.06)' : 'transparent' }}>
                          {st.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* City */}
                {selectedState !== 'brasil' && (
                <div className="mb-3.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-1.5 block">Cidade (opcional)</label>
                  <div className="flex items-center gap-2 rounded-[14px] px-3.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                    <Search size={14} className="text-zinc-600 shrink-0" />
                    <input className="flex-1 bg-transparent py-3 text-sm text-white placeholder:text-zinc-600 outline-none" style={{ fontSize: '16px' }} value={citySearch} onChange={(e) => { setCitySearch(e.target.value); setCity(''); }} placeholder="Buscar cidade..." disabled={!selectedState} />
                  </div>
                  {filteredCities.length > 0 && (
                    <div className="mt-1.5 rounded-[14px] max-h-40 overflow-y-auto" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                      {filteredCities.map((c) => (
                        <button key={c} onClick={() => { setCity(c); setCitySearch(c); }} className="w-full text-left px-4 py-2.5 text-[13px] text-zinc-300 border-b border-white/[0.04] hover:bg-white/[0.04]">{c}</button>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Save/Cancel */}
                <div className="flex gap-2.5 mb-3">
                  <button onClick={() => setEditing(false)} className="flex-1 py-3.5 rounded-[14px] text-sm font-semibold text-zinc-400" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-[14px] bg-emerald-400 text-sm font-bold text-black shadow-lg shadow-emerald-500/25">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /><span>Salvar</span></>}
                  </button>
                </div>
              </>
            )}

            {/* ═══ HISTÓRICO DE ANÁLISES ═══ */}
            <div className="mt-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <History size={14} className="text-zinc-500" />
                <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px]">Histórico de Análises</span>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={20} className="text-zinc-600 animate-spin" />
                </div>
              ) : historyItems.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-zinc-600">Nenhuma análise ainda</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/arena/history?id=${item.id}`);
                          const record = await res.json();
                          if (record.id) {
                            loadFromHistory(record);
                            onClose();
                          }
                        } catch {}
                      }}
                      className="w-full text-left rounded-[14px] p-3 active:scale-[0.98] transition-all duration-200"
                      style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0">{scoreToEmoji(item.score)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-white truncate">{item.headline}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {item.platform && <span className="text-[10px] text-zinc-500">{item.platform}</span>}
                            <span className="text-[10px] text-zinc-600">
                              {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-sm font-black tabular-nums text-emerald-400">{item.score?.toFixed(1)}</span>
                          <ChevronRight size={14} className="text-zinc-600" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sign out */}
            <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[14px] mt-1" style={{ backgroundColor: 'rgba(251,113,133,0.05)', border: '0.5px solid rgba(251,113,133,0.15)' }}>
              <LogOut size={16} className="text-rose-400" />
              <span className="text-sm font-semibold text-rose-400">Sair da conta</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
