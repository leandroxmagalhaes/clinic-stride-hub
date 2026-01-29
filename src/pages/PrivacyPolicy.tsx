import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Shield className="h-6 w-6 text-primary" />
              Política de Privacidade
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Última atualização: {new Date().toLocaleDateString('pt-PT')}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Introdução</h2>
              <p className="text-muted-foreground mb-4">
                Esta Política de Privacidade descreve como recolhemos, utilizamos, armazenamos e 
                protegemos os seus dados pessoais, em conformidade com o Regulamento Geral sobre a 
                Proteção de Dados (RGPD/GDPR) e a Lei Geral de Proteção de Dados (LGPD).
              </p>
              <p className="text-muted-foreground">
                Ao utilizar os nossos serviços, você consente com a recolha e tratamento dos seus 
                dados conforme descrito nesta política.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Dados que Recolhemos</h2>
              <p className="text-muted-foreground mb-3">Recolhemos os seguintes tipos de dados pessoais:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Dados de identificação:</strong> Nome completo, NIF/CPF, data de nascimento, género</li>
                <li><strong>Dados de contacto:</strong> Email, telefone, morada</li>
                <li><strong>Dados de saúde:</strong> Histórico clínico, diagnósticos, evoluções, dados de sessões terapêuticas</li>
                <li><strong>Dados financeiros:</strong> Histórico de pagamentos, créditos, transações</li>
                <li><strong>Dados de emergência:</strong> Contacto de emergência e respetivo telefone</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Finalidade do Tratamento</h2>
              <p className="text-muted-foreground mb-3">Os seus dados são tratados para:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Prestação de serviços de saúde e fisioterapia</li>
                <li>Gestão de agendamentos e sessões</li>
                <li>Comunicação sobre consultas e tratamentos</li>
                <li>Faturação e gestão financeira</li>
                <li>Cumprimento de obrigações legais e regulamentares</li>
                <li>Melhoria contínua dos nossos serviços</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Base Legal</h2>
              <p className="text-muted-foreground mb-3">O tratamento dos seus dados baseia-se em:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Consentimento:</strong> Para dados de saúde e comunicações de marketing</li>
                <li><strong>Execução de contrato:</strong> Para prestação dos serviços contratados</li>
                <li><strong>Obrigação legal:</strong> Para cumprimento de requisitos legais e fiscais</li>
                <li><strong>Interesse legítimo:</strong> Para melhoria dos serviços e segurança</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Tempo de Retenção</h2>
              <p className="text-muted-foreground mb-3">Os seus dados são conservados durante:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Dados de saúde:</strong> Mínimo de 5 anos após o último atendimento, conforme legislação aplicável</li>
                <li><strong>Dados fiscais:</strong> 10 anos, conforme obrigações legais</li>
                <li><strong>Dados de contacto:</strong> Enquanto mantiver relação connosco, ou até solicitar eliminação</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Os Seus Direitos</h2>
              <p className="text-muted-foreground mb-3">
                Nos termos do RGPD/GDPR e LGPD, você tem os seguintes direitos:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Direito de acesso:</strong> Solicitar cópia dos seus dados pessoais</li>
                <li><strong>Direito de retificação:</strong> Corrigir dados incorretos ou incompletos</li>
                <li><strong>Direito ao apagamento:</strong> Solicitar eliminação dos seus dados (quando aplicável)</li>
                <li><strong>Direito à portabilidade:</strong> Receber os seus dados em formato estruturado</li>
                <li><strong>Direito de oposição:</strong> Opor-se ao tratamento dos seus dados</li>
                <li><strong>Direito de retirar o consentimento:</strong> A qualquer momento, sem afetar a licitude do tratamento anterior</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Medidas de Segurança</h2>
              <p className="text-muted-foreground mb-3">
                Implementamos medidas técnicas e organizativas para proteger os seus dados:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Encriptação de dados em trânsito e em repouso</li>
                <li>Controlo de acesso baseado em funções (RBAC)</li>
                <li>Políticas de segurança a nível de linha (RLS)</li>
                <li>Backups regulares e seguros</li>
                <li>Monitorização contínua de acessos</li>
                <li>Formação da equipa em proteção de dados</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. Partilha de Dados</h2>
              <p className="text-muted-foreground">
                Não vendemos nem partilhamos os seus dados pessoais com terceiros, exceto quando:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>Necessário para prestação dos serviços (ex: laboratórios de análises)</li>
                <li>Exigido por lei ou autoridade competente</li>
                <li>Com o seu consentimento expresso</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">9. Contacto do Responsável</h2>
              <p className="text-muted-foreground">
                Para exercer os seus direitos ou esclarecer dúvidas sobre esta política, 
                contacte-nos através dos canais disponíveis na aplicação ou diretamente na clínica.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">10. Alterações a Esta Política</h2>
              <p className="text-muted-foreground">
                Reservamo-nos o direito de atualizar esta política periodicamente. 
                Notificaremos sobre alterações significativas através dos meios de contacto disponíveis.
              </p>
            </section>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/terms" className="hover:underline text-primary">
            Ver Termos de Uso
          </Link>
        </div>
      </div>
    </div>
  );
}
