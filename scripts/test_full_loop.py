"""Test completo: roda TODAS as 2103 personas e imprime progresso."""
import asyncio
import sys
import time

def p(msg):
    print(msg, flush=True)

async def main():
    from arena_analysis.web_researcher import ArenaWebResearcher
    from arena_analysis.context_builder import ContextBuilder
    from arena_analysis.persona_loader import load_personas
    from arena_analysis.persona_loop import PersonaLoop

    personas = load_personas()
    total = len(personas)
    p(f"Total personas: {total}")

    wr = ArenaWebResearcher()
    web = await wr.research("Lula deve ser preso?")
    p(f"Web snippets: {len(web.snippets)}")

    cb = ContextBuilder()
    ctx = await cb.build("Lula deve ser preso?", web.combined_context)
    p(f"Contexto: {ctx.tema}")

    loop = PersonaLoop()
    start = time.time()
    all_ids = set()
    pos = neg = neu = 0
    last_print = 0

    async for progress in loop.run("Lula deve ser preso?", ctx, personas):
        for r in progress.results:
            all_ids.add(r.persona_id)
            if r.sentiment == "positive":
                pos += 1
            elif r.sentiment == "negative":
                neg += 1
            else:
                neu += 1

        if progress.processed - last_print >= 100 or progress.processed == total:
            elapsed = time.time() - start
            p(f"  [{elapsed:.1f}s] {progress.processed}/{total} | P={pos} N={neg} U={neu}")
            last_print = progress.processed

    elapsed = time.time() - start
    p(f"\n=== RESULTADO FINAL ===")
    p(f"Tempo: {elapsed:.1f}s")
    p(f"Personas processadas: {len(all_ids)}/{total}")
    p(f"TODAS passaram: {len(all_ids) == total}")
    p(f"Positivo: {pos} ({pos*100//total}%)")
    p(f"Negativo: {neg} ({neg*100//total}%)")
    p(f"Neutro: {neu} ({neu*100//total}%)")

asyncio.run(main())
