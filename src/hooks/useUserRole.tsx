import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type AppRole = "admin" | "moderator" | "user";

interface UserRoleState {
  role: AppRole | null;
  isAdmin: boolean;
  isModerator: boolean;
  canViewAnalytics: boolean;
  isLoading: boolean;
}

export function useUserRole(): UserRoleState {
  const { user, isLoading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [canViewAnalytics, setCanViewAnalytics] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRole(null);
      setCanViewAnalytics(false);
      setIsLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        // Note: a single user can have multiple rows in user_roles
        // (the table's UNIQUE constraint is on (user_id, role), not just
        // user_id). Using `.maybeSingle()` here would crash with PGRST116
        // when a user happens to have e.g. both 'admin' and 'user' rows,
        // and the hook would silently set role=null — making the founder
        // look like a regular user and hiding the Admin sidebar item.
        // Fetch all rows and pick the highest-priority one client-side.
        const { data, error } = await supabase
          .from("user_roles")
          .select("role, can_view_analytics")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
          setCanViewAnalytics(false);
        } else {
          const rows = (data ?? []) as { role: AppRole; can_view_analytics: boolean | null }[];
          const priority: Record<AppRole, number> = { admin: 3, moderator: 2, user: 1 };
          const top = rows.sort(
            (a, b) => (priority[b.role] ?? 0) - (priority[a.role] ?? 0),
          )[0];
          setRole(top?.role ?? null);
          // can_view_analytics may be set on any of the user's rows —
          // OR them together so the permission isn't lost just because
          // the highest-priority row didn't carry the flag.
          setCanViewAnalytics(rows.some((r) => r.can_view_analytics === true));
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
        setRole(null);
        setCanViewAnalytics(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();
  }, [user, authLoading]);

  return {
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    canViewAnalytics: role === "admin" || canViewAnalytics,
    isLoading: authLoading || isLoading,
  };
}
