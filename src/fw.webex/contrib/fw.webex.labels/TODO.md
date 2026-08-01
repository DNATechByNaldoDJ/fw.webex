# TODO - Reescrita do FWWebEx Labels e evolução dos exemplos 031/032

Este documento deve orientar na reescrita de `fw.webex.labels.tlpp` e na
evolução dos exemplos `fw.webex.example.031.tlpp` e
`fw.webex.example.032.tlpp`.

O objetivo é transformar o designer atual em um componente reutilizável,
previsível e capaz de editar templates reais de impressão de rótulos, mantendo
o PDF gerado fiel ao canvas e ao contrato JSON.

Arquivos principais:

- `fw.webex.labels.tlpp`
- `fw.webex.example.031.tlpp`
- `fw.webex.example.032.tlpp`
- `src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.jspdf.tlpp`
  como feature genérica e dependência do recurso Labels
- `src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.pdfjs.tlpp`
  como feature genérica e independente para visualização/rasterização
- `fw.webex.markdown.tlpp` somente como consumidor potencial por adaptador; não
  como dependência de Labels
- README do componente e READMEs dos exemplos
- `fw.webex.control.tlpp` somente se uma necessidade concreta for comprovada

## Status consolidado da entrega

As etapas A a F da seção 3.1 foram concluídas. O designer, o painel gerador e o
gerador headless são produtos reutilizáveis; os exemplos 031/032 são somente
consumidores; contrato, layout, validação, preview e PDF compartilham o mesmo
runtime.

Validação inicial executada em 28/07/2026:

- 92 testes Node em 16 arquivos;
- 91 testes aprovados, nenhuma falha;
- 1 teste raster real ignorado na suíte padrão por ser opt-in;
- teste raster opt-in executado separadamente em Microsoft Edge: aprovado nas
  rotações 0, 90, 180 e 270 graus;
- contratos e registros dos exemplos 031/032 semanticamente idênticos;
- validação dos dados demonstrativos sem erros ou avisos;
- `git diff --check` sem erros.

Revisão do backlog e primeiro lote adicional executados em 31/07/2026:

- as 263 caixas anteriormente abertas foram confrontadas com código e testes;
- 207 itens já entregues foram marcados como concluídos;
- restaram 56 caixas abertas, sendo 28 identificadas explicitamente como
  **Parcial** e 28 como pendências completas, opcionais ou externas;
- `background` passou a ser garantidamente a última propriedade serializada;
- `editor` passou a aceitar somente `grid`, `snap` e `guides`, com teste de que
  esses metadados não alteram métricas nem PDF;
- o Designer ganhou configuração compacta de tamanho, rotação, margens, área
  segura, sangria, passo do grid, tolerância do snap e bloqueio do background;
- busca de camadas, movimento de 0,1/1 mm, encerramento da corrente com `Esc`,
  referência combinada com bloqueio e diagnóstico de referência inválida foram
  concluídos;
- 104 testes Node: 103 aprovados, nenhuma falha e 1 raster opt-in ignorado na
  suíte padrão (já aprovado separadamente nas quatro rotações).

Bloco de preview fiel implementado em 31/07/2026:

- PDF.js 3.11.174 foi isolado em `WebExFeaturePDFJS`, com namespace
  `FWWebEx.PDFViewer`, worker de mesma versão, readiness, cópia segura dos
  bytes, cancelamento e descarte explícito;
- somente `WebExLabelDesigner` habilita a visualização; Labels headless e o
  painel gerador continuam sem o custo adicional do PDF.js;
- o iframe foi substituído por canvas rasterizado e o overlay usa a mesma
  matriz global do renderer nas rotações 0, 90, 180 e 270;
- milímetros são convertidos pela dimensão real do viewport, inclusive para
  arraste, marquee, guias, handles e seleção sobre a página rotacionada;
- gerações e rasters obsoletos são cancelados/ignorados, mudanças são
  consolidadas por debounce e falhas retornam ao modo Design com diagnóstico;
- 115 testes Node nos módulos Labels e Features: 114 aprovados, nenhuma falha
  e 1 raster opt-in ignorado na suíte padrão;
- o backlog detalhado passou a 317 itens concluídos e 46 abertos, dos quais 26
  permanecem marcados como **Parcial** e 20 são pendências completas/opcionais.

Bloco de snap inteligente implementado em 31/07/2026:

- o motor resolve candidatos separadamente por eixo e segue a prioridade
  referência magnética, container pai, guia manual, demais elementos, grid e
  página/margens/área segura;
- cada eixo informa a origem e a âncora vencedoras, com desempate
  determinístico e histerese de 1,5 vez a tolerância visual;
- o overlay temporário mostra a guia, a origem, o tipo de alinhamento e a
  distância em milímetros durante o arraste;
- textos usam a baseline canônica calculada pelo `TextEngine`, compartilhada
  com as métricas de layout, e a referência ganhou um ícone próprio;
- a criação e o arraste de guias manuais pelas réguas, a visualização de gaps
  e a guia de sangria permanecem como evoluções de UX;
- o backlog detalhado passou a 328 itens concluídos e 36 abertos, dos quais 23
  permanecem marcados como **Parcial** e 13 são pendências completas/opcionais.

Correção do transporte da configuração inicial executada em 01/08/2026:

- o escape compartilhado TLPP -> JavaScript passou a usar a quantidade literal
  correta de barras, impedindo que JSON válido chegue como `{\"...}`;
- mensagens de inicialização agora identificam layout, dados ou opções;
- 118 testes Labels: 117 aprovados, nenhuma falha e 1 raster opt-in ignorado.

Bloco de dados demonstrativos executado em 01/08/2026 — **OK**:

- a API pública pura `contract.createSampleRecords()` passou a descobrir
  mnemônicos em `variables` e templates e a produzir valores determinísticos
  por exemplo, default, tipo e formato do código de barras;
- o designer completa automaticamente registros vazios conforme o layout
  evolui, mas desativa a automação na primeira edição manual;
- o botão **Gerar / completar dados** mescla somente campos ausentes, preserva
  inclusive `null`, string vazia, zero e falso e diagnostica conflitos de
  caminhos aninhados sem substituir conteúdo;
- o evento `fwwebex:label-datachange` informa alterações vindas do editor, da
  automação e do botão;
- o backlog detalhado passou a 329 itens concluídos e 36 abertos, dos quais 23
  permanecem marcados como **Parcial** e 13 são pendências completas/opcionais;
- 122 testes Labels: 121 aprovados, nenhuma falha e 1 raster opt-in ignorado.

Núcleo de distribuição e posicionamento executado em 01/08/2026 — **OK**:

- a API pura `layout.arrange()` e os aliases `align`, `position`, `distribute`
  e `matchSize` centralizam geometria sem alterar o contrato recebido;
- referência explícita ou magnética permanece fixa, alvos travados são
  preservados e containers deslocam sua subárvore exatamente uma vez;
- o Designer passou a posicionar nos quatro sentidos, escolher alinhamento
  transversal, igualar dimensões e distribuir por gaps iguais;
- direção, gap e alinhamento transversal são reutilizados pelo modo corrente;
- overflow de página ou da área útil do container é calculado antes da mutação,
  com confirmação e preservação do estado anterior quando cancelado;
- o menu compacto só habilita ações de organização com seleção suficiente e
  permanece disponível no modo corrente apenas para configurar a sequência;
