# FWWebEx.Browse (Fases 1 e 2)

Módulo `contrib` do **FWWebEx** para portabilidade Web das classes de visualização do TOTVS Protheus (`FWBrowse`, `FWFormBrowse`, `FWLayer`, `FWLegend`, `FWFilter` e `FWSeek`), mantendo WorkArea, codeblocks e paginação no AppServer com transporte bidirecional via `TWebChannel`.

## Arquitetura entregue

### Fase 1 — Core Grid
* `include/fw.webex.browse.th` — Constantes de alinhamento, eventos `TWebChannel` e provedores.
* `fw.webex.browse.column.tlpp` (`WebExBrowseColumn`) — Equivalente a `FWBrwColumn`.
* `fw.webex.browse.provider.tlpp` (`WebExBrowseArrayProvider`, `WebExBrowseTableProvider`, `WebExBrowseQueryProvider`) — Provedores server-side com integração a `Filter` e `Seek`.
* `fw.webex.browse.dispatcher.tlpp` (`WebExBrowseDispatcher`) — Roteamento de eventos `PAGE`, `SELECT`, `DBLCLICK`, `ACTION`, `FILTER` e `SEEK`.
* `fw.webex.browse.tlpp` (`WebExBrowse`) — Grid base sobre `WebExControl` + `WebExDataTable`.

### Fase 2 — Form & UX
* `fw.webex.layer.tlpp` (`WebExLayer`) — Equivalente Web para `FWLayer` (`AddLine`, `AddCollumn`, `AddWindow`, `GetWinPanel`) sobre `WebExRow`/`WebExCol` e cards recolhíveis Bootstrap 5.
* `fw.webex.browse.legend.tlpp` (`WebExBrowseLegend`) — Modal explicativo Bootstrap 5 para legendas.
* `fw.webex.browse.filter.tlpp` (`WebExBrowseFilter`) — Filtros pré-definidos (codeblock/expressão) + construtor dinâmico por campo/operador/valor avaliado no servidor.
* `fw.webex.browse.seek.tlpp` (`WebExBrowseSeek`) — Barra de pesquisa rápida por ordem/campo.
* `fw.webex.form.browse.tlpp` (`WebExFormBrowse`) — Equivalente a `FWFormBrowse` sobre `WebExLayer`, integrando `oPanelOptions`, `oPanelBrowse`, `oPanelDetails`, banner de filtros ativos, `SetBeforeExec`/`SetAfterExec` e modal de legenda.

## Exemplos

* `u_FWWebExExample_038()` — `WebExBrowse` (Fase 1).
* `u_FWWebExExample_039()` — `WebExFormBrowse` completo com `WebExLayer`, `Filter`, `Seek`, `Legend` e `Details` (Fase 2).

## Testes de contrato JS

```bash
node --test src/fw.webex/contrib/fw.webex.browse/tests/browse-runtime.test.mjs
```
