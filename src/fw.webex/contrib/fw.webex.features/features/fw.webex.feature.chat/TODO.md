# TODO.md — `fw.webex.feature.chat`

> **Status:** proposta / arquitetura inicial  
> **Componente:** `fw.webex.feature.chat`  
> **Projeto:** `fw.webex`  
> **Data:** 2026-09-14  
> **Objetivo:** implementar uma camada de chat segura, reutilizável e orientada a eventos do ERP sobre FWWebEx, aproveitando o bridge `TWebChannel` existente sem depender do protocolo WebSocket interno do WebApp/TOTVS.

---

## 1. Visão

Criar uma feature genérica de comunicação colaborativa para aplicações Protheus/FWWebEx capaz de oferecer:

- conversas diretas entre usuários;
- grupos/canais;
- conversas vinculadas a contextos do ERP;
- mensagens do próprio Protheus (eventos de negócio);
- presença, entrega e leitura;
- menções e referências a entidades do ERP;
- interface moderna HTML/CSS/JavaScript;
- persistência auditável no backend;
- autorização sempre decidida pelo servidor;
- integração com o bridge `FWWebEx.TWebChannel` já existente;
- fallback quando push em tempo real entre sessões não estiver disponível;
- API pública para que qualquer rotina Protheus possa publicar eventos no chat.

A feature deve funcionar como infraestrutura genérica, e **não** como uma customização específica de PCP, Faturamento, Comercial ou qualquer cliente.

Nome de trabalho:

```text
fw.webex.feature.chat
```

API JavaScript alvo:

```javascript
FWWebEx.Chat.init(options)
FWWebEx.Chat.open(target)
FWWebEx.Chat.send(message)
FWWebEx.Chat.on(eventName, callback)
FWWebEx.Chat.destroy()
```

API TLPP alvo, conceitualmente:

```advpl
FWWebExChat():Publish(...)
FWWebExChat():Notify(...)
FWWebExChat():CreateRoom(...)
FWWebExChat():AddMember(...)
FWWebExChat():GetMessages(...)
```

---

## 2. Princípios arquiteturais

### 2.1. Não acoplar ao WebSocket interno do WebApp

O chat **não deve** tentar interceptar, reutilizar ou depender diretamente do protocolo WebSocket privado utilizado internamente pelo WebApp/SmartClient Web para comunicação com o AppServer.

Motivos:

- protocolo interno pode mudar entre builds;
- não existe contrato público para uso da aplicação;
- introduziria dependência forte da implementação TOTVS;
- aumentaria o risco de segurança e incompatibilidade;
- dificultaria testes isolados do FWWebEx.

A integração deve utilizar somente contratos controlados pelo FWWebEx:

```text
Browser/FWWebEx
      │
      ▼
FWWebEx.TWebChannel
      │
      ▼
TWebChannel / AppServer
      │
      ▼
TLPP / Chat Service
```

### 2.2. O browser nunca é autoridade de identidade

O JavaScript pode solicitar ações, porém nunca deve determinar usuário autenticado, empresa, filial, grupos de acesso, salas permitidas, permissões administrativas, autor da mensagem ou owner de uma conversa.

Exemplo de payload não confiável:

```json
{
  "user": "ADMIN",
  "room": "DIRETORIA",
  "message": "teste"
}
```

O campo `user`, caso exista, deve ser ignorado pelo servidor. A identidade efetiva deve ser derivada da sessão Protheus.

```text
Sessão Protheus
     │
     ├─ usuário autenticado
     ├─ empresa
     ├─ filial
     ├─ ambiente
     └─ grupos/permissões
             │
             ▼
          Chat ACL
```

### 2.3. Server authoritative

Toda operação sensível deve ser validada no backend: enviar mensagem, abrir conversa, consultar histórico, convidar/remover participante, anexar conteúdo, criar canal, editar/apagar mensagem, consultar presença e publicar referência ERP. O DOM é somente uma camada de apresentação.

### 2.4. Feature genérica + providers

`fw.webex.feature.chat` deve separar:

```text
UI / Runtime JS
      │
      ▼
Chat Client API
      │
      ▼
Transport Provider
      │
      ▼
Chat Service TLPP
      │
      ├─ Persistence Provider
      ├─ Identity Provider
      ├─ Authorization Provider
      ├─ Event Provider
      └─ ERP Reference Provider
```

Isso permitirá no futuro substituir persistência, transporte ou backend sem reescrever a UI.

---

## 3. Dependências FWWebEx

A primeira implementação deve reutilizar os contratos já existentes no projeto.

### 3.1. TWebChannel

Usar:

```javascript
FWWebEx.TWebChannel.send(eventName, payload)
```

para envio de eventos simples Browser -> Protheus.

Usar:

```javascript
FWWebEx.TWebChannel.onAdvplToJs(function (codeType, codeContent, objectName) {
    // recebe push/eventos do host
});
```

para eventos Protheus -> Browser.

### 3.2. RequestHandler

Operações request/response devem preferir:

```javascript
FWWebEx.RequestHandler.execute({
    requestData: request,
    callbackEvent: "CHAT_RESPONSE",
    execEvent: "CHAT_EXEC"
});
```

