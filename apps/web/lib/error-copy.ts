import type { ServiceError } from "./index-status";

export const ERROR_COPY: Record<string, string> = {
  invalid_repo_url: "This doesn't look like a GitHub repository URL.",
  repo_not_found:
    "This repository is private or doesn't exist. Only public repositories are supported right now.",
  no_indexable_files: "This repository has no code files to index.",
  indexing_failed:
    "Indexing stopped before it finished. Trying again starts the repository over from scratch.",

  status_unavailable: "Couldn't read the status of this indexing job.",

  repo_not_indexed:
    "This repository has no indexed content. Try indexing it again.",
  retrieval_failed: "Couldn't search this repository. Try again in a moment.",
  generation_failed: "Something went wrong generating a response.",

  repo_limit_reached:
    "You've used every repository slot on your plan. Remove one or upgrade to connect another.",
  message_limit_reached:
    "You've used every message on your plan this month. Upgrade for more, or wait for the counter to reset.",
  repo_too_large:
    "This repository is bigger than your plan allows. Upgrading raises the limit.",
  chunk_budget_exceeded:
    "This month's indexing budget is used up. Try again next month or upgrade your plan.",

  rag_service_unavailable:
    "The RAG service isn't responding. Check that rag-service is running.",
  upstream_timeout: "The RAG service took too long to respond.",
  invalid_internal_token: "The RAG service rejected this request.",
  rate_limited: "Rate limit reached. Try again in a minute.",
};

export const NETWORK_ERROR = "Couldn't reach the server. Check your connection.";

export function errorMessage(error: ServiceError): string {
  return ERROR_COPY[error.error] ?? error.message;
}

export function errorDetail(error: ServiceError): string | null {
  return error.error in ERROR_COPY && error.message.trim() !== ""
    ? error.message
    : null;
}
