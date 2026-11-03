import { describe, expect, it } from "vitest";
import { agruparNutriNc, nutriRecorrenteCritico } from "./nutri-recorrencia";

const L = (audit_id: string, item: string, area: string, item_id: string | null = null, corrigido = false) => ({ audit_id, item, area, item_id, corrigido });

describe("agruparNutriNc", () => {
  it("agrupa o mesmo item em áreas e visitas diferentes", () => {
    const r = agruparNutriNc(
      [L("a1", "Etiquetas incompletas", "Cozinha", "i1"), L("a1", "Etiquetas incompletas", "Estoque", "i1", true), L("a2", "Etiquetas incompletas", "Cozinha", "i1"), L("a2", "GN sem tampa", "Chapa", "i2"), L("a3", "Piso sujo", "Salão")],
      4,
      [L("z1", "Etiquetas incompletas", "Cozinha", "i1"), L("z2", "Etiquetas incompletas", "Cozinha", "i1")],
    );
    expect(r[0]).toEqual({ item: "Etiquetas incompletas", areas: ["Cozinha", "Estoque"], ocorrencias: 3, visitas: 2, total_visitas: 4, corrigidos: 1, ocorrencias_anterior: 2 });
    expect(r.map((x) => x.item)).toEqual(["Etiquetas incompletas", "GN sem tampa", "Piso sujo"]);
    expect(nutriRecorrenteCritico(r[0])).toBe(true);
    expect(nutriRecorrenteCritico(r[1])).toBe(false);
  });
  it("sem id agrupa pelo texto normalizado", () => {
    const r = agruparNutriNc([L("a1", "Lixeira sem tampa", "Cozinha"), L("a2", "LIXEIRA SEM TAMPA.", "Cozinha")], 2);
    expect(r).toHaveLength(1);
    expect(r[0].visitas).toBe(2);
  });
});
