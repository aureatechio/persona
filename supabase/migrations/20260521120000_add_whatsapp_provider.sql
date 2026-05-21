-- Track qual provider entregou cada selfie (official Cloud API vs UAZAPI).
--
-- Permite ao monitor exibir se a entrega saiu pela WhatsApp Business
-- Cloud API (preferencial) ou pelo fallback UAZAPI, e ajuda a debugar
-- problemas de credenciais/templates da BM.
--
-- Valores esperados: 'official', 'uazapi'. NULL = ainda não enviado.

ALTER TABLE video_selfies
  ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT;
