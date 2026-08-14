import Image from "next/image";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/sidebar-nav";
import { PasswordChangeGuard } from "@/features/admin/password-change-guard";
import { appName } from "@/lib/app-config";
import { requireUser } from "@/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-[#eef3f7]">
      <PasswordChangeGuard mustChangePassword={user.mustChangePassword} />
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 bg-[rgb(0,41,75)] p-4 text-slate-100 shadow-2xl lg:block">
        <div className="mb-6 border-b border-white/12 pb-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image src="/coonagro-logo.png" alt="Coonagro" width={190} height={74} priority className="h-auto w-[190px]" />
            <div>
              <h1 className="text-sm font-semibold leading-snug text-white">{appName}</h1>
            </div>
          </div>
        </div>
        <SidebarNav permissions={user.permissions} />
      </aside>
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur lg:px-8">
          <div>
            <p className="text-sm text-muted-foreground">Usuário autenticado</p>
            <p className="font-medium">{user.fullName}</p>
          </div>
          <form action={logoutAction}>
            <Button variant="outline">
              <LogOut size={18} />
              Sair
            </Button>
          </form>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
