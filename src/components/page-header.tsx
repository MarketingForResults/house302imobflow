import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 overflow-x-hidden border-b bg-background px-4 py-4 sm:px-6 md:flex-row md:items-start md:justify-between md:px-8 md:py-6">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap gap-2 md:justify-end">{actions}</div>}
    </div>
  );
}
