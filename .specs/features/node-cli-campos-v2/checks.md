# Pacto: node-cli 0.55 e campos guiados checks

Build: `npx tsc --noEmit`
Run unit: `node --test --test-reporter=spec test/*.test.cjs`
Plan: `.specs/features/node-cli-campos-v2/plan.md`

## Intent

37 checks in 5 slices · 4 one-way doors · 0 open

## Checks

### S1 - Toolchain do node-cli 0.55.5 e entrega

**C1** - `npm run lint` roda `n8n-node lint` e sai com código 0 e 0 erros (hoje são 13 na `master`) (S1 AC 1)
Proof: `npm run lint`

**C2** - `npm run build` sai com código 0 e gera `dist/nodes/Pacto/Pacto.node.js`, `dist/credentials/PactoApi.credentials.js`, `pacto.svg` e `pacto.dark.svg` ao lado do node (S1 AC 2)
Proof: `npm run build && node --test --test-reporter=spec --test-name-pattern="\[C2\]" test/toolchain.test.cjs`

**C3** - O package.json tem `build` = `n8n-node build`, `lint` = `n8n-node lint`, `n8n.strict` verdadeiro, `@n8n/node-cli` 0.55.5 em devDependencies, nenhum `dependencies`, nenhum `gulp`, `funding` com tipo `individual` e a URL buymeacoffee.com/qTny0AzFXS, e `update:catalog` preservado (S1 AC 3)
Proof: run unit | ✔ [C3]

**C4** - `n8n-workflow` é `^2.46.5` em devDependencies, `*` em peerDependencies, e o lock resolve 2.46.5 ou mais nova (S1 AC 4)
Proof: run unit | ✔ [C4]

**C5** - O workflow de CI roda em `pull_request` e em push na `master`, com `npm ci`, `npm run lint`, `npm test`, `npm run build` e `node-version: 24` (S1 AC 5)
Proof: run unit | ✔ [C5]

**C6** - O workflow de publicação tem `workflow_dispatch`, a mesma `node-version` do CI, valida tag igual a `v` + versão, roda lint, test e build, e publica com `npx -y npm@12.2.2 stage publish --provenance --access public` com `RELEASE_MODE: 'true'` (S1 AC 6)
Proof: run unit | ✔ [C6]

**C7** - `npm test` compila e roda `node --test` sobre `test/*.test.cjs` (S1 AC 7)
Proof: run unit | ✔ [C7]

**C8** - O README tem as 15 seções do padrão (selo e Apoie o projeto, índice, Funcionalidades, Instalação, Credenciais, Nós e Operações, Usar como Tool de Agente de IA, exemplos, Desenvolvimento, Compatibilidade, Recursos, Publicação, Versões, Suporte, Licença), sem seção Trigger, e o número de operações do catálogo atual (S1 AC 8)
Proof: run unit | ✔ [C8]

### S2 - Versão 1 e catálogo regenerado sem perda

**C9** - Na versão 1, `GET:/psec/alunos/{id}` com `path__id` 42 chama `GET /psec/alunos/42` com a credencial `pactoApi` e `timeout` 30000 (S2 AC 1)
Proof: run unit | ✔ [C9]

**C10** - Na versão 1, `returnAll` com páginas de 100, 100 e 30 itens pede `page` 0, 1 e 2 com `size` 100 e devolve 230 itens (S2 AC 2)
Proof: run unit | ✔ [C10]

**C11** - Na versão 1 os parâmetros `resource`, `operation`, `fields` e `returnAll` mantêm `name` e `type` do 1.0.3 (S2 AC 3)
Proof: run unit | ✔ [C11]

**C12** - Todo par `area` + `key` do 1.0.3 existe no catálogo gerado, e o par ausente da documentação vem com `legacy: true` (S2 AC 4)
Proof: run unit | ✔ [C12]
Proof: run unit | ✔ [C12b]

**C13** - O gerador troca `ï¿½` pelo valor da área do 1.0.3 que casa (`Armï¿½rio` → `Armário`) e sai com código 1 listando o nome sem correspondência (S2 AC 5)
Proof: run unit | ✔ [C13]
Proof: run unit | ✔ [C13b]

