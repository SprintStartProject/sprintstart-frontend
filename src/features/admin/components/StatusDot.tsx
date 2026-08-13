type StatusDotProps = {
  active: boolean;
};

export function StatusDot({ active }: StatusDotProps) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        active ? "bg-app-success-solid" : "bg-app-danger-solid"
      }`}
    />
  );
}
