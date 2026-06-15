import { createFileRoute } from "@tanstack/react-router";
import { BookOpenText, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  DOCUMENTATION_REFERENCE_FILES,
  SYSTEM_DOCUMENTATION_SECTIONS,
} from "@/lib/system-documentation";

export const Route = createFileRoute("/_app/system-docs")({ component: SystemDocsPage });

function SystemDocsPage() {
  return (
    <div>
      <PageHeader
        title="Documentacao do sistema"
        description="Arquitetura, governanca tecnica e referencias internas do ImobFlow"
      />
      <div className="space-y-6 p-4 md:p-8">
        <section className="rounded-md border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Escopo e confidencialidade</h2>
          </div>
          <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">
            Esta area e restrita a administradores master porque consolida decisoes de arquitetura,
            pontos de seguranca, matriz de acesso, riscos tecnicos e orientacoes para evolucao do
            produto. Documentacao operacional e comercial pode ser derivada daqui, mas deve ser
            publicada em materiais separados e com menor exposicao tecnica.
          </p>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          {SYSTEM_DOCUMENTATION_SECTIONS.map((section) => (
            <article key={section.id} className="rounded-md border bg-card p-5">
              <div className="mb-3 flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <BookOpenText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">{section.title}</h2>
                  <p className="text-xs text-muted-foreground">{section.audience}</p>
                </div>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                {section.summary}
              </p>
              <ul className="space-y-2 text-sm">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <section className="rounded-md border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Arquivos versionados</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {DOCUMENTATION_REFERENCE_FILES.map((file) => (
              <div key={file} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                {file}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Sugestao de acesso</h2>
          </div>
          <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">
            Mantenha esta area somente para master. Para comercializacao, crie uma documentacao
            separada por publico: manual do administrador, guia do corretor, guia financeiro, portal
            do proprietario, portal do inquilino e materiais comerciais sem detalhes internos de
            banco, RLS, seguranca ou arquitetura.
          </p>
        </section>
      </div>
    </div>
  );
}
