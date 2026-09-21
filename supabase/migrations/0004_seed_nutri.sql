-- =====================================================================
-- Seed: banco de itens nutricionais + composição por unidade
-- Anexo A (Moema Salão), Anexo B (Moema Delivery), Anexo C (Imigrantes; clonado p/ Bela Vista e Mooca)
-- Redação em NEGATIVO preservada (item descreve o problema). Peso 1 em todos.
-- =====================================================================

create or replace function seed_nutri_item(p_slug text, p_area_ordem int, p_area text, p_ordem int, p_descricao text)
returns void language plpgsql as $$
declare v_unit uuid; v_item uuid;
begin
  select id into v_unit from units where slug = p_slug;
  if v_unit is null then raise exception 'unidade % não encontrada', p_slug; end if;
  select id into v_item from nutri_item_bank where descricao = p_descricao;
  if v_item is null then
    insert into nutri_item_bank (descricao, area_padrao, peso) values (p_descricao, p_area, 1) returning id into v_item;
  end if;
  insert into unit_nutri_checklist (unit_id, bank_item_id, area, area_ordem, ordem)
  values (v_unit, v_item, p_area, p_area_ordem, p_ordem)
  on conflict (unit_id, bank_item_id, area) do nothing;
end $$;

-- ======================= ANEXO A — MOEMA SALÃO =======================
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 2, 'Produtos não estão segregados por gêneros');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 3, 'Produto dentro do freezer ao lado da chapa não estão fechados e sem etiquetas');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 4, 'Bisnaga de água não identificada');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 5, 'Bebidas da geladeira fora do PVPS');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 6, 'GN na pista desprotegidas');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 7, 'GN na pista com etiqueta');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 8, 'Pista fria não foi identificada com o dia');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 9, 'Saleiro e dispenser de cobertura de sorvetes sujos');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 10, 'Bisnagas na geladeira sem proteção');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 11, 'GNs abertas dentro da geladeira da chapa');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 12, 'Amostras de água não foram coletadas');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 13, 'Amostras vencidas ou não coletadas');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 14, 'Higienização de prateleiras e local não foi realizada');
select seed_nutri_item('moema-salao', 1, 'Cozinha / Chapa', 15, 'Equipamentos não estão limpos (geladeiras, tostadeiras, pistas, máquina de sorvete, fritadeiras, prateleiras)');

