import { Layers, Users } from "lucide-react";

type AdminMetricsProps = {
  userCount: number;
  projectCount: number;
};

export function AdminMetrics({ userCount, projectCount }: AdminMetricsProps) {
  return (
    <>
      {/* On mobile the two bordered pills read as heavy and only repeat the
          toolbar's own count, so they collapse into one light stat line. The
          pills return from `sm` up, where there is room for them. */}
      <p className="text-sm text-app-text-muted sm:hidden">
        {userCount} {userCount === 1 ? "user" : "users"} · {projectCount}{" "}
        {projectCount === 1 ? "project" : "projects"}
      </p>

      <div className="hidden items-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 py-2 sm:flex">
        <Users className="h-4 w-4 text-app-text-muted" />
        <span className="text-sm font-semibold text-app-text">{userCount}</span>
        <span className="text-sm text-app-text-muted">users</span>
      </div>

      <div className="hidden items-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 py-2 sm:flex">
        <Layers className="h-4 w-4 text-app-text-muted" />
        <span className="text-sm font-semibold text-app-text">{projectCount}</span>
        <span className="text-sm text-app-text-muted">projects</span>
      </div>
    </>
  );
}