- a representação gráfica persistente dos gaps durante o posicionamento continua
  no próximo bloco de UX, sem bloquear o motor ou os comandos entregues.
- o backlog detalhado passou a 335 itens concluídos e 30 abertos, dos quais 20
  permanecem marcados como **Parcial** e 10 são pendências completas/opcionais;
- 135 testes Labels: 134 aprovados, nenhuma falha e 1 raster opt-in ignorado.

Pendências que não bloqueiam esta entrega:

- compilar e executar os TLPPs em um AppServer Protheus;
- criar o adaptador Markdown -> PDF, mantido fora de Labels e acompanhado por
  `NX-003`;
- validar a compilação e o carregamento do worker PDF.js sob as políticas reais
  de CDN/CORS/CSP do AppServer e definir o fallback local de `NX-017`.

Próximos blocos recomendados, em ordem:

1. completar a UX de guias manuais, gaps, sangria e responsividade;
2. incluir imagem, linha e retângulo como novos tipos, se confirmados como
   necessários para os modelos reais.

As listas detalhadas da seção 2 permanecem como catálogo de evolução de UX. O
status da implementação comprometida nesta entrega é controlado pelas etapas e
critérios da seção 3; itens opcionais ainda sem marcação não devem ser
interpretados como dependência para usar os componentes.

## 1. Contexto, decisões obrigatórias e problemas confirmados

### 1.1 Restrições e decisões que devem ser preservadas

- [x] Manter `background` dentro do JSON, inclusive como Data URI, porque ele
  faz parte do layout e permite restaurar o projeto completo.
- [x] Garantir `background` como último elemento dentro do JSON.
- [x] Não tratar o tamanho do background embutido como defeito ou propor sua
  remoção como requisito da reescrita.
- [x] Preservar as APIs públicas `WebExLabelDesigner`,
  `WebExLabelPDFGenerator` e `WebExFeatureLabels`, salvo incompatibilidade
  técnica documentada.
- [x] Manter compatibilidade de leitura com contratos `version: 1`.
- [x] Criar normalização/migração em memória para o novo contrato; não exigir
  alteração manual dos layouts existentes.
- [x] Manter milímetros como unidade canônica do layout e da renderização.
- [x] Manter a geração no navegador: jsPDF fornecido por
  `WebExFeatureJsPDF` e JsBarcode fornecido pelo recurso Labels.
- [x] Usar o mesmo motor para validação, preview, download e impressão.
- [x] Não duplicar regras de renderização nos exemplos.
- [x] Transformar o recurso Labels em componentes finais reutilizáveis.
- [x] Tratar os exemplos 031 e 032 somente como consumidores mínimos desses
  componentes, sem implementar neles regras, CSS estrutural ou comportamento de
  produto.

### 1.1.1 Premissa arquitetural: jsPDF como feature genérica

jsPDF não pertence ao domínio Labels. A biblioteca deve ser disponibilizada por
uma feature FWWebEx genérica em arquivo-fonte próprio:

`src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.jspdf.tlpp`

Decisões obrigatórias:

- [x] Criar `WebExFeatureJsPDF` e centralizar nela URL, versão, carregamento,
  idempotência e readiness do jsPDF.
- [x] Fazer `WebExFeatureLabels` habilitar e consumir `WebExFeatureJsPDF`.
- [x] Remover de `WebExFeatureLabels` a injeção direta do script jsPDF.
- [x] Manter JsBarcode como dependência específica de Labels.
- [x] Manter o renderer de rótulos em Labels; ele conhece caixas, templates,
  barcodes e o contrato Labels, enquanto a feature genérica conhece somente a
  infraestrutura PDF.
- [x] Manter `WebExLabelPDFGenerator` como fachada headless do domínio Labels.
- [x] Não mover `Contract`, `LayoutEngine`, `TextEngine` ou `BarcodeEngine` para
  a feature genérica.
- [x] Não criar dependência de Labels em Markdown nem de Markdown em Labels.
- [ ] Permitir que um adaptador independente consuma o DOM/HTML produzido por
  `WebExFeatureMarkDown` e o converta com a feature jsPDF.
- [x] Carregar dependências de HTML, como `html2canvas` e DOMPurify, somente
  quando a capacidade de renderização HTML for solicitada.
- [x] Tratar sanitização, imagens/CORS, fontes, paginação e suporte parcial a CSS
  como responsabilidades explícitas do adaptador HTML/Markdown -> PDF.
- [x] Não prometer equivalência visual com `window.print()` sem testes
  comparativos.
- [x] Tratar PDF.js separadamente: ele visualiza o PDF gerado e não substitui
  jsPDF na autoria do documento.

### 1.2 Acoplamento indevido de CSS e DOM

Problema confirmado:

```tlpp
::AddClass("fwwebex-label-designer")
```

A classe é adicionada por `WebExLabelDesigner`, mas a regra correspondente está
no exemplo 031:

```css
.fwwebex-label-designer {
    grid-area: canvas;
    min-width: 0;
}
```

Tecnicamente, uma classe CSS pode existir sem regra e servir apenas como um
gancho semântico. Porém, neste caso a regra existente não descreve o componente:
ela posiciona o componente no grid específico do exemplo 031.

Decisão:

- [x] Manter `fwwebex-label-designer` como classe raiz oficial do componente.
- [x] Mover todo CSS estrutural necessário ao funcionamento do designer para
  `WebExFeatureLabels` ou para um asset CSS próprio do recurso Labels.
- [x] Remover de `fwwebex-label-designer` qualquer responsabilidade de layout da
  página demonstrativa.
- [x] Se a página demonstrativa precisar posicionar o componente em um shell
  próprio, usar uma classe exclusiva do exemplo somente no wrapper externo,
  nunca nos elementos internos do designer.
- [x] Aplicar o mesmo princípio a `stage`, `fields`, handles, seleção, containers
  e estados de bloqueio.
- [x] O componente deve funcionar corretamente fora do exemplo 031 sem exigir
  que o consumidor copie CSS do exemplo.
- [x] O exemplo 031 não deve ser o dono visual do designer; deve apenas
  instanciar o componente final e fornecer layout/dados demonstrativos.

O componente também depende de uma estrutura interna criada manualmente pelo
exemplo:

- `[data-role="stage"]`
- `[data-role="background"]`
- `[data-role="fields"]`

Decisão:

- [x] Fazer `WebExLabelDesigner` renderizar sua própria estrutura funcional de
  DOM, incluindo as regiões internas habilitadas nas opções.
- [x] Fazer toolbar, painéis laterais, canvas, inspetor e status pertencerem ao
  produto final `WebExLabelDesigner`.
- [x] Deixar sob responsabilidade do consumidor somente a composição externa da
  página onde o componente será inserido.
- [x] Se slots customizáveis forem necessários, documentar os slots; não deixar
  um contrato DOM implícito.
- [x] Se a estrutura interna não for encontrada, emitir erro descritivo em vez
  de falhar silenciosamente.

### 1.3 Defeitos funcionais já identificados

- [x] Corrigir a rotação global de 90, 180 e 270 graus.
- [x] Não passar arrays para `setCurrentTransformationMatrix`; usar
  `pdf.Matrix`.
- [x] Executar transformações arbitrárias no modo `pdf.advancedAPI`.
- [x] Não combinar `rotatedPoint`, troca de largura/altura e soma da rotação
  global ao ângulo do elemento.
