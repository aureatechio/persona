# F3 — Param sweep: guidance × steps × deepcache

Generated: 2026-04-30T14:38:48.353Z

Case fixo: **principal-flavio** (melhor baseline, Sync-D=6.838 com F1 CRF-18).
Pipeline: audio_preprocess → LatentSync (CRF 12) → SyncNet.
Objetivo: eleger params ideais pra produção.

## Resultados (ordenados por Sync-D ↑ melhor)

| Rank | Variante | Sync-D ↓ | Sync-C ↑ | AV offset | LatentSync time |
|---|---|---|---|---|---|
| 1 | g=2.0 steps=30 dc=ON  [baseline prod] ← baseline prod | **6.851** | **8.115** | 0 | 611.4s |
| 2 | g=2.0 steps=40 dc=OFF | **6.866** | **8.205** | 0 | 1464.9s |
| 3 | g=1.5 steps=50 dc=OFF | **6.933** | **7.741** | 0 | 1781.7s |
| 4 | g=1.5 steps=30 dc=ON | **7.023** | **7.659** | 0 | 632.1s |

### Erros
- g=2.5 steps=40 dc=OFF: LatentSync parse error

## Champion

**g=2.0 steps=30 dc=ON  [baseline prod]** — Sync-D=6.851, Sync-C=8.115

Baseline prod já é o melhor! Manter configuração atual.
