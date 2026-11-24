import { useState } from "react";
import type { FormEvent } from "react";
import { useToast } from "../../../context/useToast.ts";
import type { BlueprintQuestion, BlueprintStep } from "../../../services/blueprintTypes.ts";
import type { BlueprintQuestionMetadata, BlueprintStepMetadata } from "./metadata.ts";

type Args = {
  step: BlueprintStep | null;
  question: BlueprintQuestion | null;
  stepMetadata: BlueprintStepMetadata;
  questionMetadata: BlueprintQuestionMetadata;
  onUpdateStep: (step: BlueprintStep, metadata: BlueprintStepMetadata) => Promise<void>;
  onUpdateQuestion: (
    question: BlueprintQuestion,
    metadata: BlueprintQuestionMetadata,
  ) => Promise<void>;
};

/** Sends the edited fields of the open step or knowledge check, and keeps how that went. */
export function useMetadataSaving({
  step,
  question,
  stepMetadata,
  questionMetadata,
  onUpdateStep,
  onUpdateQuestion,
}: Args) {
  const toast = useToast();
  const [isStepSaving, setIsStepSaving] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isQuestionSaving, setIsQuestionSaving] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  async function saveStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!step) return;
    setIsStepSaving(true);
    setStepError(null);
    try {
      await onUpdateStep(step, stepMetadata);
      toast.success("Step saved");
    } catch (reason) {
      setStepError(reason instanceof Error ? reason.message : "Step metadata could not be saved.");
    } finally {
      setIsStepSaving(false);
    }
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question) return;
    setIsQuestionSaving(true);
    setQuestionError(null);
    try {
      await onUpdateQuestion(question, questionMetadata);
      toast.success("Knowledge check saved");
    } catch (reason) {
      setQuestionError(
        reason instanceof Error ? reason.message : "Question metadata could not be saved.",
      );
    } finally {
      setIsQuestionSaving(false);
    }
  }

  return {
    isStepSaving,
    stepError,
    isQuestionSaving,
    questionError,
    saveStep,
    saveQuestion,
    clearErrors: () => {
      setStepError(null);
      setQuestionError(null);
    },
  };
}
