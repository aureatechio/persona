# Baseline scores (SyncNet)

Generated: 2026-04-30T01:06:51.358Z

**Métrica:**
- **Sync-D** (LSE-D): distância áudio↔boca. **MENOR = melhor**. Range típico 5-15.
- **Sync-C** (LSE-C): confiança no sync. **MAIOR = melhor**. Range típico 1-9.
- **AV offset**: deslocamento ótimo em frames (@25fps). Idealmente 0.
- **Tracks**: número de faces detectadas (best track é o de maior confidence).

Pipeline atual: `modal-enhance/latentsync_app.py` com `normalize_fps=true`. A configuração de produção é a variante **B** (guidance=2.0, steps=30, deepcache=on).

## Resultados

| Caso | Variante | Config | Sync-D ↓ | Sync-C ↑ | AV offset | Tracks |
|---|---|---|---|---|---|---|
| duda | A | g=1.5 steps=50 dc=off | **8.729** | **5.305** | 0 | 1 |
| duda | B | g=2.0 steps=30 dc=on | **8.726** | **5.611** | 0 | 1 |
| duda | C | g=2.5 steps=40 dc=off | **9.122** | **5.557** | 0 | 1 |
| flavio | A | g=1.5 steps=50 dc=off | **7.617** | **6.755** | 0 | 1 |
| flavio | B | g=2.0 steps=30 dc=on | **7.673** | **7.217** | 0 | 1 |
| principal-flavio | B | g=2.0 steps=30 dc=on | **7.352** | **7.711** | 0 | 3 |

## Detalhamento por caso

### duda

- **A** (g=1.5 steps=50 dc=off)
  - Best track: #0 of 1
  - All Sync-D: 8.729
  - All Sync-C: 5.305
- **B** (g=2.0 steps=30 dc=on)
  - Best track: #0 of 1
  - All Sync-D: 8.726
  - All Sync-C: 5.611
- **C** (g=2.5 steps=40 dc=off)
  - Best track: #0 of 1
  - All Sync-D: 9.122
  - All Sync-C: 5.557

### flavio

- **A** (g=1.5 steps=50 dc=off)
  - Best track: #0 of 1
  - All Sync-D: 7.617
  - All Sync-C: 6.755
- **B** (g=2.0 steps=30 dc=on)
  - Best track: #0 of 1
  - All Sync-D: 7.673
  - All Sync-C: 7.217

### principal-flavio

- **B** (g=2.0 steps=30 dc=on)
  - Best track: #1 of 3
  - All Sync-D: 8.707, 7.352, 8.105
  - All Sync-C: 6.240, 7.711, 6.572

