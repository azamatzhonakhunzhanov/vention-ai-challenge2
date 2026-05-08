import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Gather" },
      { name: "description", content: "How Gather collects, uses, and protects your data." },
      { property: "og:title", content: "Privacy Policy — Gather" },
      { property: "og:description", content: "How Gather collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 8, 2026</p>
      </header>

      <div className="space-y-6">
        <Section title="What we collect">
          Account info (name, email, avatar), event and RSVP data you create, photos you
          upload to galleries, and basic technical logs (IP, user agent) for security and
          reliability.
        </Section>
        <Section title="How we use it">
          To run the Service: authenticate you, show your events to attendees, deliver
          notifications, prevent abuse, and improve the product. We do not sell your
          personal data.
        </Section>
        <Section title="Sharing">
          Hosts can see RSVP and check-in data for their own events. Public event pages
          show the host name and event details you publish. We use a small set of trusted
          infrastructure providers (hosting, database, email) under data-processing terms.
        </Section>
        <Section title="Cookies">
          We use a session cookie to keep you signed in. We do not use third-party
          advertising trackers.
        </Section>
        <Section title="Your choices">
          You can edit your profile, delete events you created, request a data export, or
          delete your account at any time. Email <a className="text-primary hover:underline" href="mailto:privacy@gather-up-joy.lovable.app">privacy@gather-up-joy.lovable.app</a> for data requests.
        </Section>
        <Section title="Retention">
          We keep your data while your account is active. When you delete your account, we
          remove personal data within 30 days, except where retention is required by law.
        </Section>
        <Section title="Children">
          The Service is not directed to children under 13. We do not knowingly collect
          information from children under 13.
        </Section>
        <Section title="Changes">
          If we make material changes to this policy we will notify you in the app or by
          email before they take effect.
        </Section>
        <Section title="Contact">
          Questions? Reach us at <a className="text-primary hover:underline" href="mailto:privacy@gather-up-joy.lovable.app">privacy@gather-up-joy.lovable.app</a>.
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
