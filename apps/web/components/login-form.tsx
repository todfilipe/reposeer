"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GithubMark } from "./icons";

type Mode = "signin" | "signup";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "failed"; message: string }
  | { status: "check_email" };

const CARD =
  "w-full max-w-[420px] rounded-2xl bg-linear-to-b from-accent/10 via-surface/60 to-surface/60 p-8 backdrop-blur-sm";

const INPUT =
  "h-11 rounded-lg border border-line bg-canvas/70 px-3.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-accent";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  const busy = state.status === "submitting";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "submitting" });

    const supabase = createSupabaseBrowserClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) {
        setState({ status: "failed", message: error.message });
        return;
      }

      if (!data.session) {
        setState({ status: "check_email" });
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setState({ status: "failed", message: error.message });
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  async function handleGithub() {
    setState({ status: "submitting" });

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: "user:email",
      },
    });

    if (error) {
      setState({ status: "failed", message: error.message });
    }
  }

  if (state.status === "check_email") {
    return (
      <div className={`${CARD} text-center`}>
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          We sent a confirmation link to{" "}
          <span className="font-mono text-fg">{email}</span>. Open it to finish
          creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <Image
        src="/logo.png"
        alt=""
        width={44}
        height={44}
        className="mx-auto mb-5"
      />
      <h1 className="text-center text-2xl font-bold tracking-tight">
        {mode === "signin" ? "Sign in" : "Create an account"}
      </h1>
      <p className="mt-2 text-center text-sm text-muted">
        Connect a repository and start asking questions.
      </p>

      <button
        type="button"
        onClick={handleGithub}
        disabled={busy}
        className="mt-8 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-fg text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <GithubMark className="size-[18px]" />
        Continue with GitHub
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line/60" />
        or
        <span className="h-px flex-1 bg-line/60" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Email"
          className={INPUT}
        />

        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password"
          aria-label="Password"
          className={INPUT}
        />

        <button
          type="submit"
          disabled={busy}
          className="mt-2 h-11 rounded-lg bg-accent text-sm font-semibold text-canvas shadow-[0_8px_30px_-8px_rgb(248_167_29/0.6)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <div className="mt-4 min-h-5 text-center text-xs">
        {state.status === "failed" && (
          <p className="text-danger">{state.message}</p>
        )}
      </div>

      <p className="mt-2 text-center text-sm text-muted">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setState({ status: "idle" });
          }}
          className="text-accent hover:underline"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
