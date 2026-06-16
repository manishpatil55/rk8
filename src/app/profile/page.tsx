import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getUserSubmissions } from "@/lib/games";
import { getSystem } from "@/config/systems.config";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  user: "MEMBER",
  mod: "MODERATOR",
  admin: "ADMIN",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "text-cp-cyan",
  approved: "text-cp-yellow",
  rejected: "text-cp-red",
  takedown: "text-cp-red",
};

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const submissions = await getUserSubmissions(user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 md:px-6">
      <div className="flex items-center gap-4">
        {/* initials avatar — we never hot-link a provider image (COEP + privacy) */}
        <div className="flex h-16 w-16 items-center justify-center border border-line bg-surface-2 font-mono text-2xl text-cp-yellow">
          {(user.name ?? user.email)[0]?.toUpperCase()}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-2xl font-bold text-text">
            {user.name ?? user.email.split("@")[0]}
          </h1>
          <span className="hud-label text-cp-cyan">
            {ROLE_LABEL[user.role] ?? user.role.toUpperCase()}
          </span>
        </div>
      </div>

      <dl className="grid gap-px border sm:grid-cols-2">
        <Field k="EMAIL" v={user.email} />
        <Field k="ROLE" v={user.role} />
        <Field
          k="MEMBER SINCE"
          v={new Date(user.createdAt).toISOString().slice(0, 10)}
        />
        <Field k="STRIKES" v={String(user.strikes)} />
      </dl>

      <section className="flex flex-col gap-3 border-t pt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="hud-label text-text">/// YOUR SUBMISSIONS</h2>
          <Link href="/contribute" className="cmd-link text-cp-yellow hover:text-text">
            &gt; contribute
          </Link>
        </div>
        {submissions.length === 0 ? (
          <p className="border border-dashed border-line p-6 font-mono text-sm text-dim">
            nothing submitted yet. share a homebrew or open-licensed game and
            track its review status here.
          </p>
        ) : (
          <div className="flex flex-col gap-px border">
            {submissions.map((g) => {
              const sys = getSystem(g.systemId);
              const row = (
                <div className="flex items-center justify-between gap-3 bg-surface p-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-sm text-text">{g.title}</span>
                    <span className="hud-label">
                      SYS // {sys?.shortName ?? g.systemId}
                      {g.status === "rejected" && g.rejectReason && (
                        <span className="ml-2 text-cp-red">
                          — {g.rejectReason}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className={`hud-label ${STATUS_STYLE[g.status] ?? ""}`}>
                    {g.status}
                  </span>
                </div>
              );
              return g.status === "approved" ? (
                <Link key={g.id} href={`/play/${g.systemId}/${g.slug}`}>
                  {row}
                </Link>
              ) : (
                <div key={g.id}>{row}</div>
              );
            })}
          </div>
        )}
      </section>

      <form action="/api/auth/signout" method="post">
        <button type="submit" className="rk8-btn-ghost">
          sign out
        </button>
      </form>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-4">
      <dt className="hud-label">{k}</dt>
      <dd className="break-all font-mono text-sm text-text">{v}</dd>
    </div>
  );
}