- [x] Fazer a rotação global alterar apenas página/sistema de coordenadas; ela
  não pode alterar cálculo de fonte, largura física do barcode ou padding.
- [x] Corrigir o exemplo 031 para não sobrescrever edições pendentes no textarea
  do contrato antes de validar ou gerar preview.
- [x] Respeitar `minFontSize`; `overflow: "shrink"` não pode reduzir a fonte até
  1 pt ignorando o mínimo configurado.
- [x] Permitir `textMargin: 0` no barcode; evitar fallbacks baseados em `||`
  quando zero for um valor válido.
- [x] Separar margem do texto comum da margem do texto legível do barcode.
- [x] Validar elementos e containers fora dos limites da página.
- [x] Detectar containers sem filhos e elementos visualmente sobre um container,
  mas sem `containerId`.
- [x] Comparar mnemônicos usados nos templates com `variables`.
- [x] Detectar mnemônicos usados e não declarados, declarados e não usados e
  valores obrigatórios ausentes.
- [x] Suportar caminhos aninhados de forma coerente em template, defaults,
  obrigatoriedade e geração de dados de teste.
- [x] Reinicializar cor, fonte e demais estados gráficos por elemento para evitar
  herança acidental do elemento anterior.

### 1.4 Caso de regressão obrigatório: campo `produto`

O layout analisado contém aproximadamente:

```json
{
  "value": "{{produto}}",
  "width": 18.03,
  "height": 3,
  "fontSize": 8,
  "minFontSize": 8,
  "padding": 1,
  "maxLines": 1,
  "overflow": "shrink"
}
```

O padding vertical consome 2 mm e deixa somente 1 mm de altura útil. O motor
reduz a fonte abaixo de `minFontSize`, fazendo o produto aparecer praticamente
ilegível.

- [x] Criar teste específico para essa configuração.
- [x] Exibir no validador a altura/largura útil calculada.
- [x] Informar o tamanho final da fonte após o autofit.
- [x] Se o mínimo não couber, aplicar `overflow` sem violar `minFontSize`.
- [x] Mostrar sugestão objetiva: aumentar caixa, reduzir padding, reduzir fonte
  mínima, permitir mais linhas ou alterar a política de excesso.

## 2. Plano de reescrita e novo layout do exemplo 031

### 2.1 Arquitetura em camadas e componentes finais

A arquitetura alvo deve separar núcleo, componentes internos e produtos
reutilizáveis. Os exemplos não podem continuar funcionando como a camada de
produto.

Inverter o controle atual: os exemplos devem chamar os componentes públicos,
e os componentes devem renderizar toda a feature sem conhecer nem depender dos
exemplos.

| Camada | Responsabilidade | Pode renderizar interface? |
| --- | --- | --- |
| Feature jsPDF | Dependência genérica, versão, lifecycle e readiness do jsPDF | Somente assets/serviços genéricos |
| Feature Labels | JsBarcode, CSS base, namespace e inicialização de Labels | Somente assets de Labels |
| Core Labels | Contrato, layout, texto, barcode, validação e renderer especializado | Não |
| Componentes internos | Canvas, toolbar, camadas, inspetor e preview | Sim |
| Produtos finais | Designer completo e painel de geração | Sim |
| Exemplos 031/032 | Instanciar, configurar e demonstrar | Apenas composição mínima |

Produtos finais propostos:

1. `WebExLabelDesigner`
   - editor completo e reutilizável;
   - renderiza toolbar, painel de elementos/camadas, canvas, inspetor, painel de
     dados/contrato/problemas e barra de status;
   - expõe opções para ocultar ou simplificar regiões;
   - não depende do exemplo 031.
2. `WebExLabelGeneratorPanel`
   - componente final para informar layout/dados, validar, visualizar, baixar e
     imprimir;
   - utiliza internamente `WebExLabelPDFGenerator`;
   - não depende do exemplo 032.
3. `WebExLabelPDFGenerator`
   - permanece como componente headless de geração e integração com o renderer;
   - pode ser usado sem interface por páginas que já possuam seu próprio fluxo.

`WebExFeatureLabels` deve:

- [x] Depender de `WebExFeatureJsPDF` e carregar somente JsBarcode e os assets
  específicos de Labels.
- [x] Se PDF.js for adotado no preview fiel, registrá-lo como capacidade de
  visualização separada da geração.
- [x] Registrar todo CSS estrutural dos componentes.
- [x] Registrar tokens CSS e valores padrão de tema.
- [x] Garantir carregamento único mesmo com vários componentes na página.
- [x] Disponibilizar o namespace JavaScript compartilhado.
- [x] Não conter regras específicas dos exemplos.

`WebExLabelDesigner` deve ser um componente composto. Para evitar uma classe
monolítica, criar responsabilidades internas como:

- toolbar;
- toolbox;
- layers tree;
- canvas/stage;
- inspector;
- data/contract/problems drawer;
- status bar;
- print preview.

Essas partes podem ser classes TLPP internas, controles auxiliares ou módulos
JavaScript, conforme o padrão do repositório. O consumidor não deve precisar
montar manualmente esses filhos para obter um designer funcional.

- [x] Fazer o componente final possuir defaults úteis.
- [x] Permitir customização por opções e CSS custom properties.
- [x] Evitar exigir IDs fixos definidos pelo consumidor.
- [x] Resolver IDs internos a partir do ID raiz do componente.
- [x] Não exigir JavaScript externo para conectar os controles internos.
- [x] Expor eventos/callbacks públicos para mudança, validação, geração e erro.
- [x] Documentar quais regiões podem ser ocultadas.
- [x] Permitir mais de uma instância do designer/gerador na mesma página sem
  colisão de IDs, estado ou eventos.

API TLPP desejada para o designer:

```tlpp
WITH WEBEXOBJECT CLASS WebExLabelDesigner ARGS 100,60
    .:SetLayout(cLayoutJSON)
    .:SetRecords(cDataJSON)
    .:SetOptions(jDesignerOptions)
END WEBEXOBJECT
```

API TLPP desejada para o painel de geração:

```tlpp
WITH WEBEXOBJECT CLASS WebExLabelGeneratorPanel
    .:SetLayout(cLayoutJSON)
    .:SetRecords(cDataJSON)
    .:SetFileName("rotulos-fwwebex.pdf")
    .:SetOptions(jGeneratorOptions)
END WEBEXOBJECT
```

- [x] Definir métodos aceitando JSON TLPP e/ou string JSON conforme as
  convenções do FWWebEx.
- [x] Manter acesso à API JavaScript para atualizações após o carregamento da
  página.
- [x] Não obrigar o consumidor a usar `document.getElementById()` para operações
  comuns.
- [x] Preservar compatibilidade com o uso headless atual do gerador.

#### 2.1.1 Separação interna de responsabilidades

Reorganizar a implementação, ainda que permaneça no mesmo fonte TLPP:

- [x] `Contract`: normalização, migração, validação e resolução de mnemônicos.
- [x] `LayoutEngine`: containers, margens, padding, fluxo e cálculo das caixas.
- [x] `TextEngine`: medição, quebra, autofit, alinhamento e overflow.
- [x] `BarcodeEngine`: formato, regras AUTO, zona silenciosa e módulo mínimo.
- [x] `LabelPDFRenderer`: página, rotação, fundo e renderização final do contrato
  Labels, usando as primitivas disponibilizadas por `WebExFeatureJsPDF`.
