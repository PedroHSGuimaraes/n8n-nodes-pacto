# n8n-nodes-pacto

Node community do [n8n](https://n8n.io/) para integrar seus fluxos com a
**[API Pacto Soluções](https://api-docs.pactosolucoes.com.br/)**, o sistema de gestão de
academias.

[![Apoie no Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-Apoie_o_projeto-FFDD00?logo=buy-me-a-coffee&logoColor=000000)](https://buymeacoffee.com/qTny0AzFXS)

O pacote lê o catálogo OpenAPI oficial da Pacto e oferece **um node unificado**, com seleção
**Área → Operação**, credencial própria, paginação, uso como Tool de IA e publicação no npm
com provenance.

[n8n](https://n8n.io/) é uma plataforma de automação de fluxos com
[licença fair-code](https://docs.n8n.io/reference/license/).

[Instalação](#-instalação) · [Credenciais](#-credenciais) · [Nós e Operações](#-nós-e-operações) ·
[Exemplos](#-exemplos) · [Tool de IA](#-usar-como-tool-de-agente-de-ia) ·
[Desenvolvimento](#️-desenvolvimento) · [Versões](#-versões) · [Apoie](#-apoie-o-projeto)

---

## 🚀 Funcionalidades

- **1 node unificado** — `Pacto`, com seleção **Área → Operação**.
- **Cobertura do catálogo** — 4.620 operações em 488 áreas na especificação oficial consultada em
  06/11/2026.
- **Registro por lista pesquisável** — em node novo (versão 2), as operações que recebem o ID de
  um registro (aluno, aula, aparelho, ativo do patrimônio…) mostram a lista da sua conta e
  aceitam colar o ID.
- **Busca Rápida** — nas listagens que aceitam o filtro `quicksearchValue`, digite o texto em vez
  de escrever JSON no campo `filters`.
- **Campos amigáveis** — cada operação mostra os campos com nome e descrição da API.
- **Datas com seletor** — campos de data usam o seletor de data do n8n.
- **Secret_Key segura** — fica nas credenciais criptografadas do n8n e vai como
  `Authorization: Bearer SECRET_KEY`.
- **Return All** — pagina as operações `GET` de listagem.
- **Usável como Tool de IA** — `usableAsTool: true`, para AI Agents chamarem as operações.
- **Workflows antigos continuam iguais** — o node tem as versões 1 e 2; workflow salvo na versão 1
  não muda.
- **Zero dependências de runtime** — usa só os helpers do próprio n8n.

## 📦 Instalação

Siga o [guia de community nodes](https://docs.n8n.io/integrations/community-nodes/installation/)
do n8n.

No n8n, abra **Settings → Community Nodes → Install** e informe:

```text
n8n-nodes-pacto
```

> Requer uma instância n8n com `n8nNodesApiVersion` 1.

## 🔑 Credenciais

Crie uma credencial **Pacto API**, informe o **Empresa ID** e cole a `Secret_Key`.

### Como gerar a Secret_Key

1. Entre no módulo administrativo da Pacto.
2. Abra **Configurações → Integrações**.
3. Selecione a empresa e avance.
4. Entre em **ADM → API Sistema Pacto**.
5. Clique em **Gerar credencial**.
6. Defina descrição, validade e escopos.
7. Copie a `Secret_Key` antes de concluir.

> A chave é exibida somente durante a geração. Quando a rede possui várias unidades, gere uma
> credencial para cada unidade.

A credencial tem teste embutido no endpoint oficial `GET /psec/credential-validator`. A validação
recebe a chave diretamente; as operações da API recebem o padrão Bearer definido pela OpenAPI. O
**Empresa ID** vai automaticamente no header `empresaId` em todas as requisições.

## 🧩 Nós e Operações

1. Adicione o node **Pacto**.
2. Escolha uma **Area**, como `Clientes`, `Plano`, `Produto`, `Negociação` ou `Agenda de Aulas`.
3. Escolha uma **Operation**. A lista mostra, por exemplo:

   ```text
   Consultar um aluno [GET]
   ```

4. Preencha os campos da operação. Em node novo, o ID do registro aparece como **Registro**.
5. Execute o node.

A descrição de cada operação informa o escopo e os parâmetros da OpenAPI. A
[documentação oficial](https://api-docs.pactosolucoes.com.br/) tem schemas, exemplos e regras de
negócio.

### Registro (versão 2)

Nas operações que recebem o ID de um registro no caminho da rota, o campo **Registro** tem dois
modos:

| Modo | Uso |
| --- | --- |
| **Da Lista** | Abre a lista da sua conta, com busca, e traz uma página por vez ao rolar |
| **Por ID** | Cola o ID (ou uma expressão) quando você já o conhece |

A lista vem da rota de listagem oficial da mesma entidade (por exemplo, `GET /psec/alunos` para
`/psec/alunos/{id}`). O gerador só liga a lista quando a documentação confirma a paginação
(`page` e `size`), o campo do ID e um campo de nome. Operações sem lista confirmada continuam com
o campo de ID em texto, dentro de **Fields**.

### Busca Rápida (versão 2)

Nas listagens cujo filtro aceita `quicksearchValue`, o campo **Busca Rápida** substitui o JSON.
Se o campo `filters` já tiver um objeto JSON, o node acrescenta o texto a ele.

## 💡 Exemplos

### Consultar um aluno

```text
Area: Clientes
Operation: Consultar um aluno [GET]
Registro: Da Lista → escolha o aluno
```

O **Empresa ID** vem da credencial e não precisa ser repetido.

### Listar alunos com busca

```text
Area: Clientes
Operation: Consultar alunos da academia [GET]
Busca Rápida: silva
Return All: ligado
```

O node envia `filters={"quicksearchValue":"silva"}` e pagina com `size` 100.

### Criar ou atualizar

Para operações `POST`, `PUT` ou `PATCH`, preencha os campos do formulário. O schema varia por
operação e o node monta o corpo sozinho.

## 🤖 Usar como Tool de Agente de IA

O node `Pacto` pode ser ligado ao conector **Tool** de um **AI Agent** no n8n.

No servidor self-hosted, habilite community nodes como tools:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

Depois:

1. Adicione um **AI Agent**.
2. Conecte um Chat Model.
3. No conector **Tool**, adicione o node **Pacto**.
4. Fixe **Area** e **Operation** para limitar o que o agente pode executar.
5. Use **Let the model define this** nos parâmetros que o modelo deve preencher.

Boas práticas:

- exponha uma operação por tool;
- use Secret_Key dedicada e escopos mínimos;
- não permita operações destrutivas sem confirmação humana.

## 🛠️ Desenvolvimento

```bash
npm install          # dependências
npm run build        # n8n-node build: tsc + cópia de ícones
npm test             # compila e roda node --test sobre o dist
npm run lint         # lint oficial do n8n (n8n-node lint)
npm run lint:fix
```

### Atualizar o catálogo oficial

```bash
npm run update:catalog
```

Exige Node 24 ou mais novo. O gerador (`scripts/update-pacto-catalog.mjs`):

1. descobre o bundle atual da documentação e lê o source map publicado;
2. extrai a OpenAPI oficial e monta `nodes/Pacto/helpers/catalog.generated.ts`;
3. **preserva o que o pacote já publicou**: operação que a documentação removeu fica marcada
   `legacy` (só a versão 1 do node a lista) e área com acento perdido volta ao nome antigo;
4. gera `nodes/Pacto/helpers/lookups.generated.ts` com as listas dos seletores e as operações
   com Busca Rápida, e imprime as bases que ficaram sem lista, com o motivo.

Melhorias de campo entram no gerador, nunca à mão nos arquivos `*.generated.ts`.

Estrutura:

```text
n8n-nodes-pacto/
├── credentials/PactoApi.credentials.ts
├── nodes/Pacto/
│   ├── helpers/        # catálogo e listas gerados, regras de ID e Busca Rápida
│   ├── methods/        # operações, mapeador de campos e lista do seletor
│   ├── transport/      # chamada HTTP com credencial e timeout
│   └── Pacto.node.ts
├── scripts/            # gerador do catálogo (catalog-builder.mjs e a casca)
├── test/               # node --test com contexto falso do n8n
└── .github/workflows/  # ci.yml e publish.yml
```

## ✅ Compatibilidade

- n8n Community Nodes API v1, compilado com `n8n-workflow` 2.47.
- Node.js 24 no CI e na publicação.
- API base: `https://apigw.pactosolucoes.com.br`; OpenAPI 3.0.1.
- Autenticação por `Secret_Key`.
- **Atualizando do 1.0.x:** workflows salvos continuam na versão 1 do node e enviam as mesmas
  requisições. Para usar o **Registro** e a **Busca Rápida**, adicione um node novo (versão 2).

## 📚 Recursos

- [Documentação da API Pacto](https://api-docs.pactosolucoes.com.br/)
- [Central de Ajuda Pacto — gerar Secret_Key](https://sistemapacto.zendesk.com/hc/pt-br/articles/51972391150355-Como-gerar-Credencial-Secret-Key-para-uso-da-API-do-Sistema-Pacto-Tela-nova)
- [Community nodes do n8n](https://docs.n8n.io/integrations/community-nodes/)

## 🚀 Publicação

A tag `vX.Y.Z` dispara o workflow `publish.yml`, que valida a tag contra a versão do
`package.json`, roda lint, testes e build e envia o pacote com `npm stage publish` e provenance. A
versão **fica em espera**: ela só vai ao ar depois que o dono a aprova, com 2FA, na aba **Staged
Packages** do npmjs.com.

## 📈 Versões

- **1.1.0** — **Registro por lista e Busca Rápida.** Chega a versão 2 do node: os IDs de caminho das
  operações com lista (aluno, aula, aparelho, ativo do patrimônio e outros) mostram a lista da
  conta e aceitam colar o ID; a Busca Rápida troca o JSON de `filters`. Migração para o
  `@n8n/node-cli` 0.55.5 (lint oficial sem erros, testes e CI), `n8n-workflow` 2.47, catálogo
  regenerado com 4.620 operações e as 131 operações removidas pela documentação preservadas
  (`legacy`) para workflows salvos. Corrige o cabeçalho que não é da credencial, que quebrava a
  execução.
- **1.0.1–1.0.3** — Nomes de operação simplificados, Empresa ID na credencial e seletor de data nos campos de data. Veja o histórico no Git.
- **1.0.0** — Lançamento: node unificado, catálogo OpenAPI, Secret_Key, paginação, AI Tool e npm
  provenance.

## 🆘 Suporte

Se algo não funcionar:

1. Confira o **Empresa ID** e a **Secret_Key** (o teste da credencial usa o endpoint oficial).
2. Verifique se a versão do n8n é compatível.
3. Consulte os logs do n8n para o erro da API.
4. Abra uma [issue no GitHub](https://github.com/PedroHSGuimaraes/n8n-nodes-pacto/issues).

## ☕ Apoie o projeto

Este node é mantido de forma independente. Se ele ajuda suas automações, você pode apoiar o
desenvolvimento e as novas integrações pelo
[Buy Me a Coffee](https://buymeacoffee.com/qTny0AzFXS).

## 📄 Licença

[MIT](LICENSE.md)
