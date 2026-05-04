import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const IMPERSONATION_STORAGE_KEY = "imagick_admin_impersonation_v1";

export interface ImpersonationTarget {
  id: string;
  email: string;
  fullName?: string | null;
  startedAt?: string;
}

interface ImpersonationContextValue {
  isImpersonating: boolean;
  targetUser: ImpersonationTarget | null;
  effectiveUserId: string | null;
  effectiveEmail: string | null;
  effectiveDisplayName: string | null;
  startImpersonation: (target: ImpersonationTarget) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextValue | undefined>(undefined);

function parseStoredTarget(): ImpersonationTarget | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(IMPERSONATION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ImpersonationTarget;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [targetUser, setTargetUser] = useState<ImpersonationTarget | null>(() => parseStoredTarget());

  const stopImpersonation = useCallback(() => {
    setTargetUser(null);
    queryClient.clear();
  }, [queryClient]);

  const startImpersonation = useCallback((target: ImpersonationTarget) => {
    if (!user?.id || !isAdmin) return;
    if (target.id === user.id) {
      stopImpersonation();
      return;
    }
    setTargetUser({
      ...target,
      startedAt: new Date().toISOString(),
    });
    queryClient.clear();
  }, [user?.id, isAdmin, stopImpersonation, queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!targetUser) {
      window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(targetUser));
  }, [targetUser]);

  useEffect(() => {
    if (!user?.id) {
      setTargetUser(null);
      return;
    }
    if (targetUser?.id === user.id) {
      setTargetUser(null);
    }
  }, [user?.id, targetUser?.id]);

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin && targetUser) {
      setTargetUser(null);
    }
  }, [isAdmin, roleLoading, targetUser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== IMPERSONATION_STORAGE_KEY) return;
      setTargetUser(parseStoredTarget());
      queryClient.clear();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  const isImpersonating = Boolean(user?.id && isAdmin && targetUser?.id && targetUser.id !== user.id);
  const effectiveUserId = isImpersonating ? targetUser!.id : (user?.id ?? null);
  const effectiveEmail = isImpersonating ? targetUser!.email : (user?.email ?? null);
  const effectiveDisplayName = isImpersonating
    ? (targetUser?.fullName || targetUser?.email || null)
    : ((user?.user_metadata?.full_name as string | undefined) || user?.email || null);

  const value = useMemo<ImpersonationContextValue>(() => ({
    isImpersonating,
    targetUser: isImpersonating ? targetUser : null,
    effectiveUserId,
    effectiveEmail,
    effectiveDisplayName,
    startImpersonation,
    stopImpersonation,
  }), [isImpersonating, targetUser, effectiveUserId, effectiveEmail, effectiveDisplayName, startImpersonation, stopImpersonation]);

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error("useImpersonation must be used within ImpersonationProvider");
  }
  return context;
}

export function useEffectiveUser() {
  const { user, session, isLoading, isAuthenticated } = useAuth();
  const impersonation = useImpersonation();
  return {
    user,
    session,
    isAuthLoading: isLoading,
    isAuthenticated,
    ...impersonation,
  };
}