- [x] `Designer`: estado, seleção, interação, histórico e serialização.

API JavaScript desejada:

```javascript
FWWebExLabels.contract.normalize(layout)
FWWebExLabels.contract.validate(layout, records)
FWWebExLabels.renderer.generate(layout, records, options)
FWWebExLabels.designer.create(root, options)
```

A infraestrutura genérica deve usar o namespace oficial `FWWebEx.PDF`, e não
ser registrada dentro de `FWWebExLabels`.
`FWWebExLabels.renderer` continua sendo a API especializada de rótulos.

- [x] Evitar funções globais específicas de exemplos dentro do componente.
- [x] Registrar dependências e estilos uma única vez.
- [x] Fixar e documentar a versão de JsBarcode em Labels; a versão do jsPDF
  pertence à documentação de `WebExFeatureJsPDF`.
- [x] Não alterar `fw.webex.control.tlpp` para acomodar lógica que pertence ao
  recurso Labels.

#### 2.1.2 Papel definitivo dos exemplos

Exemplo 031:

- [x] Criar apenas a página demonstrativa.
- [x] Instanciar `WebExLabelDesigner`.
- [x] Fornecer layout, registros e opções iniciais.
- [x] Não declarar CSS estrutural `fwwebex-label-*`.
- [x] Não criar toolbar, canvas, inspetor ou editor JSON manualmente.
- [x] Não conter funções de seleção, alinhamento, snap, validação ou preview.
- [x] Demonstrar como escutar eventos públicos, somente se necessário.

Exemplo 032:

- [x] Criar apenas a página demonstrativa.
- [x] Instanciar `WebExLabelGeneratorPanel`.
- [x] Fornecer layout e registros de exemplo.
- [x] Demonstrar geração, preview e impressão através da API pública.
- [x] Não conter o formulário completo nem a lógica de geração em JavaScript.
- [ ] Demonstrar opcionalmente o uso headless de
  `WebExLabelPDFGenerator` em um bloco curto e separado.

Meta de legibilidade:

- [x] Os exemplos devem mostrar rapidamente como consumir o recurso.
- [x] A maior parte de cada exemplo deve ser configuração/dados demonstrativos,
  não implementação.
- [x] Uma página de aplicação deve conseguir trocar o exemplo pelo componente
  sem copiar qualquer código interno.

### 2.2 Contrato JSON versão 2

Estrutura alvo:

```json
{
  "schema": "fwwebex.labels",
  "version": 2,
  "name": "rotulo-produto",
  "unit": "mm",
  "page": {
    "width": 100,
    "height": 60,
    "rotation": 0,
    "margins": {
      "top": 0,
      "right": 0,
      "bottom": 0,
      "left": 0
    },
    "safeArea": 0,
    "bleed": 0
  },
  "editor": {
    "grid": {
      "enabled": true,
      "step": 1
    },
    "snap": {
      "enabled": true,
      "tolerancePx": 8,
      "referenceElementId": null,
      "chainMode": false
    },
    "guides": []
  },
  "variables": [],
  "barcodeAutoRules": [],
  "elements": [],
  "background": {
    "dataUrl": "data:image/jpeg;base64,...",
    "fit": "fill",
    "opacity": 1,
    "locked": true
  }
}
```

Requisitos:

- [x] Garantir que background seja sempre o último elemento da Estrutura alvo.
- [x] Continuar aceitando `background` como string no contrato v1.
- [x] Converter internamente string v1 para `background.dataUrl`.
- [x] Preservar o Data URI integralmente no round-trip
  `load -> edit -> export -> load`.
- [x] Preservar em `editor` apenas metadados necessários para restaurar a
  experiência de edição, como grid, snap, guias e elemento de referência.
- [x] Fazer o renderer ignorar completamente `editor`; esses dados não podem
  alterar a impressão.
- [x] Adicionar `schema` para identificar o tipo de documento.
- [x] Aceitar somente rotações de página `0`, `90`, `180` e `270`.
- [x] Decidir e documentar se rotação de elemento aceita qualquer grau ou apenas
  os quatro ângulos ortogonais.
- [x] Usar `template` no v2 e continuar aceitando `value` no v1.
- [x] Usar `box: {x,y,width,height}` no v2 e normalizar os campos planos do v1.
- [x] Definir campos comuns: `id`, `type`, `box`, `rotation`, `zIndex`,
  `locked`, `hidden`, `containerId`.
- [x] Definir propriedades específicas por tipo, sem opções ambíguas.
- [x] Rejeitar IDs duplicados.
- [x] Validar números finitos, dimensões positivas e enums.
- [x] Produzir erros estruturados com `code`, `severity`, `path`, `elementId`,
  `message` e `suggestion`.

Exemplo de texto no v2:

```json
{
  "id": "produto",
  "type": "text",
  "template": "Cod.Produto: {{produto}}",
  "box": {
    "x": 81.2,
    "y": 47.2,
    "width": 18,
    "height": 3
  },
  "rotation": 0,
  "style": {
    "fontFamily": "helvetica",
    "fontSize": 6,
    "minFontSize": 4.5,
    "fontStyle": "bold",
    "color": "#000000",
    "lineHeightFactor": 1.05,
    "letterSpacing": 0,
    "align": "left",
    "verticalAlign": "middle",
    "padding": {
      "top": 0,
      "right": 0.2,
      "bottom": 0,
      "left": 0.2
    },
    "margin": {
      "top": 0,
      "right": 0,
      "bottom": 0,
      "left": 0
    }
  },
  "fit": {
    "mode": "shrink",
    "maxLines": 1,
    "overflow": "error"
  }
}
```

Semântica:

- `padding`: margem interna; reduz a área disponível para o conteúdo.
- `margin`: espaço externo; participa do fluxo de containers.
- `page.margins`: área reservada da página.
- `safeArea`: aviso visual/validação, sem necessariamente recortar.
- `bleed`: área adicional para arte de fundo, quando aplicável.
- `quietZone`: margem física exclusiva do barcode.
- `barcodeOptions.textMargin`: espaço do texto legível do barcode, com unidade
  explicitamente documentada.

- [x] Aceitar número ou objeto em `padding` e `margin`.
- [x] Normalizar número como o mesmo valor nos quatro lados.
- [x] Permitir atalhos `{x, y}` como horizontal/vertical, se forem realmente
  úteis; caso contrário, manter somente os quatro lados.
- [ ] Exibir no inspetor um controle para vincular/desvincular os quatro lados.
- [x] Aplicar `margin` somente no fluxo de containers; em posicionamento
  absoluto, emitir aviso se o comportamento não estiver definido.

### 2.3 Dados, templates e variáveis

- [x] Usar dados puros, sem rótulos de apresentação:

```json
{
  "produto": "PRODUTO",
  "lote": "L260725-A",
  "validade": "25/07/2028",
  "pesoLiquido": "5,120 kg"
}
```

- [x] Manter textos como `Cod.Produto:`, `Lote:`, `Dat.Val.:` e `Pes.Liq.:`
  nos templates dos elementos.
- [x] Não misturar `"Produto: {{produto}}"` com um valor já formatado como
  `"Cod.Produto: PRODUTO"`.
- [x] Implementar `getPath` e `setPath` compartilhados para caminhos como
  `produto.codigo`.
