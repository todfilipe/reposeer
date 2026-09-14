"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantMessage, ChatMessage, Source } from "@/lib/chat";
import { fileName } from "@/lib/chat";
import { NETWORK_ERROR, errorMessage } from "@/lib/error-copy";
import { buildGithubFileUrl, type ParsedRepoUrl } from "@/lib/github-url";
import type { IndexStatus, ServiceError } from "@/lib/index-status";
import { readSseEvents } from "@/lib/sse";
import { AnswerBody } from "./answer-body";
import { ArrowRight, FileIcon, GithubMark } from "./icons";
import { SourcesPanel } from "./sources-panel";

const SUGGESTED_QUESTIONS = [
  "How does authentication work?",
  "Where is the main entry point defined?",
  "Explain the folder structure",
];

export function ChatScreen({ repoId }: { repoId: string }) {
  const router = useRouter();
  const [repo, setRepo] = useState<ParsedRepoUrl | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");

  const streamRef = useRef<AbortController | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages[messages.length - 1];
  const isStreaming =
    lastMessage?.role === "assistant" && lastMessage.status === "streaming";

  useEffect(() => {
    let cancelled = false;

    async function loadRepo() {
      const response = await fetch(`/api/index/${repoId}/status`);
      const payload = await response.json();
      if (cancelled) return;

      const index = payload as IndexStatus;
      if (!response.ok || index.stage !== "done") {
        router.replace(`/repo/${repoId}`);
        return;
      }

      setRepo({ owner: index.owner, repo: index.repo });
    }

    loadRepo();
    return () => {
      cancelled = true;
    };
  }, [repoId, router]);

  useEffect(() => () => streamRef.current?.abort(), []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const patchAnswer = useCallback(
    (answerId: string, patch: (answer: AssistantMessage) => AssistantMessage) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === answerId && message.role === "assistant"
            ? patch(message)
            : message
        )
      );
    },
    []
  );

  async function ask(text: string) {
    const answerId = crypto.randomUUID();

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text },
      {
        id: answerId,
        role: "assistant",
        text: "",
        sources: [],
        status: "streaming",
        error: null,
      },
    ]);
    setQuestion("");

    const fail = (message: string) =>
      patchAnswer(answerId, (answer) => ({
        ...answer,
        status: "failed",
        error: message,
      }));

    const controller = new AbortController();
    streamRef.current = controller;

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, question: text }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        fail(errorMessage((await response.json()) as ServiceError));
        return;
      }

      for await (const event of readSseEvents(response.body)) {
        const data = JSON.parse(event.data);

        if (event.event === "sources") {
          const { sources } = data as { sources: Source[] };
          patchAnswer(answerId, (answer) => ({ ...answer, sources }));
        } else if (event.event === "token") {
          const { text: chunk } = data as { text: string };
          patchAnswer(answerId, (answer) => ({
            ...answer,
            text: answer.text + chunk,
          }));
        } else if (event.event === "error") {
          fail(errorMessage(data as ServiceError));
          return;
        } else if (event.event === "done") {
          patchAnswer(answerId, (answer) => ({ ...answer, status: "done" }));
        }
      }

      patchAnswer(answerId, (answer) =>
        answer.status === "streaming" ? { ...answer, status: "done" } : answer
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      fail(NETWORK_ERROR);
      console.error(error);
    }
  }

  if (!repo) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-sm text-muted">Opening this repository…</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-6">
        <GithubMark className="size-4 text-muted" />
        <span className="ml-2.5 font-mono text-sm">
          {repo.owner}/{repo.repo}
        </span>
        <Link
          href="/"
          className="ml-auto rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          Change repository
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[760px] px-6 py-8">
              {messages.length === 0 ? (
                <EmptyState onPick={ask} />
              ) : (
                <ol className="space-y-8">
                  {messages.map((message, index) =>
                    message.role === "user" ? (
                      <li key={message.id} className="flex justify-end">
                        <p className="max-w-[75%] rounded-lg bg-surface px-4 py-2.5 text-[14.5px] leading-6">
                          {message.text}
                        </p>
                      </li>
                    ) : (
                      <li key={message.id} className="max-w-[90%]">
                        <Answer
                          answer={message}
                          repo={repo}
                          onRetry={() => ask(previousQuestion(messages, index))}
                        />
                      </li>
                    )
                  )}
                </ol>
              )}
              <div ref={threadEndRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-line px-6 py-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = question.trim();
                if (trimmed && !isStreaming) ask(trimmed);
              }}
              className="mx-auto flex max-w-[760px] items-center gap-2 rounded-lg border border-line bg-surface p-1.5 focus-within:border-accent"
            >
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={isStreaming}
                autoComplete="off"
                placeholder="Ask a question about this repository..."
                aria-label="Question"
                className="h-9 w-full min-w-0 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isStreaming || question.trim() === ""}
                aria-label="Send question"
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <ArrowRight className="size-4" />
              </button>
            </form>
          </div>
        </main>

        <SourcesPanel
          repo={repo}
          sources={lastMessage?.role === "assistant" ? lastMessage.sources : []}
        />
      </div>
    </div>
  );
}

function previousQuestion(messages: ChatMessage[], answerIndex: number): string {
  const previous = messages[answerIndex - 1];
  return previous?.role === "user" ? previous.text : "";
}

function Answer({
  answer,
  repo,
  onRetry,
}: {
  answer: AssistantMessage;
  repo: ParsedRepoUrl;
  onRetry: () => void;
}) {
  if (answer.status === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-danger/90">{answer.error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:text-accent"
        >
          Try again
        </button>
      </div>
    );
  }

  if (answer.text === "") {
    return (
      <p className="animate-pulse text-sm text-muted">
        {answer.sources.length === 0 ? "Searching the codebase…" : "Writing…"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <AnswerBody answer={answer.text} />

      {answer.status === "done" && answer.sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {answer.sources.map((source) => (
            <a
              key={source.file_path + source.start_offset}
              href={buildGithubFileUrl(
                repo,
                source.file_path,
                source.start_line,
                source.end_line
              )}
              target="_blank"
              rel="noreferrer"
              title={source.file_path}
              className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-accent hover:text-fg"
            >
              <FileIcon className="size-3" />
              {fileName(source.file_path)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-24">
      <h1 className="text-xl font-semibold">Ask anything about this codebase</h1>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        {SUGGESTED_QUESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-md border border-line bg-surface px-3.5 py-2 text-[13px] text-muted transition-colors hover:border-accent hover:text-fg"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
