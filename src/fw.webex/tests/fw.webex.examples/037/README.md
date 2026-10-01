# Exemplo 037 — CEP retornado ao Protheus

Execute `u_FWWebExExample_037()` ou selecione **FWWebEx → Forms →
u_FWWebExExample_037** no menu do exemplo 000.

A primeira interface WebEx, baseada no exemplo 003, consulta o CEP no ViaCEP
e tenta a BrasilAPI se a consulta falhar. JavaScript envia o JSON
`{id, origem, dados}` para o Protheus por `jsToAdvpl`, com o evento
`FWWEBEX_CEP_RESULT`, usando a ponte do `TWebChannel`.

O Protheus valida o retorno, fecha a consulta e cria outra interface WebEx em
um segundo `TWebEngine`, conectado ao mesmo `TWebChannel`. Essa interface
apresenta os dados recebidos em uma tabela **Campo / Valor**, inspirada no
exemplo 006, sem fazer outra consulta de CEP. As duas janelas são executadas
dentro de `FWExampleTools():Execute`; o callback anterior do canal é restaurado
ao fechar, cancelar ou ocorrer erro. O identificador da execução impede que
uma resposta antiga seja aceita após fechar e reabrir a consulta.

Compile `fw.webex.example.037.tlpp` e o fonte do exemplo 000 atualizado no RPO.
O ambiente precisa dos fontes FWWebEx de `core`, dos componentes de formulário,
script e tabela, de `contrib/fw.webex.features` com a feature DataTable e de
`FWExampleTools`, além de SmartClient com `TWebEngine` e `TWebChannel`. As
consultas e os recursos externos da página precisam de acesso à internet.
Se o recurso DataTable do CDN não carregar, os dados continuam visíveis em
uma tabela simples.

No Protheus, verifique:

- CEP válido: a consulta fecha e a segunda janela mostra os valores retornados.
- CEP inválido: a mensagem de validação mantém a consulta aberta.
- Falha do ViaCEP: o fallback BrasilAPI retorna os dados e sua origem.
- Cancelar ou fechar cada janela e executar novamente: o canal continua funcionando.
- A tabela Campo / Valor corresponde ao retorno, inclusive campos vazios e acentos.

Execute os cenários JavaScript a partir da raiz do repositório:

```powershell
node --test src/fw.webex/tests/fw.webex.examples/037/tests/cep-return.test.mjs
```

Os testes Node não substituem a compilação TLPP nem a execução e verificação
das janelas no Protheus.
