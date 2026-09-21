import { describe, expect, it } from "vitest";
import { classifyNutri, computeNutriScore } from "./nutri";

describe("módulo nutricional", () => {
  it("faixas do Food Checker", () => {
    expect(classifyNutri(100)).toBe("Excelente");
    expect(classifyNutri(91)).toBe("Excelente");
    expect(classifyNutri(90)).toBe("Satisfatório");
    expect(classifyNutri(80)).toBe("Satisfatório");
    expect(classifyNutri(79)).toBe("Insatisfatório");
    expect(classifyNutri(50)).toBe("Insatisfatório");
    expect(classifyNutri(49.4)).toBe("Crítico");
    expect(classifyNutri(null)).toBeNull();
  });

  it("nota = Σ pesos conformes / Σ pesos aplicáveis; N/A fora", () => {
    const r = computeNutriScore([
      { entry_id: "1", area: "Cozinha", peso: 1, resposta: "conforme" },
      { entry_id: "2", area: "Cozinha", peso: 1, resposta: "nao_conforme" },
      { entry_id: "3", area: "Salão", peso: 1, resposta: "conforme" },
      { entry_id: "4", area: "Salão", peso: 1, resposta: "na" },
      { entry_id: "5", area: "Salão", peso: 2, resposta: "conforme" },
    ]);
    expect(r.nota).toBe(80); // 4/5
    expect(r.classificacao).toBe("Satisfatório");
    expect(r.na).toBe(1);
    expect(r.perdidos_por_area).toEqual([
      { area: "Cozinha", perdidos: 1, aplicaveis: 2, nota: 50 },
      { area: "Salão", perdidos: 0, aplicaveis: 3, nota: 100 },
    ]);
  });

  it("itens sem resposta bloqueiam e não entram", () => {
    const r = computeNutriScore([
      { entry_id: "1", area: "A", peso: 1, resposta: "conforme" },
      { entry_id: "2", area: "A", peso: 1, resposta: null },
    ]);
    expect(r.faltando).toEqual(["2"]);
    expect(r.nota).toBe(100);
    expect(computeNutriScore([{ entry_id: "x", area: "A", peso: 1, resposta: "na" }]).nota).toBeNull();
  });
});
