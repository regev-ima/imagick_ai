import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Camera, User, Heart, Calendar, Briefcase, Mountain, Home, Shirt,
  UtensilsCrossed, Trophy, Baby, Bird, Users, Building2, ChevronRight,
  Sparkles, Clock, Layers, MessageSquare, Send, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingQuestion } from "@/hooks/useOnboardingQuestionnaire";

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  camera: Camera, user: User, heart: Heart, calendar: Calendar,
  briefcase: Briefcase, mountain: Mountain, home: Home, shirt: Shirt,
  utensils: UtensilsCrossed, trophy: Trophy, baby: Baby, bird: Bird,
  users: Users, building: Building2, clock: Clock, layers: Layers,
  message: MessageSquare, send: Send, help: HelpCircle,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  questions: OnboardingQuestion[];
  onSaveAnswer: (args: { questionId: string; answer: any }) => void;
  onSkip: () => void;
  onDismiss: () => void;
  isSaving?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-3">
          <motion.div
            animate={{ scale: s === current ? 1.2 : 1, opacity: s <= current ? 1 : 0.3 }}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors",
              s < current ? "bg-primary" : s === current ? "bg-primary ring-4 ring-primary/20" : "bg-muted-foreground/30"
            )}
          />
          {s < total && (
            <div className={cn("w-8 h-0.5 rounded-full transition-colors", s < current ? "bg-primary" : "bg-muted-foreground/20")} />
          )}
        </div>
      ))}
    </div>
  );
}

function TogglePill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-sm font-medium border transition-all",
        selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingQuestionnaire({ isOpen, questions, onSaveAnswer, onSkip, onDismiss, isSaving }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [snapshotQuestions, setSnapshotQuestions] = useState<OnboardingQuestion[]>([]);

  // Snapshot questions when modal opens so the list stays stable
  useEffect(() => {
    if (isOpen && questions.length > 0 && snapshotQuestions.length === 0) {
      setSnapshotQuestions(questions);
      setStepIndex(0);
    }
    if (!isOpen) {
      setSnapshotQuestions([]);
      setStepIndex(0);
      setSelections({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, questions.length]);

  const displayQuestions = snapshotQuestions.length > 0 ? snapshotQuestions : questions;
  const question = displayQuestions[stepIndex];
  const total = displayQuestions.length;

  if (!isOpen || !question) return null;

  const currentSelections = selections[question.id] ?? [];
  const options = (question.options ?? []) as { id: string; label: string; icon?: string; desc?: string }[];

  const toggleOption = (optionId: string) => {
    setSelections((prev) => {
      const current = prev[question.id] ?? [];
      if (question.allow_multiple) {
        if (current.includes(optionId)) {
          return { ...prev, [question.id]: current.filter((x) => x !== optionId) };
        }
        if (question.max_selections && current.length >= question.max_selections) return prev;
        return { ...prev, [question.id]: [...current, optionId] };
      }
      return { ...prev, [question.id]: [optionId] };
    });
  };

  const handleNext = () => {
    // Save answer
    onSaveAnswer({ questionId: question.id, answer: currentSelections });

    if (stepIndex < total - 1) {
      setStepIndex((s) => s + 1);
    } else {
      onDismiss();
    }
  };

  const canAdvance = currentSelections.length > 0;

  const renderOptions = () => {
    if (question.question_type === "grid_select") {
      return (
        <div className="grid grid-cols-4 gap-2">
          {options.map(({ id, label, icon }) => {
            const Icon = icon ? ICON_MAP[icon] ?? Camera : Camera;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleOption(id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all",
                  currentSelections.includes(id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (question.question_type === "list_select") {
      return (
        <div className="space-y-2">
          {options.map(({ id, label, icon, desc }) => {
            const Icon = icon ? ICON_MAP[icon] ?? HelpCircle : HelpCircle;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleOption(id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                  currentSelections.includes(id) ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                )}
              >
                <div className={cn("p-2 rounded-lg", currentSelections.includes(id) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    // pill_select (default)
    return (
      <div className="flex gap-2 flex-wrap">
        {options.map(({ id, label }) => (
          <TogglePill
            key={id}
            label={label}
            selected={currentSelections.includes(id)}
            onClick={() => toggleOption(id)}
          />
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="glass-card w-full max-w-2xl rounded-2xl p-8 shadow-2xl border border-primary/20"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-secondary">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Quick setup</h2>
              <p className="text-sm text-muted-foreground">
                {total} quick question{total !== 1 ? "s" : ""} — less than a minute
              </p>
            </div>
          </div>

          <ProgressDots current={stepIndex + 1} total={total} />

          {/* Question content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-lg font-semibold mb-1">{question.title}</h3>
              {question.subtitle && (
                <p className="text-sm text-muted-foreground mb-4">{question.subtitle}</p>
              )}
              {renderOptions()}
            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSkip()}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canAdvance || isSaving}
              className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              {stepIndex === total - 1 ? (
                isSaving ? "Saving…" : "Finish setup"
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
