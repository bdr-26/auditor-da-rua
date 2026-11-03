import { describe, expect, it } from "vitest";
import { agregarPedidos99, classificarCancelamento, indicadoresDoDetalhe, parsePedidos99, resumirImportacao99, unidadeDaLoja99 } from "./indicadores-99";

const CAB = [
  "Data", "Nome do estabelecimento", "ID do loja", "ID do pedido", "Horário do pedido", "Horário do cancelamento", "Parte responsável pelo cancelamento",
  "Motivos de cancelamentos por parte da loja", "Nível de avaliação do cliente", "Tag de avaliação do cliente", "Conteúdo de avaliação do cliente",
  "Tempo de finalização do pedido (segundos)", "Duração da entrega (segundos)", "Tempo de preparo (minutos)", "Tempo para aceitação do pedido (segundos)",
  "Preparação atrasada?", "Itens em falta", "Quantidade de pedidos anteriores do cliente na loja",
];
const linha = (o: Partial<Record<(typeof CAB)[number], string>>) => CAB.map((c) => o[c] ?? "");

const GRADE = [
  CAB,
  linha({ Data: "20261002", "Nome do estabelecimento": "Burger da Rua - Moema", "ID do loja": "5764608147579473685", "ID do pedido": "1", "Nível de avaliação do cliente": "500", "Tag de avaliação do cliente": "Comida excelente, Bem embalado", "Tempo de finalização do pedido (segundos)": "1.800", "Duração da entrega (segundos)": "900", "Tempo de preparo (minutos)": "10,5", "Tempo para aceitação do pedido (segundos)": "2", "Preparação atrasada?": "Não", "Quantidade de pedidos anteriores do cliente na loja": "0" }),
  linha({ Data: "20261002", "Nome do estabelecimento": "Smash da Rua", "ID do loja": "5764611700901544924", "ID do pedido": "2", "Nível de avaliação do cliente": "100", "Tag de avaliação do cliente": "Itens faltando", "Conteúdo de avaliação do cliente": "faltou a batata", "Tempo de finalização do pedido (segundos)": "3.600", "Duração da entrega (segundos)": "0", "Tempo de preparo (minutos)": "0", "Preparação atrasada?": "Sim", "Itens em falta": "Batata", "Quantidade de pedidos anteriores do cliente na loja": "3" }),
  linha({ Data: "20261003", "Nome do estabelecimento": "Smash da Rua", "ID do loja": "5764611700901544924", "ID do pedido": "3", "Horário do pedido": "2026-10-03 19:58:00", "Horário do cancelamento": "2026-10-03 20:00:00", "Parte responsável pelo cancelamento": "Responsabilidade da loja", "Motivos de cancelamentos por parte da loja": "Fechado" }),
  // desistência: cancelado em 5 s, sem aceite — fica fora do número de cancelamentos
  linha({ Data: "20261003", "Nome do estabelecimento": "Smash da Rua", "ID do loja": "5764611700901544924", "ID do pedido": "6", "Horário do pedido": "2026-10-03 20:10:00", "Horário do cancelamento": "2026-10-03 20:10:05", "Tempo para aceitação do pedido (segundos)": "0" }),
  // não aceito no prazo: cancelamento automático aos 10 min, sem aceite
  linha({ Data: "20261003", "Nome do estabelecimento": "Burger da Rua - Moema", "ID do loja": "5764608147579473685", "ID do pedido": "7", "Horário do pedido": "2026-10-03 20:20:00", "Horário do cancelamento": "2026-10-03 20:30:00", "Tempo para aceitação do pedido (segundos)": "0" }),
  // após o aceite: entregador
  linha({ Data: "20261003", "Nome do estabelecimento": "Burger da Rua - Moema", "ID do loja": "5764608147579473685", "ID do pedido": "8", "Horário do pedido": "2026-10-03 20:40:00", "Horário do cancelamento": "2026-10-03 21:30:00", "Tempo para aceitação do pedido (segundos)": "3", "Parte responsável pelo cancelamento": "Responsabilidade do entregador" }),
  linha({ Data: "20261003", "Nome do estabelecimento": "Burger da Rua- Bela Vista", "ID do loja": "5764616347963886742", "ID do pedido": "4", "Tempo de finalização do pedido (segundos)": "1.200", "Preparação atrasada?": "Não", "Quantidade de pedidos anteriores do cliente na loja": "1" }),
  linha({ Data: "20261003", "Nome do estabelecimento": "Burger da Rua - Pinheiros", "ID do loja": "999", "ID do pedido": "5" }),
  linha({}),
];

