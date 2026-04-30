# F2 — Vídeo CRF 12: comparação contra F1 (CRF 18)

Generated: 2026-04-30T13:18:55.616Z

**Pipeline F2:** audio_preprocess → LatentSync (CRF 12 no reencode 25fps) → SyncNet.
**F1 base:** mesma pipeline com CRF 18.

Ganho esperado: marginal em SyncNet (CRF afeta qualidade visual do input pré-IA, não sync).

## Resultados

| Caso | Métrica | F1 CRF-18 | F2 CRF-12 | Δ |
|---|---|---|---|---|
| duda | Sync-D ↓ | 8.754 | **8.829** | +0.075 |
| duda | Sync-C ↑ | 5.538 | **5.499** | -0.039 |
| flavio | Sync-D ↓ | 7.482 | **7.464** | -0.018 |
| flavio | Sync-C ↑ | 7.453 | **7.438** | -0.015 |
| principal-flavio | Sync-D ↓ | 6.838 | **6.909** | +0.071 |
| principal-flavio | Sync-C ↑ | 8.147 | **8.089** | -0.058 |
