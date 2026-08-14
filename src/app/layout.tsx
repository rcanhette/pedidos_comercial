import type { Metadata } from "next";
import { appName } from "@/lib/app-config";
import "./globals.css";

export const metadata: Metadata = {
  title: appName,
  description: "Cadastro, acompanhamento e aprovação de pedidos comerciais"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
