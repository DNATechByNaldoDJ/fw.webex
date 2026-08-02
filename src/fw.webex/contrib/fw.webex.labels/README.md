# FWWebEx Labels

Componentes FWWebEx para desenhar rotulos e gerar PDFs no navegador.

- `WebExLabelDesigner`: editor visual baseado em milimetros e estado canonico v2. Permite imagem de fundo,
  campos de texto e codigo de barras, arraste, redimensionamento, bloqueio,
  duplicacao, selecao multipla/por area, alinhamento, copia de estilo, camadas,
  historico, grid, snap, referencia, zoom, dados reais, preview e exportacao JSON.
- `WebExLabelGeneratorPanel`: produto visual autocontido para editar as entradas,
  validar, visualizar, baixar e imprimir.
- `WebExLabelPDFGenerator`: combina o layout com um ou mais objetos de dados e gera
  uma pagina por registro com jsPDF e JsBarcode.
- `WebExFeatureJsPDF`: feature generica que registra jsPDF e expoe
  `FWWebEx.PDF`.
- `WebExFeaturePDFJS`: feature generica e separada que rasteriza PDFs prontos
  em canvas por `FWWebEx.PDFViewer`.
- `WebExFeatureLabels`: depende da feature generica e registra somente JsBarcode
  e os assets especificos de rotulos.

A separacao permite reutilizar jsPDF em outros dominios sem depender de Labels.
Para converter DOM/HTML (inclusive a saida renderizada de Markdown), a capacidade
opcional `WebExFeatureJsPDFHTML` adiciona html2canvas e DOMPurify. O adaptador de
Markdown para PDF deve permanecer fora de Labels e tratar explicitamente
paginacao, fontes, imagens/CORS e as limitacoes de CSS do renderer HTML.

jsPDF, PDF.js, JsBarcode e as dependências opcionais de HTML têm versões fixadas, mas
são carregados atualmente por `cdn.jsdelivr.net`. Ambientes sem acesso ao CDN
precisam da futura política de fallback local/offline acompanhada por `NX-017`.

## Componentes FWWebEx

O designer e o painel gerador renderizam seu proprio DOM e seus estilos. Uma
pagina consumidora nao deve criar toolbar, stage, inspetor, textareas ou funcoes
JavaScript auxiliares:

```tlpp
WITH WEBEXOBJECT CLASS WebExLabelDesigner ARGS 100,60
    .:SetLayout(cLayoutJSON)
    .:SetRecords(cRecordsJSON)
    .:SetOptions('{"showToolbar":true,"showLayers":true}')
END WEBEXOBJECT

WITH WEBEXOBJECT CLASS WebExLabelGeneratorPanel
    .:SetLayout(cLayoutJSON)
    .:SetRecords(cRecordsJSON)
    .:SetFileName("rotulos.pdf")
    .:SetOptions('{"rotation":0}')
END WEBEXOBJECT
```

`SetLayout` e `SetOptions` aceitam string ou `JSONObject`. `SetRecords` aceita
string, array ou JSON. IDs internos nao sao exigidos; todos os controles sao
resolvidos dentro da raiz da propria instancia. Duas instancias podem coexistir
na mesma pagina.

Opcoes do designer: `showToolbar`, `showLayers`, `showInspector`,
`showDrawers`, `drawersCollapsed`, `elementsCollapsed`, `elementsMinimized`, `tabs`,
`autoSampleRecords` e `fileName`.
Por compatibilidade, `showLayers: false` oculta todo o painel esquerdo,
incluindo a aba Adicionar.
O editor visual oferece os
modos `Design`, `Dados` e `Impressao`. O modo Dados resolve os templates usando
o registro corrente; o
modo Impressao gera um `ArrayBuffer` pelo renderer final e rasteriza a página
selecionada em um canvas com PDF.js. O overlay permanece em coordenadas-fonte e
recebe a mesma matriz global usada pelo PDF em 0, 90, 180 e 270 graus; assim,
caixas, guias, handles, marquee e arraste continuam expressos em milímetros.
Mudanças confirmadas são consolidadas por debounce, e gerações ou rasters
obsoletos são cancelados/ignorados. Se a rasterização falhar, o componente volta
ao modo Design, publica `fwwebex:label-error` e mostra o erro real. Enquanto o textarea do contrato estiver
alterado, atualizacoes visuais nao sobrescrevem o texto pendente. Validacao e
preview usam exatamente esse JSON pendente.

### Organização da interface

O Designer separa as funcionalidades sem duplicar controles ou regras:

