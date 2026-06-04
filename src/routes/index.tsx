import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Building2, ArrowRight, Zap, Shield, Layers } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="font-semibold">ImobiFlow</span>
          </div>
          <Link to="/login" className="text-sm font-medium hover:text-accent">
            Entrar →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            CRM Imobiliário · Integração WordPress
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-6xl">
            Gestão de imóveis sem fricção.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Centralize imóveis, corretores e clientes. Publique automaticamente no seu site
            WordPress com Elementor + JetEngine.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Começar agora <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "Cadastro completo",
              desc: "Características, fotos, localização e status — tudo num lugar.",
            },
            {
              icon: Zap,
              title: "Sync automático",
              desc: "Envia ao WordPress em tempo real via plugin oficial.",
            },
            {
              icon: Shield,
              title: "Permissões claras",
              desc: "Admin, gestor e corretor com acessos isolados.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6">
              <f.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} ImobiFlow CRM
        </div>
      </footer>
    </div>
  );
}
