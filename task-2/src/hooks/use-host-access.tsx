import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type HostAccess = {
  loading: boolean;
  host: { id: string; slug: string; name: string } | null;
  role: "host" | "checker" | null;
  isHost: boolean;
  notFound: boolean;
};

export function useHostAccess(slug: string): HostAccess {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<HostAccess>({
    loading: true, host: null, role: null, isHost: false, notFound: false,
  });

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    (async () => {
      const { data: host } = await supabase
        .from("hosts")
        .select("id, slug, name")
        .eq("slug", slug)
        .maybeSingle();
      if (!active) return;
      if (!host) {
        setState({ loading: false, host: null, role: null, isHost: false, notFound: true });
        return;
      }
      if (!user) {
        setState({ loading: false, host, role: null, isHost: false, notFound: false });
        return;
      }
      const { data: member } = await supabase
        .from("host_members")
        .select("role")
        .eq("host_id", host.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      const role = (member?.role ?? null) as "host" | "checker" | null;
      setState({ loading: false, host, role, isHost: role === "host", notFound: false });
    })();
    return () => { active = false; };
  }, [slug, user, authLoading]);

  return state;
}
