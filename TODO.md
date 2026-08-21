# TODO.md — fw.webex (Próxima Geração)

> **Status da linha atual:** v0 congelada (manutenção apenas corretiva/crítica)
>  
> **Nova linha evolutiva:** próxima geração (sem compromisso de retrocompatibilidade com v0)
>  
> **Data de início:** 2026-05-24

---

## 1) Visão da Geração

Esta geração inicia uma nova arquitetura do fw.webex com foco em:
- inicializador de DOM configurável;
- externalização de JavaScript;
- modelo plugável para recursos e integrações;
- modelo de desenvolvimento MVC para WebEx;
- integração/renderização de dados vindos do MVC padrão Protheus/TOTVS e do modelo REST DNATech;
- exemplos reais de aplicações completas, além de exemplos isolados por componente;
- infraestrutura genérica de geração de PDF no navegador, reutilizável por
  diferentes features sem acoplamento entre domínios;
- bridge explícito e observável para a comunicação TWebChannel entre o
  documento FWWebEx e o host Protheus;
- encapsulamento de bibliotecas externas em features independentes por
  provider; ExifReader, jsPDF e PDF.js não pertencem ao domínio consumidor;
- qualidade operacional mínima (CI, catálogo de exemplos, geração de patch e governança de assets);
- fechamento orientado a prioridade dos TODOs legados críticos.

Fora de escopo imediato:
- migração automática completa de projetos v0;
- compatibilidade total e transparente entre v0 e nova geração.

---

## 2) Diretriz de Compatibilidade

- A versão **v0 está congelada** como baseline estável.
- A nova geração pode introduzir **breaking changes planejados**.
- A migração será tratada por documentação e guias (`MIGRATION.md`), não por camada de compatibilidade obrigatória.

---

## 3) Objetivos e Métricas

### Objetivos
- [x] Definir API de bootstrap (`FWWebEx.init(config)`) e lifecycle.
- [ ] Implementar arquitetura plugável mínima (registro + init de plugins).
- [ ] Externalizar JS por módulos (core + features).
- [ ] Publicar ao menos um exemplo real completo (e-shop piloto).
- [ ] Criar trilha mínima de qualidade operacional para exemplos, assets e release.
- [ ] Resolver TODOs P0/P1 com exemplos obrigatórios.

### Métricas
- TODOs P0 resolvidos: `2/6`
- TODOs P1 resolvidos: `0/13`
- TODOs P2 resolvidos: `0/5`
- Exemplos novos publicados: `6/9`
- Módulos migrados para modelo plugável: `0/1 (piloto)`

---

## 4) Backlog Priorizado

Legenda:
- Prioridade: P0 (crítico), P1 (alto), P2 (médio)
- Status: TODO | IN_PROGRESS | BLOCKED | DONE

