import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact // rk8",
  description: "How to reach RK8 — copyright notices, abuse reports, and general inquiries.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="hud-label">/// CONTACT</p>
      <h1 className="mb-2 mt-1 font-mono text-3xl font-bold text-text">
        Contact
      </h1>
      <p className="prose-legal mb-10 text-dim">
        RK8 is a small non-commercial fan project. The fastest way to resolve
        most issues is the right channel below.
      </p>

      <article className="prose-legal flex flex-col gap-6">
        <Section title="Copyright takedowns">
          <p>
            Copyright owners and their agents should use the{" "}
            <Link href="/dmca" className="text-cp-cyan hover:text-text">
              DMCA process
            </Link>
            . You can file a complete notice from the report button on any game
            page without creating an account, or contact our designated agent
            directly using the details on the DMCA page.
          </p>
        </Section>

        <Section title="Reporting a specific game">
          <p>
            For a broken game, incorrect information, or anything else about a
            particular listing, use the{" "}
            <span className="text-text">report</span> button on that game&rsquo;s
            page. It routes straight to the moderation queue.
          </p>
        </Section>

        {/* clearly-marked operator placeholder — fill before going live */}
        <section className="border border-cp-yellow/50 bg-cp-yellow/5 p-5">
          <p className="hud-label mb-3 text-cp-yellow">
            /// OPERATOR: REPLACE BEFORE LAUNCH — CONTACT DETAILS
          </p>
          <div className="prose-legal text-text">
            <p className="text-dim">
              General inquiries: [hello@your-domain.example]
              <br />
              Copyright / DMCA: [dmca@your-domain.example]
              <br />
              Abuse / safety: [abuse@your-domain.example]
            </p>
          </div>
        </section>

        <Section title="A note on response times">
          <p>
            This is a volunteer-run project, so general replies may take time.
            Copyright notices are prioritized: a complete DMCA notice results in
            removal of the listing within 72 hours at the latest.
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
