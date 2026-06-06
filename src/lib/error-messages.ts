type ErrorLike = {
  code?: string | number | null;
  status?: string | number | null;
  name?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function asErrorLike(error: unknown): ErrorLike {
  if (error && typeof error === "object") return error as ErrorLike;
  if (typeof error === "string") return { message: error };
  return {};
}

export function errorCode(error: unknown) {
  const current = asErrorLike(error);
  return current.code ?? current.status ?? null;
}

export function translatedErrorMessage(error: unknown, fallback = "Nao foi possivel concluir a acao.") {
  const current = asErrorLike(error);
  const raw = [current.message, current.details, current.hint].filter(Boolean).join(" ");
  const text = raw.toLowerCase();

  let message = fallback;
  if (text.includes("cannot coerce the result to a single json object")) {
    message = "Nao foi possivel confirmar um unico registro para esta operacao.";
  } else if (text.includes("row-level security") || text.includes("violates rls")) {
    message = "Permissao negada pelas regras de seguranca do banco de dados.";
  } else if (text.includes("schema cache") || text.includes("could not find")) {
    message = "O Supabase ainda nao atualizou a estrutura necessaria. Aplique as migrations e tente novamente.";
  } else if (text.includes("duplicate key") || text.includes("unique constraint")) {
    message = "Ja existe um registro com essas informacoes.";
  } else if (text.includes("jwt") || text.includes("session")) {
    message = "Sua sessao expirou. Entre novamente.";
  } else if (text.includes("network") || text.includes("failed to fetch")) {
    message = "Falha de conexao. Verifique a internet e tente novamente.";
  } else if (text.includes("not found")) {
    message = "Registro nao encontrado ou sem permissao de leitura.";
  } else if (current.message && !/^[a-z]+:\/\//i.test(current.message)) {
    message = current.message;
  }

  const code = errorCode(error);
  return code ? `${message} (codigo: ${code})` : message;
}
