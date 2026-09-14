from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str
    github_token: str
    supabase_url: str
    supabase_service_role_key: str
    rag_service_internal_token: str


settings = Settings()
