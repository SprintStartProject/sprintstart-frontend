import type { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
};

export function Section({ children }: SectionProps) {
  return (
    <section className="mt-8 border-t border-app-border pt-6 first:mt-0 first:border-t-0 first:pt-0 sm:mt-10 sm:pt-8">
      {children}
    </section>
  );
}
