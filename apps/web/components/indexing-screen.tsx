"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NETWORK_ERROR, errorDetail, errorMessage } from "@/lib/error-copy";
import { buildGithubRepoUrl } from "@/lib/github-url";
import {
  isTerminalStage,
  progressSignature,
  type IndexStatus,
  type ServiceError,
} from "@/lib/index-status";
import { AlertBanner } from "./alert-banner";
import { ProgressSteps } from "./progress-steps";

const POLL_INTERVAL_MS = 2000;

const STALE_AFTER_MS = 120_000;

type ScreenState =
  | { status: "loading" }
  | { status: "tracking"; index: IndexStatus; stale: boolean }
  | { status: "unavailable"; message: string };

export function IndexingScreen({ repoId }: { repoId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let lastSignature = "";
    let changedAt = Date.now();

    async function poll() {
      try {
        const response = await fetch(`/api/index/${repoId}/status`);
        const payload = await response.json();
        if (cancelled || pausedRef.current) return;

        if (!response.ok) {
          setState({
            status: "unavailable",
            message:
              (payload as ServiceError).error === "repo_not_found"
                ? "There is no indexing job at this address."
                : errorMessage(payload as ServiceError),
          });
          return;
        }

        const index = payload as IndexStatus;
        const signature = progressSignature(index);
        if (signature !== lastSignature) {
          lastSignature = signature;
          changedAt = Date.now();
        }
        const stale = Date.now() - changedAt >= STALE_AFTER_MS;

        setState((current) =>
          current.status === "tracking" &&
          current.stale === stale &&
          progressSignature(current.index) === signature
            ? current
            : { status: "tracking", index, stale }
        );

        if (index.stage === "done") {
          router.replace(`/repo/${repoId}/chat`);
          return;
        }

        if (isTerminalStage(index.stage)) return;
      } catch {
        if (cancelled) return;
        setState({
          status: "unavailable",
          message:
            "Lost connection to the server while tracking this indexing job.",
        });
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [repoId, router, attempt]);

  const retry = useCallback(async (owner: string, repo: string) => {
    pausedRef.current = true;
    setRetrying(true);

    try {
      const response = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: buildGithubRepoUrl({ owner, repo }) }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "unavailable",
          message: errorMessage(payload as ServiceError),
        });
        return;
      }

      pausedRef.current = false;
      setState({ status: "loading" });
      setAttempt((count) => count + 1);
    } catch {
      setState({ status: "unavailable", message: NETWORK_ERROR });
    } finally {
      setRetrying(false);
    }
  }, []);

  if (state.status === "loading") {
    return <p className="text-sm text-muted">Looking for this indexing job…</p>;
  }

  if (state.status === "unavailable") {
    return (
      <div className="w-full max-w-lg space-y-4">
        <AlertBanner title="Indexing unavailable" message={state.message} />
        <ConnectAnotherLink />
      </div>
    );
  }

  const { index, stale } = state;
  const failed = index.stage === "failed";

  return (
    <div className="flex w-full max-w-lg flex-col items-center">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">
        {index.stage === "done" ? "Ready" : failed ? "Failed" : "Analyzing"}
      </p>
      <h1 className="mt-2 font-mono text-3xl text-accent">
        {index.owner}/{index.repo}
      </h1>

      <div className="mt-10 w-full rounded-lg border border-line bg-surface p-6">
        <ProgressSteps status={index} />
      </div>

      {failed && index.error && (
        <div className="mt-6 w-full space-y-4">
          <AlertBanner
            title="Indexing didn't finish"
            message={errorMessage(index.error)}
            detail={errorDetail(index.error)}
          />
          <Actions
            index={index}
            retrying={retrying}
            onRetry={retry}
            retryLabel="Try again"
          />
        </div>
      )}

      {!failed && stale && (
        <div className="mt-6 w-full space-y-4">
          <div className="rounded-md border border-line bg-surface px-4 py-3">
            <p className="text-sm text-fg">This hasn’t moved in a while</p>
            <p className="mt-1 text-sm text-muted">
              Indexing may still be running on a large repository, or the
              service may have stopped. Nothing is lost either way: starting
              over re-indexes this repository from scratch.
            </p>
          </div>
          <Actions
            index={index}
            retrying={retrying}
            onRetry={retry}
            retryLabel="Start over"
          />
        </div>
      )}

      {index.stage === "done" ? (
        <p className="mt-6 text-sm text-muted">
          Repository indexed. Opening the chat…
        </p>
      ) : (
        !failed &&
        !stale && (
          <p className="mt-6 max-w-sm text-center text-sm text-muted">
            You can close this page: indexing keeps running on the server, and
            this address will pick the progress back up.
          </p>
        )
      )}
    </div>
  );
}

function Actions({
  index,
  retrying,
  retryLabel,
  onRetry,
}: {
  index: IndexStatus;
  retrying: boolean;
  retryLabel: string;
  onRetry: (owner: string, repo: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        disabled={retrying}
        onClick={() => onRetry(index.owner, index.repo)}
        className="rounded-md border border-line px-3 py-1.5 text-sm text-fg transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {retrying ? "Starting…" : retryLabel}
      </button>
      <ConnectAnotherLink />
    </div>
  );
}

function ConnectAnotherLink() {
  return (
    <Link href="/" className="text-sm text-accent hover:underline">
      ← Connect another repository
    </Link>
  );
}
