-- Rastreia se o eleitor clicou no botão "Quero receber meu vídeo" na tela
-- pós-envio antes do redirect pro wa.me. Sem trava de pipeline — é só
-- métrica pra avaliar se vale implementar o gate via webhook depois
-- (conversa cliente-iniciada custa zero no WhatsApp Cloud API).

ALTER TABLE video_selfies
  ADD COLUMN IF NOT EXISTS whatsapp_button_clicked_at TIMESTAMPTZ;
