"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileCheck2, RotateCcw, Upload } from "lucide-react";
import { importBulkImportAction, validateBulkImportAction, type BulkImportActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BulkImportKind } from "@/server/bulk-import-service";

const initialState: BulkImportActionState = { ok: false, selectedKind: "customers" };
const importTypeLabels: Record<BulkImportKind, string> = {
  customers: "Clientes",
  products: "Produtos",
  rawMaterials: "Matérias-primas"
};

export function BulkImportForm({ allowedKinds }: { allowedKinds: BulkImportKind[] }) {
  const [state, setState] = useState<BulkImportActionState>(initialState);
  const [kind, setKind] = useState<BulkImportKind>(allowedKinds[0] ?? "customers");
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const canImport = state.phase === "validated" && state.validation?.ok && (state.validation.new ?? state.validation.valid) > 0 && file;

  function formData() {
    const data = new FormData();
    data.set("kind", kind);
    if (file) data.set("file", file);
    return data;
  }

  function validate() {
    startTransition(async () => {
      setState(await validateBulkImportAction(state, formData()));
    });
  }

  function importRows() {
    if (!canImport) return;
    const confirmed = window.confirm(`Você está prestes a importar ${state.validation?.new ?? state.validation?.valid ?? 0} novos ${importTypeLabels[kind].toLocaleLowerCase("pt-BR")}.\n\nDeseja continuar?`);
    if (!confirmed) return;
    startTransition(async () => {
      setState(await importBulkImportAction(state, formData()));
    });
  }

  function reset() {
    setState(initialState);
    setKind(allowedKinds[0] ?? "customers");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Tipo de cadastro
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(event) => { setKind(event.target.value as BulkImportKind); setState({ ...initialState, selectedKind: event.target.value }); }} disabled={isPending}>
                {allowedKinds.map((item) => <option key={item} value={item}>{importTypeLabels[item]}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Arquivo Excel
              <input ref={fileRef} className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={isPending} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setState({ ...initialState, selectedKind: kind }); }} />
              <span className="mt-1 block text-xs text-muted-foreground">{file?.name ?? "Nenhum arquivo selecionado"}</span>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <a href={`/api/importacao-em-massa/modelo?kind=${kind}`}>
                <Download size={18} />
                Baixar Planilha Modelo
              </a>
            </Button>
            <Button type="button" disabled={isPending || !file} onClick={validate}>
              <FileCheck2 size={18} />
              {isPending && state.phase !== "imported" ? "Validando..." : "Validar Planilha"}
            </Button>
            {canImport ? (
              <Button type="button" disabled={isPending} onClick={importRows}>
                <Upload size={18} />
                {isPending ? "Importando registros..." : `Importar ${state.validation?.new ?? state.validation?.valid ?? 0} novos registros`}
              </Button>
            ) : null}
            {state.phase === "imported" ? (
              <Button type="button" variant="outline" onClick={reset}>
                <RotateCcw size={18} />
                Nova Importação
              </Button>
            ) : null}
          </div>
          {state.message ? <p className={`mt-4 rounded-md p-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{state.message}</p> : null}
        </CardContent>
      </Card>

      {state.phase === "imported" && state.imported ? (
        <Card>
          <CardContent>
            <p className="font-medium">Tipo: {state.imported.label}</p>
            <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <p>Linhas analisadas: <span className="font-medium text-foreground">{state.imported.analyzed}</span></p>
              <p>Novos registros cadastrados: <span className="font-medium text-foreground">{state.imported.count}</span></p>
              <p>Registros já existentes ignorados: <span className="font-medium text-foreground">{state.imported.skippedExisting}</span></p>
              <p>Duplicados na planilha ignorados: <span className="font-medium text-foreground">{state.imported.skippedDuplicated}</span></p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {state.validation ? <ValidationPreview state={state} /> : null}
    </div>
  );
}

function ValidationPreview({ state }: { state: BulkImportActionState }) {
  const validation = state.validation;
  if (!validation) return null;
  const headers = validation.rows[0] ? Object.keys(validation.rows[0].values) : [];

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="text-muted-foreground">Arquivo:</span><br /><span className="font-medium">{validation.fileName}</span></p>
            <p><span className="text-muted-foreground">Registros encontrados:</span><br /><span className="font-medium">{validation.total}</span></p>
            <p><span className="text-muted-foreground">Novos:</span><br /><span className="font-medium">{validation.new ?? validation.valid}</span></p>
            <p><span className="text-muted-foreground">Já cadastrados:</span><br /><span className="font-medium">{validation.existing ?? 0}</span></p>
            <p><span className="text-muted-foreground">Duplicados na planilha:</span><br /><span className="font-medium">{validation.duplicated ?? 0}</span></p>
            <p><span className="text-muted-foreground">Com erro:</span><br /><span className="font-medium">{validation.invalid}</span></p>
          </div>
        </CardContent>
      </Card>

      {validation.errors.length > 0 ? (
        <Card>
          <CardContent>
            <h2 className="mb-3 text-lg font-semibold">Erros encontrados</h2>
            <div className="space-y-2">
              {validation.errors.map((error, index) => (
                <div key={`${error.line}-${error.field}-${index}`} className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-medium">Linha {error.line}</p>
                  <p>Campo: {error.field}</p>
                  {error.value ? <p>Valor: {error.value}</p> : null}
                  <p>Erro: {error.error}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-3">LINHA</th>{headers.map((header) => <th key={header} className="p-3">{header}</th>)}<th className="p-3">STATUS</th></tr>
          </thead>
          <tbody>
            {validation.rows.map((row) => (
              <tr key={row.line} className="border-t">
                <td className="p-3 font-medium">{row.line}</td>
                {headers.map((header) => <td key={header} className="p-3">{row.values[header] || "-"}</td>)}
                <td className="p-3"><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className = status === "NOVO"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "JÁ CADASTRADO"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : status === "DUPLICADO NA PLANILHA"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-700";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{status}</span>;
}
