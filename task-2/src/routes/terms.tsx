import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Gather" },
      { name: "description", content: "The terms that govern your use of Gather." },
      { property: "og:title", content: "Terms of Service — Gather" },
      { property: "og:description", content: "The terms that govern your use of Gather." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 8, 2026</p>
      </header>

      <div className="prose prose-sm max-w-none space-y-6 text-foreground">
        <Section title="1. Acceptance of terms">
          By accessing or using Gather (the “Service”), you agree to be bound by these Terms.
          If you do not agree, do not use the Service.
        </Section>
        <Section title="2. Accounts">
          You are responsible for activity under your account and for keeping your credentials
          secure. You must be at least 13 years old to create an account.
        </Section>
        <Section title="3. Hosting events">
          As a host you are responsible for the accuracy of your event details, for complying
          with applicable laws, and for the conduct of your event. Gather is a tool —
          not the organizer or sponsor of your event.
        </Section>
        <Section title="4. Acceptable use">
          You agree not to use the Service to harass others, distribute unlawful content,
          violate intellectual-property rights, or attempt to disrupt the platform.
        </Section>
        <Section title="5. User content">
          You retain ownership of content you upload (event details, photos, etc.). You grant
          Gather a non-exclusive, worldwide license to host and display that content as needed
          to operate the Service.
        </Section>
        <Section title="6. Termination">
          We may suspend or terminate accounts that violate these Terms. You may delete your
          account at any time.
        </Section>
        <Section title="7. Disclaimer">
          The Service is provided “as is” without warranties of any kind. To the fullest
          extent permitted by law, Gather disclaims all liability for indirect or
          consequential damages arising from use of the Service.
        </Section>
        <Section title="8. Changes">
          We may update these Terms from time to time. Continued use of the Service after
          changes become effective constitutes acceptance of the revised Terms.
        </Section>
        <Section title="9. Contact">
          Questions about these Terms? Reach us at <a className="text-primary hover:underline" href="mailto:hello@gather-up-joy.lovable.app">hello@gather-up-joy.lovable.app</a>.
        </Section>
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
