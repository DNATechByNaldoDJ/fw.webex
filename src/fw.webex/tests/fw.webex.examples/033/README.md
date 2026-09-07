# FWWebEx Example 033 — diagnóstico CpyF2Web

Exemplo executável para descobrir como o `TWebEngine` resolve recursos
publicados por `CpyF2Web` e comprovar a forma correta de carregar External
Assets no FWWebEx.

Fonte principal: [`fw.webex.example.033.tlpp`](fw.webex.example.033.tlpp).

## Objetivo

O `CpyF2Web` disponibiliza arquivos do AppServer no cache Web usado pelo
`TWebEngine`. Entretanto, o valor retornado não deve ser tratado como um caminho
relativo comum ao `document.baseURI`.

O exemplo publica um SVG mínimo, abre uma página construída com FWWebEx e testa
três estratégias de acesso ao mesmo arquivo:

1. retorno bruto do `CpyF2Web`;
2. retorno resolvido contra `document.baseURI`;
3. somente o nome do arquivo, relativo ao HTML: `./arquivo.svg`.

Para cada tentativa, a página apresenta:

- URL efetivamente consultada;
- status HTTP;
- quantidade de bytes recebidos;
- indicação de sucesso ou falha;
- preview do primeiro SVG carregado corretamente.

O resultado completo também é enviado ao AppServer por
`FWWebEx.TWebChannel.send()` e registrado por `ConOut()`.

## A descoberta demonstrada

Um HTML aberto pelo `TWebEngine` possui endereço semelhante a:

```text
https://servidor:porta/webapp/<sessao>/cache/<ambiente>/pagina.html?...parametros...
```

O `CpyF2Web` pode devolver para o SVG um caminho semelhante a:

```text
<sessao>/cache/<ambiente>/arquivo.svg
```

Quando esse retorno é resolvido diretamente contra `document.baseURI`, o
navegador pode duplicar os segmentos:

```text
/webapp/<sessao>/cache/<ambiente>/<sessao>/cache/<ambiente>/arquivo.svg
```

O resultado esperado é HTTP 404. Como o HTML e o SVG foram publicados no mesmo
contexto, a referência correta é:

```javascript
fetch("./arquivo.svg")
```

Os parâmetros acrescentados pelo `TWebEngine` à query string não impedem esse
acesso.

## Fluxo do exemplo

```text
TLPP
 ├─ cria um SVG temporário no filesystem do AppServer
 ├─ publica o SVG com CpyF2Web
 ├─ constrói a página por meio da DSL do FWWebEx
 ├─ externaliza o JavaScript com SetExternalAssets(.T.)
 ├─ grava e publica o HTML pelo fluxo FWExampleTools
 └─ abre a página no TWebEngine
      │
      └─ Navegador
          ├─ inspeciona location.href e document.baseURI
          ├─ executa as três tentativas de fetch
          ├─ apresenta os resultados
          └─ envia o diagnóstico ao TLPP pelo TWebChannel
```

## Características FWWebEx utilizadas

- `WebExPage`, `WebExBody`, `WebExMain` e `WebExContainer`;
- componentes de título, parágrafo e painéis de resultado;
- `WebExScript` com `.SetExternalAssets(.T.)`;
- `WebFileTools():HTMLFromControl()`;
- `FWExampleTools():HtmlFileShow()`;
- bridge `FWWebEx.TWebChannel`;
- callback personalizado em `bJSToAdvPL`.

O JavaScript do próprio diagnóstico também é um External Asset. Portanto, o
exemplo valida tanto a URL do SVG quanto o mecanismo corrigido de assets do
FWWebEx.

## Como executar

Compile o fonte e execute:

```advpl
u_FWWebExExample_033()
```

Ele também aparece em:

```text
FWWebEx → Labels → u_FWWebExExample_033
```

## Resultado esperado

A tentativa **Arquivo relativo ao HTML** deve retornar HTTP 200 e apresentar o
SVG. As estratégias que reutilizam o caminho completo podem retornar HTTP 404.

No console do AppServer será registrada uma linha semelhante a:

```text
FWWebEx example 033: [{...resultados...}]
```

## Exemplo de publicação correta

```advpl
cSVGWeb:=CpyF2Web(cSVGFile,.F.,.F.,.F.,.F.)
```

No navegador, use somente o arquivo irmão:

```javascript
const clean = new URL(document.baseURI);
clean.search = "";
clean.hash = "";

const svgURL = new URL("./arquivo.svg", clean).href;
```

Pontos importantes:

- `lIsUserDiskDir=.F.` porque o SVG foi criado no AppServer;
- publique o recurso antes de abrir o HTML;
- use o retorno completo somente quando ele for apropriado para navegação;
- para um asset irmão, use `./nome-do-arquivo.ext`;
- remova os arquivos temporários após fechar o exemplo.

## Segurança

- Não publique segredos ou dados sensíveis como assets temporários.
- Não permita que entradas do usuário escolham caminhos arbitrários.
- Valide o status HTTP e o conteúdo antes de inseri-lo no DOM.
- Faça escape dos valores inseridos em JavaScript.

## Escopo

Este exemplo não gera rótulos ou PDFs. Sua única responsabilidade é demonstrar
e diagnosticar a publicação e a resolução HTTP de recursos pelo
`CpyF2Web`/`TWebEngine`.
