import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUser } from "@/hooks/useImpersonation";

export interface OnboardingQuestion {
  id: string;
  question_key: string;
  title: string;
  subtitle: string | null;
  question_type: string;
  options: any[];
  sort_order: number;
  is_active: boolean;
  allow_multiple: boolean;
  max_selections: number | null;
}

export interface OnboardingAnswer {
  id: string;
  question_id: string;
  user_id: string;
  answer: any;
  answered_at: string;
}

export function useOnboardingQuestionnaire() {
  const { effectiveUserId } = useEffectiveUser();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  // Fetch active questions
  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ["onboarding-questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_questions" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as OnboardingQuestion[];
    },
  });

  // Fetch user's existing answers
  const { data: answers, isLoading: answersLoading } = useQuery({
    queryKey: ["onboarding-answers", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("onboarding_answers" as any)
        .select("*")
        .eq("user_id", effectiveUserId);
      if (error) throw error;
      return (data ?? []) as unknown as OnboardingAnswer[];
    },
    enabled: !!effectiveUserId,
  });

  // Fetch skip status
  const { data: skipData, isLoading: skipLoading } = useQuery({
    queryKey: ["onboarding-skip", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      const { data, error } = await supabase
        .from("onboarding_skips" as any)
        .select("skipped_at")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { skipped_at: string } | null;
    },
    enabled: !!effectiveUserId,
  });

  const isLoading = questionsLoading || answersLoading || skipLoading;

  // Compute unanswered questions
  const answeredQuestionIds = new Set((answers ?? []).map((a) => a.question_id));
  const unansweredQuestions = (questions ?? []).filter((q) => !answeredQuestionIds.has(q.id));

  // Check if skipped today
  const isSkippedToday = (() => {
    if (!skipData?.skipped_at) return false;
    const skipped = new Date(skipData.skipped_at);
    const now = new Date();
    return (
      skipped.getFullYear() === now.getFullYear() &&
      skipped.getMonth() === now.getMonth() &&
      skipped.getDate() === now.getDate()
    );
  })();

  const shouldShow =
    !dismissed &&
    !isLoading &&
    !!effectiveUserId &&
    unansweredQuestions.length > 0 &&
    !isSkippedToday;

  // Save a single answer
  const saveAnswerMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: any }) => {
      if (!effectiveUserId) throw new Error("Not authenticated");
      const { error } = await supabase.from("onboarding_answers" as any).upsert(
        {
          question_id: questionId,
          user_id: effectiveUserId,
          answer,
          answered_at: new Date().toISOString(),
        } as any,
        { onConflict: "question_id,user_id" }
      );
      if (error) throw error;
    },
    // Don't invalidate here — deferred to dismiss to prevent skipping questions
  });

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveUserId) throw new Error("Not authenticated");
      const { error } = await supabase.from("onboarding_skips" as any).upsert(
        {
          user_id: effectiveUserId,
          skipped_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setDismissed(true);
      queryClient.invalidateQueries({ queryKey: ["onboarding-skip", effectiveUserId] });
    },
    onError: () => {
      setDismissed(true);
    },
  });

  return {
    shouldShow,
    isLoading,
    unansweredQuestions,
    allQuestions: questions ?? [],
    answers: answers ?? [],
    onSaveAnswer: saveAnswerMutation.mutate,
    onSkip: skipMutation.mutate,
    isSaving: saveAnswerMutation.isPending,
    dismiss: () => {
      setDismissed(true);
      queryClient.invalidateQueries({ queryKey: ["onboarding-answers", effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-skip", effectiveUserId] });
    },
  };
}
