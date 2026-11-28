# Exemplo 038 — WebExBrowse (Fase 1)

Demonstra o componente `WebExBrowse` (`src/fw.webex/contrib/fw.webex.browse/`) em execução no `TWebEngine` com `TWebChannel`, reproduzindo o modelo de programação do `FWBrowse`:

* Provedor `SetDataArray()` com paginação, busca e ordenação *server-side* no AppServer (pronto para trocar para `SetDataTable()` + `SetAlias("SA1")` ou `SetDataQuery()` + `SetQuery(...)`).
* Legendas avaliadas no servidor (`AddLegend`).
* Definição de colunas compatível com `FWBrowse` (`AddColumn`).
* Eventos bidirecionais `SetChange`, `SetDoubleClick` e botão na barra de ações (`AddButton`) com recarga automática da página atual.

## Execução no Protheus

Compile o diretório `src/fw.webex/contrib/fw.webex.browse/` e `src/fw.webex/tests/fw.webex.examples/038/` e execute:

```advpl
u_FWWebExExample_038()
```