ou eventos equivalentes definidos pela feature.

O `RequestHandler` deve ser utilizado para bootstrap, listar conversas, buscar histórico, paginação, pesquisa, criação de sala, atualização de membros e recuperação de referências ERP.

### 3.3. Lifecycle da feature

Seguir o padrão atual:

```advpl
class WebExFeatureChat from WebExControl
    protected data oFeature as object

    public method Enable(nPriority as numeric) as object
    public method Load(oControl as object,nPriority as numeric) as object
end class
```

Com runtime JavaScript inserido via:

```advpl
beginContent var cRuntime
    // JavaScript
endContent
```

Evitar concatenação extensa com `cHTML += ...`.

---

## 4. Estrutura proposta

```text
src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.chat/
│
├── TODO.md
├── README.md
│
├── fw.webex.feature.chat.tlpp
├── fw.webex.feature.chat.service.tlpp
├── fw.webex.feature.chat.repository.tlpp
├── fw.webex.feature.chat.security.tlpp
├── fw.webex.feature.chat.events.tlpp
├── fw.webex.feature.chat.references.tlpp
│
├── assets/
│   ├── fw.webex.chat.js
│   ├── fw.webex.chat.css
│   └── fw.webex.chat.icons.js
│
├── tests/
│   ├── chat-runtime.test.mjs
│   ├── chat-protocol.test.mjs
│   ├── chat-security.test.mjs
│   └── fixtures/
│
└── examples/
    ├── basic/
    ├── direct-message/
    ├── room/
    ├── erp-context/
    └── protheus-events/
```

A localização definitiva dos assets deve seguir a política futura de externalização/governança do FWWebEx. Na primeira POC o runtime pode permanecer embarcado no `.tlpp`, desde que seja organizado para futura extração.

---

## 5. Componentes

### 5.1. `WebExFeatureChat`

Responsável por registrar a feature, carregar CSS/runtime JS, registrar `FWWebEx.Chat`, validar dependências, expor readiness e controlar init/destroy.

Não deve acessar banco diretamente, conhecer tabelas Protheus, aplicar regras específicas de clientes ou conhecer regras de PCP/Faturamento/etc.

### 5.2. `FWWebEx.Chat` — runtime JavaScript

API pública proposta:

```javascript
FWWebEx.Chat.isReady()
FWWebEx.Chat.init(options)
FWWebEx.Chat.destroy()

FWWebEx.Chat.getCurrentUser()
FWWebEx.Chat.getRooms()
FWWebEx.Chat.open(roomId)
FWWebEx.Chat.close()

FWWebEx.Chat.send({ roomId, text, replyTo, references })
FWWebEx.Chat.edit(messageId, text)
FWWebEx.Chat.remove(messageId)

FWWebEx.Chat.loadMessages(roomId, options)
FWWebEx.Chat.markRead(roomId, messageId)

FWWebEx.Chat.on(eventName, callback)
FWWebEx.Chat.off(eventName, callback)
```

Eventos públicos:

```text
ready
connected
disconnected
room:opened
room:updated
message:received
message:sent
message:updated
message:removed
message:read
presence:changed
typing:changed
error
```

### 5.3. Chat Service TLPP

Criar uma fachada única para operações do domínio.

```text
ChatService
 ├─ GetBootstrap()
 ├─ ListRooms()
 ├─ GetRoom()
 ├─ GetMessages()
 ├─ SendMessage()
 ├─ EditMessage()
 ├─ DeleteMessage()
 ├─ MarkRead()
 ├─ SetPresence()
 ├─ CreateRoom()
 ├─ AddMember()
 ├─ RemoveMember()
 └─ PublishSystemEvent()
```

Toda chamada deve passar por:

```text
Identity -> Authorization -> Validation -> Domain -> Repository -> Event
```

### 5.4. Repository

Criar contrato de persistência para evitar banco hardcoded na UI/service.

```advpl
class FWWebExChatRepository
    public method CreateRoom(hRoom)
    public method GetRoom(cRoomId)
    public method ListRooms(cUserId,hOptions)
    public method AddMember(cRoomId,cUserId,hOptions)
    public method RemoveMember(cRoomId,cUserId)
    public method InsertMessage(hMessage)
    public method UpdateMessage(hMessage)
    public method GetMessages(cRoomId,hOptions)
    public method MarkRead(cRoomId,cUserId,cMessageId)
end class
```

A primeira implementação pode usar tabelas Protheus/SQL Server.

---

## 6. Modelo de dados lógico

Evitar definir aliases definitivos antes da POC. Trabalhar inicialmente com entidades lógicas.

### 6.1. CHAT_ROOM

```text
ID
TYPE                 DIRECT | GROUP | CONTEXT
TITLE
COMPANY
BRANCH
CONTEXT_TYPE
CONTEXT_KEY
CREATED_BY
CREATED_AT
UPDATED_AT
ACTIVE
```

### 6.2. CHAT_MEMBER

