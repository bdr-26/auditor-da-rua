/**
 * Orientações de conferência para os itens das auditorias do gerente (completa, simplificada e produção),
 * indexadas pela `chave` estável do item do template. Aparecem no cartão de pontuação como "O que conferir".
 *
 * `conferir`: o que olhar/medir na visita. `notas`: referência rápida para pontuar (5 = padrão, 3 = desvio
 * pontual corrigível, 1 = fora do padrão / risco). Notas 1–2 exigem foto e observação e geram pendência.
 */
export interface ItemGuidance {
  conferir: string[];
  notas: { 5: string; 3: string; 1: string };
}

const G: Record<string, ItemGuidance> = {
  temperaturas: {
    conferir: [
      "Quente: alimentos prontos mantidos em banho-maria, pass ou estufa a 60 °C ou mais.",
      "Frio: pista fria, geladeiras, câmara, molhos e saladas a 5 °C ou menos (exposição curta tolera até 10 °C).",
      "Medir com termômetro na hora, no centro do alimento, e comparar com a planilha de temperatura do turno.",
      "Equipamentos com display: conferir se a leitura bate com o termômetro e se não há alarme ou degelo em excesso.",
    ],
    notas: { 5: "Tudo dentro da faixa e planilha do turno preenchida.", 3: "Desvio pequeno corrigido na hora ou planilha com falhas de registro.", 1: "Alimento fora da faixa segura em uso ou sem nenhum controle." },
  },
  validades_pvps: {
    conferir: [
      "Abrir geladeiras, câmara e estoque seco e procurar itens vencidos ou sem data.",
      "PVPS (primeiro que vence, primeiro que sai): itens de vencimento mais próximo na frente e sendo usados primeiro.",
      "Etiquetas de manipulação: data de abertura/preparo, validade secundária e responsável.",
      "Produto vencido em uso é nota 1 e torna a loja inelegível à premiação do mês.",
    ],
    notas: { 5: "Nenhum item vencido, tudo etiquetado e em ordem de vencimento.", 3: "Itens sem etiqueta ou fora da ordem, mas nada vencido.", 1: "Produto vencido em uso ou estoque sem controle de validade." },
  },
  armazenamento: {
    conferir: [
      "Separação entre cru e pronto, e entre carnes, vegetais e laticínios; nada em contato com o chão.",
      "Etiquetas legíveis com nome, data e validade; embalagens fechadas e sem contaminação cruzada.",
      "Câmaras e estoque organizados, com circulação de ar e sem produto encostado nas paredes/evaporador.",
      "Produtos de limpeza guardados separados dos alimentos.",
    ],
    notas: { 5: "Tudo separado, identificado e organizado.", 3: "Alguns itens sem etiqueta ou mal posicionados.", 1: "Contaminação cruzada, alimento no chão ou química junto com alimento." },
  },
  epis: {
    conferir: [
      "Touca cobrindo todo o cabelo, luvas trocadas entre tarefas, sem adornos (anéis, pulseiras, relógio).",
      "Luva térmica e avental na chapa/fritadeira; calçado fechado e antiderrapante.",
      "Barba protegida ou aparada conforme o padrão da loja.",
    ],
    notas: { 5: "Toda a equipe com EPIs corretos.", 3: "Um colaborador com item faltando, corrigido na hora.", 1: "Equipe sem EPIs ou manipulando alimento com adornos." },
  },
  higienizacao_equip: {
    conferir: [
      "Chapa, fritadeira, cortadores, tábuas e utensílios limpos e sem resíduo acumulado.",
      "Tábuas por cor/uso e sem sulcos profundos; panos e esponjas em bom estado e separados por área.",
      "Registro de higienização (frequência e produto) e diluição correta do sanitizante.",
    ],
    notas: { 5: "Equipamentos limpos e higienizados com registro.", 3: "Resíduo em pontos isolados ou registro incompleto.", 1: "Sujeira acumulada ou utensílio contaminado em uso." },
  },
  montagem_peso: {
    conferir: [
      "Pesar 2 ou 3 hambúrgueres e comparar com a ficha técnica (blend, pão, molhos, complementos).",
      "Ordem de montagem e quantidade de cada ingrediente conforme o padrão.",
      "Aparência final: alinhado, sem molho escorrendo, pão tostado.",
    ],
    notas: { 5: "Peso e montagem dentro da ficha em todos os pedidos observados.", 3: "Variação pequena de peso ou montagem em um pedido.", 1: "Fora da ficha técnica de forma recorrente." },
  },
  ponto_carne: {
    conferir: [
      "Ponto padrão da casa: centro cozido e suculento, sem partes cruas nem ressecadas.",
      "Temperatura interna mínima de segurança na chapa (72 °C) para carne moída.",
      "Chapa na temperatura certa e tempo de cada lado conforme o treinamento.",
    ],
    notas: { 5: "Ponto correto em todos os pedidos observados.", 3: "Um pedido fora do ponto, corrigido antes de sair.", 1: "Carne crua no centro ou queimada saindo para o cliente." },
  },
  tempo_preparo: {
    conferir: [
      "Cronometrar do pedido pronto no sistema até a entrega ao cliente ou ao entregador.",
      "Comparar com a meta da loja (salão e delivery) e verificar fila de pedidos acumulada.",
      "Comunicação entre caixa, cozinha e expedição.",
    ],
    notas: { 5: "Pedidos dentro da meta, sem acúmulo.", 3: "Atrasos pontuais no pico.", 1: "Atraso generalizado ou pedidos esquecidos." },
  },
  mise_en_place: {
    conferir: [
      "Insumos porcionados, etiquetados e na posição de trabalho antes do pico.",
      "Reposição contínua sem interromper a linha; nada fora de refrigeração além do necessário.",
      "Bancada limpa e organizada durante a operação.",
    ],
    notas: { 5: "Linha completa e organizada antes do pico.", 3: "Faltas pontuais repostas durante o serviço.", 1: "Linha desorganizada, gerando atraso ou risco." },
  },
  desperdicio: {
    conferir: [
      "Lixo da cozinha: quantidade de alimento aproveitável descartado.",
      "Porcionamento conforme ficha; sobras de produção e descartes registrados.",
      "Uso de aparas e aproveitamento dentro do padrão.",
    ],
    notas: { 5: "Descarte mínimo e registrado.", 3: "Desperdício visível em um ponto isolado.", 1: "Descarte alto sem controle." },
  },
  limpeza_geral: {
    conferir: [
      "Salão: mesas, cadeiras, piso, vidros e balcão limpos; banheiros abastecidos e sem odor.",
      "Cozinha: piso, ralos, coifa, paredes e áreas atrás/embaixo dos equipamentos.",
      "Área externa e lixeiras: sem acúmulo, fachada e calçada limpas.",
    ],
    notas: { 5: "Todas as áreas limpas, inclusive pontos escondidos.", 3: "Sujeira pontual em área de baixo fluxo.", 1: "Sujeira visível em área de cliente ou de produção." },
  },
  descarte_residuos: {
    conferir: [
      "Lixeiras com tampa e pedal, sacos trocados e área de lixo organizada.",
      "Óleo de fritura: trocado no ponto certo, armazenado em bombona fechada e destinado a coletor licenciado.",
      "Separação de recicláveis onde houver coleta.",
    ],
    notas: { 5: "Descarte e óleo corretos, com comprovante de coleta.", 3: "Lixeira sem tampa ou saco cheio em um ponto.", 1: "Óleo despejado no ralo ou lixo acumulado exposto." },
  },
  equipamentos: {
    conferir: [
      "Chapa, fritadeira, refrigeradores, freezer, exaustão e POS funcionando normalmente.",
      "Vedação (borrachas) das geladeiras, termostatos e luzes internas.",
      "Manutenções preventivas em dia e chamados abertos para o que está quebrado.",
    ],
    notas: { 5: "Tudo funcionando e manutenções em dia.", 3: "Equipamento com defeito leve e chamado aberto.", 1: "Equipamento crítico parado sem providência." },
  },
  apresentacao: {
    conferir: [
      "Fachada, letreiro, iluminação e comunicação visual conforme o padrão da marca.",
      "Cardápios, displays e mesas organizados; nada improvisado à vista do cliente.",
      "Música, temperatura do ambiente e odor adequados.",
    ],
    notas: { 5: "Loja no padrão visual da marca.", 3: "Detalhes fora do padrão (cartaz improvisado, lâmpada queimada).", 1: "Aparência desleixada ou comunicação fora da marca." },
  },
  atendimento_cliente: {
    conferir: [
      "Saudação, cordialidade e conhecimento do cardápio no caixa e no salão.",
      "Tempo de espera para ser atendido e resolução de reclamações.",
      "Postura da equipe: sem celular, sem conversa paralela em frente ao cliente.",
    ],
    notas: { 5: "Atendimento cordial, ágil e com domínio do cardápio.", 3: "Falhas pontuais de cordialidade ou demora.", 1: "Cliente ignorado, tratado mal ou reclamação sem resposta." },
  },
  embalagem_expedicao: {
    conferir: [
      "Embalagem correta para cada produto, lacrada e identificada com o pedido.",
      "Conferência do pedido antes de sair (itens, molhos, talheres, guardanapos).",
      "Área de expedição organizada e pedidos separados por plataforma/entregador.",
    ],
    notas: { 5: "Pedidos conferidos, lacrados e identificados.", 3: "Erro pontual de conferência corrigido antes de sair.", 1: "Pedidos saindo incompletos ou sem lacre." },
  },
  app_delivery: {
    conferir: [
      "Tempo de aceite e de preparo no app no dia; pedidos cancelados e motivo.",
      "Cardápio no app atualizado (itens em falta pausados) e loja aberta nos horários combinados.",
      "Avaliações recentes e respostas a reclamações.",
    ],
    notas: { 5: "Aceite rápido, sem cancelamentos e cardápio atualizado.", 3: "Um cancelamento ou item indisponível não pausado.", 1: "Loja fechada no app em horário de operação ou cancelamentos recorrentes." },
  },
  uniforme: {
    conferir: [
      "Camiseta, avental e touca do padrão, limpos e sem rasgos; calçado fechado.",
      "Crachá ou identificação quando exigido; aparência pessoal adequada (unhas, barba, cabelo preso).",
    ],
    notas: { 5: "Toda a equipe uniformizada e limpa.", 3: "Um colaborador com peça faltando ou suja.", 1: "Equipe sem uniforme ou com roupa inadequada para alimentos." },
  },
  pontualidade: {
    conferir: [
      "Escala do dia impressa/visível e conferida com quem está na loja.",
      "Horário de entrada registrado; atrasos e faltas com justificativa e cobertura.",
      "Intervalos sendo cumpridos sem deixar posto descoberto.",
    ],
    notas: { 5: "Escala cumprida integralmente.", 3: "Atraso pontual com cobertura.", 1: "Falta sem cobertura ou posto descoberto no pico." },
  },
  planilhas: {
    conferir: [
      "Planilhas do dia: temperatura dos alimentos e equipamentos, óleo, limpeza de banheiros, recebimento.",
      "Registros do turno anterior completos, legíveis e assinados; sem preenchimento 'em lote' no fim do dia.",
      "Valores registrados coerentes com o que foi medido na visita.",
    ],
    notas: { 5: "Todas as planilhas preenchidas e coerentes.", 3: "Planilha com horários faltando.", 1: "Planilhas em branco ou preenchidas de forma fictícia." },
  },
  ambiente: {
    conferir: [
      "Conversar rapidamente com 2 ou 3 colaboradores: clima, respeito, sobrecarga, comunicação com a liderança.",
      "Observar como o líder do turno orienta e corrige a equipe.",
      "Reclamações, conflitos ou rotatividade recente.",
    ],
    notas: { 5: "Equipe colaborativa e bem liderada.", 3: "Tensão pontual ou comunicação falha.", 1: "Conflito aberto, desrespeito ou liderança ausente." },
  },
  montagem_ponto: {
    conferir: [
      "Pesar 2 hambúrgueres e comparar com a ficha técnica; conferir a ordem de montagem.",
      "Ponto da carne: centro cozido e suculento, sem partes cruas; temperatura interna mínima de 72 °C.",
    ],
    notas: { 5: "Montagem e ponto no padrão.", 3: "Variação pequena em um pedido.", 1: "Carne crua no centro ou montagem fora da ficha de forma recorrente." },
  },
  pendencias_anterior: {
    conferir: [
      "Para cada pendência listada, verificar no local se foi resolvida de fato (não só 'em andamento').",
      "Marcar resolvida ou mantida; o app calcula a reincidência automaticamente.",
    ],
    notas: { 5: "Todas resolvidas.", 3: "Parte resolvida, parte com prazo combinado.", 1: "Nenhuma resolvida ou sem providência." },
  },
  recebimento: {
    conferir: [
      "Conferência de nota x pedido x entrega (quantidade, peso, lote, validade).",
      "Temperatura na chegada: refrigerados até 7 °C, congelados a -12 °C ou menos; caminhão e embalagens íntegros.",
      "Registro do recebimento na planilha com horário e responsável; devolução do que estiver fora do padrão.",
    ],
    notas: { 5: "Recebimento conferido, medido e registrado.", 3: "Registro incompleto, mas produto conforme.", 1: "Produto fora de temperatura ou vencido aceito sem conferência." },
  },
  producao_ficha: {
    conferir: [
      "Produção seguindo a ficha técnica: pesos, ingredientes, tempo e temperatura de preparo.",
      "Rendimento das bateladas anotado e comparado com o esperado.",
      "Amostras e padrão visual/sabor do produto final.",
    ],
    notas: { 5: "Produção no padrão com rendimento registrado.", 3: "Desvio pequeno em uma batelada.", 1: "Produção fora da ficha ou sem controle de rendimento." },
  },
  expedicao: {
    conferir: [
      "Pedidos das lojas separados, conferidos e etiquetados com destino, data e validade.",
      "Embalagens fechadas, caixas térmicas limpas e temperatura mantida até a saída.",
      "Horários de saída conforme a rota combinada com as lojas.",
    ],
    notas: { 5: "Expedição conferida, no horário e com temperatura mantida.", 3: "Atraso pontual ou etiqueta incompleta.", 1: "Pedido errado, sem identificação ou fora de temperatura." },
  },
  limpeza_org: {
    conferir: [
      "Piso, paredes, ralos, coifa e bancadas limpos; sem acúmulo em cantos e embaixo de equipamentos.",
      "Estoque e câmaras organizados; materiais de limpeza separados dos alimentos.",
      "Controle de pragas em dia (iscas, telas, certificado da dedetização).",
    ],
    notas: { 5: "Limpo e organizado, controle de pragas em dia.", 3: "Sujeira pontual em área de baixo fluxo.", 1: "Sujeira acumulada, sinais de pragas ou área de produção desorganizada." },
  },
  planilhas_producao: {
    conferir: [
      "Planilhas de produção, temperatura das câmaras, recebimento e higienização preenchidas por turno.",
      "Registros legíveis, com horário e responsável, coerentes com a produção do dia.",
    ],
    notas: { 5: "Todas preenchidas e coerentes.", 3: "Horários faltando.", 1: "Em branco ou preenchidas de forma fictícia." },
  },
};

export function getItemGuidance(chave: string): ItemGuidance | null {
  return G[chave] ?? null;
}