select seed_nutri_item('moema-salao', 2, 'Área de Lavagem de Louças e Estoque', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
select seed_nutri_item('moema-salao', 2, 'Área de Lavagem de Louças e Estoque', 2, 'Equipamentos não estão limpos (micro-ondas, filtro de água, estantes, carrinho de limpeza, prateleiras, geladeira e freezer)');
select seed_nutri_item('moema-salao', 2, 'Área de Lavagem de Louças e Estoque', 3, 'Bebidas da geladeira estão fora do PVPS');
select seed_nutri_item('moema-salao', 2, 'Área de Lavagem de Louças e Estoque', 4, 'Produtos da estante fora do PVPS');
select seed_nutri_item('moema-salao', 2, 'Área de Lavagem de Louças e Estoque', 5, 'Amostras não foram coletadas, vencidas ou não descartadas');

select seed_nutri_item('moema-salao', 3, 'Estoque de Produtos de Limpeza e Banheiro de Funcionário', 1, 'Panos dentro do balde com água');
select seed_nutri_item('moema-salao', 3, 'Estoque de Produtos de Limpeza e Banheiro de Funcionário', 2, 'Local desorganizado');
select seed_nutri_item('moema-salao', 3, 'Estoque de Produtos de Limpeza e Banheiro de Funcionário', 3, 'Produtos de limpeza vencidos');
select seed_nutri_item('moema-salao', 3, 'Estoque de Produtos de Limpeza e Banheiro de Funcionário', 4, 'Perfex e papel filme desprotegidos');

select seed_nutri_item('moema-salao', 4, 'Salão 1 e 2', 1, 'Bancadas de saída de pedidos suja');
select seed_nutri_item('moema-salao', 4, 'Salão 1 e 2', 2, 'Equipamentos não estão limpos (máquina de refri, mesas, bancos, dispenser de ketchup, ar-condicionado)');
select seed_nutri_item('moema-salao', 4, 'Salão 1 e 2', 3, 'Sachês vencidos');

select seed_nutri_item('moema-salao', 5, 'Banheiro de Cliente', 1, 'Papel higiênico e sabonete não foram abastecidos, local sujo e desorganizado');

select seed_nutri_item('moema-salao', 6, 'Sala de Descartáveis', 1, 'Caixas não estão sob estrados, local sujo e desorganizado');

select seed_nutri_item('moema-salao', 7, 'Boas Práticas de Fabricação', 1, 'Funcionários não têm o hábito de lavar as mãos');
select seed_nutri_item('moema-salao', 7, 'Boas Práticas de Fabricação', 2, 'Funcionários não têm o hábito de higienizar o local antes de iniciar as atividades e na troca');
select seed_nutri_item('moema-salao', 7, 'Boas Práticas de Fabricação', 3, 'Existe foco de contaminação cruzada');
select seed_nutri_item('moema-salao', 7, 'Boas Práticas de Fabricação', 4, 'Funcionários não estão tendo higiene pessoal');

select seed_nutri_item('moema-salao', 8, 'Higienização', 1, 'Ralos com resíduos de alimentos');
select seed_nutri_item('moema-salao', 8, 'Higienização', 2, 'POPs de higienização de todas as áreas não estão sendo seguidos');
select seed_nutri_item('moema-salao', 8, 'Higienização', 3, 'POPs de higienização de todas as áreas não estão sendo preenchidos');
select seed_nutri_item('moema-salao', 8, 'Higienização', 4, 'Freezers de todas as áreas com acúmulo de gelo');
select seed_nutri_item('moema-salao', 8, 'Higienização', 5, 'Lâmpadas aquecedoras sujas');
select seed_nutri_item('moema-salao', 8, 'Higienização', 6, 'Saleiros sujos');

select seed_nutri_item('moema-salao', 9, 'Funcionários', 1, 'Funcionários não utilizam EPIs');
select seed_nutri_item('moema-salao', 9, 'Funcionários', 2, 'Funcionários com uniformes sujos');
select seed_nutri_item('moema-salao', 9, 'Funcionários', 3, 'Funcionários com adornos, perfumes, maquiagem, cílios postiços');

select seed_nutri_item('moema-salao', 10, 'Planilhas', 1, 'Planilhas não estão sendo preenchidas (banheiros de cliente, temperatura dos alimentos na distribuição, temperatura dos equipamentos, temperatura do óleo, limpeza da caixa de gordura, manutenção preventiva e corretiva e entrega dos EPIs)');

-- ======================= ANEXO B — MOEMA DELIVERY =======================
select seed_nutri_item('moema-delivery', 1, 'Área do Estoque da Área de Pré-Preparo', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
select seed_nutri_item('moema-delivery', 1, 'Área do Estoque da Área de Pré-Preparo', 2, 'Produtos não estão segregados por gêneros');
select seed_nutri_item('moema-delivery', 1, 'Área do Estoque da Área de Pré-Preparo', 3, 'Louças estão misturadas com utensílios');
select seed_nutri_item('moema-delivery', 1, 'Área do Estoque da Área de Pré-Preparo', 4, 'Higienização de prateleiras e local não foi realizada');
select seed_nutri_item('moema-delivery', 1, 'Área do Estoque da Área de Pré-Preparo', 5, 'Produtos não estão armazenados em PVPS');

select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 2, 'Produtos não estão segregados por gêneros');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 3, 'Incrustações em louças e utensílios');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 4, 'Equipamentos não estão limpos (fogão, forno, centrífuga, banho-maria, geladeiras, prateleiras e pia)');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 5, 'Carrinho de transporte não está limpo');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 6, 'Caixas de armazenar não estão limpas e em local correto (caixas brancas, de hortifruti, de insumos e de produção)');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 7, 'Descongelamento não foi realizado corretamente');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 8, 'O processo de higienização de hortifruti incorreto (quantidade de água, produto, limpeza do local antes de iniciar)');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 9, 'Perfex e papel filme não estão protegidos');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 10, 'A parte da limpeza não está sendo seguida');
select seed_nutri_item('moema-delivery', 2, 'Área de Pré-Preparo', 11, 'Amostra de água vencida');

