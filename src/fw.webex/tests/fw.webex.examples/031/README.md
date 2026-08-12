# Exemplo 031 — Designer de rótulos

Este exemplo mostra o `WebExLabelDesigner` como componente FWWebEx autocontido.
O programa consumidor fornece somente três configurações:

- `SetLayout(cLayoutJSON)`: contrato canônico `fwwebex.labels` v2;
- `SetRecords(cRecordsJSON)`: dados usados nos modos Dados, Validação e Preview;
- `SetOptions(cOptionsJSON)`: opções de apresentação e nome do PDF.

A barra de ferramentas, a prancheta, as camadas, o inspetor, os editores JSON, a
validação e o preview pertencem ao componente. O exemplo não mantém CSS
estrutural nem lógica JavaScript paralela.

`SetRecords([])` pode ser usado para começar sem dados: o designer cria exemplos
e acompanha os novos mnemônicos até a primeira edição manual. Depois disso, a
ação **Gerar / completar dados** acrescenta somente os campos ausentes e mantém
os valores já ajustados pelo usuário.

No modo Impressão, o componente gera o PDF canônico em memória, rasteriza a
página selecionada com `WebExFeaturePDFJS` e usa o viewport conhecido para
alinhar o overlay editável nas rotações 0, 90, 180 e 270 graus. O exemplo não
precisa carregar PDF.js nem calcular coordenadas por conta própria.

O contrato demonstra áreas explícitas para fluxo de conteúdo, textos com
autoajuste, alinhamentos, mnemônicos e código de barras configurável. A
simbologia `AUTO` escolhe `EAN13` para treze dígitos e usa `CODE128` como
fallback. Produto, código do produto, lote, validade, volume, espécie, peso
líquido e barcode são apenas dados demonstrativos; nenhuma regra do
`HORPCP02.tlpp` foi incorporada ao componente.

Para outro modelo de rótulo, substitua o contrato e os registros sem alterar o
designer. Uma imagem de fundo pode ser escolhida pela própria barra de
ferramentas. Ao importar, a feature genérica ExifReader ajusta a página pelas
medidas físicas da imagem; se não houver DPI, mantém a proporção e solicita a
conferência da medida.

Execute `u_FWWebExExample_031()` ou abra o item 031 pelo menu de exemplos.
