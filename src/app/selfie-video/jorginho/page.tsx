'use client';

import { Camera, ChevronRight, RotateCcw, Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

import { useSelfieRecorder } from '../_shared/useSelfieRecorder';

// Theme tokens — Santa Catarina / Jorginho Mello
// Palette driven by the reference mockup: navy base + gold CTA +
// green/yellow flag swoosh in the hero corner.
const NAVY_DEEP = '#0D2256';      // page background
const NAVY_CARD = '#14306E';      // form card bg (subtle contrast)
const NAVY_INPUT = '#0B1D48';     // inputs
const GOLD = '#FFD21F';           // accent + CTA
const GOLD_HOVER = '#FFDE4B';
const GREEN_FLAG = '#0FA958';     // swoosh accent

function HeroBackdrop() {
  // Night aerial view of Ponte Hercílio Luz + Florianópolis skyline.
  // Cropped in /public/politicos/ to remove the stock-photo watermarks.
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image
        src="/politicos/jorginho-sc-hero.jpg"
        alt="Ponte Hercílio Luz iluminada à noite"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Top darken for status-bar readability */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />

      {/* Bottom gradient — blends the photo into the navy page background */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0D2256] via-[#0D2256]/70 to-transparent" />
    </div>
  );
}

function FlagSwoosh() {
  // Single unified yellow band sweeping across the top: thicker at the
  // right corner, thinner at the left corner, with a smooth dip in the
  // middle (no visible seam between the two sides). Green is a straight
  // triangle in the top-right corner.
  return (
    <div className="absolute top-0 right-0 w-full h-[95%] pointer-events-none">
      <svg
        viewBox="0 0 300 180"
        preserveAspectRatio="none"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Yellow — one continuous cubic Bezier from top-left corner (depth 90)
            to top-right corner (depth 150), dipping through (~150, 15) in the
            middle. Cubic control points pull the curve upward so the hero photo
            stays visible between the two ends. */}
        <path
          d="M 0 0 L 0 90 C 60 -20 240 -20 300 150 L 300 0 Z"
          fill={GOLD}
        />
        {/* Green — straight-edged right triangle in the top-right corner */}
        <path
          d="M 300 0 L 300 70 L 200 0 Z"
          fill={GREEN_FLAG}
        />
      </svg>
    </div>
  );
}

