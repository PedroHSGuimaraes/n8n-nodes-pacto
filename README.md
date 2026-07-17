# n8n-nodes-pacto

Node community do [n8n](https://n8n.io/) para integrar workflows com a
**[API Pacto Soluções](https://api-docs.pactosolucoes.com.br/)**.

O pacote usa o catálogo OpenAPI oficial da Pacto e mantém a mesma experiência do projeto
`n8n-nodes-rd-station-crm`: um node unificado, credencial própria, seleção
**Área → Operação**, suporte a paginação, arquivos, AI Tool, build TypeScript e publicação npm
com provenance.

[Instalação](#-instalação) · [Credencial](#-credencial) ·
[Como usar](#-como-usar) · [Parâmetros](#-parâmetros) ·
[Paginação](#-paginação) · [AI Tool](#-usar-como-tool-de-agente-de-ia) ·
[Desenvolvimento](#️-desenvolvimento)

---

## 🚀 Funcionalidades

- **1 node unificado** — `Pacto`, com seleção **Área → Operação**.
- **Cobertura integral do catálogo** — 3.499 operações únicas, 3.077 rotas e 408 áreas/tags
  presentes na especificação oficial consultada em 17/07/2026.
- **Catálogo pesquisável** — cada operação mostra nome, método HTTP e rota.
- **Secret_Key segura** — armazenada nas credenciais criptografadas do n8n e enviada como
  `Authorization: Bearer SECRET_KEY`.
- **Campos amigáveis** — cada operação mostra campos de formulário com nomes e descrições da API.
- **Sem JSON manual** — path, query, headers e body são montados automaticamente pelo node.
- **Paginação Return All** — compatível com os padrões `page`/`size` e configurável para outros
  nomes e formatos de resposta.
- **Downloads binários** — PDF, Excel, imagens e outros arquivos podem ser gravados em uma
  propriedade binária do n8n.
- **Usável como Tool de IA** — `usableAsTool: true`, permitindo chamadas por AI Agents.
- **Atualização reproduzível** — `npm run update:catalog` lê a OpenAPI publicada no frontend
  oficial e regenera o catálogo local.
- **Zero dependências de runtime** — usa somente APIs do Node.js e helpers nativos do n8n.

## 📦 Instalação

Siga o [guia de community nodes](https://docs.n8n.io/integrations/community-nodes/installation/)
do n8n.

No n8n, abra **Settings → Community Nodes → Install** e informe:

```text
n8n-nodes-pacto
```

## 🔑 Credencial

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

A credencial possui teste embutido no endpoint oficial
`GET /psec/credential-validator`. A validação recebe a chave diretamente; as operações da API
recebem o padrão Bearer definido pela OpenAPI. O **Empresa ID** é enviado automaticamente no
header `empresaId` em todas as requisições.

## 🧩 Como usar

1. Adicione o node **Pacto**.
2. Selecione uma **Area**, como `Clientes`, `Plano`, `Produto`, `Negociação` ou
   `Agenda de Aulas`.
3. Selecione uma **Operation**. O dropdown mostra, por exemplo:

   ```text
   Consultar cliente por código [GET /v1/cliente/{codigo}]
   ```

4. Preencha os parâmetros exigidos pela operação.
5. Execute o node.

A descrição de cada operação informa o escopo e os parâmetros obrigatórios disponíveis na
OpenAPI. Consulte a [documentação oficial](https://api-docs.pactosolucoes.com.br/) para schemas,
exemplos e regras de negócio.

### Exemplo — consultar cliente por código

Selecione:

```text
Area: Clientes
Operation: Consultar cliente por código [GET /v1/cliente/{codigo}]
```

No campo **Código**, informe `12345`. O **Empresa ID** vem da credencial e não precisa ser
repetido na operação.

### Exemplo — consultar clientes com filtros

Selecione uma operação de consulta e preencha os campos de paginação e filtro exibidos no
formulário.

Algumas rotas da Pacto recebem `filters` como uma string JSON codificada na query. Nesses casos,
o valor interno precisa ser serializado, como no exemplo.

### Exemplo — criar ou atualizar

Para operações `POST`, `PUT` ou `PATCH`, preencha os campos do formulário. O schema exato varia
por operação e o node monta o corpo automaticamente.

## 🧱 Parâmetros

| Campo | Uso |
| --- | --- |
| **Campos da operação** | Campos específicos da rota, gerados a partir da documentação oficial |
| **Empresa ID** | Configurado uma vez na credencial e enviado automaticamente |

O header `Authorization` informado manualmente é removido. A autenticação sempre vem da
credencial selecionada.

### Respostas em arquivo

Em **Options**:

1. Defina **Response Format → File**.
2. Escolha o nome da **Binary Property** — padrão `data`.
3. Informe **File Name** e **MIME Type**, quando necessário.

## 📚 Paginação

Ative **Return All** somente em operações `GET`.

Padrões:

| Opção | Padrão |
| --- | --- |
| Initial Page | `0` |
| Page Parameter | `page` |
| Page Size Parameter | `size` |
| Page Size | `100` |
| Max Pages | `1000` |

O node detecta arrays diretos e propriedades comuns: `content`, `data`, `items`, `results` e
`records`. Se a lista estiver em outro local, configure **Results Property** com dot notation,
por exemplo `data.items`.

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
- fixe `empresaId` quando o agente sempre atuar na mesma unidade;
- não permita operações destrutivas sem confirmação humana.

## 🛠️ Desenvolvimento

```bash
npm install
npm run build
npm run lint
npm run format
```

### Atualizar catálogo oficial

```bash
npm run update:catalog
npm run format
npm run build
```

O gerador:

1. descobre o bundle atual da documentação;
2. lê o source map publicado pelo frontend;
3. extrai a OpenAPI oficial;
4. gera `nodes/Pacto/helpers/catalog.generated.ts`;
5. preserva métodos, rotas, tags, escopos, parâmetros e content types.

Estrutura:

```text
n8n-nodes-pacto/
├── credentials/
│   └── PactoApi.credentials.ts
├── nodes/Pacto/
│   ├── helpers/
│   │   ├── catalog.generated.ts
│   │   └── utils.ts
│   ├── methods/loadOptions.ts
│   ├── transport/index.ts
│   └── Pacto.node.ts
├── scripts/update-pacto-catalog.mjs
└── .github/workflows/publish.yml
```

## 🚢 Publicação

O workflow **Publish to npm** replica o projeto RD Station:

- dispara em tags `v*` ou manualmente;
- usa Node.js 20;
- instala com `npm ci --ignore-scripts`;
- executa build;
- publica com `npm publish --provenance --access public`;
- usa o secret `NPM_TOKEN`.

## ✅ Compatibilidade

- n8n Community Nodes API v1;
- Node.js 20 no workflow de publicação;
- API base: `https://apigw.pactosolucoes.com.br`;
- OpenAPI 3.0.1;
- autenticação por `Secret_Key`.

## 📚 Recursos

- [Documentação da API Pacto](https://api-docs.pactosolucoes.com.br/)
- [Central de Ajuda Pacto — gerar Secret_Key](https://sistemapacto.zendesk.com/hc/pt-br/articles/51972391150355-Como-gerar-Credencial-Secret-Key-para-uso-da-API-do-Sistema-Pacto-Tela-nova)
- [Community nodes do n8n](https://docs.n8n.io/integrations/community-nodes/)

## 📈 Versões

- **1.0.0** — lançamento inicial: node unificado, catálogo OpenAPI completo, Secret_Key, path/query/header/body, paginação, upload/download binário, AI Tool e npm provenance.

## 📄 Licença

[MIT](LICENSE.md)
