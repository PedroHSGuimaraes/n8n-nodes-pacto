# node-cli-campos-v2 verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 195d34b
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `npm run lint` (exit code 0 decide) | yes |
| C2 | `toolchain.test.cjs` `[C2] o build gera o node, a credencial e os ícones no dist` | yes |
| C3 | `toolchain.test.cjs` `[C3] o package.json usa n8n-node, strict, funding e não tem dependencies nem gulp` | yes |
| C4 | `toolchain.test.cjs` `[C4] n8n-workflow é ^2.46.5 em dev, * no peer e o lock resolve 2.46.5 ou mais nova` | yes |
| C5 | `toolchain.test.cjs` `[C5] o CI roda em pull_request e push na master com npm ci, lint, test e build no Node 24` | yes |
| C6 | `toolchain.test.cjs` `[C6] a publicação usa stage publish, valida a tag e usa o mesmo Node do CI` | yes |
| C7 | `toolchain.test.cjs` `[C7] npm test compila e roda node --test sobre test/*.test.cjs` | yes |
| C8 | `toolchain.test.cjs` `[C8] o README tem as seções do padrão, o selo, o índice e o número atual de operações` | yes |
| C9 | `node-v1.test.cjs` `[C9] busca um aluno pelo ID de caminho com credencial e timeout` | yes |
| C10 | `node-v1.test.cjs` `[C10] returnAll pede page 0, 1 e 2 com size 100 e junta 230 itens` | yes |
| C11 | `node-v1.test.cjs` `[C11] mantém name e type dos parâmetros do 1.0.3 para a versão 1` | yes |
| C12 | `catalogo.test.cjs` `[C12] preserva todo par area+key do 1.0.3...` e `[C12b] o catálogo gerado contém todos os 3533 pares do 1.0.3` | yes |
| C13 | `catalogo.test.cjs` `[C13] troca o nome com caractere de substituição pelo valor do 1.0.3` e `[C13b] o gerador sai com código 1 e lista o nome sem correspondência` | yes |
| C14 | `catalogo.test.cjs` `[C14] o catálogo carregado não tem área com ï¿½ e mantém as áreas do 1.0.3` | yes |
| C15 | `versoes.test.cjs` `[C15] a lista da versão 2 omite as operações legacy e a da versão 1 as inclui` | yes |
| C16 | `versoes.test.cjs` `[C16] declara version [1, 2] e defaultVersion 2` | yes |
| C17 | `catalogo.test.cjs` `[C17] cria lista só quando há GET paginado com campo do ID e rótulo, e explica o que descartou` | yes |
| C18 | `catalogo.test.cjs` `[C18] recusa uma lista que aponta para rota ausente na documentação` | yes - o claim agora diz só que `assertLookupRoutes` lança citando a rota; o código de saída 1 é do C13b |
| C19 | `ids.test.cjs` `[C19] recordId tem modos list (padrão, pesquisável) e id...` | yes |
| C20 | `ids.test.cjs` `[C20] usa o ID escolhido na lista como ID de caminho` | yes |
| C21 | `ids.test.cjs` `[C21] usa o ID colado e remove os espaços das pontas` | yes |
| C22 | `ids.test.cjs` `[C22] recusa recordId vazio com a mensagem em português` | yes |
| C23 | `ids.test.cjs` `[C23] busca alunos com o texto em filters e devolve nome e valor` | yes |
| C24 | `ids.test.cjs` `[C24] escolhe onde vai a busca: query, filters ou o próprio node` | yes |
| C25 | `ids.test.cjs` `[C25] decide se há próxima página pelo fim da lista` | yes |
| C26 | `ids.test.cjs` `[C26] segue o número de página que a resposta devolve` | yes |
| C27 | `ids.test.cjs` `[C27] lança NodeApiError quando a listagem devolve 401` | yes |
| C28 | `ids.test.cjs` `[C28] returnAll na versão 2 pagina como na versão 1` | yes |
| C29 | `busca.test.cjs` `[C29] aparece na versão 2 só nas operações cujo filters cita quicksearchValue` | yes |
| C30 | `busca.test.cjs` `[C30] com filters vazio envia só o quicksearchValue` | yes |
| C31 | `busca.test.cjs` `[C31] junta o texto ao JSON que já estava em filters` e `achados.test.cjs` `[C31b] mantém o filtro que chega como objeto (expressão) e ignora Busca Rápida só de espaços` | yes - o `[C31b]` afirma a string exata com o objeto e `filters` intacto com espaços; ver o achado novo sobre `quickSearch` que não é texto |
| C32 | `busca.test.cjs` `[C32] recusa filters que não é objeto JSON quando há Busca Rápida` | yes |
| C33 | `busca.test.cjs` `[C33] com Busca Rápida vazia envia filters exatamente como a pessoa escreveu` | yes |
| C34 | `toolchain.test.cjs` `[C34] a versão é 1.1.0 e a seção Versões lista as mudanças` | yes |
| C35 | `toolchain.test.cjs` `[C35] o pacote 1.1.0 empacota o node, a credencial e os ícones, e o publish aciona o stage na tag` | yes - lê `npm pack --dry-run --json` e afirma a versão e os 6 caminhos |
| C36 | `node-v1.test.cjs` `[C36] envia no cabeçalho um parâmetro de header que não é da credencial` | yes |
| C37 | `catalogo.test.cjs` `[C37] usa o texto do 1.0.3 para o mesmo campo e conta o que ficou sem correspondência` | yes |
| C38 | `achados.test.cjs` `[C38] erro 401 da API chega do execute como NodeApiError` | yes |
| C39 | `achados.test.cjs` `[C39] operação com corpo JSON envia o corpo montado e o Content-Type` | yes |
| C40 | `achados.test.cjs` `[C40] o seletor mostra o ID quando o rótulo vem vazio e ignora token de página inválido` | yes |
| C41 | `achados.test.cjs` `[C41] o teste da credencial tem timeout` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| `mergeQuickSearch` apaga os filtros do usuário quando `query__filters` chega como objeto ou número (por expressão) e há Busca Rápida; texto só com espaços vira `quicksearchValue` de espaços | exemplo descartável: `query__filters` `{situacoesEnuns:['AT']}` + `quickSearch` `silva` envia só `{"quicksearchValue":"silva"}`; `'   '` envia `{"a":1,"quicksearchValue":"   "}`; `versionedInputs.ts` só lê `filters` se `typeof === 'string'` | aceitar objeto simples, lançar `O campo Filters precisa ser um objeto JSON` para número ou lista, tratar `quickSearch` só com espaços como vazio; testes com `filters` objeto e espaços | `03019bf` - `mergeQuickSearch` aceita objeto, rejeita número/lista e ignora espaços; C31b prova |
| O 401 no `execute` vira `NodeOperationError`, mas a Surface do plano diz `NodeApiError`; a Coverage cita C27, que só prova `searchPactoRecords` | exemplo descartável: responder 401 no `execute` lança `NodeOperationError` (`instanceof NodeApiError` falso, `httpCode` indefinido); o `catch` de `Pacto.node.ts` reembrulha tudo | relançar o `NodeApiError` sem reembrulhar (ou corrigir a Surface) e acrescentar teste do 401 no `execute` | `03019bf` e `42599cb` - o `catch` do `execute` mantém o `NodeApiError` com o código HTTP; C38 prova |
| C18 mais frouxo que o critério | `catalogo.test.cjs`: `assert.throws(() => assertLookupRoutes(...), /\/nao-existe/)` não roda o gerador; o critério exige saída com código 1 | rodar `update-pacto-catalog.mjs` com spec que gera lista para rota ausente e afirmar `status` 1 e a rota em `stderr` | `03019bf` - o claim do C18 passou a dizer o que o teste prova (o `assertLookupRoutes` lança citando a rota) e aponta o C13b para a saída com código 1 do gerador; nenhuma entrada real de lista pode apontar para rota ausente, porque o gerador só cria lista a partir de rota `GET` que existe |
| C35 mais frouxo que o critério | proof `npm pack --dry-run` só decide por código de saída; não afirma `Pacto.node.js`, `PactoApi.credentials.js`, `pacto.svg` | afirmar, na saída do pack, os caminhos do node, da credencial e dos ícones | `03019bf` - o C35 agora afirma o `npm pack --dry-run --json` com node, credencial, 4 ícones e a tag do publish; C35 prova |
| Coverage diz que `body` é provado por C9, mas nenhum teste envia corpo | C9 é um `GET` sem corpo; `createRequest` (JSON e `x-www-form-urlencoded`) não tem teste | teste de um `POST` com corpo JSON e outro com form-urlencoded, afirmando o `body` e o `Content-Type` | `03019bf` - C39 prova o corpo JSON e o `Content-Type`; o ramo `x-www-form-urlencoded` não tem operação no catálogo atual (0 de 4.620), então não há como exercitá-lo; fica registrado e coberto se o catálogo passar a ter uma |
| Na versão 2, 6 áreas só têm operação `legacy` e aparecem no seletor `resource` com a lista de operações vazia | dist: `clientes-geral-controller`, `empresa-json-controle`, `Integração Olympia`, `log-controller`, `Selfloops`, `Token Segurança` têm 0 operações vivas | filtrar essas áreas da versão 2 ou registrar a decisão no plano | `03019bf` - registrado no `Out of scope` do plano; a área vazia na versão 2 não dá erro |
| `searchPactoRecords` devolve `name` vazio quando o rótulo é texto vazio e gera `paginationToken` `NaN` com token inválido | exemplo descartável: item `{id:0, nome:''}` vira `{name:'', value:'0'}`; token `'abc'` devolve `paginationToken: 'NaN'` | usar o ID quando o rótulo é vazio; tratar token não numérico como página 0 | `03019bf` - o seletor usa o ID quando o rótulo é vazio e trata token inválido como página 0; C40 prova |
| A chamada de teste da credencial não tem `timeout` | `credentials/PactoApi.credentials.ts`: `test.request` sem `timeout` (herdado do 1.0.3) | acrescentar `timeout: 30000` ou registrar a exceção no plano | `03019bf` - `test.request.timeout` 30000; C41 prova |
| `mergeQuickSearch` quebra com `TypeError` quando `quickSearch` não é texto (número ou nulo vindo de expressão); antes da correção funcionava | exemplo descartável no HEAD 429c963: `quickSearch` 123 lança `quickSearch.trim is not a function`; `null` lança `Cannot read properties of null (reading 'trim')`; `versionedInputs.ts` chama `quickSearch.trim()` sem converter | converter com `String(quickSearch ?? '')` antes do `trim()` e acrescentar teste com número e `null` | `FIXHASH` - `String(quickSearch ?? '').trim()`; o teste [C31b] cobre número e null |
