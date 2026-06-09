import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_app/support")({ component: SupportPage });

function SupportPage() {
  return (
    <div>
      <PageHeader title="Suporte" description="Atendimento e ajuda do sistema House302 ImobiFlow" />
      <div className="p-4 md:p-8">
        <section className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
          <LifeBuoy className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h2 className="text-xl font-semibold">Centro de suporte</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Em breve voce podera abrir chamados, consultar tutoriais e falar com o time da House302
            diretamente por aqui.
          </p>
          <div className="mt-6 grid gap-3 text-left text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="font-medium">E-mail</div>
              <div className="text-muted-foreground">house302imob@gmail.com</div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="font-medium">WhatsApp</div>
              <div className="text-muted-foreground">Disponivel em breve</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
