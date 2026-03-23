import { NextResponse } from 'next/server';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Opções de Privacidade - Arena PL</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #a1a1aa;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 48px 24px 64px;
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.025em;
      margin-bottom: 4px;
    }
    .date {
      font-size: 0.8rem;
      color: #52525b;
      margin-bottom: 32px;
    }
    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #27272a, transparent);
      margin: 32px 0;
    }
    h2 {
      font-size: 1.15rem;
      font-weight: 600;
      color: #fff;
      letter-spacing: -0.015em;
      margin-bottom: 12px;
    }
    p { font-size: 0.875rem; margin-bottom: 12px; }
    ul {
      list-style: disc;
      padding-left: 20px;
      font-size: 0.875rem;
      margin-bottom: 12px;
    }
    li { margin-bottom: 8px; }
    strong { color: #d4d4d8; }
    section { margin-bottom: 32px; }
    .option-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .option-card h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 8px;
    }
    .option-card p { margin-bottom: 0; }
    .contact-box {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 20px;
      margin-top: 12px;
    }
    .contact-box p { margin-bottom: 4px; }
    .contact-box strong { color: #fff; }
    a { color: #34d399; text-decoration: none; }
    a:hover { color: #6ee7b7; }
    .badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 10px;
      border-radius: 999px;
      margin-bottom: 10px;
    }
    .badge-green {
      background: rgba(52,211,153,0.1);
      color: #34d399;
      border: 1px solid rgba(52,211,153,0.2);
    }
    .badge-amber {
      background: rgba(251,191,36,0.1);
      color: #fbbf24;
      border: 1px solid rgba(251,191,36,0.2);
    }
    .badge-red {
      background: rgba(248,113,113,0.1);
      color: #f87171;
      border: 1px solid rgba(248,113,113,0.2);
    }
    .footer {
      text-align: center;
      font-size: 0.75rem;
      color: #3f3f46;
      margin-top: 32px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Opções de Privacidade</h1>
    <p class="date">Última atualização: 23 de março de 2026</p>
    <div class="divider"></div>

    <section>
      <p>Você tem controle sobre seus dados pessoais no <strong>Arena PL</strong>. Abaixo estão as opções disponíveis para gerenciar sua privacidade. Para exercer qualquer um desses direitos, entre em contato conosco pelo e-mail indicado ao final desta página.</p>
    </section>

    <section>
      <h2>Seus Direitos de Privacidade</h2>

      <div class="option-card">
        <span class="badge badge-green">Acesso</span>
        <h3>Acessar seus Dados</h3>
        <p>Você pode solicitar uma cópia completa de todos os dados pessoais que mantemos sobre você. Responderemos em até 15 dias úteis com um relatório detalhado.</p>
      </div>

      <div class="option-card">
        <span class="badge badge-green">Correção</span>
        <h3>Corrigir seus Dados</h3>
        <p>Se seus dados pessoais estiverem incompletos, inexatos ou desatualizados, você pode solicitar a correção a qualquer momento.</p>
      </div>

      <div class="option-card">
        <span class="badge badge-amber">Portabilidade</span>
        <h3>Portabilidade dos Dados</h3>
        <p>Você pode solicitar a transferência dos seus dados pessoais para outro serviço ou fornecedor, em formato estruturado e de uso comum.</p>
      </div>

      <div class="option-card">
        <span class="badge badge-amber">Revogação</span>
        <h3>Revogar Consentimento</h3>
        <p>Você pode revogar o consentimento dado para o tratamento dos seus dados a qualquer momento. A revogação não afeta o tratamento realizado anteriormente com base no consentimento.</p>
      </div>

      <div class="option-card">
        <span class="badge badge-red">Exclusão</span>
        <h3>Excluir seus Dados</h3>
        <p>Você pode solicitar a eliminação de todos os seus dados pessoais. Após a confirmação, seus dados serão permanentemente removidos dos nossos sistemas em até 30 dias, exceto quando a retenção for exigida por lei.</p>
      </div>

      <div class="option-card">
        <span class="badge badge-red">Anonimização</span>
        <h3>Anonimizar seus Dados</h3>
        <p>Você pode solicitar que seus dados sejam anonimizados, tornando impossível a identificação. Dados anonimizados podem ser mantidos para fins estatísticos.</p>
      </div>
    </section>

    <section>
      <h2>Comunicações e Notificações</h2>
      <div class="option-card">
        <h3>Opt-out de Comunicações</h3>
        <p>Você pode optar por não receber comunicações promocionais ou informativas enviadas pelo Aplicativo. Para isso, envie um e-mail com o assunto "Cancelar comunicações" para o endereço abaixo. Comunicações essenciais ao funcionamento do serviço (como alertas de segurança) continuarão sendo enviadas.</p>
      </div>
    </section>

    <section>
      <h2>Dados Coletados Automaticamente</h2>
      <div class="option-card">
        <h3>Dados de Uso e Dispositivo</h3>
        <p>Coletamos dados de uso e dispositivo para melhorar o Aplicativo. Você pode limitar essa coleta desativando permissões no seu dispositivo (localização, câmera, microfone) através das configurações do sistema operacional.</p>
      </div>
    </section>

    <section>
      <h2>Como Exercer seus Direitos</h2>
      <p>Para exercer qualquer um dos direitos acima, envie um e-mail para o endereço abaixo informando:</p>
      <ul>
        <li>Seu nome completo e e-mail cadastrado no Aplicativo.</li>
        <li>O direito que deseja exercer (acesso, correção, exclusão, etc.).</li>
        <li>Detalhes adicionais que possam ajudar a identificar e atender sua solicitação.</li>
      </ul>
      <p>Responderemos sua solicitação em até <strong>15 dias úteis</strong>, conforme previsto pela LGPD.</p>

      <div class="contact-box">
        <p><strong>Partido Liberal (PL)</strong></p>
        <p>E-mail: <a href="mailto:privacidade@pl.org.br">privacidade@pl.org.br</a></p>
      </div>
    </section>

    <div class="divider"></div>
    <p class="footer">&copy; 2026 Partido Liberal. Todos os direitos reservados.</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
