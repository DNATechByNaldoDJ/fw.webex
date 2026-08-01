# Features genéricas do FWWebEx

## jsPDF

`WebExFeatureJsPDF` disponibiliza jsPDF 4.2.1 sem conhecer rótulos,
Markdown ou outro domínio consumidor. A feature registra os assets uma única
vez no ciclo de vida do FWWebEx e publica:

```javascript
await FWWebEx.PDF.whenReady();

const pdf = FWWebEx.PDF.create({
  unit: "mm",
  format: "a4"
});

pdf.text("Documento FWWebEx", 20, 20);
const blob = pdf.output("blob");
const buffer = pdf.output("arraybuffer");
pdf.save("documento.pdf");
```

API base:

- `FWWebEx.PDF.version`;
- `isReady()`;
- `whenReady(timeout)`;
- `getConstructor()`;
- `create(documentOptions)`.

Em TLPP, habilite a feature no componente que precisa dela:

```tlpp
WebExFeatureJsPDF():Enable()
```

`WebExFeatureJsPDFHTML` é uma capacidade opcional. Ela carrega
html2canvas 1.4.1 e DOMPurify 3.4.7 e acrescenta
`FWWebEx.PDF.whenHTMLReady()` e `FWWebEx.PDF.renderElement()`. Esses assets não
são carregados por `WebExFeatureJsPDF` nem por Labels.

Strings HTML e elementos DOM são clonados e sanitizados por padrão antes da
renderização. Para conteúdo já sanitizado e controlado pelo aplicativo, esse
comportamento pode ser desativado explicitamente:

```javascript
await FWWebEx.PDF.whenHTMLReady();
await FWWebEx.PDF.renderElement(element, {
  sanitize: false,
  timeout: 10000
});
```

Falhas do renderer preservam a causa em um
`FWWebExPDFRenderError/FWPDF_HTML_RENDER_FAILED`.

### Limites da renderização HTML

A conversão HTML não garante equivalência com `window.print()`. Mesmo com a
sanitização padrão, o consumidor é responsável por:

- definir uma política de sanitização adequada ao conteúdo;
- assegurar CORS para imagens externas;
- aguardar fontes e imagens;
- definir margens e paginação;
- testar o subconjunto de CSS usado no documento.

Falhas de dependência produzem `FWWebExPDFDependencyError` na API base e
`FWPDF_HTML_DEPENDENCY_MISSING` no adaptador HTML. Labels usa somente a feature
base; JsBarcode e todas as regras de rótulo permanecem no domínio Labels.

Os assets possuem versões fixas, mas atualmente são servidos por
`cdn.jsdelivr.net`. Fallback local, SRI e modo offline pertencem à política
geral de assets acompanhada por `NX-017`.

## PDF.js

`WebExFeaturePDFJS` é a capacidade genérica de visualização de PDFs já
produzidos. Ela é independente de `WebExFeatureJsPDF`: jsPDF cria o documento;
PDF.js rasteriza uma página em um canvas controlado.

```tlpp
WebExFeaturePDFJS():Enable()
```

```javascript
const result = await FWWebEx.PDFViewer.renderPage(pdfArrayBuffer, {
  canvas: document.querySelector("canvas"),
  pageNumber: 1,
  targetWidth: 720,
  targetHeight: 480,
  pixelRatio: window.devicePixelRatio,
  signal: abortController.signal
});

// Libera página e documento carregados internamente.
await result.destroy();
```

A API pública contém `version`, `workerSrc`, `isReady()`, `whenReady()`,
`getLibrary()`, `configure()`, `load()`, `renderPage()` e `destroy()`.
`renderPage()` aceita `ArrayBuffer`, `TypedArray`, `Blob`, URL ou um documento
PDF.js já carregado. Os bytes recebidos são copiados antes de serem entregues ao
worker, e uma nova renderização no mesmo canvas cancela a anterior.

A versão fixada é PDF.js 3.11.174, usando o build clássico que publica
`window.pdfjsLib`; o worker usa obrigatoriamente a mesma versão. Aplicações com
CSP restritiva precisam autorizar o script e `worker-src` do CDN. A política de
asset local/same-origin, SRI e modo offline continua acompanhada por `NX-017`.