**C14** - O catálogo carregado tem 0 áreas com `ï¿½` ou U+FFFD e mantém toda área do 1.0.3 que ainda tem operação (S2 AC 6)
Proof: run unit | ✔ [C14]

**C15** - A lista de operações da versão 2 omite as `legacy: true` e a da versão 1 as inclui (S2 AC 7)
Proof: run unit | ✔ [C15]

**C37** - O gerador usa o texto do 1.0.3 quando a documentação traz `ï¿½` no nome ou na descrição de uma operação que o 1.0.3 já publica, e conta os textos novos sem correspondência (S2 AC 8)
Proof: run unit | ✔ [C37]

**C36** - Um parâmetro de header que não é da credencial (ex.: `user-agent`) vai nos cabeçalhos da requisição, em vez de quebrar com `Cannot set properties of undefined` (S2 AC 1, achado do tsc estrito: o catálogo diz `header` e o objeto da requisição guarda `headers`)
Proof: run unit | ✔ [C36]

### S3 - IDs guiados na versão 2

**C16** - O node declara `version: [1, 2]` e `defaultVersion: 2` (S3 AC 1)
Proof: run unit | ✔ [C16]

**C17** - O gerador cria entrada de lista só para operação cujo primeiro parâmetro de caminho `{p}` tem `GET` na base com `page` e `size` e item com campo `p` e rótulo `nome`, `descricao`, `name` ou `titulo`, e imprime as bases descartadas com o motivo (S3 AC 2)
Proof: run unit | ✔ [C17]

**C18** - O gerador sai com código 1 e cita a rota quando uma entrada de lista aponta para rota ausente na documentação (S3 AC 3)
Proof: run unit | ✔ [C18]

**C19** - Na versão 2, `recordId` é `resourceLocator` com modos `list` (padrão, `searchable`, `searchListMethod: 'searchPactoRecords'`) e `id`, mostrado só nas operações com lista; o `resourceMapper` omite `path__<p>` dessas operações só na versão 2 (S3 AC 4)
Proof: run unit | ✔ [C19]

**C20** - Na versão 2, `recordId` `{ mode: 'list', value: '42' }` em `GET:/psec/alunos/{id}` chama `GET /psec/alunos/42` (S3 AC 5)
Proof: run unit | ✔ [C20]

**C21** - Na versão 2, `recordId` `{ mode: 'id', value: ' 42 ' }` chama `GET /psec/alunos/42` (S3 AC 6)
Proof: run unit | ✔ [C21]

**C22** - Na versão 2, `recordId` com `value` vazio lança `NodeOperationError` `Escolha um registro na lista ou cole o ID` com `itemIndex` 0 (S3 AC 7)
Proof: run unit | ✔ [C22]

**C23** - `searchPactoRecords` com o texto `ana` chama `GET /psec/alunos` com `page` 0, `size` 20, `filters` `{"quicksearchValue":"ana"}` e `timeout` 30000, e devolve `{ id: 42, nome: 'Ana Silva' }` como `{ name: 'Ana Silva', value: '42' }` e item sem `nome` como `{ name: '42', value: '42' }` (S3 AC 8)
Proof: run unit | ✔ [C23]

**C24** - A busca vai em `qs.quicksearchValue` quando a rota tem esse parâmetro, em `filters` quando só `filters` o cita, e no próprio node (sem maiúscula e sem acento) quando nenhum dos dois (S3 AC 9)
Proof: run unit | ✔ [C24]

**C25** - `paginationToken` some com `last: true`, com menos itens que `size` ou com `page + 1 >= totalPages`, e senão é a página seguinte em texto (20 itens, página 0 → `'1'`; 12 itens → sem token; `totalPages: 1` → sem token) (S3 AC 10)
Proof: run unit | ✔ [C25]

**C26** - Quando a resposta traz `number` ou `page`, o próximo `paginationToken` é esse número + 1 (S3 AC 11)
Proof: run unit | ✔ [C26]

**C27** - `searchPactoRecords` lança `NodeApiError` quando a listagem devolve `401` (S3 AC 12)
Proof: run unit | ✔ [C27]

