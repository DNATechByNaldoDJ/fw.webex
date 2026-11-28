# Exemplo 039 — WebExFormBrowse (Fase 2)

Demonstra o `WebExFormBrowse` sobre `WebExLayer` com todos os recursos da Fase 2:

* Layout em 2 colunas (`CENTER` + `RIGHT`) e janelas recolhíveis (`WebExLayer`).
* Barra de pesquisa rápida por ordem/campo (`WebExBrowseSeek`).
* Painel recolhível de filtros pré-definidos e dinâmicos + banner de filtros ativos (`WebExBrowseFilter`).
* Modal explicativo de legendas (`WebExBrowseLegend`).
* Painel inferior de detalhes (`SetDetails`) atualizado automaticamente ao selecionar cada linha.
* Hooks `SetBeforeExec` / `SetAfterExec` e ações no painel lateral.

## Execução no Protheus

Compile `src/fw.webex/contrib/fw.webex.browse/` e `src/fw.webex/tests/fw.webex.examples/039/` e execute:

```advpl
u_FWWebExExample_039()
```
