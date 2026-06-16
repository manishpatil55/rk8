import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DMCA Policy // rk8",
  description:
    "Copyright takedown policy, designated agent, counter-notice procedure, and repeat-infringer policy.",
};

export default function DmcaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="hud-label text-cp-red">/// DMCA</p>
      <h1 className="mb-2 mt-1 font-mono text-3xl font-bold text-text">
        Copyright &amp; Takedown Policy
      </h1>
      <p className="prose-legal mb-10 text-dim">
        RK8 respects the intellectual property rights of others and complies with
        the Digital Millennium Copyright Act (17 U.S.C. § 512). This page
        explains how to submit a takedown notice, how to file a counter-notice,
        and our policy for repeat infringers.
      </p>

      <article className="prose-legal flex flex-col gap-6">
        <Section title="1. We host community-submitted content">
          <p>
            RK8 is a non-commercial fan project. Games in the community library
            are uploaded by users who attest that each file is homebrew, public
            domain, or otherwise lawfully redistributable. We do not intentionally
            host commercial copyrighted ROMs. When we are notified that material
            infringes a copyright, we act expeditiously to remove it.
          </p>
        </Section>

        <Section title="2. Filing a takedown notice">
          <p>
            If you are a copyright owner, or authorized to act on behalf of one,
            and you believe material on RK8 infringes your copyright, send a
            written notice that includes all of the elements required by 17 U.S.C.
            § 512(c)(3):
          </p>
          <ol className="ml-5 list-decimal space-y-2">
            <li>
              A physical or electronic signature of the copyright owner or a
              person authorized to act on their behalf.
            </li>
            <li>
              Identification of the copyrighted work claimed to have been
              infringed.
            </li>
            <li>
              Identification of the infringing material and information
              reasonably sufficient to let us locate it — a direct link to the
              game page is ideal.
            </li>
            <li>
              Your contact information: name, address, telephone number, and
              email address.
            </li>
            <li>
              A statement that you have a good-faith belief that the use is not
              authorized by the copyright owner, its agent, or the law.
            </li>
            <li>
              A statement, made under penalty of perjury, that the information in
              the notice is accurate and that you are the copyright owner or
              authorized to act on their behalf.
            </li>
          </ol>
          <p>
            The fastest way to submit a complete notice is the{" "}
            <span className="text-text">report</span> button on any game page
            (choose &ldquo;DMCA notice&rdquo;), which collects each required
            element. To prevent abuse, a notice is confirmed by a one-time link
            sent to the contact email you provide; the listing is reviewed once
            you confirm. You may also contact our designated agent directly using
            the details below.
          </p>
        </Section>

        {/* clearly-marked operator placeholder — fill before going live */}
        <section className="border border-cp-yellow/50 bg-cp-yellow/5 p-5">
          <p className="hud-label mb-3 text-cp-yellow">
            /// OPERATOR: REPLACE BEFORE LAUNCH — DESIGNATED AGENT
          </p>
          <div className="prose-legal text-text">
            <p className="font-semibold">Designated Copyright Agent</p>
            <p className="text-dim">
              Name: [DESIGNATED AGENT NAME]
              <br />
              Organization: [OPERATOR / ENTITY NAME]
              <br />
              Mailing address: [STREET, CITY, STATE, ZIP, COUNTRY]
              <br />
              Email: [dmca@your-domain.example]
              <br />
              Phone: [+1 …]
            </p>
            <p className="mt-3 text-sm text-dim">
              To receive DMCA safe-harbor protection, the operator must register
              this designated agent with the U.S. Copyright Office at{" "}
              <span className="text-text">dmca.copyright.gov</span> and keep these
              details current.
            </p>
          </div>
        </section>

        <Section title="3. What happens after we receive a valid notice">
          <p>
            After you confirm the notice via the emailed link, a moderator
            reviews it and a valid notice results in the listing being taken down
            promptly. To guarantee a timely response, any listing that is the
            subject of a confirmed DMCA notice is automatically taken down within
            72 hours of confirmation if a moderator has not already acted. The
            uploader is notified and a strike is recorded against their account.
            Automatic takedowns are reversible if later found to be in error.
          </p>
        </Section>

        <Section title="4. Counter-notice">
          <p>
            If you believe your material was removed by mistake or
            misidentification, you may send a counter-notice to our designated
            agent that includes:
          </p>
          <ol className="ml-5 list-decimal space-y-2">
            <li>Your physical or electronic signature.</li>
            <li>
              Identification of the material that was removed and the location
              where it appeared before removal.
            </li>
            <li>
              A statement, under penalty of perjury, that you have a good-faith
              belief the material was removed as a result of mistake or
              misidentification.
            </li>
            <li>
              Your name, address, and telephone number, and a statement that you
              consent to the jurisdiction of the federal district court for your
              address (or, if outside the United States, any judicial district in
              which RK8 may be found), and that you will accept service of process
              from the complainant.
            </li>
          </ol>
          <p>
            If we receive a valid counter-notice, we may restore the material in
            10–14 business days unless the original complainant files an action
            seeking a court order against the uploader.
          </p>
        </Section>

        <Section title="5. Repeat-infringer policy">
          <p>
            We maintain a three-strikes policy. Each upload removed in response to
            a valid copyright notice counts as one strike against the uploading
            account. Upon the third strike, the account is terminated and the user
            is barred from contributing. We may terminate accounts sooner in cases
            of egregious or willful infringement.
          </p>
        </Section>

        <Section title="6. Misrepresentation">
          <p>
            Under 17 U.S.C. § 512(f), any person who knowingly materially
            misrepresents that material is infringing — or that it was removed by
            mistake — may be liable for damages. Do not make false claims.
          </p>
        </Section>
      </article>

      <p className="prose-legal mt-10 text-sm text-dim">
        See also our{" "}
        <Link href="/legal" className="text-cp-cyan hover:text-text">
          legal notice
        </Link>{" "}
        and{" "}
        <Link href="/contact" className="text-cp-cyan hover:text-text">
          contact page
        </Link>
        .
      </p>
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