| ID | Prioridade | Módulo | Item | Origem | Exemplo obrigatório | Status | Sprint |
|---|---|---|---|---|---|---|---|
| NX-000 | P0 | governança/release | Efetivar congelamento operacional da v0 (tag + branches + proteção) | `V0_FREEZE.md` | Não | TODO | S1 |
| NX-001 | P0 | core/table | Implementar carregamento real via AJAX | `src/fw.webex/core/component/fw.webex.table.tlpp` | Sim | TODO | S2 |
| NX-002 | P0 | contrib/datatable | Finalizar fluxo do datatable form e estabilizar uso | `src/fw.webex/contrib/fw.webex.datatable/fw.webex.datatable.form.tlpp` | Sim | DONE | S1 |
| NX-003 | P1 | features/markdown | Revisar TODOs de plugins markdown | `src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.markdown.tlpp` | Sim | TODO | S3 |
| NX-004 | P1 | tests/md | Corrigir cenário PageHeader/PageFooter | `src/fw.webex/tests/md/testemd.tlpp` | Não | TODO | S1 |
| NX-005 | P0 | core/bootstrap | Criar inicializador de DOM configurável com hooks | Novo | Sim | DONE | S1 |
| NX-006 | P0 | core/plugins | Definir registro e contrato mínimo de plugins | Novo | Sim | TODO | S2 |
| NX-007 | P1 | architecture/mvc | Criar modelo de desenvolvimento MVC para WebEx (convenções, lifecycle e responsabilidades) | Novo | Sim | TODO | S4 |
| NX-008 | P1 | integrations/protheus-mvc | Criar suporte para renderização de dados provenientes do MVC padrão Protheus/TOTVS | Novo | Sim | TODO | S4 |
| NX-009 | P1 | core/assets | Externalizar JavaScript inline crítico em módulos reutilizáveis (core runtime + features) | `src/fw.webex/core/component/fw.webex.page.tlpp`, `src/fw.webex/core/component/*`, `src/fw.webex/contrib/*` | Não | TODO | S5 |
| NX-010 | P1 | core/features | Revisar idempotência, prioridade, dependências e unload do registro de features/plugins | `src/fw.webex/contrib/fw.webex.features/core/fw.webex.features.tlpp`, `src/fw.webex/core/control/fw.webex.control.tlpp` | Não | TODO | S2 |
| NX-011 | P1 | core/webapp | Automatizar descoberta de `AppRootURI`/remote origin e reduzir dependência de configuração manual em `appserver.ini` | `src/fw.webex/core/tools/fw.webex.webapp.tools.tlpp`, `README.md` | Não | TODO | S5 |
| NX-012 | P2 | core/utils | Completar suporte do `ForEach` para `DNA.TECH.THASH`, `DNA.TECH.TFINI` e `DNA.TECH.THASH_TFINI` | `src/fw.webex/core/tools/extra/for.each.tlpp` | Não | TODO | S6 |
| NX-013 | P2 | docs/examples | Auditar catálogo de exemplos: títulos, READMEs, numeração, categoria e contador hardcoded | `src/fw.webex/tests/fw.webex.examples/000/fw.webex.example.000.tlpp`, `src/fw.webex/tests/fw.webex.examples/*/README.md` | Não | TODO | S5 |
| NX-014 | P1 | examples/real-app | Criar exemplo real completo de e-shop (catálogo, carrinho, checkout mock, pedidos e admin) | Novo | Sim | TODO | S5 |
| NX-015 | P1 | quality/ci | Criar esteira mínima de qualidade: validação de TODO/catalogo, checagem textual e compilação quando ambiente permitir | `.github/workflows`, `bin/check.hb`, `bin/commit.hb` | Não | TODO | S6 |
| NX-016 | P2 | release/patch | Atualizar e automatizar geração de `makepatch.lst` para refletir arquivos atuais do projeto | `bin/patches/makepatch.lst` | Não | TODO | S6 |
| NX-017 | P2 | core/assets | Definir governança de assets externos/CDN (versões fixas, fallback local, modo offline e SRI quando aplicável) | `src/fw.webex/contrib/fw.webex.features/features/*`, `src/fw.webex/core/component/fw.webex.page.tlpp` | Não | TODO | S5 |
| NX-018 | P1 | integrations/datatable | Padronizar contrato server-side de DataTable para Protheus REST (request, filtros, ordenação, paginação e response) | `src/fw.webex/contrib/fw.webex.datatable/fw.webex.datatable.tlpp`, exemplos 007/008/018/020/023 | Sim | TODO | S5 |
| NX-019 | P1 | security/render | Centralizar escaping/sanitização de conteúdo, atributos HTML e strings JS geradas pelo FWWebEx | `src/fw.webex/core/control/fw.webex.control.tlpp`, `src/fw.webex/contrib/fw.webex.datatable/fw.webex.datatable.form.tlpp` | Não | TODO | S6 |
| NX-020 | P2 | ux/i18n/a11y | Revisar acessibilidade, ARIA, mensagens e consistência PT-BR/EN nos componentes e exemplos | `src/fw.webex/core`, `src/fw.webex/contrib`, `src/fw.webex/tests/fw.webex.examples` | Não | TODO | S6 |
| NX-021 | P1 | integrations/dnatech-rest | Definir contrato/adaptador para dados vindos do modelo REST DNATech | `C:\GitHub\naldodj-tlpp\tlpp\wsrest\afx\wsrest`, exemplo 023 | Sim | TODO | S5 |
| NX-022 | P1 | features/pdf | Extrair jsPDF para uma feature genérica, reutilizável por Labels, Markdown e futuros módulos | `src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.jspdf.tlpp`, Labels e Markdown | Sim | IN_PROGRESS | S3 |
| NX-023 | P0 | core/twebchannel | Isolar o bridge TWebChannel no frame FWWebEx, remover a injeção de scripts privados do WebApp e oferecer fallback/configuração/diagnóstico | `src/fw.webex/core/component/fw.webex.page.tlpp`, exemplo 023 | Sim | IN_PROGRESS | S1 |

---

### 4.1) Detalhamento — NX-021 DNATech REST