- a barra compacta mantém modos, desfazer/refazer, zoom, validação e preview;
- `Documento`, `Seleção` e `Visualização` agrupam as demais ferramentas;
- o painel esquerdo alterna entre `Adicionar` e `Camadas`;
- o inspetor divide propriedades em `Elemento`, `Geometria`, `Aparência`,
  `Layout` e `Código de barras`, ocultando categorias incompatíveis com o tipo;
- o painel inferior, recolhível e redimensionável, alterna entre `Dados`,
  `Contrato` e `Problemas`. O badge de Problemas informa erros e avisos sem
  trocar a aba automaticamente.

As abas usam `tablist`, `tab` e `tabpanel`, possuem IDs locais à instância e
aceitam setas, `Home` e `End`. A troca é estado transitório da interface: não
altera layout, registros, histórico nem o estado `dirty` do contrato. A partir
de 900 px, o workspace mantém a ordem **Elementos | rótulo | Inspetor**. O botão
**Ocultar Elementos**, no cabeçalho do rótulo, remove temporariamente a coluna
esquerda e amplia a área central; o mesmo botão permite reabri-la. O botão
**Recolher**, no próprio painel Elementos, mantém uma faixa lateral de 48 px com
o controle de expansão. Assim, ocultar e minimizar são preferências transitórias
independentes. Abaixo de 900 px, o recolhimento preserva apenas o cabeçalho em
largura total; canvas, elementos e propriedades seguem em uma única coluna.

O estado inicial pode ser configurado sem editar o contrato:

```javascript
designer.setOptions({
  drawersCollapsed: true,
  elementsCollapsed: true,
  elementsMinimized: false,
  tabs: {
    toolbar: "document",
    sidebar: "layers",
    inspector: "element",
    drawers: "data"
  }
});

designer.selectTab("drawers", "problems", true);
designer.setElementsCollapsed(false);
designer.setElementsMinimized(true);
const activeTabs = designer.getActiveTabs();
```

Valores aceitos: `toolbar` (`document`, `selection`, `view`), `sidebar`
(`add`, `layers`), `inspector` (`element`, `geometry`, `appearance`, `layout`,
`barcode`) e `drawers` (`data`, `contract`, `problems`).

O menu compacto **Configurar pagina** altera largura, altura, rotacao de saida,
margens por lado, area segura, o valor de sangria mantido como metadado, passo
do grid e tolerancia do snap sem editar JSON. Ajuste, opacidade e bloqueio do
background tambem estao disponiveis na barra. A API JavaScript equivalente
aceita tanto a assinatura legada
`designer.setPage(width, height, rotation)` quanto um objeto completo:

```javascript
designer.setPage({
  width: 100,
  height: 60,
  rotation: 90,
  margins: {top: 1, right: 1, bottom: 1, left: 1},
  safeArea: 2,
  bleed: 0
});
```

Atalhos principais:

- `Shift+clique` e arraste em area vazia: selecao multipla;
- setas: mover 0,1 mm; `Shift + setas`: mover 1 mm;
- `Delete`: excluir; `Ctrl+D`: duplicar;
- `Ctrl+Z` / `Ctrl+Y`: desfazer/refazer;
- `Alt` durante o arraste: suspender o snap.

A árvore de camadas pode ser filtrada por ID, nome, tipo ou mnemônico. A ação
**Travar + referência** bloqueia o elemento corrente e o mantém como âncora
magnética; `Esc` encerra o posicionamento encadeado sem remover a referência.

### Dados de exemplo

Quando os registros estão vazios, o designer mantém **Dados JSON para validação
e preview** sincronizado com a evolução do layout. Mnemônicos declarados em
`variables` ou encontrados nos templates são acrescentados automaticamente. A
primeira edição manual do textarea desliga essa sincronização para que o JSON,
inclusive enquanto estiver incompleto, nunca seja reescrito pelo designer.

O botão **Gerar / completar dados** lê o JSON visível e acrescenta somente os
caminhos ausentes em cada registro. Valores existentes são preservados sem
exceção, incluindo `null`, string vazia, `0` e `false`. Caminhos aninhados são
criados quando possível; se um segmento intermediário já for um valor escalar,
o conflito é informado sem substituí-lo. O valor sugerido segue a ordem
`variable.example`, `variable.default`, tipo declarado, formato do código de
barras e, por último, nome amigável ou mnemônico. Assim, os exemplos continuam
genéricos e não embutem regras de produto, volume ou espécie.

