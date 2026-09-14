import { checkMessageLimit } from "@/lib/limits";
import {
  QUERY_TIMEOUT_MS,
  callRagService,
  serviceErrorResponse,
} from "@/lib/rag-service";
import {
  QUERY_RATE_LIMIT,
  rateLimitedResponse,
  takeRateLimit,
} from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/require-user";
import { addMessageUsage } from "@/lib/usage";

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) {
    return user;
  }

  const retryAfterSeconds = takeRateLimit(`query:${user.id}`, QUERY_RATE_LIMIT);
  if (retryAfterSeconds !== null) {
    return rateLimitedResponse(retryAfterSeconds);
  }

  let repoId: unknown;
  let question: unknown;

  try {
    ({ repoId, question } = await request.json());
  } catch {
    return Response.json(
      { error: "invalid_body", message: "O corpo do pedido não é JSON válido." },
      { status: 400 }
    );
  }

  if (typeof repoId !== "string" || typeof question !== "string" || question.trim() === "") {
    return Response.json(
      { error: "invalid_query", message: "Faltam os campos repoId e question." },
      { status: 400 }
    );
  }

  const limit = await checkMessageLimit();

  if (limit) {
    return Response.json(limit, { status: 402 });
  }

  await addMessageUsage(user.id);

  try {
    const upstream = await callRagService("/query", {
      body: { repo_id: repoId, question: question.trim(), user_id: user.id },
      timeoutMs: QUERY_TIMEOUT_MS,
      clientSignal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json(await upstream.json(), { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