select seed_nutri_item('moema-delivery', 3, 'Área do Refeitório e Entrega do Delivery', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
select seed_nutri_item('moema-delivery', 3, 'Área do Refeitório e Entrega do Delivery', 2, 'Produtos não estão armazenados em PVPS');
select seed_nutri_item('moema-delivery', 3, 'Área do Refeitório e Entrega do Delivery', 3, 'Mesas e poltronas não estão limpas');
select seed_nutri_item('moema-delivery', 3, 'Área do Refeitório e Entrega do Delivery', 4, 'Equipamentos não foram limpos (micro-ondas, ventilador, geladeira, filtro)');

select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 2, 'Batata e hambúrguer de frango não identificados com uso diário e abertos');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 3, 'Produtos não foram segregados por gêneros');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 4, 'Produtos não foram armazenados em PVPS');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 5, 'Data de validade não foi colocada nas pistas');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 6, 'Preparações nas pistas com etiqueta');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 7, 'GNs sem tampa dentro dos equipamentos');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 8, 'Bisnagas armazenadas em geladeira não protegidas');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 9, 'Bisnaga de água não identificada com uma etiqueta');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 10, 'Equipamentos não estão limpos (geladeiras, freezer, pistas, fritadeiras, tostadeira, chapa, prateleiras, impressoras, ar-condicionado e coifa)');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 11, 'A parte da limpeza não está sendo seguida');
select seed_nutri_item('moema-delivery', 4, 'Área de Finalização', 12, 'Sachês vencidos');

select seed_nutri_item('moema-delivery', 5, 'Área do Açougue', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
select seed_nutri_item('moema-delivery', 5, 'Área do Açougue', 2, 'Ar-condicionado da sala desligado');
select seed_nutri_item('moema-delivery', 5, 'Área do Açougue', 3, 'Porta mantida aberta');
select seed_nutri_item('moema-delivery', 5, 'Área do Açougue', 4, 'Perfex e papel filme não protegidos');
select seed_nutri_item('moema-delivery', 5, 'Área do Açougue', 5, 'Equipamentos não estão limpos (geladeiras, prateleiras, ar-condicionado, máquina de frios, moldes, balanças)');

select seed_nutri_item('moema-delivery', 6, 'Área de Lavagem de Louças e Estoque Refrigerado e Congelado', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
select seed_nutri_item('moema-delivery', 6, 'Área de Lavagem de Louças e Estoque Refrigerado e Congelado', 2, 'Amostras vencidas');
select seed_nutri_item('moema-delivery', 6, 'Área de Lavagem de Louças e Estoque Refrigerado e Congelado', 3, 'Amostras não coletadas');
select seed_nutri_item('moema-delivery', 6, 'Área de Lavagem de Louças e Estoque Refrigerado e Congelado', 4, 'Produtos impróprios para consumo não identificados e sem etiquetas');
select seed_nutri_item('moema-delivery', 6, 'Área de Lavagem de Louças e Estoque Refrigerado e Congelado', 5, 'Produtos não estão armazenados por gêneros');
select seed_nutri_item('moema-delivery', 6, 'Área de Lavagem de Louças e Estoque Refrigerado e Congelado', 6, 'A parte da limpeza não está sendo seguida');
select seed_nutri_item('moema-delivery', 6, 'Área de Lavagem de Louças e Estoque Refrigerado e Congelado', 7, 'Produtos não estão armazenados em PVPS');

select seed_nutri_item('moema-delivery', 7, 'Área de Lavanderia', 1, 'Panos dentro do balde com água');
select seed_nutri_item('moema-delivery', 7, 'Área de Lavanderia', 2, 'Produtos de limpeza vencidos');
select seed_nutri_item('moema-delivery', 7, 'Área de Lavanderia', 3, 'Panos secando em local incorreto');

select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 2, 'Produtos vencidos');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 3, 'Produtos não estão armazenados por gêneros');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 4, 'Produtos não estão armazenados em PVPS');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 5, 'Resíduos de etiquetas em GNs e caixas');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 6, 'Potes de vidro vazios sujos');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 7, 'A parte da limpeza não está sendo seguida');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 8, 'Sachês vencidos');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 9, 'Embalagens abertas misturadas com embalagens fechadas');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 10, 'Produtos fora de estrados');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 11, 'Equipamentos não estão limpos (prateleiras, estantes, armários)');
select seed_nutri_item('moema-delivery', 8, 'Área de Estoque – Fundo', 12, 'Amostras dos pães não coletadas e não descartadas quando venceram');

select seed_nutri_item('moema-delivery', 9, 'Área do Lixo', 1, 'Local não está dentro das conformidades (organizado, limpo, separação de orgânicos e porta fechada)');
select seed_nutri_item('moema-delivery', 9, 'Área do Lixo', 2, 'Foram encontrados lixos descartados em local errado');

