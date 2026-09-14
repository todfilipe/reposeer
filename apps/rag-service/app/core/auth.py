import secrets

from fastapi import Header

from app.core.config import settings


class InvalidInternalToken(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def require_internal_token(authorization: str | None = Header(default=None)) -> None:
    if authorization is None or not authorization.startswith("Bearer "):
        raise InvalidInternalToken(
            "missing_internal_token",
            "Falta o header Authorization: Bearer <RAG_SERVICE_INTERNAL_TOKEN>.",
        )

    received = authorization.removeprefix("Bearer ")

    if not secrets.compare_digest(received, settings.rag_service_internal_token):
        raise InvalidInternalToken("invalid_internal_token", "Token interno inválido.")
