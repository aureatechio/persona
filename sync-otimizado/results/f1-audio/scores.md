# F1 — Audio preprocess: comparação contra baseline

Generated: 2026-04-30T01:51:38.337Z

**Pipeline F1:** ffmpeg `afftdn (denoise) → highpass 80Hz → lowpass 8kHz → loudnorm EBU R128 -16 LUFS → mono 44.1kHz` → LatentSync (variant B, prod).
**Baseline:** mesma config B sem audio preprocess.

## Resultados

| Caso | Métrica | Baseline | F1 (audio preproc) | Δ |
|---|---|---|---|---|
| duda | Sync-D ↓ | 8.726 | **8.754** | +0.028 ↑ |
| duda | Sync-C ↑ | 5.611 | **5.538** | -0.073 ↓ |
| flavio | Sync-D ↓ | 7.673 | **7.482** | -0.191 ↓ |
| flavio | Sync-C ↑ | 7.217 | **7.453** | +0.236 ↑ |
| principal-flavio | Sync-D ↓ | 7.352 | **6.838** | -0.514 ↓ |
| principal-flavio | Sync-C ↑ | 7.711 | **8.147** | +0.436 ↑ |

## Detalhes

### duda
- Output: `C:\Users\victo\persona\sync-otimizado\results\f1-audio\duda.mp4`
- Tempos: audio_preprocess 3.1s + LatentSync 664.9s + SyncNet 74.2s
- Tracks SyncNet: 1, AV offset: 0

### flavio
- Output: `C:\Users\victo\persona\sync-otimizado\results\f1-audio\flavio.mp4`
- Tempos: audio_preprocess 2.4s + LatentSync 643.5s + SyncNet 47.4s
- Tracks SyncNet: 1, AV offset: 0

### principal-flavio
- Output: `C:\Users\victo\persona\sync-otimizado\results\f1-audio\principal-flavio.mp4`
- Tempos: audio_preprocess 3.1s + LatentSync 632.4s + SyncNet 51.4s
- Tracks SyncNet: 3, AV offset: 0


## Conclusão

2/3 casos melhoraram em pelo menos uma métrica.