```text
ROOM_ID
USER_ID
ROLE                 OWNER | ADMIN | MEMBER | READONLY
JOINED_AT
LAST_READ_MESSAGE_ID
LAST_READ_AT
MUTED
ACTIVE
```

### 6.3. CHAT_MESSAGE

```text
ID
ROOM_ID
AUTHOR_USER_ID
TYPE                 TEXT | SYSTEM | EVENT | FILE | REFERENCE
TEXT
REPLY_TO
CREATED_AT
UPDATED_AT
DELETED_AT
CLIENT_MESSAGE_ID
SEQUENCE
```

`CLIENT_MESSAGE_ID` deve permitir idempotência em retransmissões do browser.

### 6.4. CHAT_REFERENCE

```text
MESSAGE_ID
TYPE                 PRODUCT | ORDER | OP | NF | CUSTOMER | SUPPLIER | CUSTOM
KEY
LABEL
METADATA_JSON
```

### 6.5. CHAT_RECEIPT

Opcional na POC; necessário para confirmação individual de entrega/leitura.

```text
MESSAGE_ID
USER_ID
DELIVERED_AT
READ_AT
```

---

## 7. Identidade e autorização

### TODO P0 — Identity Provider

- [ ] Criar `FWWebExChatIdentity`.
- [ ] Derivar usuário da sessão Protheus.
- [ ] Derivar empresa/filial da sessão.
- [ ] Não aceitar identidade enviada pelo browser.
- [ ] Normalizar identificador de usuário.
- [ ] Expor somente metadados necessários à UI.
- [ ] Nunca enviar informações sensíveis da sessão ao DOM.

Shape público sugerido:

```json
{
  "id": "000123",
  "displayName": "Naldo",
  "company": "01",
  "branch": "01"
}
```

### TODO P0 — Authorization Provider

Toda operação deve verificar:

```text
CanReadRoom(user, room)
CanWriteRoom(user, room)
CanManageRoom(user, room)
CanReadMessage(user, message)
CanEditMessage(user, message)
CanDeleteMessage(user, message)
CanPublishReference(user, type, key)
```

Regras mínimas:

- autor pode editar sua mensagem dentro da política definida;
- usuário não pode consultar salas das quais não participa;
- sala de contexto respeita empresa/filial e ACL do contexto;
- eventos de sistema não podem ser forjados pelo browser;
- `OWNER`/`ADMIN` são calculados no backend;
- IDs recebidos do cliente sempre devem ser revalidados.

---

## 8. Protocolo Browser ↔ Protheus

Definir protocolo versionado desde a POC.

### 8.1. Envelope

```json
{
  "protocol": "fw.webex.chat/1",
  "id": "request-uuid",
  "type": "chat.message.send",
  "timestamp": 1789400000000,
  "payload": {}
}
```

Resposta:

```json
{
  "protocol": "fw.webex.chat/1",
  "requestId": "request-uuid",
  "ok": true,
  "data": {},
  "error": null
}
```

Evento assíncrono:

```json
{
  "protocol": "fw.webex.chat/1",
  "event": "chat.message.created",
  "sequence": 123456,
  "data": {}
}
```

### 8.2. Eventos iniciais

```text
CHAT_BOOTSTRAP
CHAT_LIST_ROOMS
CHAT_GET_MESSAGES
CHAT_SEND_MESSAGE
CHAT_EDIT_MESSAGE
CHAT_DELETE_MESSAGE
CHAT_MARK_READ
CHAT_OPEN_ROOM
CHAT_CLOSE_ROOM
CHAT_PRESENCE
CHAT_TYPING
```

Eventos push:

```text
CHAT_MESSAGE_CREATED
CHAT_MESSAGE_UPDATED
CHAT_MESSAGE_DELETED
CHAT_ROOM_UPDATED
CHAT_READ_UPDATED
CHAT_PRESENCE_UPDATED
CHAT_SYSTEM_EVENT
```

---

## 9. Bootstrap

```javascript
const chat = await FWWebEx.Chat.init({
    mount: "#fwwebex-chat",
    realtime: true,
    historyPageSize: 50
});
```

Fluxo:

```text
FWWebEx.Chat.init()
        │
        ▼
RequestHandler.execute(CHAT_BOOTSTRAP)
        │
        ▼
ChatService.GetBootstrap()
        │
        ├─ identidade
        ├─ capacidades
        ├─ rooms recentes
        ├─ unread counts
        ├─ configuração
        └─ realtime capability
        │
        ▼
render UI
```

Resposta exemplo:

```json
{
  "user": {},
  "capabilities": {
    "edit": true,
    "delete": true,
    "typing": false,
    "presence": true,
    "attachments": false,
    "realtime": true
  },
  "rooms": [],
  "server": {
    "protocol": "fw.webex.chat/1",
    "heartbeatMs": 30000
  }
}
```

---

## 10. Tempo real

Esta é a principal hipótese técnica a validar na POC.

### Hipótese A — Push via TWebChannel

```text
Usuário A
   │ SendMessage
   ▼
ChatService
   │
   ├─ persiste
   └─ publica evento
          │
          ▼
Sessão Usuário B
          │
          ▼
AdvplToJs
          │
          ▼
FWWebEx.Chat
```

