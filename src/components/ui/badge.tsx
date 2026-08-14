import { orderStatusClasses, orderStatusLabels } from "@/lib/constants";
import { cn } from "@/lib/utils";

type KnownStatus = keyof typeof orderStatusLabels;

function isKnownStatus(status: string): status is KnownStatus {
  return status in orderStatusLabels;
}

export function StatusBadge({ status }: { status: string }) {
  const known = isKnownStatus(status) ? status : "RECEBIDO";
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", orderStatusClasses[known])}>
      {isKnownStatus(status) ? orderStatusLabels[status] : status}
    </span>
  );
}