- [x] Validar `required`, `default` e `type` usando o mesmo resolvedor.
- [x] Criar comando "Descobrir variáveis" para varrer todos os templates.
- [x] Criar ação para adicionar automaticamente declarações ausentes.
- [x] Mostrar variáveis não usadas sem impedir a geração.
- [x] Não adicionar filtros de template nesta etapa; registrar filtros e
  formatadores como evolução futura para evitar ampliar a reescrita.

### 2.4 Motor de layout e renderização

- [x] Criar `normalizeInsets`.
- [ ] Calcular uma caixa externa, uma caixa com margin e uma caixa útil após
  padding.
- [ ] Usar exatamente as mesmas caixas no canvas, validação e PDF.
- [x] Separar `fit.mode` de `fit.overflow`.
- [x] Nunca reduzir fonte abaixo de `minFontSize`.
- [x] Implementar clipping real para `overflow: "clip"`.
- [x] Implementar ellipsis medido, sem substituir caracteres arbitrariamente.
- [x] Tratar explicitamente texto vazio.
- [x] Suportar `normal`, `bold`, `italic` e `bolditalic`.
- [x] Validar fontes disponíveis no jsPDF e informar fallback.
- [x] Garantir que `0` seja preservado em padding, margin, quiet zone,
  `textMargin`, gap, rotação e demais propriedades numéricas.
- [x] Não alterar medidas do elemento ao rotacionar a página.

Estratégia obrigatória para rotação:

- [x] Trocar somente o formato da página em 90/270.
- [x] Entrar em `pdf.advancedAPI`.
- [x] Criar a transformação com `new pdf.Matrix(...)`.
- [x] Aplicar a transformação uma vez ao conteúdo completo da página.
- [x] Desenhar fundo e elementos nas coordenadas originais do contrato.
- [x] Somar ao elemento apenas sua própria rotação.
- [x] Remover `rotatedPoint()` quando a transformação global estiver ativa.

Containers:

- [x] Preservar a ordem explícita dos filhos; não depender da ordem acidental do
  array geral.
- [x] Validar `containerId` existente.
- [x] Impedir ciclos e container filho de si mesmo.
- [x] Definir `direction`, `padding`, `gap`, `crossAlign`, `mainAlign`,
  `sizing`, `overflow` e `clipChildren`.
- [x] Diferenciar `shrink` da caixa e autofit do conteúdo.
- [x] Mostrar no canvas quando um container não possui filhos.
- [x] Permitir selecionar filhos por uma árvore de camadas.

### 2.5 Estado e edição no designer

- [x] Centralizar o estado do designer.
- [x] Implementar histórico com desfazer/refazer.
- [x] Preservar seleção ao alterar uma propriedade.
- [x] Implementar seleção simples, múltipla e por área.
- [ ] **Parcial:** implementar ordem de camadas: subir, descer, frente e fundo.
  Subir/descer já funciona; faltam os atalhos frente/fundo.
- [ ] **Parcial:** implementar agrupamento visual e containers sem confundir os
  conceitos. Containers estão implementados; grupo visual permanece pendente.
- [ ] **Parcial:** implementar copiar/colar e duplicar. Duplicação e `Ctrl+C/V`
  funcionam; falta tornar o clipboard independente da existência da origem.
- [x] Implementar bloqueio e visibilidade.
- [x] Implementar movimentação por teclado:
  - setas: `0,1 mm`;
  - `Shift + setas`: `1 mm`;
  - modificador configurável para passo fino, se necessário.
- [x] Implementar grid configurável e snap independente para grid, bordas,
  centros e outros elementos.
- [x] Exibir guias inteligentes e distâncias em milímetros.
- [ ] **Parcial:** permitir criar, arrastar e remover guias manuais diretamente
  pelas réguas. Guias declaradas em `editor.guides` já participam do snap;
  falta a UX de manipulação visual.
- [x] Implementar zoom com ajustar à página, 100%, ampliar e reduzir.
- [x] Manter coordenadas independentes do zoom.
- [x] Adicionar réguas horizontal e vertical.
- [ ] **Parcial:** mostrar margem da página, área segura e sangria. Margem e área
  segura já possuem guias; falta desenhar a sangria.
- [x] Alertar antes de remover container que possui filhos.

#### 2.5.1 Referência magnética e posicionamento encadeado

Implementar um sistema explícito de referência para que o usuário não precise
ajustar coordenadas diretamente no JSON.

Estados distintos:

- `locked`: o elemento não pode ser movido ou redimensionado.
- `reference`: o elemento é a referência magnética ativa.

Um elemento bloqueado não deve se tornar referência automaticamente em todos os
casos, pois backgrounds, molduras e outros elementos podem estar bloqueados sem
servir para alinhamento. A interface, porém, deve oferecer a ação combinada
**"Travar e usar como referência"**.

- [x] Permitir marcar um único elemento como referência magnética principal.
- [x] Destacar a referência com contorno e ícone diferentes da seleção
  comum.
- [x] Exibir seu ID/nome na barra de status.
- [x] Manter a referência mesmo quando outro elemento for selecionado.
- [x] Permitir limpar ou substituir a referência rapidamente.
- [x] Persistir `referenceElementId` no bloco `editor` do contrato.
- [x] Se a referência não existir após importação, limpar o vínculo e emitir
  aviso não bloqueante.
- [x] Permitir usar elementos bloqueados como referência sem desbloqueá-los.

Ao mover ou criar o próximo elemento:

- [x] Atrair para as bordas esquerda, direita, superior e inferior da
  referência.
- [x] Atrair para centros horizontal e vertical.
- [x] Para textos, oferecer alinhamento pela baseline calculada pelo
  `TextEngine`.
- [x] Mostrar guias temporárias e informar a distância final em milímetros.
- [x] Aplicar snap visual por tolerância em pixels, independentemente do zoom.
- [x] Gravar sempre a coordenada final em milímetros.
- [x] Permitir desativar temporariamente o snap durante o arraste.
- [x] Não mover a referência ao alinhar o novo elemento.
- [x] Não alterar largura/altura sem uma ação explícita de igualar ou esticar.

Adicionar comandos de posicionamento relativo:

- [x] **OK:** posicionar acima, abaixo, à esquerda ou à direita da referência.
- [x] Informar gap em milímetros.
- [x] **OK:** escolher alinhamento transversal: início, centro, fim ou stretch.
- [x] **OK:** igualar largura, altura ou ambas, atualizando também `basisBox`.
- [x] Alinhar top, middle, bottom, left, center, right e baseline.
- [x] **OK:** distribuir vários elementos mantendo a referência fixa.

Implementar dois comportamentos:

1. **Referência fixa**: todos os novos componentes alinham com o mesmo elemento.
2. **Modo corrente**: depois do posicionamento, o novo componente passa a ser a
   referência para o próximo.

O modo corrente resolve a montagem sequencial de campos como produto, lote,
validade e peso líquido.

- [x] Incluir toggle "Continuar a partir do último componente".
- [x] **OK:** preservar direção, gap e alinhamento transversal durante a corrente.
- [x] Permitir desfazer cada posicionamento separadamente.
- [x] Encerrar a corrente com `Esc` ou ação equivalente.
- [ ] **Parcial:** se o próximo componente ultrapassar página/container, manter
  a posição anterior e mostrar preview do overflow antes de confirmar. O cálculo
  atômico, o layout candidato e a confirmação estão implementados; falta desenhar
  uma sobreposição fantasma antes da decisão.

O snap também pode considerar elementos visíveis que não sejam a referência,
mas deve existir uma hierarquia previsível:

