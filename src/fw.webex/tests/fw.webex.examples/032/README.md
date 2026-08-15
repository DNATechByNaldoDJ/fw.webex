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

---

Execute `u_FWWebExExample_032()` ou abra pelo menu de exemplos.

---

<img width="1359" height="670" alt="image" src="https://github.com/user-attachments/assets/1e1d3443-dc05-497b-95ba-b82c8bd7c832" />
<img width="1358" height="678" alt="image" src="https://github.com/user-attachments/assets/c636bb7f-be73-424f-aae7-a9a0e493fac4" />
<img width="1358" height="681" alt="image" src="https://github.com/user-attachments/assets/cdf0df05-f5e1-4247-84e0-db68111f993e" />
<img width="1359" height="674" alt="image" src="https://github.com/user-attachments/assets/701a8689-c2ac-46de-98a6-1b4d41e72063" />
<img width="1359" height="679" alt="image" src="https://github.com/user-attachments/assets/7bb784c7-74d9-44af-9417-866628b814b0" />
