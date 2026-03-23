import { NextResponse } from 'next/server';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Política de Privacidade - Arena PL</title>
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
    <h1>Política de Privacidade</h1>
    <p class="date">Última atualização: 23 de março de 2026</p>
    <div class="divider"></div>

    <section>
      <p>O aplicativo <strong>Arena PL</strong> ("Aplicativo"), desenvolvido pelo Partido Liberal ("nós", "nosso"), valoriza a privacidade dos seus usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais ao utilizar nosso Aplicativo.</p>
      <p>Ao utilizar o Aplicativo, você concorda com as práticas descritas nesta Política. Caso não concorde, pedimos que não utilize o Aplicativo.</p>
    </section>

    <section>
      <h2>1. Informações que Coletamos</h2>
      <p>Podemos coletar as seguintes categorias de informações:</p>
      <ul>
        <li><strong>Dados de identificação:</strong> nome, e-mail e número de telefone fornecidos no cadastro.</li>
        <li><strong>Dados de localização:</strong> localização aproximada (município/estado) para exibição de mapas e dados eleitorais regionais. Não rastreamos localização em tempo real.</li>
        <li><strong>Dados de uso:</strong> interações com o Aplicativo, páginas visitadas e funcionalidades utilizadas.</li>
        <li><strong>Conteúdo gerado pelo usuário:</strong> vídeos, áudios e mensagens enviados voluntariamente para funcionalidades do Aplicativo.</li>
        <li><strong>Dados do dispositivo:</strong> modelo do dispositivo, sistema operacional, identificador único e informações de rede.</li>
      </ul>
    </section>

    <section>
      <h2>2. Como Usamos suas Informações</h2>
      <ul>
        <li>Fornecer e melhorar as funcionalidades do Aplicativo.</li>
        <li>Personalizar sua experiência com base em dados regionais e preferências.</li>
        <li>Enviar comunicações relevantes sobre o Aplicativo e atualizações políticas.</li>
        <li>Gerar análises e relatórios agregados (sem identificação individual).</li>
        <li>Cumprir obrigações legais e regulatórias, incluindo legislação eleitoral.</li>
      </ul>
    </section>

    <section>
      <h2>3. Compartilhamento de Dados</h2>
      <p>Não vendemos suas informações pessoais. Podemos compartilhar dados nas seguintes situações:</p>
      <ul>
        <li><strong>Prestadores de serviço:</strong> empresas que nos auxiliam na operação do Aplicativo (hospedagem, análise, comunicação), sob contratos de confidencialidade.</li>
        <li><strong>Obrigações legais:</strong> quando exigido por lei, ordem judicial ou autoridade competente.</li>
        <li><strong>Dados agregados:</strong> informações estatísticas que não identificam usuários individuais.</li>
      </ul>
    </section>

    <section>
      <h2>4. Armazenamento e Segurança</h2>
      <p>Suas informações são armazenadas em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso. Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou destruição. No entanto, nenhum sistema é 100% seguro, e não podemos garantir segurança absoluta.</p>
    </section>

    <section>
      <h2>5. Retenção de Dados</h2>
      <p>Mantemos suas informações pessoais apenas pelo tempo necessário para cumprir as finalidades descritas nesta Política ou conforme exigido por lei. Dados de conteúdo gerado (vídeos, áudios) podem ser excluídos automaticamente após o processamento, salvo quando houver consentimento para retenção.</p>
    </section>

    <section>
      <h2>6. Seus Direitos (LGPD)</h2>
      <p>Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem os seguintes direitos:</p>
      <ul>
        <li>Confirmar a existência de tratamento de dados.</li>
        <li>Acessar seus dados pessoais.</li>
        <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
        <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários.</li>
        <li>Solicitar a portabilidade dos dados.</li>
        <li>Revogar o consentimento a qualquer momento.</li>
        <li>Solicitar a eliminação dos dados tratados com consentimento.</li>
      </ul>
      <p>Para exercer esses direitos, entre em contato conosco através do e-mail indicado abaixo.</p>
    </section>

    <section>
      <h2>7. Uso por Menores</h2>
      <p>O Aplicativo não é destinado a menores de 16 anos. Não coletamos intencionalmente dados de menores. Caso identifiquemos dados de menores, eles serão excluídos imediatamente.</p>
    </section>

    <section>
      <h2>8. Alterações nesta Política</h2>
      <p>Podemos atualizar esta Política periodicamente. Notificaremos sobre mudanças significativas por meio do Aplicativo ou por e-mail. A data da última atualização será sempre indicada no topo desta página.</p>
    </section>

    <section>
      <h2>9. Contato</h2>
      <p>Para dúvidas, solicitações ou reclamações sobre esta Política de Privacidade ou sobre o tratamento de seus dados pessoais, entre em contato:</p>
      <div class="contact-box">
        <p><strong>Partido Liberal (PL)</strong></p>
        <p>E-mail: <a href="mailto:contato@pl.org.br">contato@pl.org.br</a></p>
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
