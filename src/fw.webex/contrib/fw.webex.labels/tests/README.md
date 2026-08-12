# Baseline de testes do FWWebEx Labels

Esta pasta protege os casos mínimos definidos no `TODO.md` durante a reescrita
do contrato e do renderer. A suíte não depende de pacotes externos nem executa
o jsPDF real; ela valida os dados de entrada, o runtime JavaScript embutido e os
oráculos geométricos que os testes do núcleo e do PDF devem reutilizar.

## Estrutura

Cada caso possui três arquivos:

- `layout.json`: contrato público entregue ao componente;
- `records.json`: registros puros usados para resolver os templates;
- `expected.json`: resultado observável esperado, sem dados internos do
  renderer.

Casos iniciais:

- `v1-minimal`: contrato v1 pequeno, sem background;
- `v1-background-data-uri`: preservação byte a byte de um PNG embutido;
- `v1-asymmetric-rotation`: página 100 x 60 mm, marcadores assimétricos nos
  quatro cantos e um elemento com rotação própria;
- `v1-product-min-font`: regressão de `height: 3`, `padding: 1` e
  `minFontSize: 8`.

`manifest.json` é a lista explícita de casos. Novas fixtures devem ser
adicionadas ao manifesto para serem carregadas pela suíte.

Suítes executáveis:

- `fixture-baseline.test.mjs`: fixtures e oráculos estáveis;
- `runtime-contract.test.mjs`: normalização v1, issues estruturados e valores
  zero, filtragem de metadados do editor e ordem canônica do background;
- `designer-canonical.test.mjs`: DOM mínimo offline para o designer, migração
  v1, round-trip v2 sem campos flat enumeráveis, valores zero, operações de
  edição/duplicação/trava/container, configuração de página, descoberta de
  variáveis, teclado/referência, importação de background com metadados,
  fallback proporcional, undo e proteção contra corridas assíncronas;
- `designer-smart-snap.test.mjs`: API pública pura, prioridade das origens,
  vencedor independente por eixo, tolerância conforme zoom, histerese de
  `1,5x`, suspensão com `Alt`, feedback transitório, guias canônicas e baseline
  de textos sem rotação;
- `designer-sample-records.test.mjs`: geração determinística de registros a
  partir de variáveis, templates e formatos de barcode, mesclagem aditiva de
  caminhos aninhados, preservação de valores manuais e integração do fluxo
  automático/botão/evento no designer;
- `designer-arrange.test.mjs`: motor puro de alinhamento, posicionamento em
  quatro direções, alinhamento transversal, igualação, distribuição com
  referência fixa, subárvores de containers, overflow atômico e integração do
  menu/posicionamento encadeado do designer;
- `designer-tabs.test.mjs`: agrupamento funcional da barra, painel esquerdo,
  inspetor e drawer inferior, contrato ARIA por instância, navegação por clique
  e teclado, ocultação e minimização independentes de Elementos, reajuste do
  canvas, recolhimento do painel inferior e ordem responsiva;
- `initial-config-escaping.test.mjs`: transporte do JSON inicial entre TLPP e
  JavaScript, contagem literal de barras, proteção de `</script>` e diagnóstico
  separado para layout, dados e opções;
- `contract-hardening.test.mjs`: imutabilidade, versão/schema, caminhos
  seguros, JSON bruto, JSON Pointer, insets por lado, fluxo/margens/ordem de
  containers, regras AUTO, templates, área segura e variáveis
  aninhadas/default;
- `renderer-critical.test.mjs`: execução completa do renderer com fakes
  determinísticos, cobrindo o limite de fonte do produto, `clip`, `ellipsis`,
  texto vazio, fallback de fonte, barcode vetorial, checksum EAN13, quiet zones,
  módulos mínimos, múltiplos registros, background e matrizes de rotação.
- `layout-engine-parity.test.mjs`: API pública pura do motor de layout,
  hierarquia recursiva, ordem explícita, atribuição, duplicação, remoção e
  translação de subárvores;
