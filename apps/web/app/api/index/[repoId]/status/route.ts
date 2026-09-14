import {
  INDEX_TIMEOUT_MS,
  callRagService,
  serviceErrorResponse,
} from "@/lib/rag-service";
import { requireUser } from "@/lib/supabase/require-user";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const user = await requireUser();
  if (user instanceof Response) {
    return user;
  }

  const { repoId } = await params;
  const ownerQuery = new URLSearchParams({ user_id: user.id });

  try {
    const upstream = await callRagService(
      `/index/${encodeURIComponent(repoId)}/status?${ownerQuery}`,
      {
        method: "GET",
        timeoutMs: INDEX_TIMEOUT_MS,
        clientSignal: request.signal,
      }
    );

    return Response.json(await upstream.json(), { status: upstream.status });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
