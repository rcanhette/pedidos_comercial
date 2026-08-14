"use client";

import { useActionState } from "react";
import { updateProfileAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionState = { ok: false };

export function ProfileForm({ user }: { user: { fullName: string; email: string; phone: string; cpf?: string | null; position?: string | null; mustChangePassword?: boolean } }) {
  const [state, action, pending] = useActionState(updateProfileAction, initialState);
  return (
    <form action={action} className="grid gap-4 rounded-lg border bg-background p-5 md:grid-cols-2">
      <label className="text-sm font-medium">Nome<Input name="fullName" defaultValue={user.fullName} normalizeUppercase /></label>
      <label className="text-sm font-medium">E-mail<Input name="email" defaultValue={user.email} /></label>
      <label className="text-sm font-medium">Telefone<Input name="phone" defaultValue={user.phone} /></label>
      <label className="text-sm font-medium">CPF<Input name="cpf" defaultValue={user.cpf ?? ""} /></label>
      <label className="text-sm font-medium">Cargo<Input name="position" defaultValue={user.position ?? ""} normalizeUppercase /></label>
      <label className="text-sm font-medium">Nova senha<Input name="password" type="password" required={user.mustChangePassword} /></label>
      {user.mustChangePassword ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 md:col-span-2">Você precisa alterar a senha temporária para continuar usando o sistema.</p> : null}
      <p className="text-sm text-muted-foreground md:col-span-2">Perfil e permissões só podem ser alterados por administradores autorizados.</p>
      <Button disabled={pending} className="md:w-fit">{pending ? "Salvando..." : "Salvar alterações"}</Button>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}
    </form>
  );
}
