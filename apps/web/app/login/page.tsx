import { redirect } from "next/navigation";
import { AlertBanner } from "@/components/alert-banner";
import { LoginForm } from "@/components/login-form";
import { TopBar } from "@/components/top-bar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(next?.startsWith("/") ? next : "/");
  }

  return (
    <>
      <TopBar />

      <main className="hero-backdrop flex flex-1 flex-col items-center px-6 pt-24 pb-32">
        {error === "oauth_failed" && (
          <div className="mb-6 w-full max-w-[420px]">
            <AlertBanner
              title="GitHub sign-in didn't complete"
              message="Try again, or sign in with your email and password."
            />
          </div>
        )}

        <LoginForm next={next?.startsWith("/") ? next : "/"} />
      </main>
    </>
  );
}