Objetivo: criar uma fronteira explícita entre o FWWebEx e o modelo REST DNATech, evitando que componentes e exemplos dependam diretamente do formato bruto retornado por `userRestCrudTLPPCoreFunction`, `UserRestCrudTLPP` e `REST_userRestCrudADVPL`.

Contrato de request observado:
- executor: `FWWebEx.RequestHandler.execute()` via `CALLBACK_EXEC`/`CALLBACK_DATA_RESPONSE`;
- alvo: `ClassName: "userRestCrudTLPPCoreFunction"` e `FunctionName` como `dna.tech.codAliasPost`, `dna.tech.codAliasGet`, `dna.tech.codModelPost`, `dna.tech.keyAliasPost` ou equivalentes;
- seleção: `codAlias`/`keyAlias` ou `codModel`/`keyModel`;
- paginação: `PageNumber`, `RowspPage`, `ignoreRowspPage`;
- projeção e filtros: `yesFields`, `noFields`, `tokenFields`, `Filter`, `Filter64`;
- ambiente/autorização: `cEmp`, `cFil`, `lChkPrepEnv`, `setAuthorization`;
- saída: `setContentType`, `setEmptyFields`, `getRecNo`, `getQuery`, `getFilter`, `getDeleted`, `setUTF8`, `setNoAccent`, `setTrimSpace`, `lHTTPCTLen`, `lHTTPCTType`, `lFWHTTPEncode`.

Contrato de response observado:
- raiz: `method`, `path`, `PageNumber`, `RowspPage`, `TotalRows`, `TotalPages`, `hasNextPage`, `NextPage`, `model`;
- tabela: `table.alias`, `table.name`, `table.description`, `table.index`, `table.filter`, `table.query`, `table.items`;
- linha: `table.items[].detail.row`, `HasError`, `key`, `recNo`, `isDeleted`, `error`, `items`;
- dados planos para UI: `table.items[].detail.items`.

Adaptador esperado:
- receber o response DNATech bruto e devolver `{ rows, meta, errors, raw }`;
- preencher `rows` com o flatten de `table.items[].detail.items`;
- preencher `meta` com paginação, totais, alias, modelo, índice, filtro aplicado e query quando presentes;
- preencher `errors` com linhas cujo `detail.HasError` seja verdadeiro;
- expor helper para DataTables com `{ data, recordsTotal, recordsFiltered }`;
- expor helper para `wsAction`/menus e painéis que não sejam DataTable;
- manter fallback seguro para responses incompletos, strings JSON e arrays vazios.

Critério de aceite:
- exemplo 023 deixa de mapear manualmente `json.table.items.map(row => row.detail?.items || {})` e usa o adaptador;
- `WebExDataTable` ou feature equivalente consegue consumir a resposta DNATech por contrato normalizado;
- fixtures em `data/json/turnovergeral*.json` cobrem o shape `table.items[].detail.items`;
- documentação inclui exemplo mínimo de request/response e relação com `NX-018`;
- erros por linha (`HasError`/`error`) não somem silenciosamente.

### 4.2) Detalhamento — NX-022 Feature genérica jsPDF

Objetivo: disponibilizar a infraestrutura jsPDF como uma feature FWWebEx
genérica, sem conhecimento de rótulos, Markdown ou qualquer outro domínio
consumidor.

Arquivo principal novo:

- `src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.jspdf.tlpp`

Fronteiras de responsabilidade:

- [x] Criar `WebExFeatureJsPDF` seguindo o lifecycle e o padrão das demais
  features FWWebEx.
- [x] Fixar a versão do jsPDF no runtime compartilhado.
- [x] Garantir carregamento idempotente; várias features consumidoras não podem
  injetar a biblioteca mais de uma vez.
- [x] Expor uma API pública para verificar disponibilidade/readiness e criar
  uma instância de documento sem depender de Labels ou Markdown.
- [x] Manter a feature genérica sem contrato de rótulos, código de barras,
  templates, Markdown, CSS de documento ou paginação específica de consumidor.
- [x] Manter JsBarcode sob responsabilidade de Labels.
- [x] Tratar `html2canvas`, DOMPurify e outras dependências da renderização HTML
  como capacidades opcionais e explícitas, sem carregá-las para consumidores
  que utilizem somente as primitivas do jsPDF.
- [x] Não confundir jsPDF, usado para autoria/geração, com PDF.js, usado para
  visualização de PDFs já produzidos.
- [x] Adotar versão sem vulnerabilidades conhecidas aplicáveis ao uso no
  FWWebEx e tratar upgrades como mudança testada do runtime compartilhado.

