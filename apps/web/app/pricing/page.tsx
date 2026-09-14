import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  BoltIcon,
  CheckCircle,
  RocketIcon,
  SparkleIcon,
  SproutIcon,
} from "@/components/icons";
import { TopBar } from "@/components/top-bar";
import { listPlans, type Plan } from "@/lib/plans";
import { isBillingEnabled } from "@/lib/stripe";
import { startCheckout } from "./actions";

const HERO_PLAN = "pro";

const PLAN_META: Record<
  string,
  { Icon: typeof SproutIcon; description: string; iconTile: string }
> = {
  free: {
    Icon: SproutIcon,
    description: "For trying it on a few repositories.",
    iconTile: "border border-line bg-canvas text-muted",
  },
  pro: {
    Icon: RocketIcon,
    description: "For developers who live in large codebases.",
    iconTile: "bg-accent text-canvas",
  },
  ultra: {
    Icon: BoltIcon,
    description: "For heavy use across many repositories.",
    iconTile: "border border-accent/30 bg-accent/10 text-accent",
  },
};

function planName(plan: Plan) {
  return plan.id.charAt(0).toUpperCase() + plan.id.slice(1);
}

function features(plan: Plan) {
  return [
    `${plan.max_repos} repositories`,
    `Up to ${plan.max_chunks_per_repo.toLocaleString("en")} chunks per repo`,
    `${plan.max_messages_per_month.toLocaleString("en")} messages per month`,
    "Unlimited re-indexing",
  ];
}

export default async function PricingPage() {
  await connection();

  if (!isBillingEnabled()) {
    notFound();
  }

  const plans = await listPlans();

  return (
    <>
      <TopBar />

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-6 pt-20 pb-28">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-[-0.03em]">
            Plans and pricing
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-7 text-muted text-balance">
            The size of the repository you can connect is what separates the
            plans. Everything else is generous on purpose.
          </p>
        </div>

        <ul className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isHero = plan.id === HERO_PLAN;
            const isPaid = Boolean(plan.stripe_price_id);
            const { Icon, description, iconTile } =
              PLAN_META[plan.id] ?? PLAN_META.free;

            return (
              <li
                key={plan.id}
                className={`relative flex flex-col rounded-2xl p-7 backdrop-blur-sm ${
                  isHero
                    ? "bg-linear-to-b from-accent/15 via-surface/60 to-surface/60 shadow-[0_0_70px_-20px_rgb(248_167_29/0.5)]"
                    : "bg-surface/60"
                }`}
              >
                {isHero && (
                  <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap text-canvas uppercase">
                    <SparkleIcon className="size-3" />
                    Most popular
                  </span>
                )}

                <span
                  className={`flex size-11 items-center justify-center rounded-xl ${iconTile}`}
                >
                  <Icon className="size-5" />
                </span>

                <h2 className="mt-6 text-2xl font-bold tracking-tight">
                  {planName(plan)}
                </h2>
                <p className="mt-1 text-sm text-muted md:min-h-10">{description}</p>

                <p className="mt-7 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-[-0.03em]">
                    €{plan.price_cents / 100}
                  </span>
                  <span className="text-sm text-muted">/month</span>
                </p>
                <p className="mt-1.5 text-xs text-muted">
                  {isPaid ? "Billed monthly" : "Included with every account"}
                </p>

                <ul className="mt-7 flex flex-col gap-3 text-sm">
                  {features(plan).map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <CheckCircle
                        className={`size-[18px] shrink-0 ${
                          isHero ? "text-accent" : "text-muted"
                        }`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-9">
                  {isPaid ? (
                    <form action={startCheckout}>
                      <input type="hidden" name="plan_id" value={plan.id} />
                      <button
                        type="submit"
                        className={`h-11 w-full rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 ${
                          isHero
                            ? "bg-accent text-canvas shadow-[0_8px_30px_-8px_rgb(248_167_29/0.6)]"
                            : "bg-fg text-canvas"
                        }`}
                      >
                        Subscribe to {planName(plan)}
                      </button>
                    </form>
                  ) : (
                    <Link
                      href="/"
                      className="flex h-11 w-full items-center justify-center rounded-lg border border-line bg-canvas text-sm font-semibold transition-colors hover:border-muted"
                    >
                      Get started
                    </Link>
                  )}
                  <p className="mt-3 text-center text-xs text-muted">
                    {isPaid ? "Cancel anytime" : "No credit card required"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