### POC obrigatória

- [ ] abrir duas sessões Protheus simultâneas;
- [ ] registrar um chat FWWebEx em ambas;
- [ ] enviar uma mensagem na sessão A;
- [ ] persistir a mensagem;
- [ ] descobrir se o backend consegue entregar push direcionado à sessão B;
- [ ] medir latência;
- [ ] validar comportamento com sessões em AppServers distintos;
- [ ] validar comportamento atrás de broker/balanceador;
- [ ] validar reconexão.

### Decisão arquitetural

Se o TWebChannel não fornecer mecanismo seguro/estável de broadcast cross-session, **não hackear o protocolo interno TOTVS**.

Adotar fallback:

```text
Browser
  │
  ├─ TWebChannel para request/response
  │
  └─ polling incremental de eventos
         GET events after sequence X
```

Polling inicial recomendado:

```text
janela ativa:          1–2 s
janela em background:  5–10 s
chat minimizado:       10–30 s
```

O polling deve usar cursor/sequence e nunca recarregar o histórico completo.

No futuro pode ser criado um transport provider dedicado:

```text
FWWebEx.ChatTransportTWebChannel
FWWebEx.ChatTransportPolling
FWWebEx.ChatTransportWebSocket
```

---

## 11. Event bus interno

Criar um dispatcher no backend para desacoplar persistência da entrega.

```advpl
ChatEvents():Publish("message.created",hEvent)
```

Consumidores futuros:

```text
TWebChannel dispatcher
Notification center
Email adapter
Push adapter
Audit logger
Bot/automation
```

O serviço de domínio não deve conhecer a UI.

---

## 12. Chat orientado a contexto ERP

Uma room pode ser ligada a uma entidade Protheus:

```json
{
  "type": "CONTEXT",
  "context": {
    "type": "ORDER",
    "key": "012345"
  }
}
```

Exemplos:

```text
ORDER     Pedido de Venda
OP        Ordem de Produção
NF        Nota Fiscal
PRODUCT   Produto
CUSTOMER  Cliente
SUPPLIER  Fornecedor
CUSTOM    entidade definida pelo consumidor
```

API JS:

```javascript
FWWebEx.Chat.open({
    contextType: "ORDER",
    contextKey: "012345"
});
```

API TLPP conceitual:

```advpl
FWWebExChat():OpenContext("ORDER","012345")
```

A resolução da chave e autorização pertence ao backend.

---

## 13. Referências ERP dentro das mensagens

Suportar tokens estruturados, por exemplo:

```text
@produto 099482225
@pedido 012345
@op 004512
@nf 000998
```

Não transformar texto arbitrário em SQL.

```text
mensagem
   │
   ▼
parser controlado
   │
   ▼
reference resolver
   │
   ├─ valida tipo
   ├─ valida chave
   ├─ valida acesso
   └─ obtém descrição segura
   │
   ▼
metadata estruturada
```

Resultado:

```json
{
  "text": "Verificar @produto 099482225",
  "references": [
    {
      "type": "PRODUCT",
      "key": "099482225",
      "label": "Produto 099482225"
    }
  ]
}
```

A UI pode renderizar a referência como chip/link.

---

## 14. Eventos do próprio Protheus

Criar API para mensagens produzidas pelo ERP.

```advpl
FWWebExChat():Notify(; 
    "#PCP",;
    "OP 004512 liberada para producao",;
    {;
        "type" => "OP",;
        "key"  => "004512";
    };
)
```

Ou:

```advpl
FWWebExChat():PublishContextEvent(; 
    "OP",;
    "004512",;
    "production.released",;
    hPayload;
)
```

A feature deve distinguir claramente:

```text
USER MESSAGE
SYSTEM MESSAGE
ERP EVENT
```

Mensagens `SYSTEM`/`ERP EVENT` só podem ser criadas por backend autorizado.

---

## 15. UI inicial

```text
┌──────────────────────────────────────────────────────────┐
│  Chat Protheus                                      ×   │
├──────────────────┬───────────────────────────────────────┤
│ Buscar           │ # PCP                                │
│                  │                                      │
│ ● João           │ João                    13:41         │
│ ● Maria          │ OP 004512 foi liberada.              │
│ ○ Carlos         │                                      │
│                  │ Maria                   13:42         │
│ # PCP            │ Perfeito.                            │
│ # Faturamento    │                                      │
│ # Comercial      │ [OP 004512]                          │
│                  │                                      │
│                  ├───────────────────────────────────────┤
│                  │ Digite uma mensagem...          ➤    │
└──────────────────┴───────────────────────────────────────┘
```

### MVP visual

- [ ] lista de rooms;
- [ ] unread badge;
- [ ] header da conversa;
- [ ] lista virtualizada ou incremental de mensagens;
- [ ] composer;
- [ ] botão enviar;
- [ ] reply;
- [ ] timestamps;
- [ ] status de envio;
- [ ] loading/error states;
- [ ] dark/light usando tokens do FWWebEx quando disponíveis;
- [ ] layout responsivo.

### Pós-MVP

