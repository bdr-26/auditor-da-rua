import { describe, expect, it } from "vitest";
import { computeAuditScore, concludeBlockers, scoreToPct, type ScoringAnswer, type ScoringBlock } from "./scoring";

function item(id: string, extra: Partial<ScoringBlock["items"][number]> = {}) {
  return { id, chave: id, descricao: id, falha_grave: false, produto_vencido: false, pendencias: false, bloco_ref: null, ordem: 1, ...extra };
}

const completa: ScoringBlock[] = [
  { chave: "pendencias", nome: "Pendências", peso: 0, ordem: 0, items: [item("pend", { pendencias: true })] },
  {
    chave: "seguranca", nome: "Segurança", peso: 20, ordem: 1,
    items: [item("s1", { falha_grave: true }), item("s2", { falha_grave: true, produto_vencido: true }), item("s3", { falha_grave: true })],
  },
  { chave: "operacao", nome: "Operação", peso: 20, ordem: 2, items: [item("o1"), item("o2")] },
  { chave: "limpeza", nome: "Limpeza", peso: 20, ordem: 3, items: [item("l1")] },
  { chave: "atendimento", nome: "Atendimento", peso: 20, ordem: 4, items: [item("a1")] },
  { chave: "equipe", nome: "Equipe", peso: 20, ordem: 5, items: [item("e1")] },
];

function answers(map: Record<string, number | "na">, extra: Partial<ScoringAnswer> = {}): ScoringAnswer[] {
  return Object.entries(map).map(([item_id, v]) => ({
    item_id,
    nota: v === "na" ? null : v,
    na: v === "na",
    observacao: "obs",
    fotos: 1,
    ...extra,
  }));
}

describe("scoreToPct", () => {
  it("mapeia 1..5 em 0..100", () => {
    expect(scoreToPct(1)).toBe(0);
    expect(scoreToPct(3)).toBe(50);
    expect(scoreToPct(5)).toBe(100);
  });
});

describe("auditoria completa", () => {
  it("nota = média dos 5 blocos, pendências (peso 0) fora", () => {
    const r = computeAuditScore("completa", completa, answers({ pend: 1, s1: 5, s2: 5, s3: 5, o1: 3, o2: 3, l1: 4, a1: 4, e1: 5 }));
    // seg 100, op 50, limp 75, atend 75, equipe 100 → 80
    expect(r.nota_final).toBe(80);
    expect(r.falha_grave).toBe(false);
    expect(r.faltando).toEqual([]);
    expect(r.notas_blocos.find((b) => b.chave === "seguranca")?.nota).toBe(100);
  });

  it("falha grave zera o bloco de segurança e limita a nota a 50%", () => {
    const r = computeAuditScore("completa", completa, answers({ pend: "na", s1: 1, s2: 5, s3: 5, o1: 5, o2: 5, l1: 5, a1: 5, e1: 5 }));
    const seg = r.notas_blocos.find((b) => b.chave === "seguranca")!;
    expect(seg.nota).toBe(0);
    expect(seg.zerado).toBe(true);
    expect(r.nota_sem_teto).toBe(80); // 0+100+100+100+100 / 5
    expect(r.nota_final).toBe(50);
    expect(r.falha_grave).toBe(true);
    expect(r.itens_falha_grave).toEqual(["s1"]);
  });

  it("nota abaixo do teto não é elevada", () => {
    const r = computeAuditScore("completa", completa, answers({ pend: "na", s1: 1, s2: 5, s3: 5, o1: 1, o2: 1, l1: 1, a1: 2, e1: 2 }));
    expect(r.nota_final).toBe(10); // 0+0+0+25+25 /5
  });

  it("produto vencido só marca quando confirmado pelo auditor", () => {
    const base = { pend: "na" as const, s1: 5, s2: 1, s3: 5, o1: 5, o2: 5, l1: 5, a1: 5, e1: 5 };
    expect(computeAuditScore("completa", completa, answers(base)).produto_vencido).toBe(false);
    const withFlag = answers(base).map((a) => (a.item_id === "s2" ? { ...a, produto_vencido: true } : a));
    expect(computeAuditScore("completa", completa, withFlag).produto_vencido).toBe(true);
  });

  it("N/A sai do cálculo do bloco; bloco todo N/A não entra na média", () => {
    const r = computeAuditScore("completa", completa, answers({ pend: "na", s1: 5, s2: "na", s3: 3, o1: "na", o2: "na", l1: 4, a1: 4, e1: 4 }));
    expect(r.notas_blocos.find((b) => b.chave === "seguranca")?.nota).toBe(75);
    expect(r.notas_blocos.find((b) => b.chave === "operacao")?.nota).toBeNull();
    expect(r.nota_final).toBe(75); // (75+75+75+75)/4
  });

  it("lista itens faltando e bloqueia conclusão sem foto/observação em nota 1–2", () => {
    const r = computeAuditScore("completa", completa, [
      ...answers({ s1: 5, s2: 5, s3: 5, o1: 5, l1: 5, a1: 5, e1: 5, pend: "na" }),
      { item_id: "o2", nota: 2, na: false, fotos: 0, observacao: "" },
    ]);
    expect(r.faltando).toEqual([]);
    expect(r.sem_foto).toEqual(["o2"]);
    expect(r.sem_observacao).toEqual(["o2"]);
    expect(concludeBlockers(r)).toHaveLength(2);

    const r2 = computeAuditScore("completa", completa, answers({ s1: 5 }));
    expect(r2.faltando).toHaveLength(8);
    expect(r2.respondidos).toBe(1);
    expect(r2.total).toBe(9);
  });
});

