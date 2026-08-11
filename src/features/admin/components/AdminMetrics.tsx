import { Layers, Users } from "lucide-react";

type AdminMetricsProps = {
  userCount: number;
  projectCount: number;
};

export function AdminMetrics({ userCount, projectCount }: AdminMetricsProps) {
  return (
    <>
      <div className="flex items-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 py-2">
        <Users className="h-4 w-4 text-app-text-muted" />
        <span className="text-sm font-semibold text-app-text">{userCount}</span>
        <span className="text-sm text-app-text-muted">users</span>
      </div>

      <div className="flex items-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 py-2">
        <Layers className="h-4 w-4 text-app-text-muted" />
        <span className="text-sm font-semibold text-app-text">{projectCount}</span>
        <span className="text-sm text-app-text-muted">projects</span>
      </div>
    </>
  );
}
