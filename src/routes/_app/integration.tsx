/* eslint-disable @typescript-eslint/no-explicit-any -- Integration adapters use external payloads and legacy sync tables. */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Boxes,
  Check,
  Clock,
  Download,
  ExternalLink,
  Plug,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { syncPropertyToWordPress } from "@/lib/wordpress-sync.functions";
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_CONNECTORS,
  integrationStats,
  type IntegrationCategory,
  type IntegrationConnector,
  type IntegrationStatus,
} from "@/lib/integrations/catalog";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeBR } from "@/lib/format-date";
import { translatedErrorMessage } from "@/lib/error-messages";

export const Route = createFileRoute("/_app/integration")({ component: IntegrationPage });

const PLUGIN_PHP = `<?php
/**
 * Plugin Name: ImobiFlow Sync
 * Description: Receives property data from ImobiFlow CRM and creates/updates WordPress posts.
 * Version: 1.0.0
 * Author: ImobiFlow
 */

if (!defined('ABSPATH')) exit;

define('IMOBIFLOW_API_KEY_OPTION', 'imobiflow_api_key');
define('IMOBIFLOW_CPT', 'imovel'); // change if your JetEngine CPT slug is different

add_action('rest_api_init', function () {
  register_rest_route('imobiflow/v1', '/properties', [
    'methods'  => 'POST',
    'callback' => 'imobiflow_handle_property',
    'permission_callback' => '__return_true',
  ]);
});

function imobiflow_validate_token(WP_REST_Request $req) {
  $auth = $req->get_header('authorization');
  if (!$auth || stripos($auth, 'Bearer ') !== 0) return false;
  $token = trim(substr($auth, 7));
  $expected = get_option(IMOBIFLOW_API_KEY_OPTION);
  return $expected && hash_equals($expected, $token);
}

function imobiflow_handle_property(WP_REST_Request $req) {
  if (!imobiflow_validate_token($req)) {
    return new WP_REST_Response(['error' => 'Unauthorized'], 401);
  }
  $d = $req->get_json_params();
  if (empty($d['code'])) return new WP_REST_Response(['error' => 'code required'], 400);

  $post_id = !empty($d['wp_post_id']) ? intval($d['wp_post_id']) : 0;
  $args = [
    'post_type'    => IMOBIFLOW_CPT,
    'post_status'  => $d['status'] === 'sold' ? 'draft' : 'publish',
    'post_title'   => !empty($d['title']) ? $d['title'] : $d['code'],
    'post_content' => isset($d['description']) ? $d['description'] : '',
  ];
  if ($post_id && get_post($post_id)) {
    $args['ID'] = $post_id;
    wp_update_post($args);
  } else {
    $post_id = wp_insert_post($args);
  }
  if (!$post_id || is_wp_error($post_id)) {
    return new WP_REST_Response(['error' => 'failed to save post'], 500);
  }

  $meta_keys = ['code','type','status','price','area_m2','bedrooms','bathrooms','suites',
    'parking_spaces','furnished','planned_furniture','financed','accepts_trade','exclusive',
    'state','city','neighborhood','address','latitude','longitude','video_url','tour_url','broker_name'];
  foreach ($meta_keys as $k) {
    if (array_key_exists($k, $d)) update_post_meta($post_id, $k, $d[$k]);
  }

  if (!empty($d['images']) && is_array($d['images'])) {
    update_post_meta($post_id, 'gallery', $d['images']);
    if (!function_exists('media_sideload_image')) {
      require_once ABSPATH . 'wp-admin/includes/media.php';
      require_once ABSPATH . 'wp-admin/includes/file.php';
      require_once ABSPATH . 'wp-admin/includes/image.php';
    }
    if (!has_post_thumbnail($post_id)) {
      $thumb_id = media_sideload_image($d['images'][0], $post_id, null, 'id');
      if (!is_wp_error($thumb_id)) set_post_thumbnail($post_id, $thumb_id);
    }
  }

  return new WP_REST_Response(['id' => $post_id, 'ok' => true], 200);
}

add_action('admin_menu', function () {
  add_options_page('ImobiFlow Sync', 'ImobiFlow Sync', 'manage_options', 'imobiflow-sync', 'imobiflow_settings_page');
});
function imobiflow_settings_page() {
  if (!current_user_can('manage_options')) return;
  if (isset($_POST['imobiflow_api_key'])) {
    check_admin_referer('imobiflow_save');
    update_option(IMOBIFLOW_API_KEY_OPTION, sanitize_text_field($_POST['imobiflow_api_key']));
    echo '<div class="updated"><p>API Key saved.</p></div>';
  }
  $key = esc_attr(get_option(IMOBIFLOW_API_KEY_OPTION, ''));
  echo '<div class="wrap"><h1>ImobiFlow Sync</h1>
    <form method="post"><table class="form-table"><tr><th>API Key</th>
    <td><input type="text" name="imobiflow_api_key" value="' . $key . '" class="regular-text" /></td></tr></table>'
    . wp_nonce_field('imobiflow_save', '_wpnonce', true, false)
    . get_submit_button('Save') . '</form></div>';
}
`;

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  enabled: "Ativo",
  available: "Disponível",
  planned: "Planejado",
};

