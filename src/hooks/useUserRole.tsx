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
        const { data, error } = await supabase
          .from("user_roles")
          .select("role, can_view_analytics")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
          setCanViewAnalytics(false);
        } else {
          setRole((data?.role as AppRole) || null);
          setCanViewAnalytics(data?.can_view_analytics ?? false);
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
