import { Link, useNavigate } from "@tanstack/react-router";
import { Ticket, CalendarDays, LogOut } from "lucide-react";
import logoUrl from "@/assets/logo.jpeg";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useHostMemberships } from "@/hooks/use-host-memberships";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const { hasAnyHost } = useHostMemberships();
  const navigate = useNavigate();
  const hostHref = user && hasAnyHost ? "/my-events" : "/host/new";

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src={logoUrl} alt="Gather logo" className="h-8 w-8 rounded-lg object-cover" />
          <span className="text-lg">Gather</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            to="/explore"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium text-foreground bg-accent" }}
          >
            Explore
          </Link>
          <Link
            to={hostHref}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium text-foreground bg-accent" }}
          >
            Host
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/my-tickets" })}>
                  <Ticket className="mr-2 h-4 w-4" /> My Tickets
                </DropdownMenuItem>
                {hasAnyHost && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/my-events" })}>
                    <CalendarDays className="mr-2 h-4 w-4" /> My Events
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link to="/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
