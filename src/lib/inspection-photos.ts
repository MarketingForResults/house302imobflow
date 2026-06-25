export function safeInspectionPhotoFolderSegment(value: unknown) {
  const segment = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return segment || "imovel";
}

export function inspectionPhotoFolderName(property?: { id?: string; code?: string | null }) {
  return safeInspectionPhotoFolderSegment(property?.code || property?.id || "imovel");
}

export function inspectionPhotosPath(propertyOrId?: { id?: string } | string | null) {
  const propertyId = typeof propertyOrId === "string" ? propertyOrId : propertyOrId?.id;
  return propertyId ? "/inspection-photos/" + encodeURIComponent(propertyId) : "";
}

export function inspectionPhotosUrl(propertyOrId?: { id?: string } | string | null, origin?: string) {
  const path = inspectionPhotosPath(propertyOrId);
  if (!path) return "";

  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return base ? base + path : path;
}