export default function SelfieVideoJorginhoPage() {
  const r = useSelfieRecorder({ slug: 'jorginho' });

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden" style={{ backgroundColor: NAVY_DEEP }}>
      <main className="flex-1 flex flex-col">
        {/* ===== STEP: DADOS ===== */}
        {r.step === 'dados' && (
          <div className="flex-1 flex flex-col">
            {/* ── Hero ───────────────────────────────────── */}
            <div className="relative h-[30vh] min-h-[200px] max-h-[290px] w-full">
              <HeroBackdrop />
              <FlagSwoosh />
            </div>

            {/* Logo PL — ultra-tight white card (just a thin border), floats over hero + body */}
            <div className="relative z-20 flex justify-center -mt-12">
              <div className="bg-white rounded-2xl p-0.5 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.6)]">
                <Image
                  src="/logo-pl.png"
                  alt="PL - Partido Liberal"
                  width={110}
                  height={110}
                  className="w-24 h-24 object-contain block"
                />
              </div>
            </div>

            {/* ── Body ───────────────────────────────────── */}
            <div className="flex-1 flex flex-col px-6 pt-4 pb-8 max-w-md mx-auto w-full">
              {/* Headline */}
              <div className="text-center mb-3">
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight uppercase">
                  Santa Catarina melhorou
                </h1>
                <h2 className="text-xl font-medium text-white tracking-tight leading-tight uppercase mt-1">
                  E vai continuar melhorando!
                </h2>
              </div>

              <p className="text-center text-sm font-semibold leading-relaxed mb-2" style={{ color: GOLD }}>
                Você é protagonista de um plano de governo que dá certo.
              </p>

              <p className="text-center text-xs text-white/80 leading-relaxed mb-4 px-2">
                <span className="font-bold">GRAVE UM VÍDEO AGORA</span> com suas sugestões que
                {' '}<span className="font-bold">ENVIAREMOS UM VÍDEO DE VOLTA.</span>
              </p>

              {/* Form card */}
              <div
                className="rounded-2xl p-5 shadow-xl shadow-black/30 space-y-4"
                style={{ backgroundColor: NAVY_CARD }}
              >
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2 block text-white">
                    Como quer ser chamado?
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={r.name}
                      onChange={(e) => r.setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl text-base text-white placeholder:text-white/30 outline-none focus:ring-2 transition-all duration-200"
                      style={{
                        backgroundColor: NAVY_INPUT,
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                      placeholder="Seu nome"
                      autoComplete="given-name"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2 block text-white">
                    Seu telefone
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-white/50 text-sm pointer-events-none">
                      <span className="text-base leading-none">🇧🇷</span>
                      <span className="font-medium">+55</span>
                    </span>
                    <input
                      type="tel"
                      value={r.phone}
                      onChange={(e) => r.setPhone(e.target.value)}
                      className="w-full pl-[5.25rem] pr-4 py-3.5 rounded-xl text-base text-white placeholder:text-white/30 outline-none focus:ring-2 transition-all duration-200"
                      style={{
                        backgroundColor: NAVY_INPUT,
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                      placeholder="(XX) XXXXX-XXXX"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <button
                  onClick={r.handleContinueToDados}
                  disabled={!r.canContinueDados}
                  className={cn(
                    'w-full inline-flex items-center justify-center gap-2 px-6 py-4 mt-2',
                    'font-bold text-sm tracking-wide',
                    'rounded-xl',
                    'shadow-lg',
                    'active:scale-[0.97]',
                    'transition-all duration-200',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                  style={{
                    backgroundColor: GOLD,
                    color: NAVY_DEEP,
                    boxShadow: '0 8px 20px -6px rgba(255,210,31,0.4)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GOLD_HOVER)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GOLD)}
                >
                  Envie sua contribuição
                  <ChevronRight size={16} />
                </button>
              </div>

              {r.error && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
                  <p className="text-red-300 text-xs">{r.error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== STEP: GRAVAÇÃO ===== */}
        {r.step === 'gravacao' && (
          <div className="flex-1 flex flex-col relative">
            <div className="flex-1 relative bg-black">
              <video
                ref={r.videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />

              <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10">
                <div className="text-center">
                  <p className="text-white text-sm font-medium">
                    {r.isRecording
                      ? 'Gravando...'
                      : `Grave até ${r.maxSeconds}s com sua sugestão para Santa Catarina`}
                  </p>
                </div>
              </div>

              {r.isRecording && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-full">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white text-sm font-mono font-bold">
                      {r.recordingTime}s / {r.maxSeconds}s
                    </span>
                  </div>
                  <div className="mt-2 w-48 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
                    <div
                      className="h-full bg-red-500 transition-all duration-1000 rounded-full"
                      style={{ width: `${(r.recordingTime / r.maxSeconds) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {r.error && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/90">
                  <div className="text-center px-6">
                    <p className="text-red-400 text-sm mb-4">{r.error}</p>
                    <button
                      onClick={() => { r.setError(null); r.startCamera(); }}
                      className="px-4 py-2 bg-white/10 rounded-xl text-white text-sm transition-colors duration-200 hover:bg-white/20"
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 px-6 py-6 border-t border-white/5" style={{ backgroundColor: NAVY_DEEP }}>
              <div className="flex items-center justify-center">
                {!r.isRecording ? (
                  <button
                    onClick={r.startRecording}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/30 flex items-center justify-center active:scale-[0.95] transition-all duration-200 ring-4 ring-white/20"
                  >
                    <div className="w-7 h-7 bg-white rounded-full" />
                  </button>
                ) : (
                  <button
                    onClick={r.stopRecording}
                    disabled={!r.canStopRecording}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/30 flex items-center justify-center active:scale-[0.95] transition-all duration-200 ring-4 ring-white/20 disabled:opacity-50"
                  >
                    <div className="w-7 h-7 bg-white rounded-md" />
                  </button>
                )}
              </div>
              {r.isRecording && !r.canStopRecording && (
                <p className="text-center text-white/40 text-xs mt-3">
                  Mínimo {r.minSeconds} segundos
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===== STEP: PREVIEW ===== */}
        {r.step === 'preview' && r.previewUrl && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative bg-black">
              <video
                ref={r.previewVideoRef}
                src={r.previewUrl}
                controls
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>

            <div className="shrink-0 px-6 py-6 border-t border-white/5" style={{ backgroundColor: NAVY_DEEP }}>
              {r.error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-center">
                  <p className="text-red-300 text-xs">{r.error}</p>
                </div>
              )}
              <div className="flex items-center gap-3 max-w-md mx-auto">
                <button
                  onClick={r.handleRegravar}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white/[0.08] hover:bg-white/[0.15] text-white/80 hover:text-white border border-white/[0.12] hover:border-white/[0.25] rounded-xl font-medium text-sm active:scale-[0.97] transition-all duration-200"
                >
                  <RotateCcw size={16} />
                  Regravar
                </button>

                <button
                  onClick={r.handleEnviar}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 font-bold text-sm rounded-xl active:scale-[0.97] transition-all duration-200"
                  style={{
                    backgroundColor: GOLD,
                    color: NAVY_DEEP,
                    boxShadow: '0 8px 20px -6px rgba(255,210,31,0.4)',
                  }}
                >
                  <Send size={16} />
                  Enviar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP: ENVIANDO ===== */}
        {r.step === 'enviando' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="w-64 h-64 rounded-full blur-3xl"
                style={{ backgroundColor: 'rgba(255,210,31,0.12)' }}
              />
            </div>

            <div className="relative w-20 h-20 mb-6">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={GOLD}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - r.uploadProgress / 100)}`}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold tabular-nums text-white">{r.uploadProgress}%</span>
              </div>
            </div>

            <p className="text-white font-medium">
              {r.uploadProgress < 10
                ? 'Preparando...'
                : r.uploadProgress < 95
                  ? 'Enviando sua contribuição...'
                  : 'Finalizando...'}
            </p>
            <p className="text-white/40 text-sm mt-2">Não feche esta tela</p>

            <div className="w-full max-w-xs mt-6">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${r.uploadProgress}%`, backgroundColor: GOLD }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP: OBRIGADO ===== */}
        {r.step === 'obrigado' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
            <div
              className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl pointer-events-none"
              style={{ backgroundColor: 'rgba(255,210,31,0.1)' }}
            />
            <div
              className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl pointer-events-none"
              style={{ backgroundColor: 'rgba(15,169,88,0.1)' }}
            />

            <div className="text-center max-w-sm space-y-6 relative">
              <div className="relative inline-flex">
                <div className="w-28 h-28 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/15">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center">
                    <Image src="/logo-pl.png" alt="PL" width={48} height={48} className="w-12 h-auto" />
                  </div>
                </div>
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ backgroundColor: 'rgba(255,210,31,0.1)', animationDuration: '2s' }}
                />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight mb-3">
                  Obrigado pela sua contribuição!
                </h2>
                <p className="text-blue-100/70 text-sm leading-relaxed">
                  <span className="text-white font-semibold">{r.name}</span>, sua sugestão chegou. Vamos
                  te enviar um vídeo de resposta no WhatsApp em breve. Santa Catarina vai continuar melhorando.
                </p>
              </div>

              <button
                onClick={r.handleReset}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 font-bold text-sm rounded-xl active:scale-[0.97] transition-all duration-200"
                style={{
                  backgroundColor: GOLD,
                  color: NAVY_DEEP,
                  boxShadow: '0 8px 20px -6px rgba(255,210,31,0.4)',
                }}
              >
                <Camera size={16} />
                Gravar outro
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