describe("auditoria simplificada", () => {
  const simp: ScoringBlock[] = [
    {
      chave: "geral", nome: "Geral", peso: 1, ordem: 1,
      items: [
        item("temp", { falha_grave: true, bloco_ref: "seguranca" }),
        item("pvps", { falha_grave: true, produto_vencido: true, bloco_ref: "seguranca" }),
        item("limp", { bloco_ref: "limpeza" }),
        item("mont", { bloco_ref: "operacao" }),
        item("pend", { pendencias: true }),
      ],
    },
  ];

  it("média simples dos itens aplicáveis", () => {
    const r = computeAuditScore("simplificada", simp, answers({ temp: 5, pvps: 3, limp: 4, mont: 4, pend: "na" }));
    // 100, 50, 75, 75 → 75
    expect(r.nota_final).toBe(75);
    expect(r.notas_blocos.find((b) => b.chave === "seguranca")?.nota).toBe(75);
    expect(r.notas_blocos.find((b) => b.chave === "pendencias")?.nota).toBeNull();
  });

  it("falha grave: itens ⚠ contam 0% e teto 50%", () => {
    const r = computeAuditScore("simplificada", simp, answers({ temp: 1, pvps: 5, limp: 5, mont: 5, pend: 5 }));
    // temp 0, pvps 0 (⚠ zerado), limp 100, mont 100, pend 100 → 60 → teto 50
    expect(r.nota_sem_teto).toBe(60);
    expect(r.nota_final).toBe(50);
    expect(r.falha_grave).toBe(true);
    expect(r.notas_blocos.find((b) => b.chave === "seguranca")?.nota).toBe(0);
  });
});

describe("auditoria de produção", () => {
  it("usa a mesma mecânica da simplificada", () => {
    const prod: ScoringBlock[] = [
      { chave: "producao", nome: "Produção", peso: 1, ordem: 1, items: [item("rec"), item("arm", { falha_grave: true }), item("exp")] },
    ];
    const r = computeAuditScore("producao", prod, answers({ rec: 4, arm: 4, exp: 2 }));
    expect(r.nota_final).toBe(58.33);
    const grave = computeAuditScore("producao", prod, answers({ rec: 5, arm: 1, exp: 5 }));
    expect(grave.nota_final).toBe(50);
  });
});
