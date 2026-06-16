import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal // rk8",
  description:
    "Legal notice, submission policy, and disclaimers for the RK8 retro gaming platform.",
};

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="hud-label">/// LEGAL</p>
      <h1 className="mb-2 mt-1 font-mono text-3xl font-bold text-text">
        Legal Notice
      </h1>
      <p className="prose-legal mb-10 text-dim">
        RK8 is a non-commercial fan project — from one gamer to another. The
        following explains what this platform is, what it is not, and the rules
        for contributing to it.
      </p>

      <article className="prose-legal flex flex-col gap-6">
        <Section title="Emulators are legal software">
          <p>
            The emulators RK8 runs in your browser are independently developed
            software that reproduces the behavior of gaming hardware. Emulation
            itself is lawful. RK8 does not distribute any console BIOS or firmware;
            where a system requires one, you must supply your own, and it is
            stored only in your browser. See the{" "}
            <Link href="/bios" className="text-cp-cyan hover:text-text">
              BIOS policy
            </Link>
            .
          </p>
        </Section>

        <Section title="We host community-submitted content">
          <p>
            Games in the community library are uploaded by users, not by RK8. Each
            uploader attests that the material is homebrew, public domain, or
            otherwise lawfully redistributable. RK8 does not intentionally
            distribute commercial copyrighted ROMs. Every submission is reviewed
            by a moderator before it becomes public.
          </p>
        </Section>

        <Section title="Submission policy">
          <p>By contributing a game, you confirm that:</p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              You have the right to share the file — it is homebrew, public
              domain, or distributed under a license that permits redistribution.
            </li>
            <li>
              You will not upload commercial copyrighted ROMs, BIOS files, or
              firmware.
            </li>
            <li>
              Commercial copyrighted material is removed on sight, and repeat
              infringers are banned under our{" "}
              <Link href="/dmca" className="text-cp-cyan hover:text-text">
                three-strikes policy
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section title="Trademarks">
          <p>
            Console names, game titles, company names, and related marks are the
            property of their respective owners. They are used here only for
            identification and to help you find content. RK8 is not affiliated
            with, endorsed by, or sponsored by any of these rights holders.
          </p>
        </Section>

        <Section title="No warranty">
          <p>
            RK8 is provided &ldquo;as is&rdquo;, without warranties of any kind.
            Compatibility, performance, and availability vary by system, browser,
            and device. Use the platform at your own discretion.
          </p>
        </Section>

        <Section title="Reporting a problem">
          <p>
            Every game page has a report button. Copyright owners can file a
            formal takedown notice through the{" "}
            <Link href="/dmca" className="text-cp-cyan hover:text-text">
              DMCA process
            </Link>{" "}
            without creating an account. For anything else, see our{" "}
            <Link href="/contact" className="text-cp-cyan hover:text-text">
              contact page
            </Link>
            .
          </p>
        </Section>
      </article>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}
