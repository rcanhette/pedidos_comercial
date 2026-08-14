import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VerifyCodeForm } from "@/features/auth/verify-code-form";
import { appName } from "@/lib/app-config";
import { getCurrentUser, getPendingLoginChallenge } from "@/server/auth";

export default async function VerifyLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const challenge = await getPendingLoginChallenge();
  if (!challenge) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary px-4 py-8">
      <div className="w-full max-w-[570px]">
        <div className="mb-6 text-center">
          <Image src="/coonagro-logo.png" alt="Coonagro" width={570} height={192} priority className="mx-auto h-auto w-full max-w-[570px]" />
          <p className="mt-3 whitespace-nowrap text-[30px] font-semibold leading-tight text-white">{appName}</p>
        </div>
      <section className="mx-auto w-full max-w-md rounded-lg border border-border bg-background p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Confirme seu acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">Digite o código enviado para o seu e-mail.</p>
        </div>
        <VerifyCodeForm email={challenge.email} />
        <div className="mt-5 text-center text-sm">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">Voltar para o login</Link>
        </div>
      </section>
      </div>
    </main>
  );
}
