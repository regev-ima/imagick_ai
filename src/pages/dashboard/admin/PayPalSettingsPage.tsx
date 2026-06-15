import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PayPalMode = "sandbox" | "live";

export default function PayPalSettingsPage() {
  const queryClient = useQueryClient();
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [isSettingUpPlans, setIsSettingUpPlans] = useState(false);
  const [showSetupConfirm, setShowSetupConfirm] = useState(false);

  const { data: mode = "sandbox" as PayPalMode, isLoading: modeLoading } = useQuery({
    queryKey: ["paypal-mode"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "paypal_mode")
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      if (data?.value) {
        const parsed = JSON.parse(data.value);
        return parsed === "live" ? "live" : "sandbox";
      }
      return "sandbox" as PayPalMode;
    },
  });

  const { data: planMappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ["paypal-plan-mappings", mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paypal_plan_mapping")
        .select("id, plan_id, billing_cycle, paypal_plan_id, is_sandbox, subscription_plans(name, slug)")
        .eq("is_sandbox", mode === "sandbox")
        .order("created_at");

      if (error) throw error;
      return data || [];
    },
  });

  const modeMutation = useMutation({
    mutationFn: async (newMode: PayPalMode) => {
      const { error } = await supabase
        .from("platform_settings")
        .upsert(
          { key: "paypal_mode", value: JSON.stringify(newMode), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      if (error) throw error;
    },
    onSuccess: (_data, newMode) => {
      queryClient.invalidateQueries({ queryKey: ["paypal-mode"] });
      queryClient.invalidateQueries({ queryKey: ["paypal-plan-mappings"] });
      toast.success(`Switched to PayPal ${newMode} mode`);
    },
    onError: (err: Error) => {
      toast.error(`Failed to switch mode: ${err.message}`);
    },
  });

  const handleToggleMode = () => {
    if (mode === "sandbox") {
      setShowLiveConfirm(true);
    } else {
      modeMutation.mutate("sandbox");
    }
  };

  const handleSetupPlans = async () => {
    setIsSettingUpPlans(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-setup-plans`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to set up plans");

      toast.success(`PayPal plans created successfully for ${mode} mode`);
      queryClient.invalidateQueries({ queryKey: ["paypal-plan-mappings"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to set up PayPal plans");
    } finally {
      setIsSettingUpPlans(false);
    }
  };

  return (
    <div className="min-h-full bg-background p-6 lg:p-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/admin">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <span className="caption">Admin · Billing</span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">PayPal Settings</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            Manage PayPal integration mode and billing plan mappings
          </p>
        </div>
      </div>

      {/* Mode Toggle Card */}
      <div className="glass-card overflow-hidden rounded-[--radius]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            PayPal Environment
          </span>
          {modeLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : mode === "live" ? (
            <Badge variant="secondary" className="font-mono">LIVE</Badge>
          ) : (
            <Badge variant="outline" className="border-[hsl(var(--rating))]/40 font-mono text-[hsl(var(--rating))]">
              SANDBOX
            </Badge>
          )}
        </div>
        <div className="space-y-4 p-4">
          <p className="font-sans text-sm text-muted-foreground">
            Switch between sandbox (testing) and live (production) modes.
          </p>
          {mode === "live" && (
            <div className="flex items-center gap-3 rounded-[--radius] border border-secondary/30 bg-secondary/10 p-3">
              <ShieldCheck className="w-5 h-5 text-secondary flex-shrink-0" />
              <p className="text-sm text-secondary">
                Live mode is active. All transactions will process real payments.
              </p>
            </div>
          )}
          {mode === "sandbox" && (
            <div className="flex items-center gap-3 rounded-[--radius] border border-[hsl(var(--rating))]/25 bg-[hsl(var(--rating))]/10 p-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-[hsl(var(--rating))]" />
              <p className="text-sm text-[hsl(var(--rating))]">
                Sandbox mode is active. Transactions use PayPal test accounts.
              </p>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleToggleMode}
            disabled={modeMutation.isPending}
          >
            {modeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Switch to {mode === "sandbox" ? "Live" : "Sandbox"} Mode
          </Button>
        </div>
      </div>

      {/* Plan Mappings Card */}
      <div className="glass-card overflow-hidden rounded-[--radius]">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
          <span className="aura-microlabel flex items-center gap-2">
            PayPal Plan Mappings · {mode}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSetupConfirm(true)}
            disabled={isSettingUpPlans}
            className="gap-2"
          >
            {isSettingUpPlans ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isSettingUpPlans ? "Creating..." : "Setup Plans"}
          </Button>
        </div>
        <div className="p-4">
          <p className="mb-4 font-sans text-sm text-muted-foreground">
            Links between your subscription plans and PayPal billing plan IDs.
          </p>
          {mappingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : planMappings.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                No PayPal plan mappings found for {mode} mode.
              </p>
              <p className="text-xs text-muted-foreground">
                Click "Setup Plans" to create PayPal billing plans for all active subscription tiers.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {planMappings.map((mapping: any) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between rounded-[--radius] border border-border bg-surface-2 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {(mapping as any).subscription_plans?.name || "Unknown Plan"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {mapping.billing_cycle} billing
                    </p>
                  </div>
                  <code className="rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground">
                    {mapping.paypal_plan_id}
                  </code>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Mode Confirmation Dialog */}
      <AlertDialog open={showLiveConfirm} onOpenChange={setShowLiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to Live Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              This will connect to PayPal's production environment. All subscriptions and payments
              will be real transactions. Make sure your live PayPal credentials are configured
              in your Supabase Edge Function secrets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => modeMutation.mutate("live")}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              Switch to Live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Setup Plans Confirmation Dialog */}
      <AlertDialog open={showSetupConfirm} onOpenChange={setShowSetupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create PayPal Billing Plans?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will create new PayPal billing plans in <strong className="text-foreground">{mode}</strong> mode for all active subscription tiers (Starter, Pro, Studio) with both monthly and yearly billing cycles.
                </p>
                <div className="rounded-[--radius] border border-border bg-surface-2 p-3 text-xs space-y-1.5">
                  <p>What happens:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>New PayPal plans are created via the PayPal API</li>
                    <li>Plan IDs are saved to the database mappings table</li>
                    <li>Existing mappings for {mode} mode will be replaced</li>
                  </ul>
                </div>
                {mode === "live" && (
                  <div className="flex items-start gap-2 rounded-[--radius] border border-[hsl(var(--rating))]/25 bg-[hsl(var(--rating))]/10 p-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[hsl(var(--rating))]" />
                    <p className="text-xs text-[hsl(var(--rating))]">
                      You are in <strong>live mode</strong>. These plans will be created in PayPal's production environment.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowSetupConfirm(false);
                handleSetupPlans();
              }}
            >
              Yes, Setup Plans
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