- [ ] emoji;
- [ ] reactions;
- [ ] attachments;
- [ ] drag/drop;
- [ ] edit/delete;
- [ ] typing indicator;
- [ ] presença;
- [ ] pesquisa;
- [ ] pins;
- [ ] threads;
- [ ] voice/video explicitamente fora do escopo inicial.

---

## 16. Segurança de conteúdo

### P0

- [ ] nunca inserir `message.text` com `innerHTML` sem sanitização;
- [ ] usar `textContent` para texto puro;
- [ ] sanitizar HTML quando algum renderer explicitamente permitir markup;
- [ ] bloquear `<script>`, handlers inline e URLs perigosas;
- [ ] escapar atributos;
- [ ] limitar tamanho máximo de mensagem;
- [ ] limitar quantidade de referências;
- [ ] validar Unicode/control chars;
- [ ] implementar rate limiting no backend;
- [ ] evitar SQL construído com entrada do browser;
- [ ] registrar falhas de autorização;
- [ ] não expor stack trace ao cliente.

Integração direta com o backlog de segurança do FWWebEx referente a escaping/sanitização deve ser considerada obrigatória.

---

## 17. Transporte seguro

O chat deve assumir transporte protegido pelo ambiente Protheus/WebApp.

Requisitos:

- HTTPS/WSS em produção;
- nenhuma credencial no JavaScript;
- nenhum token persistido em `localStorage` sem necessidade;
- não confiar em IDs de sessão informados pelo browser;
- payloads pequenos e limitados;
- validar versão do protocolo;
- heartbeat/reconnect controlados;
- rejeitar eventos desconhecidos.

Criptografia ponta-a-ponta não faz parte do MVP.

Se futuramente existir necessidade de E2EE, deverá ser um projeto separado, pois afeta auditoria, busca, indexação, bots, eventos do ERP, retenção e compliance.

---

## 18. Idempotência

Enviar mensagem deve aceitar um `clientMessageId` criado no browser:

```javascript
crypto.randomUUID()
```

```text
send(clientMessageId)
       │
       ├─ timeout/retry
       │
       ▼
server verifica clientMessageId + user
       │
       ├─ já existe -> retorna mensagem existente
       └─ não existe -> grava
```

Evita mensagens duplicadas em reconexões.

---

## 19. Ordenação

Não depender exclusivamente do horário do browser.

Cada room deve possuir ordenação baseada no servidor:

```text
SEQUENCE bigint
```

Ou identificador monotônico equivalente.

```json
{
  "id": "...",
  "sequence": 48123,
  "createdAt": "2026-09-14T13:45:30-03:00"
}
```

O cursor incremental deve usar `sequence`.

---

## 20. Histórico e paginação

```javascript
FWWebEx.Chat.loadMessages(roomId, {
    before: 48123,
    limit: 50
});
```

Nunca carregar todo o histórico.

Critérios:

- paginação reversa;
- índice por `ROOM_ID + SEQUENCE`;
- resposta limitada;
- continuidade estável mesmo com novas mensagens;
- suporte futuro a retenção/arquivamento.

---

## 21. Presença

Não implementar presença global antes de validar custo.

Estados iniciais:

```text
ONLINE
AWAY
OFFLINE
UNKNOWN
```

Presença não deve ser derivada apenas do DOM.

POC:

- registrar atividade da sessão;
- heartbeat controlado;
- TTL;
- remover presença órfã após timeout;
- não gravar heartbeat em tabela transacional de alto custo a cada segundo.

Alternativas:

- cache em memória por AppServer;
- provider externo futuro;
- tabela temporária/leve;
- desabilitar feature se topologia distribuída não suportar estado global.

---

## 22. Typing indicator

Pós-MVP. Não persistir em banco.

Eventos efêmeros:

```text
typing.start
typing.stop
```

Com TTL curto e rate limit obrigatório.

---

## 23. Multi-AppServer / Broker

Testes obrigatórios antes de declarar realtime pronto:

- [ ] usuário A e B no mesmo AppServer;
- [ ] usuário A e B em AppServers diferentes;
- [ ] broker ativo;
- [ ] sticky session;
- [ ] reconexão após queda de AppServer;
- [ ] failover;
- [ ] sessão retomada;
- [ ] evento não pode desaparecer silenciosamente.

Se o estado de presença/assinatura ficar local ao processo, criar abstraction provider antes de escalar a feature.

---

## 24. API de publish para customizações

Objetivo: permitir que qualquer rotina Protheus publique eventos sem conhecer transporte/UI.

```advpl
FWWebExChat():Publish(; 
    "room:PCP",;
    {;
        "type"    => "ERP_EVENT",;
        "event"   => "production.order.released",;
        "message" => "OP 004512 liberada para producao",;
        "refType" => "OP",;
        "refKey"  => "004512";
    };
)
```

Ou por contexto:

```advpl
FWWebExChat():PublishContext(; 
    "ORDER",;
    cPedido,;
    "sales.order.invoiced",;
    hData;
)
```

Essa API deve ser independente do FWWebEx estar aberto no momento. Persistir primeiro; entregar depois.

---

## 25. Bots / automação

Futuro.

