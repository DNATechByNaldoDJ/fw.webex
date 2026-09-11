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
          ├─ aguarda as fontes e valida as configurações do SVG
          ├─ ajusta as fontes com getBBox() e mantém o vão visual entre volume/espécie
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

Campos textuais ausentes são ignorados. Legendas com `data-label-for` são
ocultadas quando o valor associado está vazio. Volume e espécie são avaliados
independentemente; o grupo `volume-species` é ocultado somente quando os dois
estão vazios.

## Ajuste automático de fonte

Textos variáveis declaram limites no próprio SVG. O exemplo utiliza o perfil
demonstrativo 1, com as mesmas faixas da tabela de impressão raster:

| Campo | Mínimo raster | Máximo raster | Altura disponível no SVG | Escala horizontal |
|---|---:|---:|---:|---:|
| `volume` | 14 | 23 | 16.227778 | 0.945 |
| `species` | 5 | 15 | 10.583333 | 0.945 |

Exemplo de configuração da espécie:

```xml
<text id="species"
      x="65" y="99" text-anchor="middle"
      font-family="Arial" font-weight="900"
      data-fit-width="112"
      data-fit-height="10.583333"
      data-min-font-size="5"
      data-max-font-size="15"
      data-font-unit="raster"
      data-font-scale-x="0.945" />
```

`createSVGLabelLayout(root, templateName).fit()` valida o template, aguarda as
fontes e usa busca binária com `getBBox()` para encontrar o maior tamanho que
respeite a largura e a altura disponíveis. Os elementos são consultados apenas
na raiz recebida: vários SVGs na mesma página podem usar os mesmos IDs.

| Atributo | Como ajustar |
|---|---|
| `data-fit-width`, `data-fit-height` | Largura e altura máximas, nas coordenadas locais do elemento. |
| `data-min-font-size`, `data-max-font-size` | Faixa positiva; o máximo deve ser maior ou igual ao mínimo. |
| `data-font-unit="svg"` | Tamanhos nas coordenadas locais do SVG; padrão quando omitido. |
| `data-font-unit="pt"` | Tamanhos em pontos CSS. |
| `data-font-unit="raster"` | Valores da tabela histórica; aplica a conversão de `4/3` para pontos CSS. |
| `data-font-scale-x` | Multiplicador horizontal positivo; padrão `1`. Usa `textLength` e `spacingAndGlyphs`. |

Todos os atributos numéricos `data-*` usam **números sem unidade, com ponto
decimal**. Escreva `7.25`; não use `7.25px`, `7.25pt` ou `7,25`. A unidade
fica somente em `data-font-unit`. Com `height="115mm"` e
`viewBox="0 0 130 115"`, uma unidade da raiz corresponde a 1 mm. A conversão
raster é `valor × 4/3 × 25.4/72` em milímetros; os grupos transformados têm sua
escala considerada. O tamanho nominal `font-size` é substituído durante o ajuste.

Quando nem a fonte mínima cabe, o motor pode reduzi-la abaixo do mínimo para
evitar que o conteúdo saia da caixa. O elemento recebe
`data-fit-below-min="true"`; `data-applied-font-size` registra a fonte final em
coordenadas locais. Esses atributos são resultados de execução e não precisam
ser gravados no modelo.

## Espaçamento entre volume e espécie

O grupo do exemplo define:

```xml
<g id="volume-species"
   data-volume-gap="0.57"
   data-volume-align="center"
   data-species-use-volume-font="true">
  <rect x="6" y="77" width="118" height="27" />
  <!-- text #volume e text #species como filhos diretos, com x/y numéricos -->
</g>
```

- `data-volume-gap` é a distância em **milímetros entre a tinta das letras**,
  e não a diferença entre os atributos `y`. O valor `0.57` permanece estável
  quando as fontes diminuem; use `0` para eliminar esse vão.
- `data-volume-align` aceita `start`, `center` e `end`, para posicionar o bloco
  no topo, centro ou base da caixa definida pelo primeiro `rect` filho direto.
- `data-species-use-volume-font="true"` usa a faixa de fonte do volume quando
  apenas a espécie tem conteúdo. A espécie continua respeitando sua caixa.
- Os textos devem ter `x` e `y` numéricos. Para girar ou redimensionar o bloco,
  aplique `transform` ao grupo, mantendo os textos como filhos diretos sem
  transformação individual.

O motor mede a tinta dos glifos, reposiciona os textos e, se necessário, reduz
o par para caber no `rect`, preservando o vão solicitado. Se os dois campos
estiverem vazios, oculta todo o grupo. Se só um estiver preenchido, alinha esse
texto na caixa sem reservar espaço para o outro. Templates antigos que omitem
`data-volume-gap` preservam as coordenadas originais dos textos.

## Mensagens que ajudam a corrigir o modelo

As falhas informam rótulo atual/total, produto, arquivo/URL do template, ID do
elemento, atributo/valor inválido e orientação de correção. A validação reúne
problemas de vários elementos antes de interromper a geração; a área de status
preserva as quebras de linha.

Por exemplo, se o volume tiver `data-max-font-size="7.25px"`, a mensagem aponta
`#volume`, o atributo e o valor recebido, e solicita um número sem unidade.
Depois de remover `px`, verifique também que o máximo é maior ou igual ao
mínimo — para o perfil demonstrativo 1, use mínimo `14` e máximo `23` com
`data-font-unit="raster"`. IDs repetidos dentro do mesmo SVG e configuração de
gap incompatível com a caixa também são diagnosticados.

## Manutenção e comparação com a impressão raster

1. Edite o SVG em `FWWebEx034Template()`, preservando a arte e os IDs dos campos.
2. Mantenha `width` e `height` em milímetros e `viewBox` coerente com a arte.
   O exemplo também fixa `130 × 115 mm` na área de captura e no jsPDF: ajuste
   os três pontos em conjunto se mudar o tamanho da página.
3. Para repetir outro perfil raster, copie seus mínimos/máximos nos textos e
   mantenha `data-font-unit="raster"`. Esse atributo converte a unidade; ele
   não consulta tabelas Protheus nem escolhe um perfil automaticamente.
4. Ajuste a largura/altura das caixas, a escala horizontal, o gap e a família
   de fonte. Mantenha a mesma fonte instalada no ambiente que renderiza os
   dois tipos de impressão quando a comparação exigir a mesma aparência.
5. Teste volume e espécie curtos, ambos longos, somente espécie, somente volume
   e ambos vazios. Compare o PDF em tamanho real com a saída raster.
6. Compile o exemplo e confirme as dimensões e o espaço entre os campos na
   impressora, sem a opção de ajustar a página à área imprimível.

As faixas, a conversão e o comportamento de ajuste são compatíveis com o fluxo
raster; diferenças nas fontes disponíveis e na rasterização podem alterar
pequenos detalhes dos glifos. O exemplo preserva sua arte e a família Arial.

## Código de barras

O formato é selecionado conforme o conteúdo:

- 13 dígitos: `EAN13`;
- demais valores: `CODE128`.

GTIN vazio limpa o barcode. Se houver GTIN e o elemento `#barcode` estiver
ausente, a geração informa como corrigir o template. Dimensões inválidas ou
não positivas retornadas pelo JsBarcode também geram diagnóstico.

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
