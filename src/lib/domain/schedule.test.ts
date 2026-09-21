import { describe, expect, it } from "vitest";
import { generateSchedule, rotationWeekIndex, unitForDay, workWeekRange } from "./schedule";

const units = [
  { id: "ms", nome: "Moema Salão", ordem_rotacao: 1 },
  { id: "md", nome: "Moema Delivery", ordem_rotacao: 2 },
  { id: "im", nome: "Imigrantes", ordem_rotacao: 3 },
  { id: "bv", nome: "Bela Vista", ordem_rotacao: 4 },
  { id: "mo", nome: "Mooca", ordem_rotacao: 5 },
];
const base = "2026-09-22"; // terça

describe("rotação semanal", () => {
  it("reproduz a tabela de exemplo da seção 5 (5 semanas)", () => {
    const expected = [
      ["ms", "md", "im", "bv", "mo"],
      ["mo", "ms", "md", "im", "bv"],
      ["bv", "mo", "ms", "md", "im"],
      ["im", "bv", "mo", "ms", "md"],
      ["md", "im", "bv", "mo", "ms"],
    ];
    for (let w = 0; w < 5; w++) {
      const wed = `2026-${w === 0 ? "09-23" : `10-${String(w * 7 - 7 + 30 - 30 + 0).padStart(2, "0")}`}`;
      void wed;
      const days = ["2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"].map((d) => {
        const dt = new Date(d + "T00:00:00Z");
        dt.setUTCDate(dt.getUTCDate() + w * 7);
        return dt.toISOString().slice(0, 10);
      });
      expect(days.map((d) => unitForDay(d, units, base)!.id)).toEqual(expected[w]);
    }
  });

  it("ciclo de 5 semanas: cada loja passa exatamente 1x em cada dia", () => {
    const sched = generateSchedule("2026-09-22", "2026-10-26", units, "prod", base);
    const byUnitDay = new Map<string, Set<number>>();
    for (const d of sched) {
      if (d.tipo === "producao") continue;
      const wd = new Date(d.data + "T00:00:00Z").getUTCDay();
      const set = byUnitDay.get(d.unit_id) ?? new Set();
      expect(set.has(wd)).toBe(false);
      set.add(wd);
      byUnitDay.set(d.unit_id, set);
    }
    for (const u of units) expect(byUnitDay.get(u.id)?.size).toBe(5);
    // semana 6 repete a semana 1
    expect(unitForDay("2026-10-28", units, base)!.id).toBe("ms");
  });

  it("segunda sem auditoria, terça = produção, tipos por dia", () => {
    const sched = generateSchedule("2026-09-21", "2026-09-27", units, "prod", base);
    expect(sched.map((d) => d.tipo)).toEqual(["producao", "simplificada", "simplificada", "completa", "completa", "completa"]);
    expect(sched[0]).toEqual({ data: "2026-09-22", unit_id: "prod", tipo: "producao" });
    expect(sched.find((d) => d.data === "2026-09-21")).toBeUndefined();
  });

  it("datas anteriores à base funcionam (semana negativa)", () => {
    expect(rotationWeekIndex("2026-09-16", base)).toBe(-1);
    expect(unitForDay("2026-09-16", units, base)!.id).toBe("md"); // semana -1: qua = (0 - (-1)) mod 5 = 1 → Moema D
  });

  it("aceita mais de 5 lojas (nova loja entra na rotação)", () => {
    const six = [...units, { id: "nv", nome: "Nova", ordem_rotacao: 6 }];
    const sched = generateSchedule("2026-09-22", "2026-11-02", six, null, base);
    const ids = new Set(sched.map((d) => d.unit_id));
    expect(ids.has("nv")).toBe(true);
  });

  it("semana de trabalho vai de terça a domingo", () => {
    expect(workWeekRange("2026-09-25")).toEqual({ start: "2026-09-22", end: "2026-09-27" });
    expect(workWeekRange("2026-09-28")).toEqual({ start: "2026-09-22", end: "2026-09-27" }); // segunda pertence à semana anterior
    expect(workWeekRange("2026-09-22")).toEqual({ start: "2026-09-22", end: "2026-09-27" });
  });
});