O desenho deve permitir usuários não-humanos controlados pelo backend:

```text
SYSTEM
BOT
ERP
```

Exemplo:

```text
🤖 Protheus
Pedido 012345 faturado.
NF 000998
Valor: R$ 18.450,00

[Abrir NF]
```

Não permitir que o browser selecione `authorType=SYSTEM`.

---

## 26. Anexos

Fora do primeiro MVP.

Quando implementado:

- não armazenar base64 grande dentro da mensagem;
- provider de storage;
- whitelist de MIME type;
- limite de tamanho;
- nome seguro;
- hash;
- autorização no download;
- antivírus/scan quando infraestrutura permitir;
- evitar caminhos locais fornecidos pelo usuário;
- não expor arquivo por URL pública previsível.

Mensagem armazena somente referência ao attachment.

---

## 27. Pesquisa

Fase posterior.

```javascript
FWWebEx.Chat.search({
    query: "OP 004512",
    roomId: "...",
    limit: 50
});
```

Requisitos:

- ACL aplicada antes do retorno;
- filtros por room/data/autor;
- nunca buscar mensagens de rooms inacessíveis;
- indexação futura opcional.

---

## 28. Observabilidade

Criar logs com categorias próprias:

```text
FWCHAT/TRANSPORT
FWCHAT/AUTH
FWCHAT/ROOM
FWCHAT/MESSAGE
FWCHAT/EVENT
FWCHAT/REALTIME
FWCHAT/SECURITY
```

Métricas importantes:

```text
mensagens/minuto
latência send->persist
latência persist->delivery
requests ativos
erros de autorização
reconnects
poll requests/minuto
rooms ativas
sessões conectadas
```

Nunca logar texto completo da mensagem por padrão em produção.

---

## 29. Tratamento de erros

```json
{
  "code": "FWCHAT_ROOM_ACCESS_DENIED",
  "message": "Acesso nao permitido a conversa.",
  "retryable": false
}
```

Códigos iniciais:

```text
FWCHAT_PROTOCOL_INVALID
FWCHAT_NOT_READY
FWCHAT_TRANSPORT_OFFLINE
FWCHAT_REQUEST_TIMEOUT
FWCHAT_ROOM_NOT_FOUND
FWCHAT_ROOM_ACCESS_DENIED
FWCHAT_MESSAGE_INVALID
FWCHAT_MESSAGE_TOO_LARGE
FWCHAT_MESSAGE_NOT_FOUND
FWCHAT_MESSAGE_EDIT_DENIED
FWCHAT_RATE_LIMITED
FWCHAT_SERVER_ERROR
```

Stack trace somente no log servidor.

---

## 30. Configuração

```javascript
FWWebEx.Chat.init({
    mount: "#fwwebex-chat",
    pageSize: 50,
    maxMessageLength: 4000,
    realtime: "auto",
    polling: {
        activeMs: 1500,
        backgroundMs: 10000
    },
    features: {
        edit: true,
        delete: true,
        reactions: false,
        attachments: false,
        presence: true,
        typing: false
    }
});
```

O servidor deve devolver capabilities finais. Configuração do cliente nunca aumenta permissão concedida pelo servidor.

---

## 31. Performance

Diretrizes:

- não manter query longa aberta para simular realtime;
- não executar polling por mensagem individual;
- usar cursor incremental;
- inserts simples;
- índices adequados;
- evitar `Reclock()` em loops quando operação puder ser set-based;
- agrupar receipts quando possível;
- lazy-load do histórico;
- lazy-load da feature se chat não for utilizado;
- minimizar payload TWebChannel;
- não retransmitir histórico completo em reconnect.

---

## 32. Testes

### JavaScript

- [ ] init idempotente;
- [ ] destroy limpa listeners;
- [ ] subscribe/unsubscribe;
- [ ] parsing de protocolo;
- [ ] ordenação por sequence;
- [ ] deduplicação por ID;
- [ ] optimistic message;
- [ ] retry;
- [ ] timeout;
- [ ] reconnect;
- [ ] XSS fixtures;
- [ ] invalid event;
- [ ] room switch race condition;
- [ ] histórico incremental.

### TLPP

- [ ] identidade não vem do browser;
- [ ] ACL por room;
- [ ] ACL por empresa/filial;
- [ ] usuário externo à room não lê histórico;
- [ ] usuário read-only não envia;
- [ ] mensagem duplicada por `clientMessageId` não duplica registro;
- [ ] evento SYSTEM não pode ser criado pelo cliente;
- [ ] paginação correta;
- [ ] referência ERP inválida é rejeitada;
- [ ] erro interno não vaza stack trace.

### Integração

- [ ] duas sessões;
- [ ] múltiplas abas;
- [ ] WebApp;
- [ ] SmartClient quando aplicável;
- [ ] perda de conexão;
- [ ] reconnect;
- [ ] AppServer restart;
- [ ] multi-AppServer;
- [ ] broker;
- [ ] 50 usuários simulados;
- [ ] 100 usuários simulados;
- [ ] 500 usuários — teste exploratório conforme infraestrutura disponível.

---

## 33. POC 0 — provar o transporte

