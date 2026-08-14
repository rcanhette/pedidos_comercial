import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { appName } from "@/lib/app-config";
import { getCurrentUser } from "@/server/auth";
import { isOAuthProviderConfigured } from "@/server/oauth";

type LoginPageProps = {
  searchParams?: Promise<{ erro?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary px-4 py-8">
      <div className="w-full max-w-[570px]">
        <div className="mb-6 text-center">
          <Image src="/coonagro-logo.png" alt="Coonagro" width={570} height={192} priority className="mx-auto h-auto w-full max-w-[570px]" />
          <p className="mt-3 whitespace-nowrap text-[30px] font-semibold leading-tight text-white">{appName}</p>
        </div>
      <section className="mx-auto w-full max-w-md rounded-lg border border-border bg-background p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Acesse sua conta</h1>
        </div>
        <LoginForm
          googleEnabled={isOAuthProviderConfigured("google")}
          microsoftEnabled={isOAuthProviderConfigured("microsoft")}
          oauthError={params?.erro}
        />
      </section>
      </div>
    </main>
  );
}
