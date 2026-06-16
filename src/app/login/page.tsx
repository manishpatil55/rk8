import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DEV_AUTH, DEV_AUTH_EMAIL, enabledProviders } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  provider: "that sign-in method isn't available.",
  state: "login session expired — start again.",
  denied: "sign-in was cancelled.",
  email_required: "your account didn't share an email — enable it and retry.",
  email_unverified: "verify your email with the provider, then retry.",
  banned: "this account is suspended.",
  invalid_credentials: "invalid credentials.",
  orphaned_identity: "account record missing — contact an admin.",
  exchange: "sign-in failed — try again.",
  dev: "dev sign-in failed.",
};

function safeNext(v: string | undefined): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);

  // already signed in → bounce onward
  if (await getCurrentUser()) redirect(next);

  const providers = enabledProviders();
  const err = sp.error ? (ERRORS[sp.error] ?? "sign-in failed.") : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 md:py-24">
      <div className="flex flex-col gap-2">
        <p className="hud-label">/// ACCESS TERMINAL</p>
        <h1 className="font-mono text-3xl font-bold text-text">sign in</h1>
        <p className="font-mono text-[13px] leading-relaxed text-dim">
          playing is always anonymous. an account is only needed to contribute
          games, sync saves, or moderate.
        </p>
      </div>

      {err && (
        <p
          role="alert"
          className="border border-cp-red/50 bg-cp-red/10 p-3 font-mono text-sm text-cp-red"
        >
          {err}
        </p>
      )}

      <div className="rk8-card notch-tr flex flex-col gap-3 p-5">
        {providers.length === 0 ? (
          <p className="font-mono text-[13px] leading-relaxed text-dim">
            no oauth providers configured. set DISCORD_CLIENT_ID /
            GOOGLE_CLIENT_ID (and secrets) in <code>.env</code>, or use the dev
            login below.
          </p>
        ) : (
          providers.map((p) => (
            <a
              key={p.id}
              href={`/api/auth/signin/${p.id}?next=${encodeURIComponent(next)}`}
              className="rk8-btn-primary w-full justify-center"
            >
              continue with {p.label}
            </a>
          ))
        )}
      </div>

      {DEV_AUTH && (
        <form
          action="/api/auth/dev"
          method="post"
          className="rk8-card notch-tr flex flex-col gap-3 p-5"
        >
          <p className="hud-label text-cp-cyan">DEV LOGIN // local only</p>
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-1 font-mono text-[13px] text-dim">
            email
            <input
              name="email"
              type="email"
              defaultValue={DEV_AUTH_EMAIL}
              className="border border-line bg-surface-2 px-3 py-2 text-text outline-none focus:border-cp-yellow"
            />
          </label>
          <label className="flex flex-col gap-1 font-mono text-[13px] text-dim">
            password
            <input
              name="password"
              type="password"
              className="border border-line bg-surface-2 px-3 py-2 text-text outline-none focus:border-cp-yellow"
            />
          </label>
          <button type="submit" className="rk8-btn-ghost w-full justify-center">
            sign in as dev admin
          </button>
        </form>
      )}

      <Link href="/" className="cmd-link text-dim hover:text-text">
        &gt; back to home
      </Link>
    </div>
  );
}
