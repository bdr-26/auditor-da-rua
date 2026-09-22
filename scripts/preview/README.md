# Preview local (sem Supabase real)

Sobe o app com um **mock do Supabase** em memória, carregado com dados fictícios em pt-BR
(unidades, templates, checklists nutricionais, agenda, auditorias, pendências, fechamento…),
e tira **screenshots mobile** de todas as telas de cada perfil.

Nada aqui toca o código em `src/`. Os arquivos ficam em `scripts/preview/`:

| Arquivo | O que faz |
|---|---|
| `mock-supabase.mjs` | Servidor HTTP (porta 54321) que emula Auth (GoTrue), PostgREST e Storage |
| `fixtures.mjs` | Dados fictícios consistentes com `supabase/migrations/0001_schema.sql` e os seeds 0003/0004; exporta ids úteis |
| `run.sh` / `stop.sh` | Sobe e derruba mock + `next dev` |
| `screenshot.mjs` | Loga pelo formulário real e fotografa as rotas do perfil (Playwright) |
| `package.json` | Dependência própria (`playwright-core`) — não entra no `package.json` do app |

## Pré-requisitos

- `npm install` na raiz do projeto (Next, Supabase SDK etc.).
- Uma vez: `cd scripts/preview && npm install` (instala `playwright-core`).
- Um Chromium do Playwright. O script procura em `PLAYWRIGHT_BROWSERS_PATH`, `/opt/pw-browsers`
  e `~/.cache/ms-playwright`; ou informe o binário em `PREVIEW_CHROMIUM=/caminho/chrome`.
  (`playwright-core` está fixado na versão cujo Chromium é a build 1194 / Chromium 141; se
  usar outro Chromium, alinhe a versão em `scripts/preview/package.json`.)

## Rodar o preview

```bash
npm run preview          # = scripts/preview/run.sh
```

O script:

1. grava `.env.preview` na raiz (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, chaves `mock`,
   `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `CRON_SECRET=dev`);
2. sobe o mock e o `next dev -p 3000` com essas variáveis (elas têm precedência sobre o `.env.local`);
3. espera o "Ready" e imprime como acessar.

Abra <http://localhost:3000/login> e entre com **qualquer senha**:

| E-mail | Perfil |
|---|---|
| `antonio@bdr-auditor.app` | proprietário |
| `rodrigo@bdr-auditor.app` | gerente (auditor geral) |
| `dani@bdr-auditor.app` | nutricionista |

Para parar: `npm run preview:stop` (mata os grupos de processo listados em `scripts/preview/.pids`).

Logs ficam **fora** do repositório, em `/tmp/auditor-da-rua-preview/{next,mock}.log`
(ou `PREVIEW_LOG_DIR`). Isso é proposital: o watcher do `next dev` observa a árvore do projeto e um
log crescendo dentro dela dispara recompilações em loop.

Portas alternativas: `MOCK_SUPABASE_PORT=54322 PREVIEW_PORT=3001 npm run preview`.

## Screenshots

Com o preview no ar:

```bash
npm run preview:shots -- dani    out/dani            # 390×844 (padrão, iPhone)
npm run preview:shots -- rodrigo out/rodrigo
npm run preview:shots -- antonio out/antonio 430 932  # largura/altura opcionais
```

Para cada perfil o script faz login pelo `/login`, visita as rotas do papel (lista em
`screenshot.mjs`, com os ids das fixtures: rascunhos, auditoria concluída, unidade Imigrantes, mês
anterior) e salva:

- `NN-rota.png` — página inteira, `deviceScaleFactor` 2, `isMobile`/`hasTouch` quando a largura ≤ 500;
- `contact-sheet.html` — galeria com todas as imagens da rodada (rotas com aviso ficam destacadas);
- `summary.json` — status HTTP, redirecionamentos, `h1`, painel de erro detectado, erros de console.

Antes de cada foto o script espera `networkidle`, percorre a página até o fim (carrega fotos
`lazy`), esconde o badge de dev do Next e aguarda 500 ms. Variáveis: `PREVIEW_BASE_URL`,
`MOCK_SUPABASE_URL`, `PREVIEW_NAV_TIMEOUT` (ms).

## O que o mock emula

- **Auth**: `POST /auth/v1/token?grant_type=password|refresh_token`, `GET /auth/v1/user`,
  `POST /auth/v1/logout`. O `access_token` é um JWT sem assinatura válida (o app só o repassa).
- **PostgREST** (`/rest/v1/<tabela>`): `select` com recursos embutidos (`tabela(colunas)`, aninhados,
  `!inner`, filtros em caminho embutido como `template_items.chave=eq.x`), filtros `eq neq gt gte lt lte
  in is like ilike`, `not.<op>`, `or=(…)`, `order` (várias colunas, `asc/desc`, `nullsfirst/last`),
  `limit`/`offset`, `Accept: application/vnd.pgrst.object+json` (406 `PGRST116` com 0 ou >1 linhas),
  `Prefer: return=representation`, `count=exact` (HEAD com `Content-Range`), `POST` (insert/upsert com
  `on_conflict` e `resolution=merge-duplicates|ignore-duplicates`), `PATCH`, `DELETE` (com cascata das FKs
  principais). Colunas `numeric` (`nota_final`, `peso`, `nota_operacional`…) voltam como string, como no
  PostgREST. Violação de unique → 409 `23505`. Triggers emulados: `updated_at`, versão do
  `nutri_item_bank`. Tabelas desconhecidas → `[]`. As mutações ficam em memória até o próximo
  `GET /rest/v1/_reset` (recarrega as fixtures) ou reinício. `GET /rest/v1/_ids` devolve os ids úteis.
- **Storage**: upload (`POST/PUT /storage/v1/object/<bucket>/<path>`), URL assinada individual e em
  lote (`/object/sign/<bucket>[/<path>]`), remoção (`DELETE /object/<bucket>`), e qualquer `GET` de objeto
  devolve um PNG placeholder 400×300 (ou um PDF mínimo para `*.pdf`).
- **CORS** liberado para o cliente do navegador (`localhost:3000`).

Cada requisição é logada em uma linha (`método tabela status ms query`).

## Fixtures (resumo)

"Hoje" é calculado em `America/Sao_Paulo` ao carregar; a agenda cobre mês anterior, atual e próximo
com a rotação real (terça = produção; qua/qui simplificada; sex/sáb/dom completa, base 2026-09-22).
Dias passados estão `concluida` com auditoria vinculada (uma simplificada recente `nao_cumprida`);
hoje tem um rascunho do gerente na unidade/tipo previstos (etapa 1, 3 respostas) e um rascunho
nutricional de Moema Salão (43 itens pré-criados, 1ª área respondida com 2 não conformes);
4 auditorias nutricionais concluídas (Moema Salão ×2, Imigrantes ×2); uma completa com falha grave
(Mooca) e uma com produto vencido (Bela Vista); 5 pendências abertas (1 reincidente) + 2 resolvidas;
fechamento do mês anterior com ranking, 1 ajuste de pontualidade, indicadores 99Food de 3 lojas,
2 relatórios; um domingo de folga no próximo mês; uma troca manual de loja num dia futuro.
Rode `node scripts/preview/fixtures.mjs` para ver contagens e ids.
