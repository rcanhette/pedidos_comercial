"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { verifyLoginCodeAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionState = { ok: false };

export function VerifyCodeForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(verifyLoginCodeAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        Enviamos um código de 6 dígitos para {email}.
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Código de verificação</label>
        <Input
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
        />
        {state.fieldErrors?.code?.map((error) => <p key={error} className="mt-1 text-sm text-red-700">{error}</p>)}
      </div>
      {state.message ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.message}</p> : null}
      <Button className="w-full" disabled={pending}>
        <KeyRound size={18} />
        {pending ? "Validando..." : "Validar código"}
      </Button>
    </form>
  );
}
