import { useState } from "react";
import { format, addDays, addMonths } from "date-fns";
import { Gift, CalendarIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GrantCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  onGranted: () => void;
}

const EXPIRATION_PRESETS = [
  { label: "30 days", fn: () => addDays(new Date(), 30) },
  { label: "90 days", fn: () => addDays(new Date(), 90) },
  { label: "6 months", fn: () => addMonths(new Date(), 6) },
  { label: "1 year", fn: () => addMonths(new Date(), 12) },
];

export function GrantCreditsModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  onGranted,
}: GrantCreditsModalProps) {
  const [amount, setAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const handlePreset = (index: number) => {
    setActivePreset(index);
    setExpiresAt(EXPIRATION_PRESETS[index].fn());
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    setActivePreset(null);
    setExpiresAt(date);
  };

  const handleSubmit = async () => {
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid credit amount");
      return;
    }
    if (!expiresAt) {
      toast.error("Please select an expiration date");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("admin_grant_credits", {
        p_user_id: userId,
        p_amount: parsedAmount,
        p_expires_at: expiresAt.toISOString(),
        p_reason: reason.trim() || null,
      });

      if (error) {
        console.error("Grant credits error:", error);
        toast.error(error.message || "Failed to grant credits");
        return;
      }

      toast.success(`Granted ${parsedAmount.toLocaleString()} credits to ${userEmail}`);
      setAmount("");
      setExpiresAt(undefined);
      setReason("");
      setActivePreset(null);
      onGranted();
    } catch (err) {
      console.error("Grant credits error:", err);
      toast.error("Failed to grant credits");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = parseInt(amount, 10) > 0 && expiresAt && !isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Grant Credits
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target user */}
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">User: </span>
            <span className="font-medium">{userEmail}</span>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="credit-amount">Number of credits</Label>
            <Input
              id="credit-amount"
              type="number"
              min={1}
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label>Expiration</Label>
            <div className="flex flex-wrap gap-2">
              {EXPIRATION_PRESETS.map((preset, i) => (
                <Button
                  key={preset.label}
                  variant={activePreset === i ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePreset(i)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiresAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiresAt ? format(expiresAt, "PPP") : "Or pick a custom date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={handleCalendarSelect}
                  disabled={(date) => date <= new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="grant-reason">Reason (optional)</Label>
            <Textarea
              id="grant-reason"
              placeholder="e.g. Compensation for service issue"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Granting...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4 mr-2" />
                Grant {amount ? parseInt(amount, 10).toLocaleString() : ""} Credits
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
