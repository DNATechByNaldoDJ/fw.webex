# Testes do core FWWebEx

Os testes deste diretório executam, em um DOM mínimo e isolado, os contratos
JavaScript definidos dentro dos fontes TLPP do core.

## TWebChannel

`twebchannel-bridge.test.mjs` extrai e executa os blocos
`FWWebEx.TWebChannel` e `FWWebEx.RequestHandler` de
`component/fw.webex.page.tlpp`. A suíte não acessa a rede nem depende de uma
instalação Protheus: providers e falhas de carregamento são simulados pelo
harness.

Cobertura principal:

- reutilização de `window.twebchannel` quando a plataforma já o publicou;
- uma única conexão diante de chamadas concorrentes, inclusive quando um
  preloader nativo já publicou evidência do transporte;
- conexão explícita quando `gotConnection` está falso sem evidência de
  transporte, ou quando `forceReconnect` foi solicitado antes ou depois da
  primeira conexão;
- conexão própria concluída apenas por seu callback, sem aceitar um evento
  `twebchannelready` tardio de outra tentativa;
- identidade estável do `EventTarget`, inclusive quando ele é solicitado antes
  do lazy load e o provider publica outro dispatcher;
- recepção AdvPL → JavaScript com confirmação explícita: mensagens tratadas não
  chegam ao stub anterior e mensagens livres usam o receptor legado como
  fallback;
- montagem da origem da plataforma inclusive com `AppRoot` igual a `/`;
- carregamento somente sob demanda, prazo total e ordem dos fallbacks, inclusive
  quando um script permanece silencioso sem disparar `load` ou `error`;
- deadlines individuais para consumidores concorrentes de um mesmo carregamento,
  nas ordens longo → curto e curto → longo;
- erro tipado, possibilidade de nova tentativa e limpeza de `lastError` após
  recuperação bem-sucedida;
- ausência de inclusão antecipada de `totvstec.js` e `fwprotheus.js` no HTML.

## RequestHandler

Cobertura principal:

- retorno booleano de `waitForConnection` preservado;
- payload `false` entregue sem ser confundido com ausência de resposta;
- timeout de resposta tipado como
  `FWWEBEX_TWEBCHANNEL_RESPONSE_TIMEOUT` e encaminhado a `onError`;
- limpeza de listeners, timers e animação tanto no sucesso quanto no timeout;
- serialização de operações que compartilham `callbackEvent`, sem consumo da
  resposta anterior;
- operações com eventos de callback diferentes progridem em paralelo.

Contagem atual: **21 testes**.

Execute na raiz do repositório:

```powershell
node --test src/fw.webex/core/tests/*.test.mjs
```
