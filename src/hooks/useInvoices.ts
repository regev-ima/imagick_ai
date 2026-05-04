import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUser } from "@/hooks/useImpersonation";

export interface Invoice {
  id: string;
  invoice_number: string;
  type: string;
  description: string;
  amount: number;
  status: string;
  paypal_transaction_id: string | null;
  pdf_storage_path: string | null;
  created_at: string;
}

export function useInvoices() {
  const { effectiveUserId } = useEffectiveUser();

  return useQuery({
    queryKey: ["invoices", effectiveUserId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!effectiveUserId) return [];

      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_number, type, description, amount, status, paypal_transaction_id, pdf_storage_path, created_at")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch invoices:", error);
        return [];
      }

      return data || [];
    },
    enabled: !!effectiveUserId,
    staleTime: 60_000,
  });
}