Por padrão, o botão também reativa a sincronização para as próximas alterações
do layout. Defina `autoSampleRecords: false` nas opções para impedir a geração
automática; o botão permanece disponível para uma mesclagem pontual. A mesma
operação pode ser usada sem o componente visual:

```javascript
const result = FWWebExLabels.contract.createSampleRecords(layout, records);
// result.records: cópia preenchida
// result.added, result.preserved, result.conflicts e result.warnings: diagnóstico
```

### Organização e posicionamento

O menu compacto **Organizar seleção** aparece quando há seleção múltipla. No
modo de posicionamento encadeado ele também permanece disponível para configurar
direção, gap e alinhamento transversal antes de adicionar o próximo componente.
As ações disponíveis são:

- alinhar esquerda, centro, direita, topo, meio, base ou baseline;
- posicionar acima, abaixo, à esquerda ou à direita da referência;
- usar alinhamento transversal `start`, `center`, `end` ou `stretch`;
- distribuir três ou mais elementos horizontal ou verticalmente por gaps iguais;
- igualar largura, altura ou ambas.

A referência magnética explícita tem prioridade sobre o elemento primário da
seleção e nunca é movida. Alvos travados são preservados e informados no status.
Quando um container é movido, sua subárvore acompanha o deslocamento uma única
vez; igualação de tamanho também atualiza `basisBox`, para que o tamanho não seja
perdido no próximo reflow. Filhos de containers continuam sujeitos ao fluxo do
container na validação e no PDF; para organizá-los de forma persistente, ajuste
`direction`, `gap`, `crossAlign`, `mainAlign` e `sizing` da área e use
**Reorganizar área**.

O designer calcula o resultado em uma cópia antes de aplicá-lo. Se alguma caixa
ultrapassar a página ou a área útil do container, solicita confirmação e mantém
o estado anterior quando a operação é cancelada. A API pura equivalente aceita
comandos diretos ou um objeto descritivo:

```javascript
const result = FWWebExLabels.layout.arrange(
  layout,
  ["produto", "lote", "validade"],
  "distribute-vertical",
  {referenceId: "produto"}
);

const positioned = FWWebExLabels.layout.arrange(layout, ["lote"], {
  operation: "position",
  direction: "below",
  referenceId: "produto",
  gap: 1,
  crossAlign: "start"
});
```

`layout.align()`, `layout.position()`, `layout.distribute()` e
`layout.matchSize()` são aliases da mesma operação pura. O retorno contém o
layout candidato, `changedIds`, `skippedIds` e `overflowIds`.

### Snap inteligente

Durante o arraste, o designer escolhe um vencedor independente para cada eixo.
As origens obedecem à seguinte prioridade:

1. referência magnética ativa;
2. container pai;
3. guia manual;
4. demais elementos visíveis;
5. grid;
6. página, margens e área segura.

A tolerância configurada permanece em pixels e é convertida para milímetros de
acordo com o zoom corrente. Depois da captura, a origem permanece ativa até
`1,5x` essa tolerância, evitando oscilações entre candidatos; uma origem de
prioridade superior ainda pode assumir o eixo. `Alt` suspende temporariamente o
snap. Linhas e mensagens transitórias identificam a origem vencedora e a
correção aplicada em milímetros, sendo removidas ao terminar ou cancelar o
arraste.

Textos sem rotação também oferecem a primeira baseline calculada pela mesma
regra canônica usada pelo renderer. As entradas de `editor.guides`, por exemplo
`{"axis":"x","position":20}`, são metadados canônicos de edição e participam
do snap, mas não alteram validação, métricas ou PDF. A interface ainda não
oferece criação ou arraste de guias manuais; também não exibe gaps nem desenha a
sangria no canvas.

Eventos do designer: `fwwebex:label-change`, `fwwebex:label-selection`,
`fwwebex:label-dirtychange`, `fwwebex:label-datachange`,
`fwwebex:label-arrange`,
`fwwebex:label-validation`, `fwwebex:label-preview`,
`fwwebex:label-generated` e `fwwebex:label-error`. O painel gerador emite
`fwwebex:label-generator:result` e `fwwebex:label-generator:error`.

O contrato exportado usa `schema: "fwwebex.labels"`, `version: 2`,
`page.width`, `page.height` e coordenadas em milimetros. O carregamento continua
aceitando contratos v1 e os migra em memoria; a serializacao sempre produz v2.
O bloco `editor` e normalizado somente com `grid`, `snap` e `guides`, nunca
interfere na validacao de impressao ou no PDF, e `background` e serializado como
a ultima propriedade de nivel superior para manter o contrato legivel mesmo
quando contem uma Data URI extensa.
Os valores dinamicos usam `{{campo}}` ou caminhos como
`{{produto.codigo}}`. Rotacoes de pagina aceitas: `0`, `90`, `180` e `270`;
a rotacao propria do elemento aceita qualquer angulo em graus.