API JavaScript alvo:

```javascript
FWWebEx.PDF.isReady()
FWWebEx.PDF.create(documentOptions)
FWWebEx.PDF.renderElement(elementOrHtml, options) // capacidade HTML opcional
```

Visualização/rasterização separada da autoria:

- [x] Criar `WebExFeaturePDFJS` em arquivo próprio, sem dependência de Labels
  ou Markdown.
- [x] Fixar PDF.js e worker na mesma versão e publicar a API independente
  `FWWebEx.PDFViewer`.
- [x] Aceitar `ArrayBuffer`/`TypedArray`, rasterizar uma página em canvas e
  oferecer readiness, cancelamento e descarte explícito.
- [x] Manter `WebExFeatureJsPDF` responsável por autoria e
  `WebExFeaturePDFJS` responsável somente por visualização de PDFs prontos.
- [ ] Substituir os assets CDN por política local/offline, SRI e CSP conforme
  o item `NX-017`.

Integração com Labels:

- [x] Fazer `WebExFeatureLabels` depender de `WebExFeatureJsPDF` em vez de
  injetar jsPDF diretamente.
- [x] Manter no recurso Labels o contrato, layout, texto, barcode e o renderer
  especializado de rótulos.
- [x] Manter `WebExLabelPDFGenerator` como API headless de domínio, construída
  sobre a feature genérica.
- [x] Confirmar que Labels não duplica URL, versão, readiness ou lifecycle do
  jsPDF.

Integração opcional com Markdown:

- [ ] Criar um adaptador Markdown -> PDF fora da feature genérica, consumindo o
  DOM/HTML produzido por `WebExFeatureMarkDown`.
- [ ] Avaliar `jsPDF.html()` com dependências HTML opcionais e documentar o
  subconjunto de CSS efetivamente suportado.
- [ ] Definir política explícita para sanitização, imagens externas/CORS,
  carregamento de fontes, links, tabelas e blocos de código.
- [ ] Mapear `PageBreak`, margens, cabeçalho e rodapé do Markdown para uma
  política de paginação própria do adaptador.
- [ ] Não criar dependência entre Markdown e Labels.
- [ ] Não prometer equivalência visual com `window.print()` antes de concluir
  testes comparativos.

Testes e critérios de aceite:

- [ ] Uma página mínima cria, baixa e obtém `blob`/`arraybuffer` usando somente
  `WebExFeatureJsPDF`.
- [x] Labels continua gerando os fixtures de rótulos após remover sua injeção
  direta do jsPDF.
- [ ] Labels e Markdown habilitados simultaneamente carregam uma única instância
  da biblioteca.
- [ ] O adaptador Markdown gera título, parágrafos, listas, tabela, imagem,
  código e quebra de página em um teste representativo.
- [ ] Falhas de dependência, imagem, fonte ou HTML produzem erro descritivo, e
  não um PDF silenciosamente incompleto.
- [x] O README da feature genérica documenta API, versão, capacidades
  opcionais, limitações e exemplos mínimos.
- [x] O README de Labels descreve somente sua integração, sem duplicar a
  documentação da infraestrutura jsPDF.
- [ ] Quando o adaptador Markdown -> PDF for implementado em `NX-003`, atualizar
  o README de Markdown sem criar dependência com Labels.

O núcleo reutilizável de `NX-022` está concluído: a feature genérica, sua
capacidade HTML opcional, o consumo por Labels, readiness, sanitização, testes
de fronteira e documentação foram entregues. O item permanece `IN_PROGRESS`
até receber um exemplo direto, uma prova real de saída e o adaptador Markdown
-> PDF, que continua deliberadamente separado de Labels e relacionado a
`NX-003`.

### 4.3) Detalhamento — NX-023 Bridge TWebChannel

Diagnóstico arquitetural:

- o WebApp/TWebEngine pode preparar o transporte no documento pai, mas o HTML
  FWWebEx executa em um `iframe` com outro objeto global;
- carregar `totvstec.js` e `fwprotheus.js` novamente no documento filho
  duplica partes privadas do bootstrap da plataforma e não é um contrato
  estável;
- somente o provider público `twebchannel.js` deve ser obtido pelo documento
  FWWebEx quando `window.twebchannel` ainda não estiver disponível nele.

Implementação:

- [x] Remover a injeção incondicional de `totvstec.js`, `fwprotheus.js` e
  `twebchannel.js` do cabeçalho de toda `WebExPage`.