- `geometry-box-model.test.mjs`: caixas externas, margens, áreas úteis,
  mínimos estruturais, alinhamento com margens assimétricas e compressão
  limitada, inclusive aninhada, de containers sem dimensões degeneradas;
- `diagnostics-grouping.test.mjs`: preservação das ocorrências brutas,
  deduplicação exata e agrupamento visual por causa, elemento e registros;
- `designer-product.test.mjs`: shell, API e CSS autocontidos do produto
  `WebExLabelDesigner`;
- `generator-panel.test.mjs`: configuração TLPP, delegação ao renderer,
  isolamento e erros estruturados do painel gerador;
- `examples-products.test.mjs`: exemplos 031/032 mínimos e paridade exata de
  layout e registros;
- `designer-isolation-performance.test.mjs`: duas instâncias no mesmo
  documento e orçamento determinístico de serialização durante o arraste com
  um background Data URI de 2 MiB;
- `designer-print-preview.test.mjs`: canvas PDF.js, viewport/matriz nas quatro
  rotações, descarte de geração/raster obsoleto, debounce e fallback para
  Design;
- `dependency-boundaries.test.mjs`: versões fixadas e separação entre a
  dependência genérica jsPDF, o adaptador HTML opcional, ExifReader e
  JsBarcode;
- `visual-raster.opt-in.test.mjs`: comparação raster real entre PDF e canvas
  para 0, 90, 180 e 270 graus, com arte assimétrica e barcode vetorial.

Com exceção do teste `visual-raster.opt-in`, essas suítes são offline. O teste
visual é ignorado por padrão e nunca baixa nem executa dependências na suíte
normal.

## Execução

Na raiz do repositório:

```powershell
node --test "src/fw.webex/contrib/fw.webex.labels/tests/*.test.mjs"
```

## Comparação raster real (opt-in)

O teste visual usa as URLs fixadas no próprio código FWWebEx para jsPDF e
JsBarcode, carrega PDF.js apenas no harness e executa tudo em Chromium. Ele
gera um PDF real em cada rotação, rasteriza sua primeira página e compara os
pixels com um canvas independente que contém:

- marcadores grandes, coloridos e assimétricos;
- página de 100 x 60 mm;
- um CODE128 sem texto legível, desenhado a partir dos módulos retornados pelo
  JsBarcode.

Requisitos opcionais:

```powershell
npm install --no-save playwright@1.55.0
npx playwright install chromium
$env:FWWEBEX_LABELS_VISUAL="1"
node --test "src/fw.webex/contrib/fw.webex.labels/tests/visual-raster.opt-in.test.mjs"
```

Também é possível reutilizar um Chromium/Chrome/Edge instalado, sem baixar o
navegador do Playwright:

```powershell
$env:FWWEBEX_LABELS_BROWSER="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
```

Esse fluxo requer acesso a `cdn.jsdelivr.net`. A ausência de Playwright,
Chromium ou rede só produz falha quando o opt-in foi explicitamente ativado.
Na execução padrão, o teste aparece como ignorado.

## Como reutilizar no núcleo

Os testes da futura API devem consumir os mesmos arquivos, sem copiar seus
layouts:

1. `contract.normalize()` recebe `layout.json`;
2. `contract.validate()` recebe o layout e `records.json`;
3. `renderer.generate()` usa as rotações de
   `v1-asymmetric-rotation/expected.json`;
4. o teste de round-trip compara o Data URI com igualdade estrita;
5. o teste de texto confirma que a fonte final nunca fica abaixo de 8 pt e que
   o overflow é reportado com `elementId`, caminho, mensagem e sugestão.

A seleção do runtime compartilhado usa `function normalizeLayout` junto da
publicação de `FWWebExLabels.renderer.generate`, evitando confundir o bloco do
designer com o bloco canônico registrado por `WebExFeatureLabels`.

Os arrays de matriz seguem a ordem `[a, b, c, d, e, f]` apenas como oráculo
matemático. A implementação jsPDF deve criar `pdf.Matrix` e aplicar a
transformação uma única vez em `advancedAPI`.