O componente nao contem regras para volume, especie, produto ou qualquer modelo de
rotulo. Cada elemento descreve suas proprias restricoes:

- Texto: `style` controla fonte, padding, margin e alinhamentos; `fit` separa
  autoajuste (`mode`) de excesso (`overflow`).
- Codigo de barras: `format`, `fallbackFormat`, `quietZone`, `minModuleWidth`,
  `displayValue`, tipografia do texto legivel, `textMargin`, `overflow` e
  `barcodeOptions`.

`format` aceita diretamente qualquer simbologia suportada pelo JsBarcode. Quando
o designer escolhe `AUTO`, a selecao e feita exclusivamente pelas regras
`barcodeAutoRules` exportadas no proprio layout. Cada regra pode combinar
`length`, expressao regular em `pattern` e `format`; o fallback tambem pertence
ao layout ou ao elemento. Nao existe mapeamento de simbologia fixo no gerador.
`barcodeOptions` repassa opcoes adicionais ao JsBarcode. Para textos,
`textOptions` repassa opcoes adicionais ao jsPDF, evitando limitar o contrato as
propriedades conhecidas hoje pelo componente.

`variables` registra os mnemonicos disponiveis, rotulo amigavel, tipo, valor
padrao, exemplo e obrigatoriedade. Os elementos podem combinar esses mnemonicos
livremente em seus templates. `example` é apenas uma sugestão para os dados de
teste; não altera validação nem impressão.

O alinhamento do conteudo e independente da posicao da caixa. `align` aceita
`left`, `center`, `right` e `justify`; `verticalAlign` aceita `top`, `middle` e
`bottom`. Assim, qualquer combinacao horizontal/vertical pode ser definida por
elemento.

Para texto, `fit.mode` aceita `none` ou `shrink`, enquanto `fit.overflow`
aceita `error`, `clip` ou `ellipsis`. O motor nunca reduz a fonte abaixo de
`minFontSize`. Para barcode, `overflow` aceita `error` ou `allow`: `allow`
mantem a geracao, mas produz um aviso estruturado quando o modulo fica abaixo de
`minModuleWidth`.

Veja os exemplos `031` (designer) e `032` (gerador).

No designer, `Shift+clique` adiciona ou remove elementos da selecao. O ultimo
elemento selecionado e a referencia para alinhamento e copia de estilo. Elementos
bloqueados podem servir de referencia, mas nao sao movidos ou alterados por essas
operacoes.

Alinhamento e empilhamento sao operacoes diferentes. Alinhar iguala um eixo e
pode sobrepor elementos. Empilhar usa o primeiro elemento selecionado como ancora
e posiciona os seguintes em sequencia, somando as dimensoes e o espacamento em
milimetros. O fluxo pode ser vertical ou horizontal e permite alinhar ou esticar
os elementos no eixo transversal.

## Areas de layout

Um elemento `container` delimita uma area e referencia seus filhos por
`containerId`. Ele configura:

- `direction`: `vertical` ou `horizontal`;
- `padding` e `gap`, em milimetros;
- `crossAlign`: inicio, centro, fim ou `stretch`;
- `sizing`: `none`, `shrink`, `equal` ou `distribute`;
- `mainAlign`: `start`, `center`, `end` ou `space-between`;
- `overflow`: `error`, `visible` ou `clip`;
- `clipChildren`: recorte fisico dos filhos no PDF.

O designer calcula as coordenadas para visualizacao e as salva no JSON. Antes de
gerar cada PDF, o gerador reaplica o contrato do container. Assim, uma alteracao
programatica no tamanho, espacamento ou estrategia tambem e respeitada sem abrir
novamente o designer.

`shrink` reduz o eixo principal proporcionalmente quando falta espaco. `equal`
divide a area igualmente. `distribute` preserva as dimensoes e distribui o espaco
livre entre os filhos. O autoajuste do texto e do codigo de barras continua sendo
executado dentro da caixa final de cada filho.

`WebExFeatureLabels` registra uma única instância do runtime compartilhado.
`WebExLabelDesigner`, `WebExLabelGeneratorPanel` e a fachada headless
`WebExLabelPDFGenerator` usam esse mesmo contrato, layout e renderer; o exemplo
031 apenas fornece a configuração demonstrativa.

