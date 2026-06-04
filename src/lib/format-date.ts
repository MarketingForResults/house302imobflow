// Formata datas no padrão d/m/aa (ex.: 5/3/26)
export function formatDateBR(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d =
    typeof input === "string"
      ? input.length === 10
        ? new Date(input + "T00:00:00")
        : new Date(input)
      : input;
  if (isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// Data + hora no padrão d/m/aa HH:mm
export function formatDateTimeBR(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDateBR(d)} ${hh}:${mm}`;
}
