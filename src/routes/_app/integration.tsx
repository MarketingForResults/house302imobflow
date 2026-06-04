import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncPropertyToWordPress } from "@/lib/wordpress-sync.functions";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, RefreshCw, Download, Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeBR } from "@/lib/format-date";

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

  // JetEngine meta fields — adjust slugs to your setup
  $meta_keys = ['code','type','status','price','area_m2','bedrooms','bathrooms','suites',
    'parking_spaces','furnished','planned_furniture','financed','accepts_trade','exclusive',
    'state','city','neighborhood','address','latitude','longitude','video_url','tour_url','broker_name'];
  foreach ($meta_keys as $k) {
    if (array_key_exists($k, $d)) update_post_meta($post_id, $k, $d[$k]);
  }

  // Gallery — store URLs in a meta field; adapt to your JetEngine gallery field
  if (!empty($d['images']) && is_array($d['images'])) {
    update_post_meta($post_id, 'gallery', $d['images']);
    // Set first image as featured (sideload)
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

// Admin settings page to set API key
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

function IntegrationPage() {
  const [wpUrl, setWpUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const sync = useServerFn(syncPropertyToWordPress);

  useEffect(() => {
    setWpUrl(localStorage.getItem("imobiflow.wpUrl") ?? "");
    setApiKey(localStorage.getItem("imobiflow.wpKey") ?? "");
  }, []);
  function save() {
    localStorage.setItem("imobiflow.wpUrl", wpUrl);
    localStorage.setItem("imobiflow.wpKey", apiKey);
    toast.success("Configuração salva");
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
    refetchInterval: 5000,
  });

  async function syncOne(propertyId: string) {
    if (!wpUrl || !apiKey) return toast.error("Configure URL e API Key primeiro");
    try {
      await sync({ data: { propertyId, wpUrl, apiKey } });
      toast.success("Sincronizado");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function downloadPlugin() {
    const blob = new Blob([PLUGIN_PHP], { type: "application/x-php" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "imobiflow-sync.php";
    a.click();
  }

  return (
    <div>
      <PageHeader title="Integração WordPress" description="Configure e sincronize seu site" />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Plug className="h-4 w-4" /> Configuração
            </div>
            <div className="space-y-3">
              <div>
                <Label>URL do site WordPress</Label>
                <Input
                  placeholder="https://seusite.com.br"
                  value={wpUrl}
                  onChange={(e) => setWpUrl(e.target.value)}
                />
              </div>
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="Cole aqui a chave gerada"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <Button onClick={save}>Salvar configuração</Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Download className="h-4 w-4" /> Plugin WordPress
            </div>
            <p className="text-sm text-muted-foreground">
              Baixe e instale o plugin{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">imobiflow-sync.php</code> no
              seu WordPress. Após ativar, vá em <strong>Configurações → ImobiFlow Sync</strong> e
              cole a mesma API Key.
            </p>
            <Button variant="outline" onClick={downloadPlugin} className="mt-4">
              <Download className="mr-1.5 h-4 w-4" /> Baixar plugin
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
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
              {props.map((p: any) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-2">{p.title || "—"}</td>
                  <td className="px-4 py-2">
                    {p.wp_post_id ? (
                      <Badge variant="outline">#{p.wp_post_id}</Badge>
                    ) : (
                      <Badge variant="outline">não publicado</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {p.wp_synced_at ? formatDateTimeBR(p.wp_synced_at) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => syncOne(p.id)}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Sincronizar
                    </Button>
                  </td>
                </tr>
              ))}
              {props.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum imóvel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3 text-sm font-semibold">Logs de sincronização</div>
          <div className="divide-y">
            {logs.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhuma sincronização ainda.
              </div>
            )}
            {logs.map((l: any) => (
              <div key={l.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                {l.success ? (
                  <Check className="mt-0.5 h-4 w-4 text-success" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 text-destructive" />
                )}
                <div className="flex-1">
                  <div className="font-medium">
                    {l.action}{" "}
                    <span className="text-muted-foreground">· status {l.status_code ?? "?"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{l.message}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTimeBR(l.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
