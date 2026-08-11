type TableHeaderProps = {
  children: string;
};

export function TableHeader({ children }: TableHeaderProps) {
  return (
    <div className="text-xs font-semibold tracking-wide text-app-text-muted uppercase">
      {children}
    </div>
  );
}
