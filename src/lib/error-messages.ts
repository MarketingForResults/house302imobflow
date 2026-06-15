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
  const looksPortuguese = /\b(acao|ação|apenas|cadastre|codigo|código|concluir|criar|excluir|gerar|imovel|imóvel|informe|nao|não|permissao|permissão|registro|salvar|senha|tente|usuario|usuário|voce|você)\b/.test(text);

  let message = fallback;
  if (!raw.trim()) {
    message = fallback;
  } else if (text.includes("invalid input value for enum")) {
    message = "Valor de categoria ou tipo ainda nao reconhecido pelo banco de dados. Aplique as migrations e tente novamente.";
  } else if (text.includes("duplicate key") || text.includes("already registered") || text.includes("unique constraint")) {
    message = "Ja existe um registro com essas informacoes.";
  } else if (text.includes("invalid login credentials")) {
    message = "E-mail ou senha invalidos.";
  } else if (text.includes("email not confirmed")) {
    message = "Confirme seu e-mail antes de entrar.";
  } else if (text.includes("user already registered")) {
    message = "Este e-mail ja esta cadastrado.";
  } else if (text.includes("password should be") || text.includes("weak password")) {
    message = "A senha informada nao atende aos requisitos de seguranca.";
  } else if (text.includes("cannot coerce the result to a single json object")) {
    message = "Nao foi possivel confirmar um unico registro para esta operacao.";
  } else if (text.includes("row-level security") || text.includes("violates rls")) {
    message = "Permissao negada pelas regras de seguranca do banco de dados.";
  } else if (text.includes("schema cache") || text.includes("could not find")) {
    message = "O Supabase ainda nao atualizou a estrutura necessaria. Aplique as migrations e tente novamente.";
  } else if (text.includes("jwt") || text.includes("session") || text.includes("unauthorized")) {
    message = "Sua sessao expirou. Entre novamente.";
  } else if (text.includes("network") || text.includes("failed to fetch")) {
    message = "Falha de conexao. Verifique a internet e tente novamente.";
  } else if (text.includes("not found")) {
    message = "Registro nao encontrado ou sem permissao de leitura.";
  } else if (current.message && !/^[a-z]+:\/\//i.test(current.message) && looksPortuguese) {
    message = current.message;
  }

  const code = errorCode(error);
  return code ? `${message} (codigo: ${code})` : message;
}
