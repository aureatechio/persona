import { NextResponse } from 'next/server';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Suporte - Arena PL</title>
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
    .subtitle {
      font-size: 0.9rem;
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
    strong { color: #d4d4d8; }
    section { margin-bottom: 32px; }
    a { color: #34d399; text-decoration: none; }
    a:hover { color: #6ee7b7; }
    .contact-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 16px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .contact-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 1.2rem;
    }
    .icon-green { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.15); }
    .icon-blue { background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.15); }
    .icon-amber { background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.15); }
    .contact-info h3 {
      font-size: 0.95rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
    }
    .contact-info p { margin-bottom: 0; font-size: 0.825rem; }
    .faq-item {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 12px;
    }
    .faq-item h3 {
      font-size: 0.925rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 8px;
    }
    .faq-item p { margin-bottom: 0; font-size: 0.825rem; }
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
    <h1>Central de Suporte</h1>
    <p class="subtitle">Arena PL — Estamos aqui para ajudar</p>
    <div class="divider"></div>

    <section>
      <h2>Entre em Contato</h2>
      <p>Se você está enfrentando algum problema ou tem dúvidas sobre o aplicativo, escolha um dos canais abaixo:</p>

      <div class="contact-card">
        <div class="contact-icon icon-green">✉</div>
        <div class="contact-info">
          <h3>E-mail</h3>
          <p>Envie sua dúvida ou problema para <a href="mailto:suporte@pl.org.br">suporte@pl.org.br</a>. Respondemos em até 48 horas úteis.</p>
        </div>
      </div>

      <div class="contact-card">
        <div class="contact-icon icon-blue">💬</div>
        <div class="contact-info">
          <h3>WhatsApp</h3>
          <p>Atendimento de segunda a sexta, das 9h às 18h (horário de Brasília). Envie uma mensagem para <a href="https://wa.me/5561999999999">+55 61 99999-9999</a>.</p>
        </div>
      </div>

      <div class="contact-card">
        <div class="contact-icon icon-amber">⏱</div>
        <div class="contact-info">
          <h3>Tempo de Resposta</h3>
          <p>Nosso prazo médio de resposta é de <strong>24 a 48 horas úteis</strong>. Questões urgentes são priorizadas automaticamente.</p>
        </div>
      </div>
    </section>

    <section>
      <h2>Perguntas Frequentes</h2>

      <div class="faq-item">
        <h3>Como faço para criar uma conta?</h3>
        <p>Abra o aplicativo e toque em "Criar conta". Preencha seus dados (nome, e-mail e senha) e confirme seu cadastro pelo e-mail de verificação.</p>
      </div>

      <div class="faq-item">
        <h3>Esqueci minha senha. Como recuperar?</h3>
        <p>Na tela de login, toque em "Esqueci minha senha". Insira o e-mail cadastrado e você receberá um link para redefinir sua senha.</p>
      </div>

      <div class="faq-item">
        <h3>O aplicativo está travando ou não carrega. O que fazer?</h3>
        <p>Tente fechar e reabrir o aplicativo. Se o problema persistir, verifique sua conexão com a internet e certifique-se de que está usando a versão mais recente do app. Caso continue, entre em contato conosco.</p>
      </div>

      <div class="faq-item">
        <h3>Como excluo minha conta e meus dados?</h3>
        <p>Envie um e-mail para <a href="mailto:privacidade@pl.org.br">privacidade@pl.org.br</a> solicitando a exclusão. Seus dados serão removidos em até 30 dias, conforme nossa <a href="/api/privacidade">Política de Privacidade</a>.</p>
      </div>

      <div class="faq-item">
        <h3>O aplicativo coleta minha localização?</h3>
        <p>Coletamos apenas localização aproximada (município/estado) para exibir dados eleitorais da sua região. Não rastreamos sua localização em tempo real. Você pode desativar essa permissão nas configurações do dispositivo.</p>
      </div>

      <div class="faq-item">
        <h3>Como cancelo minha assinatura?</h3>
        <p>O Arena PL é gratuito. Caso haja alguma cobrança futura vinculada à App Store, gerencie assinaturas em Ajustes > Apple ID > Assinaturas no seu dispositivo.</p>
      </div>
    </section>

    <section>
      <h2>Informações Adicionais</h2>
      <p>Para questões relacionadas à privacidade e proteção de dados, consulte nossa <a href="/api/privacidade">Política de Privacidade</a> ou acesse suas <a href="/api/privacidade/opcoes">Opções de Privacidade</a>.</p>
      <p>Versão atual do aplicativo: <strong>1.0.0</strong></p>
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
