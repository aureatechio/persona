'use client';

import { Camera, ChevronRight, RotateCcw, Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

import { useSelfieRecorder } from '../_shared/useSelfieRecorder';

// Same layout as Flávio, retheme to the Progressistas palette.
// Colors are derived directly from the logo:
//   NAVY_DEEP  #0A1F3F — page background (darker than the logo text so both
//              the light-blue "P" and the navy wordmark stay visible)
//   NAVY_MID   #123A6B — gradient middle tone
//   LIGHT_BLUE #87C2E5 — the "P" body color, used as primary accent / CTA
const LOGO_SRC = '/politicos/progressistas-logo.png';
const LOGO_ALT = 'Progressistas';

export default function SelfieVideoCiroPage() {
  const r = useSelfieRecorder({ slug: 'ciro' });

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#0A1F3F] via-[#123A6B] to-[#0A1F3F] flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/5 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-center gap-3">
          <Image src={LOGO_SRC} alt={LOGO_ALT} width={1369} height={850} className="h-9 w-auto" />
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* ===== STEP: DADOS ===== */}
        {r.step === 'dados' && (
          <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full relative">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#87C2E5]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#87C2E5]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center mb-8">
              <div className="mb-6">
                <Image src={LOGO_SRC} alt={LOGO_ALT} width={1369} height={850} className="w-48 md:w-56 h-auto mx-auto drop-shadow-lg" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Grave seu depoimento
              </h1>
              <p className="text-blue-200/70 mt-3 text-base leading-relaxed">
                Grave um vídeo curto e receba uma resposta personalizada no WhatsApp
              </p>
            </div>

            <div className="bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] rounded-2xl p-6 shadow-xl shadow-black/30 space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-blue-200/60 mb-2 block">
                  Como quer ser chamado?
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => r.setName(e.target.value)}
                    className={cn(
                      'w-full pl-11 pr-4 py-3.5',
                      'bg-white/[0.08] hover:bg-white/[0.12]',
                      'border border-white/[0.12] focus:border-[#87C2E5]/60',
                      'rounded-xl text-base text-white placeholder:text-white/30',
                      'outline-none focus:ring-2 focus:ring-[#87C2E5]/25',
                      'transition-all duration-200',
                    )}
                    placeholder="Seu nome"
                    autoComplete="given-name"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-blue-200/60 mb-2 block">
                  Seu telefone
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-white/40 text-sm pointer-events-none">
                    <span className="text-base leading-none">🇧🇷</span>
                    <span className="font-medium">+55</span>
                  </span>
                  <input
                    type="tel"
                    value={r.phone}
                    onChange={(e) => r.setPhone(e.target.value)}
                    className={cn(
                      'w-full pl-[5.25rem] pr-4 py-3.5',
                      'bg-white/[0.08] hover:bg-white/[0.12]',
                      'border border-white/[0.12] focus:border-[#87C2E5]/60',
                      'rounded-xl text-base text-white placeholder:text-white/30',
                      'outline-none focus:ring-2 focus:ring-[#87C2E5]/25',
                      'transition-all duration-200',
                    )}
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
                  'bg-[#87C2E5] hover:bg-[#9DCDEA]',
                  'text-[#0A1F3F] font-bold text-sm',
                  'rounded-xl',
                  'shadow-lg shadow-[#87C2E5]/20',
                  'hover:shadow-xl hover:shadow-[#87C2E5]/30',
                  'active:scale-[0.97]',
                  'transition-all duration-200',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                Continuar
                <ChevronRight size={16} />
              </button>
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
                    {r.isRecording ? 'Gravando...' : `Grave até ${r.maxSeconds}s dizendo o que achou do evento`}
                  </p>
                </div>
              </div>

              {r.isRecording && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 backdrop-blur-xl border border-red-500/30 rounded-full">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white text-sm font-mono font-bold">{r.recordingTime}s / {r.maxSeconds}s</span>
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

            <div className="shrink-0 bg-[#0A1F3F] border-t border-white/10 px-6 py-6">
              <div className="flex items-center justify-center">
                {!r.isRecording ? (
                  <button
                    onClick={r.startRecording}
                    className={cn(
                      'w-20 h-20 rounded-full',
                      'bg-red-500 hover:bg-red-400',
                      'shadow-lg shadow-red-500/30',
                      'flex items-center justify-center',
                      'active:scale-[0.95]',
                      'transition-all duration-200',
                      'ring-4 ring-white/20',
                    )}
                  >
                    <div className="w-7 h-7 bg-white rounded-full" />
                  </button>
                ) : (
                  <button
                    onClick={r.stopRecording}
                    disabled={!r.canStopRecording}
                    className={cn(
                      'w-20 h-20 rounded-full',
                      'bg-red-500 hover:bg-red-400',
                      'shadow-lg shadow-red-500/30',
                      'flex items-center justify-center',
                      'active:scale-[0.95]',
                      'transition-all duration-200',
                      'ring-4 ring-white/20',
                      'disabled:opacity-50',
                    )}
                  >
                    <div className="w-7 h-7 bg-white rounded-md" />
                  </button>
                )}
              </div>
              {r.isRecording && !r.canStopRecording && (
                <p className="text-center text-white/40 text-xs mt-3">Mínimo {r.minSeconds} segundos</p>
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

            <div className="shrink-0 bg-[#0A1F3F] border-t border-white/10 px-6 py-6">
              {r.error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-center">
                  <p className="text-red-400 text-xs">{r.error}</p>
                </div>
              )}
              <div className="flex items-center gap-3 max-w-md mx-auto">
                <button
                  onClick={r.handleRegravar}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5',
                    'bg-white/[0.08] hover:bg-white/[0.15]',
                    'text-white/80 hover:text-white',
                    'border border-white/[0.12] hover:border-white/[0.25]',
                    'rounded-xl font-medium text-sm',
                    'active:scale-[0.97] transition-all duration-200',
                  )}
                >
                  <RotateCcw size={16} />
                  Regravar
                </button>

                <button
                  onClick={r.handleEnviar}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5',
                    'bg-[#87C2E5] hover:bg-[#9DCDEA]',
                    'text-[#0A1F3F] font-bold text-sm',
                    'rounded-xl',
                    'shadow-lg shadow-[#87C2E5]/20',
                    'active:scale-[0.97] transition-all duration-200',
                  )}
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
              <div className="w-64 h-64 bg-[#87C2E5]/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-20 h-20 mb-6">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke="#87C2E5"
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
              {r.uploadProgress < 10 ? 'Preparando...' : r.uploadProgress < 95 ? 'Enviando seu video...' : 'Finalizando...'}
            </p>
            <p className="text-white/40 text-sm mt-2">Nao feche esta tela</p>

            <div className="w-full max-w-xs mt-6">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#87C2E5] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${r.uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP: OBRIGADO ===== */}
        {r.step === 'obrigado' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#87C2E5]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#87C2E5]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center max-w-sm space-y-6 relative">
              <div className="relative inline-flex">
                <Image src={LOGO_SRC} alt={LOGO_ALT} width={1369} height={850} className="w-40 h-auto drop-shadow-lg" />
                <div className="absolute inset-0 rounded-full animate-ping bg-[#87C2E5]/10" style={{ animationDuration: '2s' }} />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight mb-3">
                  Obrigado pelo seu depoimento!
                </h2>
                <p className="text-blue-100/60 text-sm leading-relaxed">
                  <span className="text-white font-semibold">{r.name}</span>, nosso time vai assistir seu depoimento com muito carinho. E vamos te enviar um vídeo no seu WhatsApp em até 10 minutos.
                </p>
              </div>

              <button
                onClick={r.handleReset}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 px-6 py-4',
                  'bg-[#87C2E5] hover:bg-[#9DCDEA]',
                  'text-[#0A1F3F] font-bold text-sm',
                  'rounded-xl',
                  'shadow-lg shadow-[#87C2E5]/20',
                  'active:scale-[0.97] transition-all duration-200',
                )}
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