1. referência magnética ativa;
2. container pai;
3. guias manuais;
4. demais elementos visíveis;
5. grid;
6. página, margens e área segura.

- [x] Documentar e testar essa prioridade.
- [x] Quando dois snaps competirem, mostrar por eixo qual origem venceu.
- [x] Evitar oscilação durante o arraste usando histerese de 1,5 vez a
  tolerância.

#### 2.5.2 Fidelidade visual e modos Design/Dados/Impressão

O preview HTML atual utiliza métricas do navegador, enquanto a impressão usa
jsPDF e JsBarcode. Isso explica diferenças de fonte, quebra, alinhamento e
tamanho entre o componente visual e o PDF.

Princípio:

- O canvas interativo pode usar uma representação rápida durante o arraste.
- O resultado confirmado deve ser recalculado pelo mesmo `LayoutEngine`,
  `TextEngine`, `BarcodeEngine` e `LabelPDFRenderer` usados na impressão.
- Quando for necessária fidelidade visual máxima, a visualização deve mostrar
  uma página realmente gerada pelo renderer.

Implementar três modos claros:

1. **Design**
   - mostra `{{mnemônicos}}`, caixas, handles, containers, guias e alertas;
   - prioriza edição rápida.
2. **Dados**
   - mantém caixas e edição, mas resolve os templates com o registro escolhido;
   - mostra fonte final, linhas finais e barcodes com o valor real.
3. **Impressão**
   - mostra a página gerada pelo mesmo motor do PDF;
   - oculta adornos de edição, salvo quando o modo de sobreposição estiver
     ativo.

- [x] Adicionar seletor segmentado `Design | Dados | Impressão`.
- [x] Permitir alternar sem perder seleção, zoom ou histórico.
- [x] Quando os dados forem um array, incluir seletor de registro
  `1 de N`.
- [x] Atualizar imediatamente o modo Dados quando o JSON de teste mudar.
- [x] **OK:** gerar e mesclar dados demonstrativos a partir dos mnemônicos do
  layout, sem substituir valores informados manualmente.
- [ ] **Parcial:** mostrar mnemônicos não resolvidos com destaque e diagnóstico.
  O destaque existe; falta apresentar o diagnóstico imediatamente.
- [ ] **Parcial:** mostrar no inspetor o valor original, o valor resolvido e o
  texto final. Template e valor resolvido já são exibidos.
- [ ] **Parcial:** exibir tamanho final da fonte, quantidade de linhas, área útil e política
  aplicada.

Para o modo Impressão:

- [x] Gerar uma página em memória com `LabelPDFRenderer`.
- [x] Renderizar essa página em canvas com PDF.js para obter uma imagem fiel do
  PDF em vez de recriar a aparência com CSS.
- [x] Mapear milímetros para pixels usando o tamanho real da página renderizada.
- [x] Reutilizar o mesmo canvas como fundo do modo de sobreposição.
- [x] Atualizar de forma debounced após mudanças de propriedades.
- [x] Durante pointer move, usar overlay rápido; ao soltar, atualizar a
  renderização fiel.
- [x] Não gerar novo PDF a cada pixel movimentado.
- [x] Mostrar estado "Atualizando visualização" quando houver render pendente.
- [x] Se a renderização fiel falhar, manter o modo Design e apresentar erro
  descritivo; não fingir equivalência.

Modo de sobreposição:

- [x] Permitir exibir caixas, guias e handles transparentes sobre o canvas
  renderizado do PDF.
- [x] Permitir selecionar e mover componentes sobre a visualização fiel.
- [x] Manter a geometria do overlay derivada das mesmas coordenadas em
  milímetros e da mesma matriz global usada pelo renderer.
- [x] Oferecer controle de opacidade entre render e contornos.
- [x] Permitir alternar rapidamente entre "somente impressão" e
  "impressão + caixas".

Fidelidade e comparação:

- [ ] **Parcial:** criar visual diff automatizado entre preview fiel e PDF
  renderizado. O teste raster cobre o renderer, ainda não o viewport do preview.
- [x] Definir tolerância para antialiasing sem aceitar deslocamentos de layout.
- [ ] **Parcial:** testar fontes, bold/italic, alinhamentos, padding, rotação, barcode e
  background.
- [x] Garantir que a troca Design/Dados altere somente o conteúdo exibido, não
  as coordenadas do contrato.

### 2.6 Novo layout de usabilidade do exemplo 031

O JSON não deve ocupar permanentemente grande parte da tela. A interface deve
priorizar canvas, árvore de elementos e propriedades. Contrato, dados de teste
e validação ficam em um painel inferior recolhível.

| Região | Conteúdo | Comportamento |
| --- | --- | --- |
| Barra superior | Novo/restaurar, background, desfazer/refazer, modos Design/Dados/Impressão, zoom, grid/snap, referência, validar, exportar | Sempre visível e compacta |
| Painel esquerdo | Adicionar elementos e aba de camadas | Largura entre 240 e 280 px |
| Área central | Réguas, canvas, guias e controles de seleção | Ocupa todo espaço restante |
| Painel direito | Inspetor por abas | Largura entre 340 e 400 px |
| Painel inferior | Dados, contrato JSON e validação | Recolhível e redimensionável |
| Barra de status | Seleção, referência magnética, x/y, largura/altura, fonte final, zoom e quantidade de erros | Uma linha compacta |

Barra superior:

- [x] Background: carregar, substituir, remover, opacidade e bloqueio.
- [x] Configuração da página: tamanho, orientação, rotação de saída, margens,
  área segura e sangria.
- [x] Desfazer/refazer.
- [x] Grid, snap, passo e tolerância.
- [x] Marcar referência, travar e usar como referência, referência
  fixa/corrente e gap.
- [x] Alternar entre Design, Dados e Impressão.
- [x] **OK:** alinhar, distribuir e igualar dimensões em menu compacto, com ações
  habilitadas somente para seleção suficiente; durante a corrente, somente as
  configurações da sequência permanecem acessíveis.
- [x] Validar, preview PDF, exportar JSON e importar JSON.
- [x] Separar "rotação da página no PDF" de "orientação visual do canvas".

Painel esquerdo:

- [ ] **Parcial:** aba "Adicionar": texto, barcode, imagem, linha, retângulo e
  container. Texto, barcode e container estão disponíveis.
- [x] Aba "Camadas": árvore com z-order, parent/children, visibilidade, lock e
  busca por ID/nome/mnemônico.
- [ ] Permitir arrastar elementos para dentro ou para fora de containers.
- [x] Permitir reordenar filhos do container.
- [x] Exibir ícones diferentes por tipo implementado.

Canvas:

- [x] Manter fundo fiel ao PDF.
- [x] Exibir caixas e handles sem alterar as dimensões reais do elemento.
- [x] No modo Design, exibir o template, por exemplo `{{produto}}`.
- [x] No modo Dados, exibir o valor resolvido, por exemplo `PRODUTO`.
- [x] No modo Impressão, exibir a página produzida pelo renderer.
- [x] Permitir sobrepor caixas editáveis ao preview de impressão.
- [x] Destacar a referência magnética e os pontos de snap disponíveis.
- [ ] **Parcial:** mostrar guias, gaps e alinhamentos durante o posicionamento.
  Guias, alinhamento vencedor e distância em milímetros já são exibidos;
  falta representar visualmente os gaps.