- [x] Criar `FWWebEx.TWebChannel` com `load`, `connect`, `send`, receptor
  multiplexado, estado e erros tipados.
- [x] Tornar o receptor aditivo: `true` marca a mensagem como tratada e
  `false` preserva a delegação ao `advplToJs` anterior.
- [x] Reutilizar um provider já publicado no frame e serializar tentativas
  concorrentes de carga/conexão.
- [x] Oferecer `forceReconnect` somente como recuperação explícita, sem
  reiniciar o transporte preparado pela plataforma no fluxo normal.
- [x] Resolver a origem por configuração, asset do ambiente Protheus e CDN
  versionado, nessa ordem.
- [x] Corrigir a documentação do `appserver.ini`: `GetAPPRoot` e autenticação
  leem `[FWWEBEX_<GetEnvServer()>]`, e não `[FWWEBEX]`.
- [x] Migrar `FWWebEx.RequestHandler` e o exemplo 023 para a API do bridge.
- [x] Serializar requests por `callbackEvent`, aplicar `responseTimeout` de 30
  segundos por padrão e limpar listeners/timers em todos os desfechos.
- [x] Documentar configuração local/offline e roteiro de diagnóstico no frame.
- [x] Executar a suíte isolada do bridge e do `RequestHandler`: 21 testes
  aprovados em
  `src/fw.webex/core/tests/twebchannel-bridge.test.mjs`.
- [ ] Validar o fluxo no WebApp real antes de alterar o status para `DONE`.

Critérios de aceite:

- uma página que não usa comunicação ADVPL não injeta os três scripts;
- uma página que usa o bridge carrega no máximo uma instância do provider;
- a seção `[FWWEBEX_<ENVIRONMENT>]` corresponde ao retorno de
  `GetEnvServer()` para que `AppRootURI` permita localizar o asset da
  plataforma;
- o FWWebEx não depende nem injeta `totvstec.js` ou `fwprotheus.js`; eventual
  uso desses arquivos é interno à plataforma;
- falhas expõem código, causa e estado observável, sem polling disperso no
  consumidor;
- timeout de resposta emite `FWWEBEX_TWEBCHANNEL_RESPONSE_TIMEOUT`, libera a
  fila correspondente e não deixa listener pendente;
- budgets compartilhados de carga/conexão e deadlines individuais preservam
  consumidores concorrentes sem duplicar scripts ou conexões;
- o exemplo 023 recebe `CALLBACK_RESPONSE` e entrega os dados ao DataTable pelo
  `EventTarget` do bridge.

## 5) Definition of Ready (DoR)

Um item entra em sprint quando:
- possui critério funcional objetivo;
- impacto técnico foi mapeado (core, contrib, docs e testes);
- há estratégia de teste local definida;
- se alterar comportamento: existe plano de exemplo e documentação.

## 6) Definition of Done (DoD)

Um item só pode ser concluído quando:
- [ ] Implementação finalizada.
- [ ] Testes/checagens locais executados.
- [ ] Documentação atualizada (README/changelog/TODO).
- [ ] Exemplo criado/atualizado (quando aplicável).
- [ ] Impacto de migração documentado em `MIGRATION.md`.

---

## 7) Plano de Sprint

### Sprint 1 — Fundação e primeira entrega visível

Objetivo: estabelecer a base arquitetural e concluir um TODO crítico com exemplo.

Escopo:
1. NX-005: inicializador de DOM configurável (`init`, `ready`, hooks principais). **DONE**
2. NX-002: concluir datatable form. **DONE**
3. NX-004: corrigir teste markdown de header/footer.
4. Criar 2 exemplos para datatable (mínimo e realista). **DONE**
5. Atualizar documentação de uso da feature. **DONE**

Critério de aceite:
- 100% dos itens P0 planejados da sprint concluídos;
- exemplos executáveis adicionados;
- testes da área alterada executados.

### Sprint 2 — Plugabilidade e núcleo de tabela

Objetivo: consolidar arquitetura plugável e resolver TODO crítico do core/table.

Escopo:
1. NX-006: registro e ciclo de vida de plugins (piloto).
2. NX-010: revisar idempotência, prioridade, dependências e unload de features/plugins.
3. NX-001: carregamento AJAX real em tabela.
4. Integração plugin piloto + datatable.
5. Atualização de guia de migração para mudanças técnicas.

### Sprint 3 — Features e qualidade

Objetivo: reduzir dívida técnica de markdown e elevar robustez.

