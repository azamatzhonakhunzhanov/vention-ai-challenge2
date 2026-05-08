import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type HostMembership = {
  host_id: string;
  role: "host" | "checker";
  host: { id: string; slug: string; name: string; logo_url: string | null } | null;
};

export function useHostMemberships() {
  const { user, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<HostMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("host_members")
      .select("host_id, role, host:hosts ( id, slug, name, logo_url )")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        setMemberships((data ?? []) as unknown as HostMembership[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const hostIds = memberships.map((m) => m.host_id);
  return {
    memberships,
    hostIds,
    hasAnyHost: memberships.length > 0,
    loading,
  };
}
