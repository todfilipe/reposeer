import type { ServiceError } from "./index-status";

export const QUERY_TIMEOUT_MS = 30_000;
export const INDEX_TIMEOUT_MS = 30_000;

class RagServiceUnreachable extends Error {}
class RagServiceTimeout extends Error {}

export async function callRagService(
  path: string,
  {
    method = "POST",
    body,
    timeoutMs,
    clientSignal,
  }: {
    method?: "GET" | "POST";
    body?: unknown;
    timeoutMs: number;
    clientSignal: AbortSignal;
  }
): Promise<Response> {
  const baseUrl = process.env.RAG_SERVICE_URL;
  const token = process.env.RAG_SERVICE_INTERNAL_TOKEN;

  if (!baseUrl || !token) {
    throw new Error(
      "RAG_SERVICE_URL ou RAG_SERVICE_INTERNAL_TOKEN em falta no .env.local"
    );
  }

  const controller = new AbortController();
  const abortFromClient = () => controller.abort(clientSignal.reason);
  clientSignal.addEventListener("abort", abortFromClient);

  const timeout = setTimeout(
    () => controller.abort(new RagServiceTimeout(`Sem resposta em ${timeoutMs}ms`)),
    timeoutMs
  );

  try {
    return await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.reason instanceof RagServiceTimeout) {
      throw controller.signal.reason;
    }
    if (clientSignal.aborted) {
      throw error;
    }
    throw new RagServiceUnreachable(
      error instanceof Error ? error.message : "falha de rede desconhecida"
    );
  } finally {
    clearTimeout(timeout);
    clientSignal.removeEventListener("abort", abortFromClient);
  }
}

export function serviceErrorResponse(error: unknown): Response {
  if (error instanceof RagServiceTimeout) {
    return Response.json(
      { error: "upstream_timeout", message: error.message } satisfies ServiceError,
      { status: 504 }
    );
  }

  if (error instanceof RagServiceUnreachable) {
    return Response.json(
      {
        error: "rag_service_unavailable",
        message: `Não foi possível contactar o rag-service: ${error.message}`,
      } satisfies ServiceError,
      { status: 502 }
    );
  }

  return Response.json(
    {
      error: "proxy_failed",
      message: error instanceof Error ? error.message : "erro desconhecido",
    } satisfies ServiceError,
    { status: 500 }
  );
}