## API JavaScript

O gerador headless registra:

```javascript
const labels = window.FWWebExLabels;

const normalized = labels.contract.normalize(layoutV1OuV2);
const serialized = labels.contract.serialize(normalized);
const structural = labels.contract.validate(serialized, records);

const result = await labels.renderer.generate(serialized, records, {
  rotation: 90,
  output: "blob",
  returnResult: true
});
```

O motor de layout tambem e publico e suas mutacoes sao puras:

```javascript
const flowed = labels.layout.resolve(layout, records);
const assigned = labels.layout.assign(layout, ["produto"], "area-dados");
const copied = labels.layout.duplicate(layout, ["area-dados"]);
const removed = labels.layout.remove(layout, ["area-dados"]);
const moved = labels.layout.translate(layout, "area-dados", {dx: 2, dy: 1});
```

O resolvedor de snap também é público e puro:

```javascript
const snapped = labels.snap.resolve(layout, {
  elementId: "produto",
  position: {x: 20.4, y: 12.2},
  excludeIds: ["produto"],
  pixelsPerMm: 4,
  latch: {x: null, y: null},
  metricsById: {}
});

console.log(snapped.position, snapped.winners.x, snapped.winners.y);
```

`FWWebExLabels.snap.resolve()` não modifica o layout recebido. `winners.x` e
`winners.y` informam separadamente origem, âncoras, coordenada-alvo, distância e
correção; `latch` deve ser reapresentado durante o mesmo arraste para preservar
a histerese. `disabled: true` produz a posição original sem vencedores.

`layoutEngine` e um alias de compatibilidade para `layout`. As operacoes mantem
`containerId` e `layout.children` sincronizados. Duplicar um container clona
toda a subarvore; remover usa cascata por padrao; mover um container desloca a
subarvore uma unica vez. `locked` bloqueia interacoes de edicao, mas nao altera
o reflow deterministico usado pelo PDF.

`contract.validate()` valida contrato, dados e geometria estrutural. Para uma
validacao identica ao preview/impressao, incluindo reflow de containers,
medicao de fontes e codificacao real dos barcodes, use
`renderer.generate(..., {output: "none", returnResult: true})`.

`result.report` contem `valid`, `errors`, `warnings`, `issues` e `metrics`.
Cada issue informa `code`, `severity`, `path` (JSON Pointer), `elementId`,
`recordIndex`, `phase`, `message`, `suggestion` e `details`.

Saidas suportadas:

- `output: "pdf"`: devolve a instancia jsPDF;
- `output: "blob"`, `"arraybuffer"` ou `"datauristring"`: devolve o formato
  solicitado;
- `output: "none"`: executa todo o pipeline sem produzir uma saida externa;
- sem `output`: baixa o arquivo, usando `fileName` quando informado.

`autoPrint: true` inclui a acao de impressao no PDF sem abrir dialogos proprios
do componente; o comportamento final ainda depende do visualizador/navegador.

## Unidades e caixas

- `page`, `box`, `basisBox`, `padding`, `margin`, `quietZone`,
  `minModuleWidth` e `textMargin`: milimetros;
- `fontSize` e `minFontSize`: pontos tipograficos;
- `rotation`: graus;
- `opacity`: numero entre 0 e 1;
- `letterSpacing`: valor repassado ao jsPDF no contexto da fonte.

`padding` reduz a caixa util do conteudo. `margin` participa somente do fluxo de
containers. `quietZone` reserva espaco fisico dos dois lados do barcode e
`textMargin` separa as barras do texto legivel.

Na migracao v1, `barcodeOptions.fontSize` e `barcodeOptions.textMargin` sao
interpretados como valores legados do JsBarcode em pixels e convertidos,
respectivamente, para pontos e milimetros. Propriedades canonicas explicitas
`humanReadableFontSize` e `textMargin` nao passam por essa conversao.

`page.margins` e `safeArea` geram diagnosticos de area segura, mas nao recortam
o conteudo. `bleed` permanece metadado do contrato para fluxos que precisem de
arte adicional; a pagina PDF conserva as dimensoes fisicas declaradas.
`background.fit` aceita `fill`, `contain`, `cover` ou `none`; este ultimo preserva
o tamanho original da imagem.

O barcode e desenhado como vetores no PDF. Para EAN/UPC, o texto legivel vem da
codificacao do JsBarcode, inclusive digito verificador calculado. O fundo do
barcode cobre toda a caixa, incluindo as quiet zones.