**C28** - Na versão 2, `returnAll` pagina como na versão 1 (S3 AC 13)
Proof: run unit | ✔ [C28]

### S4 - Busca Rápida nos filtros

**C29** - `quickSearch` ("Busca Rápida") aparece na versão 2 só nas operações cuja descrição de `filters` cita `quicksearchValue` (S4 AC 1)
Proof: run unit | ✔ [C29]

**C30** - `quickSearch` `silva` com `query__filters` vazio envia `filters` `{"quicksearchValue":"silva"}` (S4 AC 2)
Proof: run unit | ✔ [C30]

**C31** - `quickSearch` `silva` com `query__filters` `{"situacoesEnuns":["AT"]}` envia `{"situacoesEnuns":["AT"],"quicksearchValue":"silva"}` (S4 AC 3)
Proof: run unit | ✔ [C31]

**C32** - `query__filters` que não é objeto JSON lança `NodeOperationError` `O campo Filters precisa ser um objeto JSON` (S4 AC 4)
Proof: run unit | ✔ [C32]

**C33** - `quickSearch` vazio envia `filters` exatamente como o usuário escreveu (S4 AC 5)
Proof: run unit | ✔ [C33]

### S5 - Lançamento 1.1.0

**C34** - O package.json tem versão 1.1.0 e a seção Versões do README lista node-cli, versão 2 do node, IDs guiados, Busca Rápida e as 131 operações preservadas (S5 AC 1)
Proof: run unit | ✔ [C34]

**C35** - O pacote 1.1.0 empacota o `dist` (`npm pack --dry-run` sai com 0 e lista o node, a credencial e os ícones) e o workflow de publicação aciona o `stage publish` na tag `v1.1.0`; a fila "Staged Packages" e a aprovação do dono acontecem depois do merge (S5 AC 2, parte local)
Proof: `npm pack --dry-run`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| parâmetros da versão 1 (4) | `resource` C11 · `operation` C11 · `fields` C11 · `returnAll` C11 | - |
| pares `area` + `key` do 1.0.3 (3533) | C12, table-driven sobre os 3533 pares do arquivo de linha de base | - |
| modos do Resource Locator `recordId` (2) | `list` C20 · `id` C21 | - |
| fontes de busca do seletor (3) | `query` C24 · `filters` C23 · sem busca na API C24 | - |
| regras de fim de lista (3) | `last: true` C25 · menos que `size` C25 · `page + 1 >= totalPages` C25 | - |
| entradas de `filters` com Busca Rápida (3) | vazio C30 · com JSON C31 · JSON inválido C32 | - |
| `searchPactoRecords` statuses (2) | 200 C23 · 401 C27 | - |
| node `pacto` statuses (2) | 200 C9 · 401 C27 | - |
| localização dos campos de entrada na requisição (4) | `path` C9 · `query` C10 · `header` C36 · `body` C9 | - |
| arquivos de publicação (2) | ci.yml C5 · publish.yml C6 | - |

- Claims naming a status code, route or response shape: C9, C20, C21, C23, C27 - each has a proof that crosses the boundary (o `execute` ou o `listSearch` com contexto falso que grava a requisição)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C22, C32
- failure modes: C27
- idempotency: n/a - o node repassa a requisição; a idempotência é da API Pacto
- authorization: C27
- concurrency: n/a - o node não guarda estado entre itens
- data lifecycle: C12
- dependency failure: C27
- state transitions: n/a - o node não tem estados
- observability: n/a - nenhum requisito de log nesta entrega

## Handoff

- **Settled mid-build:** nenhuma resposta nova do dono; o orquestrador fechou as três dúvidas abertas do plano (manter as operações legacy; paginação pelo número que a resposta devolve; IDs de query e corpo fora do escopo) e aprovou o plano com antecedência
- **Dispatched:** Verifier (sonnet, subagente novo) em `195d34b`, enviado depois do commit das provas
- **Boundary:** C1-C37 fechados em `195d34b`; `check_proofs.py` 40 pass, 0 fail
- **Abandoned:** nada; o erro TS2590 (união grande demais) do catálogo de 4.751 operações foi resolvido gerando o catálogo em pedaços de 500, sem mudar o contrato
- **Walked:** n/a - sem tela capturada
