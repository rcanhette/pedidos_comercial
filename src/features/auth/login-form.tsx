"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionState = { ok: false };

type LoginFormProps = {
  googleEnabled: boolean;
  microsoftEnabled: boolean;
  oauthError?: string;
};

export function LoginForm({ googleEnabled, microsoftEnabled, oauthError }: LoginFormProps) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-5">
      {googleEnabled || microsoftEnabled ? (
        <div className="space-y-3">
          {googleEnabled ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/api/auth/google">Entrar com Google</Link>
            </Button>
          ) : null}
          {microsoftEnabled ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/api/auth/microsoft">Entrar com Office 365</Link>
            </Button>
          ) : null}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      ) : null}

      {oauthError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{oauthError}</p> : null}

      <form action={action} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Usuário ou e-mail</label>
          <Input name="identifier" autoComplete="username" required />
          {state.fieldErrors?.identifier?.map((error) => <p key={error} className="mt-1 text-sm text-red-700">{error}</p>)}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Senha</label>
          <div className="flex gap-2">
            <Input name="password" type={visible ? "text" : "password"} autoComplete="current-password" required />
            <Button type="button" variant="outline" aria-label="Mostrar ou ocultar senha" onClick={() => setVisible((value) => !value)}>
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </div>
        </div>
        {state.message ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.message}</p> : null}
        <Button className="w-full" disabled={pending}>
          <LogIn size={18} />
          {pending ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
