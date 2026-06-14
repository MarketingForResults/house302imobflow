export const CONTRACT_INSURANCE_OPTIONS = [
  { value: "security_deposit_insurance", label: "Seguro Caução" },
  { value: "guarantor_insurance", label: "Seguro Fiador" },
  { value: "insurance_broker", label: "Corretora de Seguros" },
] as const;

export type ContractInsuranceValue = (typeof CONTRACT_INSURANCE_OPTIONS)[number]["value"];

export function contractInsuranceLabels(values: unknown): string[] {
  const selected = Array.isArray(values) ? values : values ? [values] : [];
  return selected
    .map((value) => CONTRACT_INSURANCE_OPTIONS.find((option) => option.value === value)?.label)
    .filter(Boolean) as string[];
}

export function formatContractInsurance(values: unknown): string {
  return contractInsuranceLabels(values).join(", ");
}
