# Exemplo 032 - Painel gerador de PDF de rótulos

Este exemplo é um consumidor mínimo de `WebExLabelGeneratorPanel`. O componente
reutilizável entrega os editores JSON, a validação estruturada, o preview, o
download e a impressão; por isso o exemplo não mantém CSS, JavaScript, formulário
ou funções globais próprios.

O contrato canônico v2 e os dados demonstrativos são exatamente os mesmos do
exemplo 031. Eles incluem duas áreas explícitas, os mnemônicos `produto`,
`codigoProduto`, `lote`, `validade`, `volume`, `especie`, `pesoLiquido` e
`barcode`, além da simbologia configurável `AUTO`, com seleção entre EAN-13 e
CODE128 pelas regras do contrato.

A integração se resume a instanciar o painel e configurar `SetLayout`,
`SetRecords`, `SetFileName` e `SetOptions`.

Execute `u_FWWebExExample_032()` ou abra pelo menu de exemplos.
