export type DiscountType = "none" | "percent" | "amount";

export type DiscountResult = {
  gross: number;
  type: DiscountType;
  value: number;
  amount: number;
  net: number;
};

export function normalizeDiscountType(value: unknown): DiscountType {
  return value === "percent" || value === "amount" ? value : "none";
}

export function calculateDiscount(
  grossValue: unknown,
  discountType: unknown,
  discountValue: unknown,
): DiscountResult {
  const gross = Math.max(0, Number(grossValue) || 0);
  const type = normalizeDiscountType(discountType);
  const value = Math.max(0, Number(discountValue) || 0);
  const rawAmount =
    type === "percent" ? (gross * Math.min(value, 100)) / 100 : type === "amount" ? value : 0;
  const amount = Math.min(gross, Math.max(0, rawAmount));

  return {
    gross,
    type,
    value: type === "none" ? 0 : value,
    amount,
    net: Math.max(0, gross - amount),
  };
}

export function formatDiscountLabel(result: DiscountResult) {
  if (result.type === "none" || result.amount <= 0) return "";
  const value =
    result.type === "percent"
      ? `${result.value.toLocaleString("pt-BR")}%`
      : result.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `Desconto ${value}: ${result.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
}
