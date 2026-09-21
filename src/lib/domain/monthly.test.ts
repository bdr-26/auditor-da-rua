import { describe, expect, it } from "vitest";
import { computeMonthlyOperational, rankUnits, type MonthlyAuditInput } from "./monthly";

function audit(tipo: MonthlyAuditInput["tipo"], nota: number | null, extra: Partial<MonthlyAuditInput> = {}): MonthlyAuditInput {
  return { id: Math.random().toString(), tipo, data: "2026-09-10", nota_final: nota, falha_grave: false, produto_vencido: false, notas_blocos: null, ...extra };
}

describe("nota mensal", () => {
  it("média ponderada completa ×2, simplificada ×1", () => {
    const s = computeMonthlyOperational([audit("completa", 80), audit("simplificada", 50), audit("completa", 90)]);
    // (80*2 + 50*1 + 90*2) / 5 = 78
    expect(s.nota).toBe(78);
    expect(s.n_auditorias).toBe(3);
    expect(s.amostra_reduzida).toBe(false);
  });

  it("sem auditorias → nota nula; menos de 3 → amostra reduzida", () => {
    expect(computeMonthlyOperational([]).nota).toBeNull();
    const s = computeMonthlyOperational([audit("completa", 80), audit("simplificada", 60)]);
    expect(s.amostra_reduzida).toBe(true);
  });

  it("rascunhos (sem nota) não entram; nutricional não entra", () => {
    const s = computeMonthlyOperational([audit("completa", 80), audit("completa", null), audit("nutricional", 100)]);
    expect(s.nota).toBe(80);
    expect(s.n_auditorias).toBe(1);
  });

  it("agrega falhas graves, produto vencido e nota de segurança", () => {
    const s = computeMonthlyOperational([
      audit("completa", 50, { falha_grave: true, produto_vencido: true, notas_blocos: [{ chave: "seguranca", nome: "Seg", peso: 20, nota: 0, zerado: true, itens_respondidos: 5, itens_aplicaveis: 5 }] }),
      audit("completa", 90, { notas_blocos: [{ chave: "seguranca", nome: "Seg", peso: 20, nota: 100, zerado: false, itens_respondidos: 5, itens_aplicaveis: 5 }] }),
    ]);
    expect(s.falhas_graves).toBe(1);
    expect(s.produto_vencido).toBe(true);
    expect(s.nota_seguranca).toBe(50);
    expect(s.notas_blocos[0].zerado).toBe(true);
  });
});

describe("ranking", () => {
  const base = { nota_seguranca: 80, falhas_graves: 0, produto_vencido: false, n_auditorias: 4, amostra_reduzida: false, entra_no_ranking: true };

  it("ordena por nota e premia a 1ª elegível", () => {
    const r = rankUnits([
      { unit_id: "a", nome: "A", nota: 70, ...base },
      { unit_id: "b", nome: "B", nota: 85, ...base },
      { unit_id: "c", nome: "C", nota: 60, ...base },
    ]);
    expect(r.map((x) => x.unit_id)).toEqual(["b", "a", "c"]);
    expect(r.map((x) => x.posicao)).toEqual([1, 2, 3]);
    expect(r[0].premiada).toBe(true);
    expect(r[1].elegivel).toBe(true); // 70 é elegível (≥ 70)
    expect(r[2].elegivel).toBe(false);
  });

  it("1º abaixo de 70% → ninguém premiado", () => {
    const r = rankUnits([
      { unit_id: "a", nome: "A", nota: 65, ...base },
      { unit_id: "b", nome: "B", nota: 60, ...base },
    ]);
    expect(r.some((x) => x.premiada)).toBe(false);
  });

  it("produto vencido torna inelegível mesmo em 1º", () => {
    const r = rankUnits([
      { unit_id: "a", nome: "A", nota: 90, ...base, produto_vencido: true },
      { unit_id: "b", nome: "B", nota: 80, ...base },
    ]);
    expect(r[0].unit_id).toBe("a");
    expect(r[0].premiada).toBe(false);
    expect(r[1].premiada).toBe(false); // 2º colocado não herda o prêmio
  });

  it("desempate: segurança, depois falhas graves, depois empate declarado", () => {
    const r = rankUnits([
      { unit_id: "a", nome: "A", nota: 80, ...base, nota_seguranca: 70 },
      { unit_id: "b", nome: "B", nota: 80, ...base, nota_seguranca: 90 },
    ]);
    expect(r[0].unit_id).toBe("b");
    expect(r[0].empate).toBe(false);

    const r2 = rankUnits([
      { unit_id: "a", nome: "A", nota: 80, ...base, falhas_graves: 1 },
      { unit_id: "b", nome: "B", nota: 80, ...base, falhas_graves: 0 },
    ]);
    expect(r2[0].unit_id).toBe("b");

    const r3 = rankUnits([
      { unit_id: "a", nome: "A", nota: 80, ...base },
      { unit_id: "b", nome: "B", nota: 80, ...base },
      { unit_id: "c", nome: "C", nota: 70, ...base },
    ]);
    expect(r3[0].empate && r3[1].empate).toBe(true);
    expect(r3[0].posicao).toBe(1);
    expect(r3[1].posicao).toBe(1);
    expect(r3[2].posicao).toBe(3);
    expect(r3[0].premiada && r3[1].premiada).toBe(true); // prêmio dividido
  });

  it("produção e lojas sem nota ficam fora do ranking", () => {
    const r = rankUnits([
      { unit_id: "p", nome: "Produção", nota: 95, ...base, entra_no_ranking: false },
      { unit_id: "n", nome: "Nova", nota: null, ...base },
      { unit_id: "a", nome: "A", nota: 75, ...base },
    ]);
    expect(r[0].unit_id).toBe("a");
    expect(r.find((x) => x.unit_id === "p")?.posicao).toBeNull();
    expect(r.find((x) => x.unit_id === "n")?.posicao).toBeNull();
  });
});
