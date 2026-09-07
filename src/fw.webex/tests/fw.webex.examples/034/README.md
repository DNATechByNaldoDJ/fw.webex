# FWWebEx Example 034 — rótulos SVG e PDF consolidado

Exemplo de geração de rótulos no TOTVS Protheus usando FWWebEx, SVG,
JsBarcode, html2canvas e jsPDF.

Fonte principal: [`fw.webex.example.034.tlpp`](fw.webex.example.034.tlpp).

## Objetivo

Demonstrar uma arquitetura especializada para rótulos com:

- dimensões físicas controladas pelo SVG;
- dados variáveis identificados por IDs;
- redução automática de fontes;
- códigos de barras EAN-13 e Code 128;
- processamento sequencial;
- PDF multipágina consolidado;
- abertura por Blob;
- download como fallback quando a nova guia for bloqueada.

O template SVG não é transportado em Base64. Ele é publicado com `CpyF2Web` e
carregado pelo navegador como `./arquivo.svg`, reduzindo consideravelmente o
volume das strings manipuladas pelo AdvPL/TLPP.

## Arquitetura

```text
TLPP + FWWebEx
 ├─ grava o template SVG no AppServer
 ├─ publica o SVG com CpyF2Web
 ├─ monta a interface com WebExPage e componentes FWWebEx
 ├─ externaliza as bibliotecas e o script da engine
 └─ publica e abre o HTML no TWebEngine
      │
      └─ Navegador
          ├─ fetch("./template.svg")
          ├─ clona o template para cada registro
          ├─ preenche os elementos identificados
          ├─ ajusta as fontes com getBBox()
          ├─ gera o barcode com JsBarcode
          ├─ captura uma página por vez com html2canvas
          ├─ adiciona cada página ao jsPDF
          └─ abre o PDF final por Blob ou inicia o download
```

## Por que o SVG é responsável pelo layout

Em vez de manter coordenadas específicas de cada modelo no fonte TLPP, o SVG
define:

- largura e altura em milímetros;
- `viewBox` e proporção;
- posição e dimensão de cada campo;
- família, peso e tamanho de fonte;
- área disponível para textos variáveis;
- localização e dimensão do código de barras.

O Protheus fornece os dados e coordena a publicação. O navegador realiza os
ajustes gráficos e a geração do PDF.

## Contrato do template demonstrativo

O template embutido no exemplo usa `130 mm × 115 mm` e contém estes IDs:

| ID | Conteúdo |
|---|---|
| `product` | produto |
| `batch` | lote |
| `manufacture` | fabricação |
| `expiration` | validade |
| `weight` | peso |
| `volume` | volume destacado |
| `species` | espécie da embalagem |
| `barcode` | SVG interno preenchido pelo JsBarcode |

Campos textuais ausentes são ignorados. Volume e espécie são avaliados
independentemente; o grupo `volume-species` é ocultado somente quando os dois
estão vazios.

## Ajuste automático de fonte

Textos variáveis declaram limites no próprio SVG:

```xml
<text id="species"
      data-fit-width="112"
      data-fit-height="6"
      data-min-font-size="2"
      data-max-font-size="7" />
```

A função `fitText()` usa busca binária e `getBBox()` para encontrar o maior
tamanho que respeite simultaneamente a largura e a altura disponíveis.

## Código de barras

O formato é selecionado conforme o conteúdo:

- 13 dígitos: `EAN13`;
- demais valores: `CODE128`.

Depois da execução do JsBarcode, o exemplo restaura os atributos externos do
elemento:

- `x`;
- `y`;
- `width`;
- `height`;
- `preserveAspectRatio`.

O `viewBox` é calculado a partir das dimensões determinísticas geradas pela
biblioteca. Isso impede que textos variáveis de outros campos desloquem o
barcode entre páginas.

## Processamento e memória

Os rótulos são renderizados um de cada vez:

1. o SVG é inserido na área oculta;
2. os dados são aplicados;
3. fontes e ciclos de pintura são aguardados;
4. o rótulo é capturado;
5. a imagem é adicionada ao PDF;
6. o DOM da página é descartado antes do próximo registro.

O SVG externo não é repetido dentro da string HTML para cada rótulo. Essa
abordagem reduz a pressão sobre `MaxStringSize` e a memória do AppServer.

## Características FWWebEx utilizadas

- página e estrutura visual construídas pela DSL FWWebEx;
- `WebExButton` para iniciar a geração;
- painel de status atualizado durante o processo;
- `WebExScript` com `.SetExternalAssets(.T.)`;
- `WebFileTools():CpyF2WebRelativeURL()`;
- `WebFileTools():HTMLFromControl()`;
- `FWExampleTools():HtmlFileShow()`;
- comunicação por `FWWebEx.TWebChannel.send()`;
- callback personalizado em `bJSToAdvPL`.

As bibliotecas e a engine são reunidas em um External Asset publicado pelo
próprio FWWebEx. O template SVG é publicado separadamente.

## Pré-requisitos

Devem existir no RPO recursos com os seguintes nomes:

- `JsBarCode.all.min.js`;
- `html2canvas.min.js`;
- `jspdf.umd.min.js`.

Também são necessários:

- `TWebEngine`, `TWebChannel` e `CpyF2Web` disponíveis;
- WebAgent conectado;
- permissão para criar arquivos no diretório temporário do FWWebEx.

## Como executar

Compile o fonte e execute:

```advpl
u_FWWebExExample_034()
```

Ou acesse:

```text
FWWebEx → Labels → u_FWWebExExample_034
```

Na página, pressione **Gerar PDF demonstrativo**. O exemplo gera três rótulos
com combinações diferentes de produto, volume, espécie e código de barras.

## Adaptando para dados reais

O array `labels` é fixo e contém apenas dados demonstrativos. Em produção:

1. valide os registros no TLPP;
2. serialize os dados como JSON;
3. aplique escape adequado antes de inseri-los no HTML/JavaScript;
4. não concatene valores recebidos de usuários sem validação;
5. mantenha o processamento sequencial para lotes grandes.

Para novos modelos SVG:

1. defina `width`, `height` e `viewBox`;
2. mantenha `preserveAspectRatio="xMidYMid meet"` no SVG raiz e no barcode;
3. preserve os IDs utilizados pela engine;
4. configure as propriedades `data-fit-*`;
5. teste textos vazios, curtos, longos e em maiúsculas;
6. homologue as dimensões físicas na impressora utilizada.

## Abertura do PDF

O documento inteiro é gerado antes da abertura:

```javascript
const blob = pdf.output("blob");
const url = URL.createObjectURL(blob);
const popup = window.open(url, "_blank");
```

Quando `window.open()` é bloqueado, um link temporário inicia o download. A URL
do Blob é revogada após o período de segurança.

## Segurança e limitações

- O exemplo não acessa tabelas Protheus.
- Os dados são exclusivamente demonstrativos.
- Templates publicados não devem conter informações sensíveis.
- Caminhos de arquivo não devem ser controlados diretamente pelo usuário.
- Falhas HTTP são tratadas antes da geração do PDF.
- As bibliotecas de terceiros mantêm suas próprias licenças.
- Calibração da impressora e margens físicas devem ser homologadas à parte.
