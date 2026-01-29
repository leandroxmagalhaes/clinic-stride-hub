import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfService() {
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
              <FileText className="h-6 w-6 text-primary" />
              Termos de Uso
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Última atualização: {new Date().toLocaleDateString('pt-PT')}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Aceitação dos Termos</h2>
              <p className="text-muted-foreground">
                Ao aceder e utilizar este sistema de gestão clínica, você concorda com estes 
                Termos de Uso. Se não concordar com qualquer parte destes termos, não deverá 
                utilizar o sistema.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Descrição do Serviço</h2>
              <p className="text-muted-foreground mb-3">
                Este sistema oferece funcionalidades de gestão clínica, incluindo:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Gestão de pacientes e prontuários</li>
                <li>Agendamento de sessões</li>
                <li>Registo de evoluções clínicas</li>
                <li>Gestão financeira e créditos</li>
                <li>Comunicação com pacientes</li>
                <li>Relatórios e análises</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Responsabilidades do Utilizador</h2>
              <p className="text-muted-foreground mb-3">Ao utilizar o sistema, você compromete-se a:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Fornecer informações verdadeiras e atualizadas</li>
                <li>Manter a confidencialidade das suas credenciais de acesso</li>
                <li>Não partilhar o acesso com terceiros não autorizados</li>
                <li>Utilizar o sistema apenas para fins legítimos e profissionais</li>
                <li>Respeitar a privacidade dos pacientes e demais utilizadores</li>
                <li>Cumprir todas as leis e regulamentos aplicáveis</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Responsabilidades do Paciente</h2>
              <p className="text-muted-foreground mb-3">
                Os pacientes que acedem ao portal devem:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Manter os seus dados de contacto atualizados</li>
                <li>Informar sobre alterações no seu estado de saúde</li>
                <li>Comparecer às sessões agendadas ou cancelar com antecedência</li>
                <li>Utilizar o diário de atividades de forma honesta</li>
                <li>Proteger as suas credenciais de acesso</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Dados de Saúde</h2>
              <p className="text-muted-foreground">
                Os dados de saúde registados neste sistema são de natureza sensível e estão 
                protegidos por legislação específica. Os profissionais de saúde que utilizam 
                o sistema são responsáveis por:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>Registar informações clínicas precisas e relevantes</li>
                <li>Manter o sigilo profissional</li>
                <li>Aceder apenas aos dados necessários para o tratamento</li>
                <li>Cumprir as normas deontológicas da profissão</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Propriedade Intelectual</h2>
              <p className="text-muted-foreground">
                Todo o conteúdo do sistema, incluindo design, funcionalidades, código e 
                documentação, é propriedade exclusiva do fornecedor. É proibida a reprodução, 
                distribuição ou modificação sem autorização expressa.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Disponibilidade do Serviço</h2>
              <p className="text-muted-foreground">
                Esforçamo-nos para manter o sistema disponível 24/7, mas não garantimos 
                disponibilidade ininterrupta. Poderão ocorrer interrupções para manutenção, 
                atualizações ou por motivos de força maior.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. Limitação de Responsabilidade</h2>
              <p className="text-muted-foreground mb-3">O fornecedor não será responsável por:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Decisões clínicas tomadas com base nas informações do sistema</li>
                <li>Perda de dados devido a uso indevido ou falha de terceiros</li>
                <li>Danos indiretos ou consequenciais</li>
                <li>Interrupções de serviço além do nosso controlo</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">9. Suspensão e Encerramento</h2>
              <p className="text-muted-foreground">
                Reservamo-nos o direito de suspender ou encerrar o acesso ao sistema em caso de:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                <li>Violação destes Termos de Uso</li>
                <li>Uso fraudulento ou abusivo</li>
                <li>Não pagamento dos serviços contratados</li>
                <li>Solicitação do próprio utilizador</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">10. Alterações aos Termos</h2>
              <p className="text-muted-foreground">
                Estes termos podem ser alterados a qualquer momento. Alterações significativas 
                serão comunicadas com antecedência razoável. O uso continuado do sistema após 
                alterações constitui aceitação dos novos termos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">11. Lei Aplicável</h2>
              <p className="text-muted-foreground">
                Estes Termos de Uso são regidos pela legislação portuguesa e da União Europeia, 
                ou brasileira, conforme a localização do utilizador. Quaisquer litígios serão 
                submetidos aos tribunais competentes da jurisdição aplicável.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">12. Contacto</h2>
              <p className="text-muted-foreground">
                Para questões sobre estes Termos de Uso, contacte-nos através dos canais 
                disponíveis na aplicação ou diretamente na clínica.
              </p>
            </section>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:underline text-primary">
            Ver Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
