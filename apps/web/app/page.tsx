import { ConnectForm } from "@/components/connect-form";
import { ProductPreview } from "@/components/product-preview";
import { TopBar } from "@/components/top-bar";

export default function LandingPage() {
  return (
    <>
      <TopBar />

      <main className="hero-backdrop flex flex-1 flex-col items-center px-6 pt-28 pb-32">
        <h1 className="mt-10 max-w-[820px] text-center text-[52px] leading-[1.06] font-bold tracking-[-0.03em] text-balance sm:text-[64px]">
          Ask questions about any GitHub repository
        </h1>

        <p className="mt-7 max-w-[640px] text-center text-[15px] leading-7 text-muted text-balance">
          Instant semantic search and code reasoning for your entire codebase.
          Answers grounded in the actual files, with citations you can check.
        </p>

        <div className="mt-10 flex w-full justify-center">
          <ConnectForm />
        </div>

        <div className="mt-32 flex w-full justify-center">
          <ProductPreview />
        </div>
      </main>
    </>
  );
}
