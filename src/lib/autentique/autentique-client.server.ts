/* eslint-disable @typescript-eslint/no-explicit-any -- Autentique GraphQL responses are intentionally normalized at the boundary. */
import "@tanstack/react-start/server-only";

const AUTENTIQUE_ENDPOINT = "https://api.autentique.com.br/v2/graphql";

type GraphQLErrorPayload = {
  message?: string;
  extensions?: Record<string, unknown>;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLErrorPayload[];
};

export type AutentiqueSignerInput = {
  name?: string;
  email?: string;
  phone?: string;
  delivery_method?: "DELIVERY_METHOD_WHATSAPP" | "DELIVERY_METHOD_SMS";
  action?: "SIGN" | "SIGN_AS_A_WITNESS" | "APPROVE" | "RECOGNIZE";
};

export type AutentiqueDocumentInput = {
  name: string;
  message?: string;
  ignore_cpf?: boolean;
  new_signature_style?: boolean;
  locale?: {
    country?: string;
    language?: string;
    timezone?: string;
    date_format?: string;
  };
};

export class AutentiqueError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AutentiqueError";
  }
}

function getApiKey() {
  const apiKey = process.env.AUTENTIQUE_API_KEY;
  if (!apiKey) {
    throw new AutentiqueError("AUTENTIQUE_API_KEY nao configurada no ambiente do servidor.");
  }
  return apiKey;
}

function normalizeGraphqlErrors(errors?: GraphQLErrorPayload[]) {
  if (!errors?.length) return null;
  return errors.map((error) => error.message || "Erro GraphQL sem mensagem").join(" | ");
}

async function parseGraphqlResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: GraphQLResponse<T>;

  try {
    payload = text ? (JSON.parse(text) as GraphQLResponse<T>) : {};
  } catch {
    throw new AutentiqueError(
      `Autentique retornou resposta invalida (${response.status}).`,
      response.status,
      text,
    );
  }

  if (!response.ok) {
    throw new AutentiqueError(
      normalizeGraphqlErrors(payload.errors) ?? `Falha HTTP na Autentique (${response.status}).`,
      response.status,
      payload,
    );
  }

  const graphQlError = normalizeGraphqlErrors(payload.errors);
  if (graphQlError) {
    throw new AutentiqueError(graphQlError, response.status, payload.errors);
  }

  if (!payload.data) {
    throw new AutentiqueError("Autentique nao retornou dados.", response.status, payload);
  }

  return payload.data;
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(AUTENTIQUE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  return parseGraphqlResponse<T>(response);
}

export async function createAutentiqueDocument(input: {
  document: AutentiqueDocumentInput;
  signers: AutentiqueSignerInput[];
  file: Blob;
  fileName: string;
  sandbox?: boolean;
}) {
  const query = `
    mutation CreateDocumentMutation(
      $document: DocumentInput!,
      $signers: [SignerInput!]!,
      $file: Upload!,
      $sandbox: Boolean
    ) {
      createDocument(
        document: $document,
        signers: $signers,
        file: $file,
        sandbox: $sandbox
      ) {
        id
        name
        created_at
        files { original signed pades }
        signatures {
          public_id
          name
          email
          phone
          created_at
          action { name }
          link { short_link }
          user { id name email phone }
          user_data { name email phone }
          viewed { created_at }
          signed { created_at }
          rejected { created_at reason }
        }
      }
    }
  `;

  const formData = new FormData();
  formData.append(
    "operations",
    JSON.stringify({
      query,
      variables: {
        document: input.document,
        signers: input.signers,
        sandbox: input.sandbox ?? true,
        file: null,
      },
    }),
  );
  formData.append("map", JSON.stringify({ file: ["variables.file"] }));
  formData.append("file", input.file, input.fileName);

  const response = await fetch(AUTENTIQUE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: formData,
  });

  const data = await parseGraphqlResponse<{ createDocument: any }>(response);
  return data.createDocument;
}

export async function getAutentiqueDocument(id: string) {
  const data = await graphqlRequest<{ document: any }>(
    `
      query GetAutentiqueDocument($id: ID!) {
        document(id: $id) {
          id
          name
          created_at
          files { original signed pades }
          signatures {
            public_id
            name
            email
            phone
            created_at
            action { name }
            link { short_link }
            user { id name email phone }
            user_data { name email phone }
            email_events {
              sent
              opened
              delivered
              refused
              reason
            }
            viewed { created_at }
            signed { created_at }
            rejected { created_at reason }
            signed_unapproved { created_at }
            biometric_approved { created_at }
            biometric_rejected { created_at reason }
          }
        }
      }
    `,
    { id },
  );

  return data.document;
}

export async function createSignatureLink(publicId: string) {
  const data = await graphqlRequest<{ createLinkToSignature: { short_link: string } }>(
    `
      mutation CreateSignatureLink($publicId: String!) {
        createLinkToSignature(public_id: $publicId) {
          short_link
        }
      }
    `,
    { publicId },
  );

  return data.createLinkToSignature.short_link;
}
