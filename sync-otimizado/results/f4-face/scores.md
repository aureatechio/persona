# F4 — Face refinement (CodeFormer): comparação contra F1

Generated: 2026-04-30T12:01:51.887Z

**Pipeline F4:** audio_preprocess → LatentSync B → **CodeFormer face restoration** (fidelity_weight=0.7).
**Comparação base:** F1 outputs (audio_preprocess + LatentSync B, sem face refine).

**Nota:** F4 é fundamentalmente uma melhoria VISUAL — o SyncNet mede sync de boca,
não textura/nitidez. Espera-se que Sync-D/C fiquem estáveis (ou piorem levemente),
enquanto a melhoria real aparece na avaliação visual dos .mp4.

## Resultados SyncNet

| Caso | Métrica | F1 (base) | F4 (+ CodeFormer) | Δ |
|---|---|---|---|---|
| duda | Sync-D ↓ | 8.754 | **8.809** | +0.055 |
| duda | Sync-C ↑ | 5.538 | **5.472** | -0.066 |
| flavio | Sync-D ↓ | 7.482 | **7.495** | +0.013 |
| flavio | Sync-C ↑ | 7.453 | **7.349** | -0.104 |
| principal-flavio | Sync-D ↓ | 6.838 | **6.675** | -0.163 |
| principal-flavio | Sync-C ↑ | 8.147 | **8.183** | +0.036 |

## Outputs pra avaliação visual

| Caso | F1 (base) | F4 (+ CodeFormer) |
|---|---|---|
| duda | results/f1-audio/duda.mp4 | results/f4-face/duda.mp4 |
| flavio | results/f1-audio/flavio.mp4 | results/f4-face/flavio.mp4 |
| principal-flavio | results/f1-audio/principal-flavio.mp4 | results/f4-face/principal-flavio.mp4 |

## Detalhes

### duda
- CodeFormer: 235s (image corrigida: torch 2.5.1 + ffmpeg-python)
- SyncNet: ~60s

### flavio
- CodeFormer: 286.2s
- SyncNet: 48.9s
- Tracks: 1, AV offset: 0

### principal-flavio
- CodeFormer: 284.2s
- SyncNet: 51.5s
- Tracks: 3, AV offset: 0

