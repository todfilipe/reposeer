import Image from "next/image";
import Link from "next/link";
import { isBillingEnabled } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GithubMark } from "./icons";

const SOURCE_URL = "https://github.com/todfilipe/reposeer";

export async function TopBar() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="h-14 shrink-0">
      <div className="mx-auto flex h-full max-w-[1200px] items-center px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="RAG Codebase Chat"
            width={28}
            height={28}
            priority
          />
        </Link>

        <nav className="ml-10 hidden gap-7 text-sm text-muted md:flex">
          {user && (
            <Link href="/dashboard" className="transition-colors hover:text-fg">
              Dashboard
            </Link>
          )}
          {isBillingEnabled() && (
            <Link href="/pricing" className="transition-colors hover:text-fg">
              Pricing
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="text-muted transition-colors hover:text-fg"
          >
            <GithubMark className="size-[18px]" />
          </a>
          {user ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">
                {user.email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md border border-line bg-surface px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-muted"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-line bg-surface px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-muted"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