const STATUS_VARIANT: Record<IntegrationStatus, "default" | "secondary" | "outline"> = {
  enabled: "default",
  available: "secondary",
  planned: "outline",
};

function IntegrationIcon({ connector, className = "h-10 w-10" }: { connector: IntegrationConnector; className?: string }) {
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-xl ${connector.accent} text-xs font-bold text-white shadow-sm`}
    >
      {connector.icon}
    </div>
  );
}

function IntegrationPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<IntegrationCategory | "all" | "enabled">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wpUrl, setWpUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const sync = useServerFn(syncPropertyToWordPress);
  const stats = integrationStats();

  const selectedConnector = selectedId
    ? INTEGRATION_CONNECTORS.find((connector) => connector.id === selectedId)
    : null;

  const filteredConnectors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return INTEGRATION_CONNECTORS.filter((connector) => {
      const matchesCategory =
        category === "all" ||
        (category === "enabled" ? connector.status === "enabled" : connector.category === category);
      const matchesSearch =
        !normalizedSearch ||
        [connector.name, connector.category, connector.tagline, connector.overview]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  useEffect(() => {
    setWpUrl(localStorage.getItem("imobiflow.wpUrl") ?? "");
    setApiKey(localStorage.getItem("imobiflow.wpKey") ?? "");
  }, []);

  function saveWordPressConfig() {
    localStorage.setItem("imobiflow.wpUrl", wpUrl);
    localStorage.setItem("imobiflow.wpKey", apiKey);
    toast.success("Configuração WordPress salva");
  }

  const { data: props = [] } = useQuery({
    queryKey: ["properties-sync"],
    queryFn: async () =>
      (
        await supabase
          .from("properties")
          .select("id, code, title, status, wp_post_id, wp_synced_at")
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: selectedConnector?.id === "wordpress",
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["wp-logs"],
    queryFn: async () =>
      (
        await supabase
          .from("wp_sync_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
    enabled: selectedConnector?.id === "wordpress",
    refetchInterval: selectedConnector?.id === "wordpress" ? 5000 : false,
  });

  async function syncOne(propertyId: string) {
    if (!wpUrl || !apiKey) return toast.error("Configure URL e API Key primeiro");
    try {
      await sync({ data: { propertyId, wpUrl, apiKey } });
      toast.success("Sincronizado");
    } catch (error: any) {
      toast.error(translatedErrorMessage(error, "Nao foi possivel sincronizar."));
    }
  }

  function downloadPlugin() {
    const blob = new Blob([PLUGIN_PHP], { type: "application/x-php" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "imobiflow-sync.php";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  return (
    <div>
      <PageHeader
        title="Integrações"
        description="Central para conectar serviços externos, APIs e microserviços do ImobiFlow"
      />

      <div className="grid min-h-[calc(100vh-6rem)] border-t bg-background md:grid-cols-[280px_1fr]">
        <aside className="border-r bg-muted/20 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar integração"
              className="pl-9"
            />
          </div>

          <div className="mt-5 space-y-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setCategory("enabled");
                setSelectedId(null);
              }}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition hover:bg-background ${
                category === "enabled" ? "bg-background font-medium shadow-sm" : ""
              }`}
            >
              <span>Ativas</span>
              <span className="text-xs text-muted-foreground">{stats.enabled}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                setSelectedId(null);
              }}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition hover:bg-background ${
                category === "all" ? "bg-background font-medium shadow-sm" : ""
              }`}
            >
              <span>Todas</span>
              <span className="text-xs text-muted-foreground">{stats.total}</span>
            </button>
          </div>

          <div className="mt-6">
            <p className="px-3 text-xs font-medium uppercase text-muted-foreground">Categorias</p>
            <div className="mt-2 space-y-1 text-sm">
              {INTEGRATION_CATEGORIES.map((item) => {
                const count = INTEGRATION_CONNECTORS.filter(
                  (connector) => connector.category === item,
                ).length;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setCategory(item);
                      setSelectedId(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition hover:bg-background ${
                      category === item ? "bg-background font-medium shadow-sm" : ""
                    }`}
                  >
                    <span>{item}</span>
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Boxes className="h-4 w-4" />
              Faltou algum conector?
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Registre aqui a intenção e conectamos depois com API, webhook ou microserviço.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => toast.info("Solicitação registrada para planejamento.")}
            >
              Solicitar
            </Button>
          </div>
        </aside>

        <main className="p-4 md:p-8">
          {selectedConnector ? (
            <ConnectorDetails
              connector={selectedConnector}
              wpUrl={wpUrl}
              apiKey={apiKey}
              onWpUrlChange={setWpUrl}
              onApiKeyChange={setApiKey}
              onSaveWordPress={saveWordPressConfig}
              onDownloadPlugin={downloadPlugin}
              properties={props}
              logs={logs}
              onSyncProperty={syncOne}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <>
              <section className="mx-auto mb-8 max-w-3xl text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Plug className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Conecte o ImobiFlow ao que sua operação já usa
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Centralize integrações externas, credenciais, webhooks e microserviços em uma área
                  preparada para crescer com o sistema.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                  <Badge variant="default">{stats.enabled} ativas</Badge>
                  <Badge variant="secondary">{stats.available} disponíveis</Badge>
                  <Badge variant="outline">{stats.planned} planejadas</Badge>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Conectores do sistema</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure uma vez, use em documentos, imóveis, financeiro e automações.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {filteredConnectors.map((connector) => (
                    <button
                      key={connector.id}
                      type="button"
                      onClick={() => setSelectedId(connector.id)}
                      className="group flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition hover:border-primary/40 hover:shadow-sm"
                    >
                      <IntegrationIcon connector={connector} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{connector.name}</p>
                          <Badge variant={STATUS_VARIANT[connector.status]}>
                            {STATUS_LABEL[connector.status]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {connector.tagline}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ConnectorDetails({
  connector,
  wpUrl,
  apiKey,
  onWpUrlChange,
  onApiKeyChange,
  onSaveWordPress,
  onDownloadPlugin,
  properties,
  logs,
  onSyncProperty,
  onBack,
}: {
  connector: IntegrationConnector;
  wpUrl: string;
  apiKey: string;
  onWpUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onSaveWordPress: () => void;
  onDownloadPlugin: () => void;
  properties: any[];
  logs: any[];
  onSyncProperty: (propertyId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          Integrações
        </button>
        <span>/</span>
        <span className="font-medium text-foreground">{connector.name}</span>
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <IntegrationIcon connector={connector} className="h-14 w-14" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{connector.name}</h2>
                <Badge variant={STATUS_VARIANT[connector.status]}>
                  {STATUS_LABEL[connector.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{connector.tagline}</p>
            </div>
          </div>
          {connector.status === "enabled" ? (
            <Button variant="outline" disabled>
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              Habilitado no workspace
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <Clock className="mr-1.5 h-4 w-4" />
              Preparado para roadmap
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Visão geral</h3>
            <p className="mt-1 text-sm text-muted-foreground">{connector.overview}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Recursos principais</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {connector.keyFeatures.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {connector.id === "autentique" && <AutentiquePanel />}
          {connector.id === "wordpress" && (
            <WordPressPanel
              wpUrl={wpUrl}
              apiKey={apiKey}
              onWpUrlChange={onWpUrlChange}
              onApiKeyChange={onApiKeyChange}
              onSave={onSaveWordPress}
              onDownloadPlugin={onDownloadPlugin}
              properties={properties}
              logs={logs}
              onSyncProperty={onSyncProperty}
            />
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Settings2 className="h-4 w-4" />
              Checklist de configuração
            </h3>
            <div className="space-y-2">
              {connector.setupChecklist.map((item) => (
                <div key={item} className="rounded-lg bg-muted/40 p-3 text-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>

          {connector.adminNotes?.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
              <h3 className="mb-2 text-sm font-semibold">Notas de segurança</h3>
              <ul className="space-y-1 text-sm">
                {connector.adminNotes.map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border bg-card p-4 text-sm">
            <h3 className="mb-3 font-semibold">Detalhes</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <span className="block text-xs uppercase">Categoria</span>
                <span className="text-foreground">{connector.category}</span>
              </div>
              <div>
                <span className="block text-xs uppercase">Criado por</span>
                <span className="text-foreground">{connector.createdBy}</span>
              </div>
              {connector.docsUrl && (
                <div>
                  <span className="block text-xs uppercase">Documentação</span>
                  <a
                    href={connector.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Abrir docs
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function AutentiquePanel() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-lg font-semibold">Ambiente Autentique</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        A integração já foi preparada no servidor. Use esta área como painel administrativo de
        configuração e auditoria futura.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Secret obrigatória</p>
          <code className="mt-2 block rounded bg-muted px-2 py-1 text-xs">AUTENTIQUE_API_KEY</code>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Webhook</p>
          <code className="mt-2 block rounded bg-muted px-2 py-1 text-xs">
            /api/autentique/webhook
          </code>
        </div>
      </div>
    </div>
  );
}

function WordPressPanel({
  wpUrl,
  apiKey,
  onWpUrlChange,
  onApiKeyChange,
  onSave,
  onDownloadPlugin,
  properties,
  logs,
  onSyncProperty,
}: {
  wpUrl: string;
  apiKey: string;
  onWpUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onSave: () => void;
  onDownloadPlugin: () => void;
  properties: any[];
  logs: any[];
  onSyncProperty: (propertyId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Plug className="h-4 w-4" />
            Configuração
          </div>
          <div className="space-y-3">
            <div>
              <Label>URL do site WordPress</Label>
              <Input
                placeholder="https://seusite.com.br"
                value={wpUrl}
                onChange={(event) => onWpUrlChange(event.target.value)}
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="Cole aqui a chave gerada"
                value={apiKey}
                onChange={(event) => onApiKeyChange(event.target.value)}
              />
            </div>
            <Button onClick={onSave}>Salvar configuração</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Download className="h-4 w-4" />
            Plugin WordPress
          </div>
          <p className="text-sm text-muted-foreground">
            Baixe e instale o plugin{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">imobiflow-sync.php</code>.
            Após ativar, vá em <strong>Configurações → ImobiFlow Sync</strong> e cole a mesma API Key.
          </p>
          <Button variant="outline" onClick={onDownloadPlugin} className="mt-4">
            <Download className="mr-1.5 h-4 w-4" />
            Baixar plugin
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-3 text-sm font-semibold">Imóveis</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Título</th>
              <th className="px-4 py-2">WP Post</th>
              <th className="px-4 py-2">Última sync</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {properties.map((property: any) => (
              <tr key={property.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{property.code}</td>
                <td className="px-4 py-2">{property.title || "—"}</td>
                <td className="px-4 py-2">
                  {property.wp_post_id ? (
                    <Badge variant="outline">#{property.wp_post_id}</Badge>
                  ) : (
                    <Badge variant="outline">não publicado</Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {property.wp_synced_at ? formatDateTimeBR(property.wp_synced_at) : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => onSyncProperty(property.id)}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Sincronizar
                  </Button>
                </td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum imóvel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-3 text-sm font-semibold">Logs de sincronização</div>
        <div className="divide-y">
          {logs.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhuma sincronização ainda.
            </div>
          )}
          {logs.map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 px-5 py-3 text-sm">
              {log.success ? (
                <Check className="mt-0.5 h-4 w-4 text-success" />
              ) : (
                <X className="mt-0.5 h-4 w-4 text-destructive" />
              )}
              <div className="flex-1">
                <div className="font-medium">
                  {log.action}{" "}
                  <span className="text-muted-foreground">· status {log.status_code ?? "?"}</span>
                </div>
                <div className="text-xs text-muted-foreground">{log.message}</div>
              </div>
              <div className="text-xs text-muted-foreground">{formatDateTimeBR(log.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