**Prioridade: P0**

Objetivo: antes de criar UI completa, provar comunicação bidirecional entre duas sessões.

### Entregável

```text
Sessão A                         Sessão B
────────                         ────────
[ mensagem ] [Enviar]            histórico
```

### Checklist

- [ ] criar feature mínima `WebExFeatureChat`;
- [ ] registrar `FWWebEx.Chat`;
- [ ] criar `CHAT_EXEC`;
- [ ] criar `CHAT_RESPONSE`;
- [ ] enviar A -> TLPP;
- [ ] persistir;
- [ ] retornar ACK para A;
- [ ] tentar push TLPP -> B;
- [ ] medir latência;
- [ ] validar cross-session;
- [ ] documentar limitações encontradas.

### Gate

Somente avançar para realtime definitivo depois de responder:

> É possível direcionar um `AdvplToJs` de forma estável e suportável para outra sessão conectada sem depender de APIs privadas do WebApp?

Se **sim**, criar `ChatTransportTWebChannelRealtime`.

Se **não**, implementar `ChatTransportPolling` como baseline confiável.

---

## 34. POC 1 — chat direto

**Prioridade: P0**

- [ ] bootstrap;
- [ ] identificar usuário corrente;
- [ ] listar usuários elegíveis;
- [ ] criar room `DIRECT`;
- [ ] enviar texto;
- [ ] histórico;
- [ ] unread count;
- [ ] mark read;
- [ ] refresh/reconnect sem duplicação.

Critério de aceite:

```text
Usuário A abre conversa com B
A envia mensagem
B recebe ou detecta incrementalmente
B fecha/reabre FWWebEx
histórico permanece correto
```

---

## 35. POC 2 — room/grupo

**Prioridade: P1**

- [ ] room `GROUP`;
- [ ] owner/admin/member;
- [ ] adicionar membro;
- [ ] remover membro;
- [ ] ACL;
- [ ] unread por membro;
- [ ] nome/descrição da room;
- [ ] evento de entrada/saída.

---

## 36. POC 3 — contexto ERP

**Prioridade: P1**

Escolher um caso simples, por exemplo Pedido ou OP.

- [ ] criar room por contexto;
- [ ] abrir chat a partir da rotina;
- [ ] resolver contexto no backend;
- [ ] autorização contextual;
- [ ] renderizar referências;
- [ ] botão "Abrir registro";
- [ ] publicar evento do ERP.

Exemplo de aceite:

```text
OP 004512
└─ chat contextual
   ├─ João: aguardando componente
   ├─ Maria: material liberado
   └─ 🤖 Protheus: OP liberada para producao
```

---

## 37. MVP

O MVP estará completo quando possuir:

- [ ] feature carregável pelo lifecycle FWWebEx;
- [ ] runtime `FWWebEx.Chat`;
- [ ] identidade server-side;
- [ ] ACL;
- [ ] direct messages;
- [ ] groups;
- [ ] persistência;
- [ ] histórico paginado;
- [ ] unread/read;
- [ ] realtime ou polling incremental confiável;
- [ ] reconnect;
- [ ] mensagens ERP/system;
- [ ] uma integração contextual real;
- [ ] proteção XSS;
- [ ] rate limiting básico;
- [ ] testes;
- [ ] exemplo funcional;
- [ ] README.

---

## 38. Roadmap sugerido

| Fase | Prioridade | Objetivo | Status |
|---|---:|---|---|
| CHAT-000 | P0 | Definir protocolo `fw.webex.chat/1` | TODO |
| CHAT-001 | P0 | Criar skeleton `WebExFeatureChat` | TODO |
| CHAT-002 | P0 | Identity Provider | TODO |
| CHAT-003 | P0 | Authorization Provider | TODO |
| CHAT-004 | P0 | Repository mínimo | TODO |
| CHAT-005 | P0 | POC cross-session TWebChannel | TODO |
| CHAT-006 | P0 | Fallback polling incremental | TODO |
| CHAT-007 | P0 | Direct messages | TODO |
| CHAT-008 | P0 | Histórico/paginação | TODO |
| CHAT-009 | P0 | Read/unread | TODO |
| CHAT-010 | P1 | Rooms/grupos | TODO |
| CHAT-011 | P1 | UI completa | TODO |
| CHAT-012 | P1 | Context rooms ERP | TODO |
| CHAT-013 | P1 | ERP references | TODO |
| CHAT-014 | P1 | API `Publish/Notify` TLPP | TODO |
| CHAT-015 | P1 | ERP/System messages | TODO |
| CHAT-016 | P1 | Multi-AppServer/Broker validation | TODO |
| CHAT-017 | P1 | Security hardening | TODO |
| CHAT-018 | P1 | Observabilidade | TODO |
| CHAT-019 | P2 | Presence | TODO |
| CHAT-020 | P2 | Typing | TODO |
| CHAT-021 | P2 | Reactions/emoji | TODO |
| CHAT-022 | P2 | Search | TODO |
| CHAT-023 | P2 | Attachments | TODO |
| CHAT-024 | P2 | Bots/automation | TODO |
| CHAT-025 | P2 | Notifications externas/provider | TODO |

