// ============================================================
// types/onboarding.ts
// ============================================================
// Alle Interfaces für den Onboarding-Bereich.
// ============================================================

export interface OnBoardingStep {
  id: string;
  title: string;
  completed: boolean;
}

export interface OnBoardingTask {
  id: string;
  title: string;
  description: string;
  motivation: string[];
  steps: OnBoardingStep[];
  finalTask: string;
  artifactUrl?: string;
}

export interface OnBoardingItem {
  id: string;
  title: string;
  description: string;
  type: 'document' | 'video' | 'link' | 'task';
  completed: boolean;
  duration?: string;
  artifactUrl?: string;
  task?: OnBoardingTask;
}

export interface OnBoardingPhase {
  id: string;
  title: string;
  description: string;
  period: string;
  items: OnBoardingItem[];
}

export interface OnBoardingPath {
  userId: string;
  role: string;
  generatedAt: string;
  phases: OnBoardingPhase[];
}