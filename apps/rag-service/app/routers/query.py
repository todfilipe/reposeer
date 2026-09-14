import json
from uuid import UUID

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.core.embeddings import GeminiApiError, create_gemini_client
from app.core.generator import stream_answer
from app.core.retriever import RetrievalError, RetrievedChunk, retrieve_chunks

router = APIRouter()


class QueryRequest(BaseModel):
    repo_id: str
    question: str
    user_id: str | None = None


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def event_stream(question: str, chunks: list[RetrievedChunk]):
    yield sse_event(
        "sources",
        {
            "sources": [
                {
                    "file_path": chunk.file_path,
                    "similarity": round(chunk.similarity, 3),
                    "start_offset": chunk.start_offset,
                    "end_offset": chunk.end_offset,
                    "start_line": chunk.start_line,
                    "end_line": chunk.end_line,
                    "content": chunk.content,
                }
                for chunk in chunks
            ]
        },
    )

    try:
        async with create_gemini_client() as gemini:
            async for text in stream_answer(gemini, question, chunks):
                yield sse_event("token", {"text": text})
    except GeminiApiError as error:
        yield sse_event("error", {"error": "generation_failed", "message": str(error)})
        return

    yield sse_event("done", {"finish_reason": "stop"})


@router.post("/query")
async def query(request: QueryRequest):
    if request.user_id is None:
        return JSONResponse(
            status_code=400,
            content={
                "error": "missing_user_id",
                "message": "Todo o pedido de query tem de trazer user_id.",
            },
        )
    try:
        UUID(request.user_id)
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={
                "error": "invalid_user_id",
                "message": f"user_id inválido: {request.user_id}",
            },
        )

    try:
        chunks = await retrieve_chunks(
            request.question, request.repo_id, request.user_id
        )
    except (GeminiApiError, RetrievalError) as error:
        return JSONResponse(
            status_code=500,
            content={"error": "retrieval_failed", "message": str(error)},
        )

    if not chunks:
        return JSONResponse(
            status_code=404,
            content={
                "error": "repo_not_indexed",
                "message": f"Não há chunks indexados para o repo {request.repo_id} deste utilizador.",
            },
        )

    return StreamingResponse(
        event_stream(request.question, chunks),
        media_type="text/event-stream",
    )
