"use client";

import { useActionState } from "react";
import type { Role, User, UserRole } from "@prisma/client";
import { createUserAction, deleteUserAction, updateUserAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeBr } from "@/lib/format";

const initialState: ActionState = { ok: false };

type UserWithRoles = User & { roles: Array<UserRole & { role: Role }> };

export function UserForm({ roles }: { roles: Role[] }) {
  const [state, action, pending] = useActionState(createUserAction, initialState);
  return (
    <form action={action} className="grid gap-3 rounded-lg border bg-background p-5 md:grid-cols-3">
      <Input name="fullName" placeholder="Nome completo" normalizeUppercase required />
      <Input name="username" placeholder="Usuário" required />
      <Input name="email" type="email" placeholder="E-mail" required />
      <Input name="phone" placeholder="Telefone" required />
      <Input name="cpf" placeholder="CPF opcional" />
      <Input name="position" placeholder="Cargo opcional" normalizeUppercase />
      <Input name="password" type="password" placeholder="Senha temporária" required />
      <Input name="confirmPassword" type="password" placeholder="Confirmar senha" required />
      <select name="roleIds" className="h-10 rounded-md border px-3" required>
        {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select>
      <input type="hidden" name="active" value="true" />
      <p className="text-sm text-muted-foreground md:col-span-3">No primeiro login, o usuário será obrigado a trocar a senha temporária.</p>
      <Button disabled={pending}>{pending ? "Criando..." : "Criar usuário"}</Button>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}
    </form>
  );
}

function UserRow({ user, roles, canEdit, canDelete, currentUserId }: { user: UserWithRoles; roles: Role[]; canEdit: boolean; canDelete: boolean; currentUserId: string }) {
  const updateAction = updateUserAction.bind(null, user.id);
  const [state, action, pending] = useActionState(updateAction, initialState);
  const roleId = user.roles[0]?.roleId ?? "";
  const deleteAction = deleteUserAction.bind(null, user.id);
  const canDeleteUser = canDelete && user.id !== currentUserId && user.username !== "admin" && user.active;
  return (
    <div className="border-t p-3">
      <form action={action} className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_1.2fr_0.9fr_0.8fr_0.9fr]">
        <Input name="fullName" defaultValue={user.fullName} disabled={!canEdit} normalizeUppercase required />
        <Input name="username" defaultValue={user.username} disabled={!canEdit} required />
        <Input name="email" type="email" defaultValue={user.email} disabled={!canEdit} required />
        <Input name="phone" defaultValue={user.phone} disabled={!canEdit} required />
        <Input name="cpf" defaultValue={user.cpf ?? ""} disabled={!canEdit} placeholder="CPF" />
        <Input name="position" defaultValue={user.position ?? ""} disabled={!canEdit} placeholder="Cargo" normalizeUppercase />
        <select name="roleIds" className="h-10 rounded-md border px-3 text-sm" defaultValue={roleId} disabled={!canEdit} required>
          {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="hidden" name="active" value="false" />
          <input type="checkbox" name="active" value="true" defaultChecked={user.active} disabled={!canEdit} />
          Ativo
        </label>
        <Input name="password" type="password" placeholder="Nova senha temporária" disabled={!canEdit} />
        <Input name="confirmPassword" type="password" placeholder="Confirmar senha" disabled={!canEdit} />
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <span className="text-sm text-muted-foreground">Último acesso: {formatDateTimeBr(user.lastAccessAt)}</span>
          {user.mustChangePassword ? <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Troca de senha pendente</span> : null}
        </div>
        {canEdit ? <Button disabled={pending} className="md:w-fit">{pending ? "Salvando..." : "Salvar"}</Button> : null}
        {state.message ? <p className={state.ok ? "text-sm text-emerald-700 md:col-span-5" : "text-sm text-red-700 md:col-span-5"}>{state.message}</p> : null}
      </form>
      {canDeleteUser ? (
        <form action={deleteAction} className="mt-3" onSubmit={(event) => { if (!confirm(`Excluir o usuário ${user.fullName}? Ele será inativado e não poderá acessar o sistema.`)) event.preventDefault(); }}>
          <Button type="submit" variant="destructive">Excluir usuário</Button>
        </form>
      ) : null}
    </div>
  );
}

export function UserManager({ users, roles, canEdit, canDelete, currentUserId }: { users: UserWithRoles[]; roles: Role[]; canEdit: boolean; canDelete: boolean; currentUserId: string }) {
  return (
    <div className="rounded-lg border bg-background">
      <div className="grid gap-3 bg-muted p-3 text-sm font-medium md:grid-cols-[1.2fr_0.8fr_1.2fr_0.9fr_0.8fr_0.9fr]">
        <span>Nome</span><span>Usuário</span><span>E-mail</span><span>Telefone</span><span>CPF</span><span>Cargo</span>
      </div>
      {users.map((user) => <UserRow key={user.id} user={user} roles={roles} canEdit={canEdit} canDelete={canDelete} currentUserId={currentUserId} />)}
    </div>
  );
}