---

## 39. Critérios para não virar uma customização monolítica

A implementação deve ser rejeitada em review se:

- possuir regra de cliente dentro da feature;
- acessar SC5/SC6/SD2/etc. diretamente no runtime genérico;
- usar usuário recebido do JavaScript como identidade;
- depender de protocolo privado WebApp;
- misturar renderização da UI com persistência SQL;
- criar `StartJob()` por usuário conectado;
- manter uma thread Protheus bloqueada por sessão esperando mensagem;
- fazer polling carregando histórico inteiro;
- inserir texto de mensagem via `innerHTML` sem sanitização;
- depender de variáveis globais não namespaced;
- gravar estado efêmero de typing/presença em alta frequência sem estratégia própria.

---

## 40. Questões técnicas que a POC precisa responder

1. Qual o melhor mecanismo suportado para identificar a sessão atual e o usuário no Chat Service?
2. É possível emitir `AdvplToJs` para uma sessão diferente daquela que originou a execução?
3. Como localizar uma sessão ativa de um usuário sem depender de API privada?
4. Qual o comportamento do bridge atrás de múltiplos AppServers?
5. O broker mantém afinidade suficiente para push direcionado?
6. Qual o custo de polling incremental para 50/100/500 usuários?
7. Qual provider deve manter presença em topologia distribuída?
8. Qual estratégia usar para gerar IDs/sequence de forma segura e performática no SQL Server?
9. Qual tabela/alias customizado será adotado no primeiro exemplo Protheus?
10. Como integrar ACL do chat com grupos/permissões Protheus sem amarrar o core a um cliente?
11. Como abrir uma rotina/registro Protheus a partir de uma referência renderizada no chat de forma segura?
12. Quais eventos do ERP serão utilizados no primeiro exemplo real?

---

## 41. Primeiro exemplo recomendado

### `fw.webex.example.chat.001`

Tema:

```text
Chat direto entre duas sessões Protheus
```

Objetivos:

- provar bridge;
- provar identidade;
- provar persistência;
- provar entrega incremental;
- provar sanitização;
- medir latência.

Não incluir inicialmente anexos, emoji, reactions, bots, typing, pesquisa ou contexto ERP complexo.

---

## 42. Segundo exemplo recomendado

### `fw.webex.example.chat.002`

Tema:

```text
Chat contextual de Ordem de Produção
```

Fluxo:

```text
abrir OP
   │
   ▼
abrir painel FWWebEx Chat
   │
   ▼
room context = OP/004512
   │
   ├─ mensagens humanas
   └─ eventos do Protheus
```

Esse exemplo deve provar o diferencial da feature: **chat consciente do ERP**.

---

## 43. Visão de longo prazo

Se a arquitetura provar estabilidade, `fw.webex.feature.chat` pode evoluir para uma camada colaborativa do Protheus:

```text
                 FWWebEx Chat
                      │
        ┌─────────────┼─────────────┐
        │             │             │
     pessoas        grupos       contextos ERP
        │             │             │
        └─────────────┼─────────────┘
                      │
                 Event Bus
                      │
       ┌──────────────┼──────────────┐
       │              │              │
     PCP          Faturamento     Comercial
       │              │              │
       └──────────────┼──────────────┘
                      │
                   Protheus
```

O objetivo final não é reproduzir WhatsApp/Teams dentro do ERP.

O diferencial deve ser:

> **comunicação colaborativa nativamente integrada ao contexto e aos eventos do Protheus.**

Uma mensagem pode conhecer um pedido, produto, OP, NF, cliente ou qualquer entidade exposta por um provider do ERP; e uma rotina Protheus pode publicar eventos para usuários e grupos sem conhecer detalhes da UI ou transporte.

---

## 44. Definição de sucesso

A feature será considerada arquiteturalmente bem-sucedida quando:

1. nenhum componente depender do protocolo WebSocket privado do WebApp;
2. identidade/autorização forem 100% server-side;
3. duas sessões conseguirem trocar mensagens com entrega confiável;
4. o funcionamento permanecer válido em topologia real com broker/AppServers;
5. o chat funcionar mesmo com realtime indisponível, via fallback incremental;
6. mensagens puderem ser associadas a entidades Protheus;
7. qualquer rotina TLPP puder publicar eventos sem conhecer a UI;
8. o runtime JavaScript permanecer independente das tabelas/persistência;
9. a feature puder ser utilizada por diferentes clientes sem fork;
10. segurança, observabilidade e testes fizerem parte do core desde a primeira versão.

---

## 45. Próximo passo

Implementar **CHAT-000 + CHAT-001 + CHAT-005** em conjunto:

```text
1. protocolo
2. skeleton da feature
3. POC de transporte entre duas sessões
```

Antes de investir na UI completa, precisamos provar a principal incógnita técnica:

> **qual é o mecanismo suportado e confiável para propagar um evento de chat de uma sessão Protheus para outra em uma topologia com WebApp, AppServer e broker?**

A partir dessa resposta escolhemos o transport provider definitivo sem acoplar o projeto a internals da TOTVS.
