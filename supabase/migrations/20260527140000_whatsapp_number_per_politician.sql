-- Cada político tem seu próprio número de WhatsApp (do candidato, da
-- campanha, do partido regional). O número aparece no botão wa.me que
-- o eleitor vê após enviar o depoimento.
--
-- Formato esperado: internacional sem '+' e sem separadores
-- (ex: 5511987654321). O front normaliza removendo não-dígitos antes
-- de gerar o link.

ALTER TABLE video_base_models
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
