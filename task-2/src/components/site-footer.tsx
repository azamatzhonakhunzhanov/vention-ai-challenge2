import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>© {year} Gather</p>
        <nav className="flex items-center gap-5">
          <Link to="/about" className="transition-colors hover:text-foreground">About</Link>
          <Link to="/terms" className="transition-colors hover:text-foreground">Terms</Link>
          <Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
