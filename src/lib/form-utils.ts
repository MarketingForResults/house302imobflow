export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskCep(value: string) {
  return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d{0,3})/, (_m, a, b) => b ? `${a}-${b}` : a);
}

export function maskCpf(value: string) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCnpj(value: string) {
  return onlyDigits(value)
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskCpfCnpj(value: string) {
  return onlyDigits(value).length > 11 ? maskCnpj(value) : maskCpf(value);
}

export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskRg(value: string) {
  return value.toUpperCase().replace(/[^0-9A-Z.-]/g, "").slice(0, 14);
}

export function maskCnh(value: string) {
  return onlyDigits(value).slice(0, 11);
}

export function composeAddress(form: any) {
  const main = [form.street, form.number].filter(Boolean).join(", ");
  return [
    main,
    form.complement,
    form.neighborhood,
    [form.city, form.state].filter(Boolean).join(" / "),
    form.zip_code ? `CEP ${form.zip_code}` : "",
  ].filter(Boolean).join(" - ") || form.address || "";
}

export async function lookupCepAddress(zipCode: string) {
  const cep = onlyDigits(zipCode);
  if (cep.length !== 8) throw new Error("Informe um CEP com 8 digitos");

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data = await response.json();
  if (!response.ok || data.erro) throw new Error("CEP nao encontrado");

  return {
    zip_code: maskCep(cep),
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}
