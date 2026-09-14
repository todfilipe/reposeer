from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.auth import InvalidInternalToken, require_internal_token
from app.routers.health import router as health_router
from app.routers.indexing import router as indexing_router
from app.routers.query import router as query_router

app = FastAPI(title="RAG Service")


@app.exception_handler(InvalidInternalToken)
async def handle_invalid_internal_token(_: Request, error: InvalidInternalToken):
    return JSONResponse(
        status_code=401, content={"error": error.code, "message": error.message}
    )


internal_only = [Depends(require_internal_token)]

app.include_router(health_router)
app.include_router(indexing_router, dependencies=internal_only)
app.include_router(query_router, dependencies=internal_only)
