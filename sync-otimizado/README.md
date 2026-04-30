# sync-otimizado

Pipeline de lipsync experimental, construído em fases ortogonais sobre o LatentSync atual.

O setup atual em `modal-enhance/` e `scripts/sweep-latentsync.mjs` permanece intocado — vira a baseline contra a qual cada fase é comparada.

## Estrutura

```
sync-otimizado/
├── modal/                  # Modal functions novas (uma por etapa)
├── scripts/
│   ├── benchmark/          # F0 — métricas reprodutíveis
│   ├── sweep-params.mjs    # F3 — sweep extendido
│   └── run-pipeline.mjs    # F6 — cliente do orquestrador
├── samples-control/        # suite fixa (5 arquivos + suite.json)
├── results/
│   ├── baseline/
│   ├── f1-audio/, f2-video/, f3-params/, f4-face/, f5-rife/, f6-pipeline/
└── README.md
```

## Fases

| Fase | O que faz | Status |
|---|---|---|
| F0 | Suite + métricas (Sync-D, LPIPS) → baseline | ⏳ |
| F1 | Pré-processamento de áudio (denoise, EQ, loudnorm) | ⏳ |
| F2 | CRF do reencode 25fps: 18 → 12 | ⏳ |
| F3 | Sweep de inference_steps × guidance × deepcache | ⏳ |
| F4 | Face refinement (CodeFormer/GFPGAN) pós-LatentSync | ⏳ |
| F5 | RIFE: 25fps → 30fps no output | ⏳ |
| F6 | Orquestrador end-to-end com flags por etapa | ⏳ |

## Princípios

1. **Cada fase é uma Modal function isolada** — pode ser invocada sozinha pra debug
2. **Cache de intermediários** no Supabase (storage_path do LatentSync output) — não rerodar inference toda vez que ajustar pós
3. **Toggle por etapa** no orquestrador F6 — A/B fica trivial
4. **Score em cada mudança** contra a baseline F0 — sem improviso visual

## Decisões já fechadas

- LatentSync **interno em 25fps** (modelo treinado nisso). Volta pra 30fps só na F5, opcional.
- Whisper-tiny fica (UNet `latentsync_unet.pt` foi treinado com cross_attention_dim=384 = whisper-tiny). Trocar pra medium/large exige re-treino.
- A10G como GPU padrão (~$1.10/h). H100 fica pra quando justificar batching.

## Rodando localmente

```bash
# F0 — gera baseline scores
node sync-otimizado/scripts/benchmark/compare-suite.mjs

# F1 — testar audio preprocess sozinho
node sync-otimizado/scripts/run-pipeline.mjs --case=duda --audio-preprocess=on --face-refine=off --rife=off

# F6 — pipeline completo
node sync-otimizado/scripts/run-pipeline.mjs --case=flavio --all
```

(Comandos placeholder — serão criados durante as fases correspondentes.)