select seed_nutri_item('moema-delivery', 10, 'Área Banheiros e Vestiário', 1, 'Local não está dentro das conformidades (organizado, limpo, sem pertences espalhados)');

select seed_nutri_item('moema-delivery', 11, 'Boas Práticas de Fabricação', 1, 'Funcionários não têm o hábito de lavar as mãos');
select seed_nutri_item('moema-delivery', 11, 'Boas Práticas de Fabricação', 2, 'Funcionários não têm o hábito de higienizar o local antes de iniciar as atividades e na troca');
select seed_nutri_item('moema-delivery', 11, 'Boas Práticas de Fabricação', 3, 'Existe foco de contaminação cruzada');
select seed_nutri_item('moema-delivery', 11, 'Boas Práticas de Fabricação', 4, 'Funcionários não estão tendo higiene pessoal');

select seed_nutri_item('moema-delivery', 12, 'Higienização', 1, 'Ralos com resíduos de alimentos');
select seed_nutri_item('moema-delivery', 12, 'Higienização', 2, 'POPs de higienização de todas as áreas não estão sendo seguidos');
select seed_nutri_item('moema-delivery', 12, 'Higienização', 3, 'POPs de higienização de todas as áreas não estão sendo preenchidos');
select seed_nutri_item('moema-delivery', 12, 'Higienização', 4, 'Freezers de todas as áreas com acúmulo de gelo');
select seed_nutri_item('moema-delivery', 12, 'Higienização', 5, 'Lâmpadas aquecedoras sujas');
select seed_nutri_item('moema-delivery', 12, 'Higienização', 6, 'Saleiros sujos');

select seed_nutri_item('moema-delivery', 13, 'Funcionários', 1, 'Funcionários não utilizam EPIs');
select seed_nutri_item('moema-delivery', 13, 'Funcionários', 2, 'Funcionários com uniformes sujos');
select seed_nutri_item('moema-delivery', 13, 'Funcionários', 3, 'Funcionários estão utilizando adornos/cílios e unhas postiças, utilizando perfume forte');

select seed_nutri_item('moema-delivery', 14, 'Planilhas', 1, 'Planilhas não estão sendo preenchidas (recebimento de mercadoria, temperatura dos alimentos na distribuição, temperatura dos equipamentos, temperatura do óleo, limpeza da caixa de gordura, higienização de hortifruti, alimentos transportados, manutenção preventiva e corretiva e entrega dos EPIs)');

