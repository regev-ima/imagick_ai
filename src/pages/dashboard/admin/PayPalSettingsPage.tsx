import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard/admin">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            PayPal <span className="text-gradient-primary">Settings</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage PayPal integration mode and billing plan mappings
          </p>
        </div>
      </div>

      {/* Mode Toggle Card */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>PayPal Environment</CardTitle>
              <CardDescription>Switch between sandbox (testing) and live (production) modes</CardDescription>
            </div>
            {modeLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Badge variant={mode === "live" ? "default" : "secondary"} className={
                mode === "live"
                  ? "bg-green-500/10 text-green-500 border-green-500/30"
                  : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
              }>
                {mode === "live" ? "LIVE" : "SANDBOX"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "live" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-400">
                Live mode is active. All transactions will process real payments.
              </p>
            </div>
          )}
          {mode === "sandbox" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-400">
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
        </CardContent>
      </Card>

      {/* Plan Mappings Card */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>PayPal Plan Mappings ({mode})</CardTitle>
              <CardDescription>
                Links between your subscription plans and PayPal billing plan IDs
              </CardDescription>
            </div>
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
        </CardHeader>
        <CardContent>
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
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {(mapping as any).subscription_plans?.name || "Unknown Plan"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {mapping.billing_cycle} billing
                    </p>
                  </div>
                  <code className="text-xs bg-background px-2 py-1 rounded border border-border/50">
                    {mapping.paypal_plan_id}
                  </code>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              className="bg-green-600 hover:bg-green-700"
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
                <div className="rounded-lg bg-muted/60 border border-border/50 p-3 text-xs space-y-1.5">
                  <p>What happens:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>New PayPal plans are created via the PayPal API</li>
                    <li>Plan IDs are saved to the database mappings table</li>
                    <li>Existing mappings for {mode} mode will be replaced</li>
                  </ul>
                </div>
                {mode === "live" && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">
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
