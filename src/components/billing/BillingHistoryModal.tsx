import { useState } from "react";
import { motion } from "framer-motion";
import { X, Download, Receipt, CreditCard, Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useInvoices, type Invoice } from "@/hooks/useInvoices";
import { downloadInvoicePdf } from "@/lib/download-invoice-pdf";

interface BillingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BillingHistoryModal({ isOpen, onClose }: BillingHistoryModalProps) {
  const { data: invoices = [], isLoading } = useInvoices();

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadInvoice = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoice_number);
    } catch {
      toast.error("Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        className="max-h-[80vh] w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-card surface-2 flex max-h-[80vh] flex-col overflow-hidden rounded-[--radius] border border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-4 py-2.5">
            <span className="aura-microlabel flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5" />
              Billing History
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <div className="grid h-12 w-12 place-items-center rounded-[--radius] border border-border bg-card">
                  <Receipt className="h-5 w-5" />
                </div>
                <p>No invoices yet</p>
                <p className="-mt-1 text-sm text-muted-foreground/70">Invoices will appear here after your first payment.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {invoices.map((invoice, index) => (
                  <motion.li
                    key={invoice.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between rounded-[--radius] border border-border bg-card p-4 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[--radius] border border-border bg-card">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium tracking-tight">{invoice.description}</p>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                          <span>{formatDate(invoice.created_at)}</span>
                          <span>·</span>
                          <span>{invoice.invoice_number}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end gap-1 text-right">
                        <p className="folio text-sm text-foreground">${invoice.amount.toFixed(2)}</p>
                        <span
                          className="caption inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5"
                          style={
                            invoice.status === "paid"
                              ? { color: "hsl(var(--secondary))", borderColor: "hsl(var(--secondary) / 0.4)", background: "hsl(var(--secondary) / 0.1)" }
                              : invoice.status === "pending"
                                ? { color: "hsl(var(--rating))", borderColor: "hsl(var(--rating) / 0.4)", background: "hsl(var(--rating) / 0.1)" }
                                : { color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.4)" }
                          }
                        >
                          {invoice.status === "paid" ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : invoice.status === "pending" ? (
                            <Clock className="h-3 w-3" />
                          ) : (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {invoice.status}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={() => handleDownloadInvoice(invoice)}
                        disabled={downloadingId === invoice.id}
                      >
                        {downloadingId === invoice.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-5">
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
