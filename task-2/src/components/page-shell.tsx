import type { ReactNode } from "react";

interface PageShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageShell({ eyebrow, title, description, children }: PageShellProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {description && (
          <p className="mt-3 text-base text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="mt-10">{children}</div>}
    </section>
  );
}