-- ======================= ANEXO C — IMIGRANTES (rascunho) + clones Bela Vista e Mooca =======================
create or replace function seed_nutri_anexo_c(p_slug text) returns void language plpgsql as $$
begin
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 2, 'Produtos não estão segregados por gêneros');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 3, 'Produto dentro do freezer ao lado da chapa não estão fechados e sem etiquetas');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 4, 'Bisnaga de água não identificada');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 5, 'Bebidas da geladeira fora do PVPS');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 6, 'GN na pista desprotegidas');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 7, 'GN na pista com etiqueta');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 8, 'Pista fria não foi identificada com o dia');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 9, 'Bisnagas na geladeira sem proteção');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 10, 'GNs abertas dentro da geladeira da chapa');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 11, 'Amostras de água não foram coletadas');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 12, 'Amostras vencidas ou não coletadas');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 13, 'Higienização de prateleiras e local não foi realizada');
  perform seed_nutri_item(p_slug, 1, 'Cozinha / Chapa', 14, 'Equipamentos não estão limpos (geladeiras, tostadeiras, pistas, fritadeiras, chapa, prateleiras)');

  perform seed_nutri_item(p_slug, 2, 'Área de Lavagem de Louças e Estoque', 1, 'Etiquetas (rasurada, vencida, mais de uma, errada, apagada, incompleta, informações incorretas, sem etiqueta)');
  perform seed_nutri_item(p_slug, 2, 'Área de Lavagem de Louças e Estoque', 2, 'Equipamentos não estão limpos (micro-ondas, filtro de água, estantes, carrinho de limpeza, prateleiras, geladeira e freezer)');
  perform seed_nutri_item(p_slug, 2, 'Área de Lavagem de Louças e Estoque', 3, 'Bebidas da geladeira estão fora do PVPS');
  perform seed_nutri_item(p_slug, 2, 'Área de Lavagem de Louças e Estoque', 4, 'Produtos da estante fora do PVPS');
  perform seed_nutri_item(p_slug, 2, 'Área de Lavagem de Louças e Estoque', 5, 'Amostras não foram coletadas, vencidas ou não descartadas');

  perform seed_nutri_item(p_slug, 3, 'Estoque de Produtos de Limpeza e Banheiro de Funcionário', 1, 'Panos dentro do balde com água');
  perform seed_nutri_item(p_slug, 3, 'Estoque de Produtos de Limpeza e Banheiro de Funcionário', 2, 'Local desorganizado');
  perform seed_nutri_item(p_slug, 3, 'Estoque de Produtos de Limpeza e Banheiro de Funcionário', 3, 'Produtos de limpeza vencidos');
  perform seed_nutri_item(p_slug, 3, 'Estoque de Produtos de Limpeza e Banheiro de Funcionário', 4, 'Perfex e papel filme desprotegidos');

  perform seed_nutri_item(p_slug, 4, 'Salão', 1, 'Bancadas de saída de pedidos suja');
  perform seed_nutri_item(p_slug, 4, 'Salão', 2, 'Equipamentos não estão limpos (máquina de refri, mesas, bancos, dispenser de ketchup, ar-condicionado)');
  perform seed_nutri_item(p_slug, 4, 'Salão', 3, 'Sachês vencidos');

  perform seed_nutri_item(p_slug, 5, 'Banheiro de Cliente', 1, 'Papel higiênico e sabonete não foram abastecidos, local sujo e desorganizado');

  perform seed_nutri_item(p_slug, 6, 'Área do Lixo', 1, 'Local não está dentro das conformidades (organizado, limpo, separação de orgânicos e porta fechada)');
  perform seed_nutri_item(p_slug, 6, 'Área do Lixo', 2, 'Foram encontrados lixos descartados em local errado');

  perform seed_nutri_item(p_slug, 7, 'Boas Práticas de Fabricação', 1, 'Funcionários não têm o hábito de lavar as mãos');
  perform seed_nutri_item(p_slug, 7, 'Boas Práticas de Fabricação', 2, 'Funcionários não têm o hábito de higienizar o local antes de iniciar as atividades e na troca');
  perform seed_nutri_item(p_slug, 7, 'Boas Práticas de Fabricação', 3, 'Existe foco de contaminação cruzada');
  perform seed_nutri_item(p_slug, 7, 'Boas Práticas de Fabricação', 4, 'Funcionários não estão tendo higiene pessoal');

  perform seed_nutri_item(p_slug, 8, 'Higienização', 1, 'Ralos com resíduos de alimentos');
  perform seed_nutri_item(p_slug, 8, 'Higienização', 2, 'POPs de higienização de todas as áreas não estão sendo seguidos');
  perform seed_nutri_item(p_slug, 8, 'Higienização', 3, 'POPs de higienização de todas as áreas não estão sendo preenchidos');
  perform seed_nutri_item(p_slug, 8, 'Higienização', 4, 'Freezers de todas as áreas com acúmulo de gelo');
  perform seed_nutri_item(p_slug, 8, 'Higienização', 5, 'Lâmpadas aquecedoras sujas');
  perform seed_nutri_item(p_slug, 8, 'Higienização', 6, 'Saleiros sujos');

  perform seed_nutri_item(p_slug, 9, 'Funcionários', 1, 'Funcionários não utilizam EPIs');
  perform seed_nutri_item(p_slug, 9, 'Funcionários', 2, 'Funcionários com uniformes sujos');
  perform seed_nutri_item(p_slug, 9, 'Funcionários', 3, 'Funcionários com adornos, perfumes, maquiagem, cílios postiços');

  perform seed_nutri_item(p_slug, 10, 'Planilhas', 1, 'Planilhas não estão sendo preenchidas (banheiros de cliente, temperatura dos alimentos na distribuição, temperatura dos equipamentos, temperatura do óleo, limpeza da caixa de gordura, manutenção preventiva e corretiva e entrega dos EPIs)');

  update units set nutri_checklist_em_revisao = true where slug = p_slug;
end $$;

select seed_nutri_anexo_c('imigrantes');
select seed_nutri_anexo_c('bela-vista');
select seed_nutri_anexo_c('mooca');

drop function seed_nutri_anexo_c(text);
drop function seed_nutri_item(text, int, text, int, text);
