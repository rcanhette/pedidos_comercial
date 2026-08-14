import { notFound } from "next/navigation";
import { BulkImportForm } from "@/features/admin/bulk-import-form";
import { bulkImportConfig, bulkImportKinds, userCanAccessBulkImport, type BulkImportKind } from "@/server/bulk-import-service";
import { requireUser } from "@/server/auth";

export default async function BulkImportPage() {
  const user = await requireUser();
  if (!userCanAccessBulkImport(user)) notFound();
  const allowedKinds = bulkImportKinds.filter((kind) => user.permissions.includes(bulkImportConfig[kind].permission)) as BulkImportKind[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importação em Massa</h1>
        <p className="text-sm text-muted-foreground">Importe novos clientes, produtos ou matérias-primas a partir da planilha padrão.</p>
      </div>
      <BulkImportForm allowedKinds={allowedKinds} />
    </div>
  );
}
