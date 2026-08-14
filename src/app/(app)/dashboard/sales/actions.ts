"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { saveSalesTargets } from "@/server/sales-dashboard-service";
import { salesTargetsSchema } from "@/validations/sales-dashboard";

export type SalesTargetActionState = { ok: boolean; message?: string; fieldErrors?: Record<string, string[]> };

export async function saveSalesTargetsAction(_state: SalesTargetActionState, formData: FormData): Promise<SalesTargetActionState> {
  const user = await requireUser();
  const year = formData.get("year");
  const targets = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    targetTons: String(formData.get(`target_${index + 1}`) ?? ""),
    manualActualTons: String(formData.get(`manualActual_${index + 1}`) ?? "")
  }));
  const parsed = salesTargetsSchema.safeParse({ year, targets });
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors, message: "Verifique as metas informadas." };
  try {
    const result = await saveSalesTargets(user, parsed.data);
    revalidatePath("/dashboard/sales");
    return { ok: true, message: result.changes > 0 ? "Metas e realizados manuais salvos." : "Nenhuma alteração nas metas." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível salvar as metas." };
  }
}
