# 💡 Exemplo de uso (23)

O exemplo 023 combina SBAdmin, DataTables server-side e uma chamada ADVPL pelo
TWebChannel. Ele também serve como referência para o bridge
`FWWebEx.TWebChannel` usado por `FWWebEx.RequestHandler`.

<img width="1359" height="766" alt="Dashboard do exemplo 023" src="https://github.com/user-attachments/assets/2977e2c4-b6b1-4fbc-bd14-031566a07019" />

## Por que o bridge é necessário

O TWebEngine abre o HTML do FWWebEx em um `iframe`. O WebApp pode ter carregado
as bibliotecas TOTVS no documento pai, mas o objeto `window.twebchannel` não é
automaticamente compartilhado com o documento filho. O FWWebEx, portanto:

- reutiliza o provider quando ele já está visível no frame atual;
- carrega somente `twebchannel.js` quando necessário;
- não depende nem injeta `totvstec.js` ou `fwprotheus.js`; eventual uso desses
  arquivos é interno à plataforma;
- usa primeiro uma origem configurada, depois o asset do ambiente Protheus e,
  por último, a versão fixada no CDN.

## Fluxo do exemplo

No JavaScript da página, `FWWebEx.RequestHandler.execute()` aguarda a conexão,
envia `CALLBACK_EXEC` e registra a resposta em `CALLBACK_DATA_RESPONSE`. O
receptor não substitui diretamente `window.twebchannel.advplToJs`; ele é
registrado no bridge:

```javascript
FWWebEx.TWebChannel.onAdvplToJs(function (codeType, codeContent) {
    if (codeType !== 'CALLBACK_RESPONSE') return false;

    try {
        FWWebEx.TWebChannel.getEventTarget().dispatchEvent(
            new CustomEvent('CALLBACK_DATA_RESPONSE', {
                detail: JSON.parse(codeContent)
            })
        );
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
});
```

O retorno `true` informa ao bridge que a mensagem foi tratada. Ao retornar
`false` — inclusive para um tipo desconhecido ou JSON inválido — o bridge
delega a mensagem ao `advplToJs` anterior da plataforma, se houver.

Cada chamada do DataTable usa `FWWebEx.RequestHandler.execute()`. O handler
serializa requests com o mesmo `callbackEvent`, evitando que duas esperas por
`CALLBACK_DATA_RESPONSE` consumam a mesma resposta. `responseTimeout` pode ser
informado por chamada e usa 30 segundos por padrão:

```javascript
FWWebEx.RequestHandler.execute({
    requestData: request,
    execEvent: 'CALLBACK_EXEC',
    callbackEvent: 'CALLBACK_DATA_RESPONSE',
    responseTimeout: 30000,
    onResponse: function (json) {
        // Atualiza o DataTable.
    },
    onError: function (error) {
        console.error(error.code, error.message);
    }
});
```

O listener e o timer são removidos tanto no sucesso quanto no erro. Se o
Protheus não responder no prazo, `onError` recebe
`FWWEBEX_TWEBCHANNEL_RESPONSE_TIMEOUT` e a fila é liberada para a próxima
requisição.

No ADVPL, `WebApp():GetTWebChannel()` continua sendo criado somente quando o
arquivo HTML foi gerado e será realmente exibido. Os callbacks permanecem
associados a `CALLBACK_EXEC:CALLBACK_RESPONSE` por
`FWExampleTools():htmlFileShow()`.

## Configuração opcional da origem

Em ambientes sem acesso ao fallback CDN, configure um asset local antes da
primeira chamada:

```javascript
FWWebEx.config = FWWebEx.config || {};
FWWebEx.config.twebchannel = {
    src: '/webapp/meus-assets/twebchannel.js',
    loadTimeout: 5000,
    connectTimeout: 5000
};
```

`loadTimeout` e `connectTimeout` controlam, respectivamente, os budgets
internos compartilhados da carga do provider e da conexão, ambos com padrão de
5 segundos. O `timeout` passado a `load()`, `connect()` ou `send()` é um prazo
individual: ele pode encerrar a espera de um consumidor sem cancelar a operação
compartilhada utilizada por outros.

Não é necessário informar `src` no cenário normal: o bridge tenta descobrir
o `twebchannel.js` publicado sob o `AppRoot` do ambiente Protheus.

O `AppRootURI` é lido da seção de ambiente no `appserver.ini`. O sufixo deve
ser exatamente o valor retornado por `GetEnvServer()`; uma seção genérica
`[FWWEBEX]` não é consultada. Exemplo para o ambiente `PROTHEUS`:

```ini
[FWWEBEX_PROTHEUS]
AppRootURI=https://servidor:porta/app-root/
```

Se essa seção estiver incorreta ou `AppRootURI` estiver vazio, o helper
normaliza o valor para `/`. A origem continua sendo montada na raiz do site
(por exemplo, `/preindex_env_<ambiente>/twebchannel.js`), mas pode retornar 404
se o asset não estiver publicado ali; então o bridge segue para as demais
origens (configurada e CDN). Essa divergência de seção pode explicar por que o
asset da plataforma não foi encontrado no rastreio.

Se o diagnóstico confirmar que uma conexão existente ficou obsoleta, a
reconexão pode ser forçada de forma explícita:

```javascript
FWWebEx.TWebChannel.connect({ timeout: 5000, forceReconnect: true });
```

Não use `forceReconnect` como opção padrão: sem ela, o bridge reaproveita o
canal conectado ou aguarda a conexão que o preloader já iniciou.

## Diagnóstico

Execute os comandos no console do próprio frame que contém a página FWWebEx,
não apenas no frame pai:

```javascript
window.twebchannel
FWWebEx.TWebChannel.getState()
document.querySelectorAll('script[data-fwwebex-twebchannel]')
```

Também é possível acompanhar:

```javascript
FWWebEx.Events.on('FWWebEx:twebchannel:ready', console.log);
FWWebEx.Events.on('FWWebEx:twebchannel:error', console.error);
```

Em uma falha, confira `error.code`, `error.message` e
`FWWebEx.TWebChannel.getState().lastError`. Isso separa erros de carregamento,
provider incompatível, dependência ausente e timeout/falha de conexão.