describe("parsePedidos99", () => {
  it("lê o relatório Dados do pedido", () => {
    const { pedidos, erro } = parsePedidos99(GRADE);
    expect(erro).toBeUndefined();
    expect(pedidos).toHaveLength(8);
    expect(pedidos[0]).toMatchObject({ data: "2026-10-02", nota: 5, tags: ["Comida excelente", "Bem embalado"], tempo_total_min: 30, tempo_entrega_min: 15, tempo_preparo_min: 10.5, atrasado: false, cliente_novo: true, cancelado: false });
    expect(pedidos[1]).toMatchObject({ nota: 1, tempo_entrega_min: null, tempo_preparo_min: null, atrasado: true, item_em_falta: true, cliente_novo: false });
    expect(pedidos[2]).toMatchObject({ cancelado: true, responsavel_cancelamento: "Responsabilidade da loja", motivo_loja: "Fechado", minutos_ate_cancelamento: 2, aceito: false });
    expect(pedidos.map(classificarCancelamento).slice(2, 6)).toEqual(["loja", "desistencia", "nao_aceito", "apos_aceite"]);
  });
  it("recusa outro relatório", () => {
    expect(parsePedidos99([["Nome do item", "Receita"], ["X", "1"]]).erro).toMatch(/Dados do pedido/);
  });
});

describe("agregação por unidade", () => {
  it("mapeia as lojas da 99 e agrega", () => {
    expect(unidadeDaLoja99("x", "Smash Da Rua - Imigrantes")).toBe("imigrantes");
    expect(unidadeDaLoja99("5764611700901544924", "Smash da Rua")).toBe("moema-delivery");
    expect(unidadeDaLoja99("x", "Burger da Rua - Pinheiros")).toBeNull();
    const r = resumirImportacao99(parsePedidos99(GRADE).pedidos);
    expect(r.periodo).toEqual({ de: "2026-10-02", ate: "2026-10-03" });
    expect(r.desconhecidas).toEqual([{ id: "999", nome: "Burger da Rua - Pinheiros", pedidos: 1 }]);
    const moema = r.unidades.find((u) => u.slug === "moema-delivery")!.detalhe;
    expect(moema).toMatchObject({ pedidos_total: 6, concluidos: 2, cancelados: 3, desistencias: 1, nao_aceitos: 1, nao_aceitos_pct: 20, cancel_loja: 1, cancel_apos_aceite: 1, cancel_pct: 60, avaliacoes: 2, nota_media: 3, atrasados: 1, itens_em_falta: 1, novos_clientes: 1, dias: 2, tempo_total_medio: 45, tempo_entrega_medio: 15 });
    expect(moema.cancel_motivos_loja).toEqual({ Fechado: 1 });
    expect(moema.cancel_resp).toEqual({ "Responsabilidade do entregador": 1 });
    expect(moema.tags_negativas).toEqual({ "Itens faltando": 1 });
    expect(moema.comentarios_negativos).toEqual([{ data: "2026-10-02", nota: 1, texto: "faltou a batata" }]);
    expect(moema.lojas_99.map((l) => l.nome)).toEqual(["Burger da Rua - Moema", "Smash da Rua"]); // mais linhas primeiro
    expect(indicadoresDoDetalhe(moema)).toEqual({ pedidos: 2, cancelamentos: 3, nota_99food: 3, tempo_medio_entrega: 45 });
    const bv = r.unidades.find((u) => u.slug === "bela-vista")!.detalhe;
    expect(bv.nota_media).toBeNull();
    expect(bv.cancel_pct).toBe(0);
    // loja desconhecida resolvida pelo usuário
    expect(resumirImportacao99(parsePedidos99(GRADE).pedidos, { "999": "mooca" }).unidades.map((u) => u.slug)).toContain("mooca");
  });
  it("agrega vazio sem quebrar", () => {
    expect(agregarPedidos99([]).periodo).toBeNull();
  });
});