- [ ] Permitir modo de contorno para inspecionar áreas transparentes.
- [x] Marcar overflow, fonte abaixo do desejado, barcode inválido e elemento
  fora da página diretamente no canvas.
- [x] Ao clicar em um erro, selecionar e centralizar o elemento correspondente.

Painel direito com abas:

1. **Elemento**
   - ID, nome, tipo, template/mnemônico, container, lock, visibilidade e ordem.
2. **Geometria**
   - X, Y, largura, altura, rotação, proporção, anchor e z-index.
3. **Aparência**
   - Fonte, estilo, tamanho máximo/mínimo, cor, espaçamento, line-height,
     alinhamentos, padding, margin, fit e overflow.
4. **Layout**
   - Propriedades de container, fluxo, gap, alinhamentos, sizing e clipping.
5. **Dados/Barcode**
   - Variáveis utilizadas ou formato, regras AUTO, quiet zone, módulo mínimo,
     texto legível e opções avançadas.

- [x] Mostrar somente propriedades aplicáveis ao tipo selecionado.
- [x] Oferecer uma seção "Avançado" recolhida para `textOptions` e
  `barcodeOptions`.
- [x] Não exigir edição manual de JSON para recursos comuns.
- [x] Manter edição JSON para casos avançados e depuração.

Painel inferior:

- [ ] **Parcial:** aba "Dados": objeto ou array de registros usados no preview.
  O editor existe no drawer inferior; falta a navegação por abas.
- [ ] **Parcial:** aba "Contrato": editor JSON com formatar, validar, aplicar e
  restaurar. Edição/aplicação/restauração existem; faltam aba e ação de formatar.
- [ ] **Parcial:** aba "Problemas": lista estruturada de erros e avisos. A lista
  existe no drawer; falta a navegação por abas.
- [x] Controlar estado `clean/dirty` do editor JSON.
- [x] Nunca sobrescrever JSON `dirty` durante validar ou preview.
- [x] Se o JSON estiver `dirty`, validar exatamente seu conteúdo.
- [x] Ao aplicar JSON, sincronizar canvas, árvore, inspetor e variáveis.
- [x] Ao alterar visualmente o layout, atualizar o editor somente quando ele não
  possuir edições pendentes.
- [ ] **Parcial:** mostrar diff ou confirmação antes de descartar alterações
  pendentes. Importação/substituição pedem confirmação; não há diff.

Responsividade:

- [ ] **Parcial:** acima de 1400 px: três colunas e painel inferior. O shell usa
  três colunas acima de 1100 px.
- [ ] Entre 900 e 1399 px: painel esquerdo compacto e inspetor em drawer.
- [ ] Abaixo de 900 px: priorizar preview, árvore e propriedades em abas; não
  tentar reproduzir toda a experiência desktop em uma coluna interminável.

Acessibilidade:

- [x] Associar labels ou nomes acessíveis aos controles.
- [ ] **Parcial:** permitir navegação por teclado. Há atalhos e foco na
  prancheta; falta navegação individual entre elementos.
- [x] Manter foco visível.
- [x] Não comunicar erro apenas por cor.
- [x] Usar botões com texto ou `aria-label`.
- [ ] **Parcial:** garantir contraste nos estados de seleção, lock e overflow;
  falta teste automatizado de contraste.

### 2.7 Revisão do exemplo 032

- [x] Usar dados puros e apresentação no template.
- [x] Evitar um único container que comprima todos os filhos apenas para fazer o
  exemplo caber.
- [x] Exibir as opções reais de geração: rotação, arquivo, download, preview e
  impressão.
- [ ] Incluir um layout de teste assimétrico com marcadores nos quatro cantos.
- [x] Permitir gerar 0, 90, 180 e 270 graus para comparação.
- [x] Verificar que 0/180 geram página 100 x 60 mm e 90/270 geram 60 x 100 mm.
- [x] Usar o mesmo contrato normalizado pelo exemplo 031.
- [x] Exibir erros estruturados do validador em vez de somente `error.message`.

## 3. Execução, testes e critérios de aceite

### 3.1 Ordem recomendada de implementação

#### Etapa A - Baseline e proteção contra regressões

- [x] Ler instruções do repositório e verificar alterações locais antes de
  editar.
- [x] Registrar o comportamento atual dos contratos v1.
- [x] Criar fixtures pequenas sem background para testes unitários.
- [x] Manter pelo menos uma fixture com background Data URI para round-trip.
- [x] Criar fixture assimétrica para rotação.
- [x] Criar fixture específica do campo `produto`.

#### Etapa B - Feature autocontida e produtos finais

- [x] Extrair o carregamento do jsPDF para `WebExFeatureJsPDF` antes de
  reorganizar os produtos finais de Labels.
- [x] Confirmar que a extração não move regras do domínio Labels para a feature
  genérica.
- [x] Mover CSS estrutural, tokens e estados visuais para
  `WebExFeatureLabels` ou para assets próprios do recurso.
- [x] Fazer `WebExLabelDesigner` renderizar toolbar, toolbox/camadas, canvas,
  inspetor, drawer inferior e status.
- [x] Criar `WebExLabelGeneratorPanel` como produto final para validar,
  visualizar, baixar e imprimir.
- [x] Manter `WebExLabelPDFGenerator` utilizável sem interface.
- [x] Remover dependências do recurso em classes, IDs, funções e estruturas DOM
  declaradas nos exemplos.
- [x] Confirmar que cada produto funciona em uma página mínima fora dos
  exemplos 031/032.
- [x] Confirmar que duas instâncias do mesmo produto funcionam na mesma página
  sem colisões.

#### Etapa C - Contrato e validação

- [x] Implementar normalização v1 -> modelo interno.
- [x] Implementar serialização v2.
- [x] Implementar validação estruturada.
- [x] Implementar padding/margin por lado.
- [x] Implementar variáveis e caminhos aninhados de forma coerente.
- [x] Garantir round-trip integral do background.

#### Etapa D - Renderer e rotação

- [x] Refatorar o renderer para usar um único sistema de coordenadas.
- [x] Corrigir Matrix/advancedAPI.
- [x] Corrigir texto, barcode e background nas quatro rotações.
- [x] Corrigir autofit, mínimo de fonte, clipping e ellipsis.
- [x] Confirmar igualdade visual entre canvas e PDF pelo teste raster real nas
  rotações 0, 90, 180 e 270 graus.

#### Etapa E - Produto `WebExLabelDesigner`

- [x] Implementar no componente o novo shell com barra superior, painéis
  laterais, canvas e painel inferior.
- [x] Implementar árvore de camadas.
- [x] Implementar inspetor contextual (sem exigir edição JSON para propriedades comuns).
- [x] Implementar histórico, grid, snap, réguas e atalhos.
- [x] Implementar estado dirty e sincronização segura do JSON.
- [x] Integrar mensagens estruturadas de validação ao canvas.
- [x] Expor opções para ocultar regiões sem exigir que o consumidor reconstrua o
  componente.
- [x] Expor eventos públicos de alteração, seleção, validação, preview e erro.

#### Etapa F - Produtos de geração, exemplos e documentação

- [x] Implementar `WebExLabelGeneratorPanel` usando o gerador headless.
- [x] Reduzir o exemplo 031 à instanciação/configuração do designer.
- [x] Reduzir o exemplo 032 à instanciação/configuração do painel de geração.
- [x] Manter, no máximo, um bloco curto e separado demonstrando a API headless
  no exemplo 032.
