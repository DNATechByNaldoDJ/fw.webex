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

## ExifReader

`WebExFeatureExifReader` oferece leitura genérica de metadados de imagens, sem
depender de Labels ou de outro domínio consumidor. A feature fixa ExifReader
4.42.0 e publica `FWWebEx.ImageMetadata.ExifReader`:

```tlpp
WebExFeatureExifReader():Enable()
```

```javascript
const metadata = await FWWebEx.ImageMetadata.ExifReader.inspect(file);

console.log(metadata.pixelWidth, metadata.pixelHeight);
console.log(metadata.dpiX, metadata.dpiY);
console.log(metadata.physicalWidthMm, metadata.physicalHeightMm);
console.log(metadata.resolutionSource, metadata.warnings);
```

A API pública contém `version`, `isReady()`, `whenReady(timeout)`,
`getLibrary()`, `load(source, options)` e `inspect(source, options)`. `load()`
mantém acesso aos grupos originais do ExifReader e ativa `expanded` e
`computed` por padrão. Opções nativas podem ser passadas diretamente ou em
`readerOptions`.
Quando a origem vier do usuário, passe `File`, `Blob` ou bytes; uma string é
interpretada pelo ExifReader como URL e não deve receber um caminho/endereço
não confiável.

`inspect()` normaliza PNG (`pHYs`), JPEG (EXIF com fallback JFIF) e WebP
(EXIF). Para manter esse contrato, `inspect()` sempre força a saída agrupada
`expanded: true` e os valores calculados `computed: true`, mesmo que o chamador
forneça valores diferentes; `load()` permanece o acesso configurável aos tags
brutos. O resultado inclui os aliases planos abaixo e também os objetos
`pixelSize`, `resolution` e `physicalSize`:

- `format` e `mimeType`;
- `pixelWidth` e `pixelHeight` já orientados;
- `storedPixelWidth` e `storedPixelHeight` antes da orientação EXIF;
- `dpiX`, `dpiY`, `physicalWidthMm` e `physicalHeightMm`;
- `orientation`, `orientationDescription` e `orientationSwapsAxes`;
- `resolutionSource` (`png-pHYs`, `exif` ou `jpeg-jfif`);
- `warnings`, uma lista de objetos `{code, message, details?}`.

As orientações EXIF de 5 a 8 trocam os eixos de pixels e DPI. Metadados
ausentes, parciais, conflitantes ou fora da faixa usual geram avisos, sem
inventar uma resolução física. Use `{includeRaw: true}` somente quando o
resultado bruto também for necessário.

Falhas usam códigos estáveis: `FWIMAGEMETADATA_SOURCE_INVALID`,
`FWIMAGEMETADATA_READ_FAILED`,
`FWIMAGEMETADATA_EXIFREADER_DEPENDENCY_MISSING` e
`FWIMAGEMETADATA_EXIFREADER_VERSION_CONFLICT`.

ExifReader é distribuído sob [MPL-2.0](https://github.com/mattiasw/ExifReader/blob/main/LICENSE).
Metadados são conteúdo não confiável e
devem ser escapados antes de aparecerem em HTML. O asset ainda é servido por
`cdn.jsdelivr.net`; fallback local, SRI e modo offline seguem a política geral
acompanhada por `NX-017`.
