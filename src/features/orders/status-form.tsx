"use client";

import { useActionState, useState } from "react";
import { changeStatusAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { activeOrderStatusOptions, orderStatusLabels } from "@/lib/constants";

const initialState: ActionState = { ok: false };
const sapRequiredStatuses = ["PEDIDO_CRIADO", "ENVIADO_PARA_ASSINATURA"];
type ActiveOrderStatus = (typeof activeOrderStatusOptions)[number];

function activeStatusOrDefault(status: string): ActiveOrderStatus {
  return activeOrderStatusOptions.includes(status as ActiveOrderStatus) ? (status as ActiveOrderStatus) : "RECEBIDO";
}

export function StatusForm({ orderId, currentStatus, sapOrderNumber }: { orderId: string; currentStatus: string; sapOrderNumber?: string | null }) {
  const [state, action, pending] = useActionState(changeStatusAction.bind(null, orderId), initialState);
  const [status, setStatus] = useState<ActiveOrderStatus>(activeStatusOrDefault(currentStatus));
  const [sapValue, setSapValue] = useState(sapOrderNumber ?? "");
  const [sapEditable, setSapEditable] = useState(!sapOrderNumber);
  const showSap = sapRequiredStatuses.includes(status);
  return (
    <form action={action} className="space-y-3 rounded-lg border bg-background p-5">
      <h2 className="text-lg font-semibold">Alterar status</h2>
      <select name="status" className="h-10 w-full rounded-md border px-3" value={status} onChange={(event) => setStatus(event.target.value as ActiveOrderStatus)} required>
        {activeOrderStatusOptions.map((option) => <option key={option} value={option}>{orderStatusLabels[option]}</option>)}
      </select>
      {showSap ? (
        <label className="block text-sm font-medium">Pedido SAP
          <div className="mt-1 flex gap-2">
            <Input
              name="sapOrderNumber"
              placeholder="Número do pedido no SAP"
              value={sapValue}
              onChange={(event) => setSapValue(event.target.value)}
              readOnly={!sapEditable}
              required
            />
            {sapOrderNumber ? (
              <Button type="button" variant="outline" onClick={() => setSapEditable(true)} disabled={sapEditable}>
                Editar
              </Button>
            ) : null}
          </div>
        </label>
      ) : null}
      {state.fieldErrors?.sapOrderNumber?.map((error) => <p key={error} className="text-sm text-red-700">{error}</p>)}
      <Textarea name="justification" placeholder={status === "CANCELADO" ? "Justificativa obrigatória" : "Observação ou justificativa"} normalizeUppercase required={status === "CANCELADO"} />
      {state.fieldErrors?.justification?.map((error) => <p key={error} className="text-sm text-red-700">{error}</p>)}
      {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}
      <Button disabled={pending}>{pending ? "Alterando..." : "Confirmar alteração"}</Button>
    </form>
  );
}
