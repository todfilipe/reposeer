export type IndexStage =
  | "listing_files"
  | "reading_files"
  | "embedding"
  | "saving"
  | "done"
  | "failed";

export type IndexStatus = {
  repo_id: string;
  owner: string;
  repo: string;
  stage: IndexStage;
  files_found: number | null;
  chunks_processed: number | null;
  chunks_total: number | null;
  error: { error: string; message: string } | null;
};

export type ServiceError = { error: string; message: string };

export function isTerminalStage(stage: IndexStage): boolean {
  return stage === "done" || stage === "failed";
}

export function progressSignature(status: IndexStatus): string {
  return [
    status.stage,
    status.files_found,
    status.chunks_processed,
    status.chunks_total,
  ].join("|");
}