Escopo:
1. NX-022: extrair jsPDF para feature genérica e validar o consumo por Labels.
2. NX-003: revisar TODOs de Markdown e avaliar o adaptador Markdown -> PDF.
3. Ajustes de estilo/comportamento associados.
4. Revisão final de exemplos e testes das features.

### Sprint 4 — MVC e integração Protheus/TOTVS

Objetivo: definir um modelo MVC próprio para WebEx e criar a ponte inicial com dados do MVC padrão Protheus/TOTVS.

Escopo:
1. NX-007: especificar convenções de Model, View e Controller para WebEx.
2. NX-007: criar exemplo mínimo de aplicação MVC WebEx.
3. NX-008: definir contrato/adaptador para dados vindos do MVC Protheus/TOTVS.
4. NX-008: criar exemplo de renderização usando dados compatíveis com o MVC padrão Protheus/TOTVS.

Critério de aceite:
- contrato MVC documentado;
- exemplo executável de MVC WebEx;
- exemplo executável de renderização a partir de dados do MVC Protheus/TOTVS;
- impacto de migração documentado em `MIGRATION.md`, se houver mudança de contrato público.

### Sprint 5 — Exemplos reais e contratos de integração

Objetivo: sair dos exemplos isolados por componente e publicar uma aplicação piloto que mostre o FWWebEx em fluxo real.

Escopo:
1. NX-014: criar exemplo real de e-shop com dados mockados/local fixtures.
2. NX-018: padronizar contrato server-side de DataTable para Protheus REST.
3. NX-021: definir contrato/adaptador para dados vindos do modelo REST DNATech.
4. NX-009: iniciar externalização de JavaScript inline mais crítico.
5. NX-011: reduzir dependência de `AppRootURI` manual.
6. NX-013: auditar catálogo de exemplos e corrigir títulos/numeração/categorias.
7. NX-017: definir política de assets externos/CDN e fallback local.

Critério de aceite:
- exemplo de e-shop executável e registrado no menu de exemplos;
- catálogo, carrinho, checkout mock e administração de pedidos/produtos demonstrados;
- README do e-shop explicando dados, fluxo e pontos do FWWebEx usados;
- contrato DataTable server-side documentado com exemplo de request/response;
- contrato/adaptador DNATech REST documentado e aplicado ao exemplo 023;
- catálogo de exemplos sem contador manual inconsistente.

### Sprint 6 — Qualidade operacional e hardening

Objetivo: preparar o projeto para crescer com menos regressão e menos acoplamento manual.

Escopo:
1. NX-015: criar workflow/checklist mínimo de qualidade.
2. NX-016: automatizar geração/atualização da lista de patch.
3. NX-019: centralizar escaping/sanitização de renderização.
4. NX-020: revisar acessibilidade, ARIA e consistência de idioma.
5. NX-012: completar suporte pendente do `ForEach`.

Critério de aceite:
- checagens locais/CI documentadas;
- `makepatch.lst` reproduzível a partir do estado atual do projeto;
- helpers de escaping disponíveis para conteúdo, atributo e JS;
- pelo menos um exemplo validando os helpers críticos;
- documentação atualizada com limites conhecidos.

---

## 8) Notas da Análise Ampla

Achados principais desta revisão:
- os exemplos atuais cobrem bem componentes isolados, mas ainda falta uma aplicação real de ponta a ponta;
- o catálogo de exemplos é manual (`nExamples:=30`) e alguns READMEs/títulos precisam revisão;
- há bastante JavaScript inline em core/contrib, reforçando a necessidade de externalização gradual;
- features usam muitas URLs CDN diretas, o que pede política para ambiente corporativo/offline;
- o modelo REST DNATech já entrega um shape rico (`table.items[].detail.items`, metadados de tabela e paginação), mas os exemplos ainda fazem flatten manual;
- a geração de patch ainda referencia uma lista antiga de arquivos e precisa acompanhar a nova estrutura;
- existem TODOs reais em tabela, markdown, WebApp/AppRoot e `ForEach`;
- jsPDF é infraestrutura transversal e não deve permanecer versionado ou
  injetado por uma feature de domínio como Labels;
- segurança de renderização merece helpers centrais para evitar escaping duplicado por componente.

## 9) Política de Evolução

- v0 permanece disponível como referência estável.
- Nova geração evolui com versionamento próprio.
- Breaking changes devem ser documentados previamente.
- Cada alteração estrutural relevante precisa de impacto descrito no `MIGRATION.md`.