- [x] Garantir que nenhum dos exemplos declare CSS estrutural ou replique
  comportamento interno do recurso Labels.
- [x] Documentar contrato v2 e compatibilidade v1.
- [x] Documentar unidades de todas as propriedades.
- [x] Documentar diferença entre page rotation, element rotation, padding,
  margin, quiet zone e barcode text margin.
- [x] Atualizar READMEs sem prometer recursos ainda não implementados.

### 3.2 Matriz mínima de testes

| Caso | Resultado esperado |
| --- | --- |
| Página 100 x 60, rotação 0 | Conteúdo e fundo na posição original |
| Página 100 x 60, rotação 90 | Página 60 x 100 e conteúdo rotacionado uma vez |
| Página 100 x 60, rotação 180 | Conteúdo invertido sem deslocamento |
| Página 100 x 60, rotação 270 | Página 60 x 100 sem corte ou espelhamento |
| Elemento com rotação própria | Mantém sua rotação relativa nas quatro páginas |
| Texto produto com height 3/padding 1 | Erro/aviso útil; nunca fonte abaixo do mínimo |
| Padding escalar | Mesmo valor nos quatro lados |
| Padding por lado | Cada lado reduz corretamente a área útil |
| Margin em container | Participa do fluxo e do cálculo de overflow |
| `textMargin: 0` | Zero é preservado |
| Mnemônico não declarado | Aviso/erro aponta elemento e caminho |
| Variável obrigatória ausente | Erro identifica variável e registro |
| Caminho `produto.codigo` | Resolver, validar default e gerar teste corretamente |
| Container sem filhos | Aviso visual e na lista de problemas |
| Container com ciclo | Contrato rejeitado |
| Elemento fora da página | Aviso ou erro conforme política |
| JSON editado e não aplicado | Preview usa o JSON editado ou pede decisão; não sobrescreve |
| Background Data URI | Exportar/importar restaura exatamente a imagem |
| Múltiplos registros | Uma página correta por registro |
| Elemento travado como referência | Próximo elemento alinha sem mover a referência |
| Referência fixa | Vários elementos usam a mesma origem |
| Modo corrente | Cada elemento posicionado se torna a próxima referência |
| Snap com zoom diferente | Mesma tolerância visual e coordenada final em mm |
| Snaps concorrentes | Prioridade determinística e origem indicada |
| Design -> Dados | Mnemônicos viram valores sem mudar a geometria |
| Dados com vários registros | Seletor troca valores sem alterar o layout |
| Impressão | Canvas corresponde ao PDF gerado pelo mesmo renderer |
| Sobreposição | Caixas coincidem com os componentes impressos |
| Página mínima com `WebExLabelDesigner` | Editor completo funciona sem CSS/DOM do exemplo 031 |
| Página mínima com `WebExLabelGeneratorPanel` | Geração e preview funcionam sem lógica do exemplo 032 |
| Duas instâncias na mesma página | IDs, seleção, eventos e estado não colidem |
| Uso headless | `WebExLabelPDFGenerator` gera sem montar interface |
| Labels isolado | Habilita `WebExFeatureJsPDF` e gera sem injeção jsPDF própria |
| Labels + Markdown | jsPDF é carregado uma única vez |
| Falha no jsPDF | Erro de dependência descritivo antes da geração |
| Feature jsPDF isolada | Cria PDF mínimo sem carregar JsBarcode ou Labels |
| Markdown -> PDF | Adaptador opcional usa DOM renderizado, sem depender de Labels |

### 3.3 Critérios de aceite

- [x] `WebExFeatureLabels` registra dependências e CSS estrutural do recurso sem
  conhecer os exemplos.
- [x] jsPDF é fornecido exclusivamente por `WebExFeatureJsPDF`.
- [x] `WebExFeatureLabels` não injeta nem versiona jsPDF diretamente.
- [x] O renderer especializado de Labels permanece independente de Markdown.
- [x] A feature genérica não conhece contrato, elementos ou classes de Labels.
- [x] Duas features consumidoras podem coexistir sem duplicar scripts ou estado.
- [x] `WebExLabelDesigner` é um produto final reutilizável e renderiza toda sua
  interface funcional.
- [x] `WebExLabelGeneratorPanel` é um produto final reutilizável para preview,
  download e impressão.
- [x] `WebExLabelPDFGenerator` continua disponível para consumo headless.
- [x] Os exemplos 031 e 032 contêm somente página, configuração, dados
  demonstrativos e, quando útil, escuta de eventos públicos.
- [x] Os exemplos 031 e 032 não fornecem CSS estrutural nem comportamento
  indispensável aos componentes.
- [x] `fwwebex-label-designer` representa apenas o componente, não a posição no
  grid do exemplo.
- [x] Designer e painel de geração podem ser instanciados em outra página sem
  copiar DOM, CSS ou JavaScript dos exemplos.
- [x] Mais de uma instância pode coexistir na mesma página sem colisão.
- [x] Preview e PDF usam o mesmo contrato, dados e motor.
- [x] Confirmar equivalência visual das quatro rotações no teste raster real;
  dimensões e matrizes também estão cobertas pelos testes determinísticos.
- [x] A rotação não modifica cálculo de fonte, padding ou módulo do barcode.
- [x] `minFontSize` nunca é violado silenciosamente.
- [x] Padding e margin aceitam valores independentes por lado.
- [x] Todas as propriedades comuns podem ser configuradas pelo inspetor.
- [x] Um elemento pode ser travado e definido como referência magnética.
- [x] O usuário consegue posicionar uma sequência sem editar coordenadas no
  JSON.
- [x] Referência fixa e modo corrente possuem comportamento previsível.
- [x] Design, Dados e Impressão podem ser alternados sem perda de estado.
- [x] O modo Dados mostra os valores reais durante a edição.
- [x] O modo Impressão usa o mesmo renderer da geração final.
- [x] Fazer a sobreposição coincidir com a página efetivamente rasterizada pelo
  visualizador, usando o viewport controlado do PDF.js e a matriz da página.
- [x] Opções avançadas continuam disponíveis pelo JSON.
- [x] Alterações manuais no JSON nunca são perdidas silenciosamente.
- [x] O validador informa problemas com caminho e elemento identificáveis.
- [x] O contrato declara ou identifica todos os mnemônicos utilizados.
- [x] Containers possuem hierarquia e ordem determinísticas.
- [x] O background embutido sobrevive ao round-trip sem alteração.
- [x] Layouts v1 continuam abrindo e gerando PDF.
- [x] Os READMEs refletem somente o comportamento realmente entregue.

### 3.4 Orientações para execução

- Trabalhar em etapas pequenas e verificáveis.
- Antes de editar, inspecionar `AGENTS.md`, estado do Git e alterações locais.
- Não apagar nem reformatar alterações do usuário que não pertençam à tarefa.
- Não iniciar pela interface: estabilizar contrato, validação e renderer antes
  de reescrever o exemplo 031.
- Não usar o exemplo como local definitivo de regras do componente.
- Não criar uma segunda implementação de layout para o canvas.
- Sempre comparar canvas, preview e PDF após alterações no motor.
- Renderizar PDFs de teste e inspecionar visualmente as quatro rotações.
- Ao concluir cada etapa, atualizar as caixas deste TODO e registrar decisões
  que tenham alterado o contrato.
