import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inspectionPhotoFolderName } from "@/lib/inspection-photos";
import { translatedErrorMessage } from "@/lib/error-messages";

export const Route = createFileRoute("/inspection-photos/$propertyId")({
  component: InspectionPhotosPage,
});

function InspectionPhotosPage() {
  const { propertyId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["inspection-photo-gallery", propertyId],
    queryFn: async () => {
      const gallery = await (supabase as any).rpc("get_inspection_photo_gallery", {
        gallery_property_id: propertyId,
      });

      if (!gallery.error) return gallery.data;

      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, code, title, address, neighborhood, city, state, property_images(id, image_url, sort_order, is_cover, created_at)",
        )
        .eq("id", propertyId)
        .maybeSingle();

      if (error) throw gallery.error;
      return data;
    },
  });

  const images = [...(data?.property_images ?? [])].sort(
    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const folderName = data ? inspectionPhotoFolderName(data) : "";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
        <header className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 w-fit">Galeria da vistoria</Badge>
            <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
              {data?.title || "Fotos do imóvel"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {data
                ? [data.address, data.neighborhood, data.city, data.state].filter(Boolean).join(" - ")
                : "Carregando informações do imóvel..."}
            </p>
          </div>
          {data ? (
            <div className="text-left text-sm text-muted-foreground md:text-right">
              <div>Código: <span className="font-medium text-foreground">{data.code || "-"}</span></div>
              <div>Pasta: <span className="font-medium text-foreground">{folderName}</span></div>
              <div>{images.length} foto(s)</div>
            </div>
          ) : null}
        </header>

        {isLoading ? (
          <div className="rounded-md border p-8 text-sm text-muted-foreground">Carregando fotos...</div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-8 text-sm text-destructive">
            {translatedErrorMessage(error, "Não foi possível carregar a galeria de fotos.")}
          </div>
        ) : !data ? (
          <div className="rounded-md border p-8 text-sm text-muted-foreground">Imóvel não encontrado.</div>
        ) : images.length ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image: any, index: number) => (
              <article key={image.id ?? image.image_url} className="overflow-hidden rounded-md border bg-card">
                <a href={image.image_url} target="_blank" rel="noreferrer" className="group block">
                  <img
                    src={image.image_url}
                    alt={"Foto " + (index + 1) + " da vistoria"}
                    className="aspect-[4/3] w-full bg-muted object-cover transition group-hover:scale-[1.01]"
                  />
                </a>
                <div className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="font-medium">Foto {index + 1}</span>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={image.image_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Abrir
                    </a>
                  </Button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
            Nenhuma foto foi anexada a esta vistoria ainda.
          </div>
        )}
      </div>
    </main>
  );
}
