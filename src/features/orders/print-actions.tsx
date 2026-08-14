"use client";

import { Button } from "@/components/ui/button";

export function OrderPrintActions() {
  return (
    <>
      <Button variant="outline" type="button" onClick={() => window.print()}>Exportar PDF</Button>
      <Button variant="outline" type="button" onClick={() => window.print()}>Imprimir</Button>
    </>
  );
}
