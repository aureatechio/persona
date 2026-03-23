import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de Privacidade do aplicativo Arena PL",
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-black text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-20 space-y-10">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-sm text-zinc-500">
            Última atualização: 23 de março de 2026
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

        {/* Intro */}
        <section className="space-y-4">
          <p className="text-sm leading-relaxed text-zinc-400">
            O aplicativo <strong className="text-white">Arena PL</strong>{" "}
            (&quot;Aplicativo&quot;), desenvolvido pelo Partido Liberal
            (&quot;nós&quot;, &quot;nosso&quot;), valoriza a privacidade dos
            seus usuários. Esta Política de Privacidade descreve como coletamos,
            usamos, armazenamos e protegemos suas informações pessoais ao
            utilizar nosso Aplicativo.
          </p>
          <p className="text-sm leading-relaxed text-zinc-400">
            Ao utilizar o Aplicativo, você concorda com as práticas descritas
            nesta Política. Caso não concorde, pedimos que não utilize o
            Aplicativo.
          </p>
        </section>

        {/* 1 */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            1. Informações que Coletamos
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Podemos coletar as seguintes categorias de informações:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-zinc-400 ml-2">
            <li>
              <strong className="text-zinc-300">Dados de identificação:</strong>{" "}
              nome, e-mail e número de telefone fornecidos no cadastro.
            </li>
            <li>
              <strong className="text-zinc-300">Dados de localização:</strong>{" "}
              localização aproximada (município/estado) para exibição de mapas e
              dados eleitorais regionais. Não rastreamos localização em tempo
              real.
            </li>
            <li>
              <strong className="text-zinc-300">Dados de uso:</strong>{" "}
              interações com o Aplicativo, páginas visitadas e funcionalidades
              utilizadas.
            </li>
            <li>
              <strong className="text-zinc-300">
                Conteúdo gerado pelo usuário:
              </strong>{" "}
              vídeos, áudios e mensagens enviados voluntariamente para
              funcionalidades do Aplicativo.
            </li>
            <li>
              <strong className="text-zinc-300">Dados do dispositivo:</strong>{" "}
              modelo do dispositivo, sistema operacional, identificador único e
              informações de rede.
            </li>
          </ul>
        </section>

        {/* 2 */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            2. Como Usamos suas Informações
          </h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-zinc-400 ml-2">
            <li>Fornecer e melhorar as funcionalidades do Aplicativo.</li>
            <li>
              Personalizar sua experiência com base em dados regionais e
              preferências.
            </li>
            <li>
              Enviar comunicações relevantes sobre o Aplicativo e atualizações
              políticas.
            </li>
            <li>
              Gerar análises e relatórios agregados (sem identificação
              individual).
            </li>
            <li>
              Cumprir obrigações legais e regulatórias, incluindo legislação
              eleitoral.
            </li>
          </ul>
        </section>

        {/* 3 */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            3. Compartilhamento de Dados
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Não vendemos suas informações pessoais. Podemos compartilhar dados
            nas seguintes situações:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-zinc-400 ml-2">
            <li>
              <strong className="text-zinc-300">Prestadores de serviço:</strong>{" "}
              empresas que nos auxiliam na operação do Aplicativo (hospedagem,
              análise, comunicação), sob contratos de confidencialidade.
            </li>
            <li>
              <strong className="text-zinc-300">Obrigações legais:</strong>{" "}
              quando exigido por lei, ordem judicial ou autoridade competente.
            </li>
            <li>
              <strong className="text-zinc-300">Dados agregados:</strong>{" "}
              informações estatísticas que não identificam usuários individuais.
            </li>
          </ul>
        </section>

        {/* 4 */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            4. Armazenamento e Segurança
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Suas informações são armazenadas em servidores seguros com
            criptografia em trânsito (TLS/SSL) e em repouso. Adotamos medidas
            técnicas e organizacionais para proteger seus dados contra acesso
            não autorizado, perda ou destruição. No entanto, nenhum sistema é
            100% seguro, e não podemos garantir segurança absoluta.
          </p>
        </section>

        {/* 5 */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            5. Retenção de Dados
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Mantemos suas informações pessoais apenas pelo tempo necessário para
            cumprir as finalidades descritas nesta Política ou conforme exigido
            por lei. Dados de conteúdo gerado (vídeos, áudios) podem ser
            excluídos automaticamente após o processamento, salvo quando houver
            consentimento para retenção.
          </p>
        </section>

        {/* 6 */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            6. Seus Direitos (LGPD)
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Em conformidade com a Lei Geral de Proteção de Dados (Lei nº
            13.709/2018), você tem os seguintes direitos:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-zinc-400 ml-2">
            <li>Confirmar a existência de tratamento de dados.</li>
            <li>Acessar seus dados pessoais.</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
            <li>
              Solicitar anonimização, bloqueio ou eliminação de dados
              desnecessários.
            </li>
            <li>Solicitar a portabilidade dos dados.</li>
            <li>Revogar o consentimento a qualquer momento.</li>
            <li>Solicitar a eliminação dos dados tratados com consentimento.</li>
          </ul>
          <p className="text-sm leading-relaxed text-zinc-400">
            Para exercer esses direitos, entre em contato conosco através do
            e-mail indicado abaixo.
          </p>
        </section>

        {/* 7 */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            7. Uso por Menores
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            O Aplicativo não é destinado a menores de 16 anos. Não coletamos
            intencionalmente dados de menores. Caso identifiquemos dados de
            menores, eles serão excluídos imediatamente.
          </p>
        </section>

        {/* 8 */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            8. Alterações nesta Política
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Podemos atualizar esta Política periodicamente. Notificaremos sobre
            mudanças significativas por meio do Aplicativo ou por e-mail. A data
            da última atualização será sempre indicada no topo desta página.
          </p>
        </section>

        {/* 9 */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            9. Contato
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Para dúvidas, solicitações ou reclamações sobre esta Política de
            Privacidade ou sobre o tratamento de seus dados pessoais, entre em
            contato:
          </p>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-2">
            <p className="text-sm text-zinc-300">
              <strong className="text-white">Partido Liberal (PL)</strong>
            </p>
            <p className="text-sm text-zinc-400">
              E-mail:{" "}
              <a
                href="mailto:contato@pl.org.br"
                className="text-emerald-400 hover:text-emerald-300 transition-colors duration-200"
              >
                contato@pl.org.br
              </a>
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
        <p className="text-xs text-zinc-600 text-center">
          &copy; {new Date().getFullYear()} Partido Liberal. Todos os direitos
          reservados.
        </p>
      </div>
    </div>
  );
}
