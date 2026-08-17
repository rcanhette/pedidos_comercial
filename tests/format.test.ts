import { describe, expect, it } from "vitest";
import { formatMonthYearBr } from "@/lib/format";

describe("formatação de datas comerciais", () => {
  it("formata previsão de retirada sem deslocar o mês por fuso horário", () => {
    expect(formatMonthYearBr(new Date("2026-08-01T00:00:00.000Z"))).toBe("08/2026");
  });
});
