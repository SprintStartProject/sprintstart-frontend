import type { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
};

export function Section({ children }: SectionProps) {
  return (
    <section className="mt-10 border-t border-app-border pt-8 first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </section>
  );
}
