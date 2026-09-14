# TODO.md — `fw.webex.feature.chat`

> **Status:** proposta / arquitetura inicial  
> **Componente:** `fw.webex.feature.chat`  
> **Projeto:** `fw.webex`  
> **Data:** 2026-09-14  
> **Objetivo:** implementar comunicação colaborativa segura, reutilizável e orientada a eventos do ERP sobre FWWebEx, incluindo colaboração interna e, futuramente, federação B2B entre organizações Protheus independentes.

---

## 1. Visão

Criar uma feature genérica capaz de oferecer:

- conversas diretas entre usuários;
- grupos/canais;
- conversas vinculadas a contextos do ERP;
- mensagens e eventos gerados pelo próprio Protheus;
- presença, entrega e leitura;
- referências a pedido, produto, OP, NF, cliente, fornecedor e outras entidades;
- persistência auditável;
- autorização server-side;
- integração com `FWWebEx.TWebChannel`;
- fallback quando realtime não estiver disponível;
- API TLPP para publicação de eventos;
- APIs REST internas e externas;
- captura de eventos do Protheus por Pontos de Entrada/adapters;
- evolução para colaboração federada entre empresas parceiras, clientes e fornecedores que utilizem Protheus.

O diferencial não é criar um clone de WhatsApp/Teams. É oferecer **comunicação colaborativa nativamente integrada ao contexto e aos eventos do Protheus**.

---

## 2. Princípios arquiteturais

### 2.1. Não acoplar ao WebSocket privado do WebApp

Não interceptar nem depender do protocolo WebSocket interno do WebApp/TOTVS. Utilizar somente contratos controlados pelo FWWebEx.

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

### 2.2. Browser nunca é autoridade de identidade

Usuário, empresa, filial, ACL, autoria, permissões e contexto autorizado devem ser derivados e validados no servidor.

### 2.3. Server authoritative

Toda operação sensível passa por:

```text
Identity -> Authorization -> Validation -> Domain -> Repository -> Event
```

### 2.4. Providers

```text
UI / Runtime JS
      │
Chat Client API
      │
Transport Provider
      │
Chat Service TLPP
      ├─ Persistence Provider
      ├─ Identity Provider
      ├─ Authorization Provider
      ├─ Event Provider
      └─ ERP Reference Provider
```

### 2.5. Event-driven e transport-agnostic

O domínio não deve depender diretamente de TWebChannel, REST, HTTPS B2B ou de um Ponto de Entrada específico.

```text
Protheus Hook / REST / Browser / Worker
              │
              ▼
       Canonical Event/API
              │
              ▼
       Collaboration Domain
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
   Chat    Internal   B2B
            REST     Federation
```

Assim, um evento como `PURCHASE_ORDER.CONFIRMED` pode nascer de um Ponto de Entrada, de uma API ou de processo batch sem duplicar regra de negócio.

---

## 3. Dependências FWWebEx

Reutilizar:

```javascript
FWWebEx.TWebChannel.send(eventName, payload)
FWWebEx.TWebChannel.onAdvplToJs(callback)
FWWebEx.RequestHandler.execute(options)
```

Seguir lifecycle atual:

```advpl
class WebExFeatureChat from WebExControl
    protected data oFeature as object
    public method Enable(nPriority as numeric) as object
    public method Load(oControl as object,nPriority as numeric) as object
end class
```

Runtime JavaScript extenso deve utilizar `BeginContent/EndContent`, evitando concatenações extensas de HTML/JS.

---

## 4. Estrutura proposta

```text
src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.chat/
├── TODO.md
├── README.md
├── fw.webex.feature.chat.tlpp
├── fw.webex.feature.chat.service.tlpp
├── fw.webex.feature.chat.repository.tlpp
├── fw.webex.feature.chat.security.tlpp
├── fw.webex.feature.chat.events.tlpp
├── fw.webex.feature.chat.references.tlpp
├── fw.webex.feature.chat.rest.internal.tlpp
├── fw.webex.feature.chat.rest.external.tlpp
├── fw.webex.feature.chat.protheus.events.tlpp
├── fw.webex.feature.chat.protheus.hooks.tlpp
├── fw.webex.feature.chat.federation.tlpp
├── fw.webex.feature.chat.b2b.tlpp
├── assets/
├── tests/
└── examples/
```

---

## 5. API JavaScript alvo

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
ready connected disconnected
room:opened room:updated
message:received message:sent message:updated message:removed message:read
presence:changed typing:changed
federation:connected federation:disconnected
business:event
error
```

---

## 6. Chat Service TLPP

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

API pública conceitual:

```advpl
FWWebExChat():Publish(...)
FWWebExChat():Notify(...)
FWWebExChat():PublishContext(...)
FWWebExChat():CreateRoom(...)
FWWebExChat():GetMessages(...)
```

---

## 7. Modelo lógico inicial

### CHAT_ROOM

```text
ID TYPE TITLE COMPANY BRANCH CONTEXT_TYPE CONTEXT_KEY
CREATED_BY CREATED_AT UPDATED_AT ACTIVE
```

### CHAT_MEMBER

```text
ROOM_ID USER_ID ROLE JOINED_AT LAST_READ_MESSAGE_ID LAST_READ_AT MUTED ACTIVE
```

### CHAT_MESSAGE

```text
ID ROOM_ID AUTHOR_USER_ID TYPE TEXT REPLY_TO
CREATED_AT UPDATED_AT DELETED_AT CLIENT_MESSAGE_ID SEQUENCE
```

### CHAT_REFERENCE

```text
MESSAGE_ID TYPE KEY LABEL METADATA_JSON
```

### CHAT_RECEIPT

Opcional inicialmente:

```text
MESSAGE_ID USER_ID DELIVERED_AT READ_AT
```

Usar `CLIENT_MESSAGE_ID` para idempotência e `SEQUENCE` server-side para ordenação/cursor incremental.

---

## 8. Dicionário Protheus

As tabelas da feature devem ser instaláveis sem cadastro manual no SIGACFG.

O Chat deve depender do componente genérico `FWWebEx.DictionaryPackage`, responsável por gerar os artefatos de `SYSTEMLOAD` (`sdfbra.txt`, `manifest_update.txt`, `hlppor.txt`, `hlpeng.txt`, `hlpspa.txt`) a partir de definição versionada do dicionário.

O Chat não deve manipular SX2/SX3/SIX diretamente.

---

## 9. Protocolo Browser ↔ Protheus

Versão inicial:

```text
fw.webex.chat/1
```

Envelope:

```json
{
  "protocol": "fw.webex.chat/1",
  "id": "request-uuid",
  "type": "chat.message.send",
  "timestamp": 1789400000000,
  "payload": {}
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

Eventos iniciais:

```text
CHAT_BOOTSTRAP CHAT_LIST_ROOMS CHAT_GET_MESSAGES CHAT_SEND_MESSAGE
CHAT_EDIT_MESSAGE CHAT_DELETE_MESSAGE CHAT_MARK_READ
CHAT_OPEN_ROOM CHAT_CLOSE_ROOM CHAT_PRESENCE CHAT_TYPING
```

---

## 10. Tempo real e fallback

### POC obrigatória

Validar duas sessões simultâneas:

```text
Usuário A -> ChatService -> persistência/evento -> Sessão B -> AdvplToJs -> FWWebEx.Chat
```

Pergunta de gate:

> É possível direcionar `AdvplToJs` de forma estável e suportável para outra sessão conectada sem depender de APIs privadas do WebApp?

Se sim, criar `ChatTransportTWebChannelRealtime`.

Se não, utilizar `ChatTransportPolling` como baseline confiável:

```text
persistência -> SEQUENCE global -> polling incremental -> eventos novos
```

Polling ativo ~1–2s; reduzir frequência em background/minimizado.

---

## 11. Multi-AppServer / Broker

Validar:

- sessões no mesmo AppServer;
- sessões em AppServers diferentes;
- broker/load balancer;
- sticky session;
- reconnect;
- failover;
- duplicidade e ordenação de eventos.

Persistência compartilhada deve permitir sincronização independente do processo AppServer que atende cada usuário.

---

## 12. Contexto ERP

Uma conversa pode ser associada a:

```text
PURCHASE_REQUEST
QUOTATION
PURCHASE_ORDER
SALES_ORDER
PRODUCT
CUSTOMER
SUPPLIER
OP
INVOICE
CUSTOM
```

Exemplo:

```text
@pedido 104587
@produto 099482225
@op 004512
@nf 000998
```

A feature deve permitir abrir diretamente a entidade correspondente quando houver provider registrado.

---

## 13. Eventos do próprio Protheus

Exemplos:

```text
🤖 Protheus: Pedido 104587 faturado. NF 000998.
🤖 PCP: OP 004512 aguardando componente.
🤖 Compras: Cotação 000812 recebeu nova proposta.
```

O evento deve ser produzido no backend; browser não pode forjar mensagens `SYSTEM`/`EVENT`.

---

# 14. Evolução: colaboração B2B federada

## 14.1. Visão

Muitos clientes Protheus são compradores, fornecedores, distribuidores, transportadores ou parceiros comerciais entre si. O FWWebEx pode permitir que duas organizações independentes colaborem sem que uma precise acessar o ambiente Protheus da outra.

```text
EMPRESA A                         EMPRESA B
Comprador                         Fornecedor
Protheus A                        Protheus B
    │                                 │
FWWebEx.Chat                     FWWebEx.Chat
    │                                 │
    └────── Federation/B2B ───────────┘
```

A conversa deve estar vinculada ao documento de negócio, e não existir apenas como chat livre.

Casos prioritários:

- solicitação de compra;
- cotação;
- negociação comercial;
- pedido de compra/venda;
- confirmação do pedido;
- alteração de prazo;
- status de separação/expedição;
- faturamento/NF;
- entrega;
- cancelamento;
- divergências e ocorrências.

---

## 15. Separação INTERNAL x FEDERATED

```text
                 FWWebEx.Chat
                      │
          ┌───────────┴───────────┐
          │                       │
       INTERNAL                FEDERATED
          │                       │
 TWebChannel/session        HTTPS/WSS B2B
          │                       │
 Protheus local            outro Protheus
```

`TWebChannel` permanece como transporte local Browser ↔ AppServer.

Comunicação entre organizações deve utilizar um protocolo B2B próprio, documentado e suportado, sem reutilizar internals do WebApp.

---

## 16. Protocolo B2B

Nome inicial:

```text
fw.webex.chat.b2b/1
```

O protocolo deve suportar mensagens humanas e eventos estruturados.

Exemplo:

```json
{
  "protocol": "fw.webex.chat.b2b/1",
  "event": "delivery.rescheduled",
  "id": "event-uuid",
  "conversation": "urn:fwwebex:conversation:...",
  "senderOrganization": "urn:fwwebex:org:...",
  "document": {
    "type": "PURCHASE_ORDER",
    "buyerReference": "104587",
    "supplierReference": "87451"
  },
  "data": {
    "previousDate": "2026-09-25",
    "newDate": "2026-09-21"
  }
}
```

Requisitos:

- versionamento explícito;
- UUID global;
- idempotência;
- timestamp e expiração quando aplicável;
- assinatura/autenticidade;
- replay protection;
- correlation/causation ID;
- confirmação técnica de recebimento;
- confirmação funcional quando o evento exigir aceite;
- schema validation;
- compatibilidade retroativa controlada.

---

## 17. B2B Business Events

Não limitar federação a texto.

Eventos iniciais candidatos:

```text
PURCHASE_REQUEST.CREATED
QUOTATION.REQUESTED
QUOTATION.RESPONDED
QUOTATION.REVISED
PURCHASE_ORDER.CREATED
PURCHASE_ORDER.CONFIRMED
PURCHASE_ORDER.REJECTED
ORDER.CANCEL_REQUESTED
ORDER.CANCEL_ACCEPTED
DELIVERY.RESCHEDULED
DELIVERY.DISPATCHED
DELIVERY.DELIVERED
INVOICE.ISSUED
BUSINESS.MESSAGE.CREATED
```

Cada evento deve possuir payload de domínio próprio e representação humana na UI.

Exemplo visual:

```text
FORNECEDOR XYZ
Pedido 104587

Previsão alterada
25/09/2026 -> 21/09/2026

[ Aceitar nova data ] [ Negociar ] [ Abrir pedido ]
```

---

## 18. Cotação federada

Fluxo desejado:

```text
                   COTAÇÃO 000812
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
      Fornecedor A  Fornecedor B  Fornecedor C
       Protheus      Protheus      Protheus
           │             │             │
       proposta A    proposta B    proposta C
           │             │             │
           └─────────────┼─────────────┘
                         ▼
                   Protheus comprador
```

A negociação pode combinar chat + proposta estruturada:

```text
Comprador:
Precisamos de 2.000 unidades.

Fornecedor:
Para 2.000 consigo reduzir para R$ 89,50.

🤖 Protheus:
Nova proposta recebida
Preço: R$ 89,50
Prazo: 8 dias

[ Incorporar à cotação ]
```

A incorporação automática nunca deve ocorrer apenas porque chegou texto; deve depender de evento estruturado validado e ação/regra autorizada no Protheus receptor.

---

## 19. Identidade organizacional

Federação exige identidade distinta da identidade do usuário local.

```text
Usuário
  ↓
Organização A
  ↓
Organization Identity
  ↓
credencial/certificado
  ↓
B2B Transport
  ↓
Organization Identity B
  ↓
usuário/processo autorizado
```

Entidade lógica:

```text
FEDERATION_ORGANIZATION
ID
LEGAL_NAME
COUNTRY
TAX_ID / CNPJ
PUBLIC_KEY / CERTIFICATE
ENDPOINT
STATUS
CREATED_AT
UPDATED_AT
```

Nunca confiar em `company`, CNPJ ou nome enviados sem autenticação criptográfica do peer.

---

## 20. Handshake de parceria

Uma organização não deve conseguir enviar mensagens para outra apenas conhecendo seu endpoint.

Fluxo:

```text
Empresa A
   │ invitation
   ▼
Empresa B
   │ accept/reject
   ▼
Trusted Partnership
```

A relação deve possuir escopos:

```text
QUOTATION:READ/WRITE
PURCHASE_ORDER:READ/WRITE
DELIVERY:READ
INVOICE:READ
CHAT:WRITE
ATTACHMENT:WRITE
```

A parceria pode ser suspensa/revogada sem remover o histórico auditável.

---

## 21. Segurança B2B

P0 antes de qualquer piloto externo:

- TLS obrigatório;
- autenticação machine-to-machine;
- assinatura de mensagens/eventos;
- rotação de credenciais;
- allowlist de organizações;
- scopes por parceria;
- rate limiting;
- proteção contra replay;
- idempotência;
- validação rígida de schema;
- tamanho máximo de payload;
- sanitização de conteúdo humano;
- trilha de auditoria;
- retenção configurável;
- nenhuma informação interna de stack/SQL/RPO na resposta externa;
- isolamento completo entre tenants/organizações.

---

## 22. Modelo de conversação federada

Adicionar entidades lógicas futuras:

```text
FEDERATION_ORGANIZATION
FEDERATION_PARTNERSHIP
FEDERATION_ENDPOINT
FEDERATION_CONVERSATION
FEDERATION_DOCUMENT_LINK
FEDERATION_EVENT
FEDERATION_DELIVERY
```

Uma conversa federada deve mapear referências diferentes do mesmo documento:

```text
Buyer organization     Supplier organization
PO 104587       <----> SO 87451
```

Nunca pressupor que os números de documento são iguais nos dois ERPs.

---

## 23. Gateway/provider de federação

Não acoplar o Chat a uma implementação única.

```text
Chat/Federation Service
          │
 FederationTransportProvider
          │
     ┌────┼──────────────┐
     │    │              │
   HTTPS  WSS       future provider
```

Interfaces conceituais:

```text
ConnectPartner()
DisconnectPartner()
SendEnvelope()
ReceiveEnvelope()
Acknowledge()
ValidatePeer()
GetCapabilities()
```

A primeira POC deve preferir HTTPS request/response + fila/outbox/inbox persistente antes de exigir WebSocket permanente entre empresas.

---

## 24. Outbox / Inbox

Para comunicação B2B confiável, não depender da disponibilidade simultânea dos dois AppServers.

```text
Business transaction
       │
       ├─ grava alteração ERP
       └─ grava OUTBOX
              │
              ▼
        Federation Worker
              │
              ▼
          peer endpoint
              │
              ▼
            INBOX
              │
       valida/idempotência
              │
              ▼
        evento no Protheus
```

Requisitos:

- retry com backoff;
- dead-letter state;
- idempotência por event ID;
- status SENT/ACK/FAILED;
- rastreabilidade ponta a ponta;
- nenhuma perda silenciosa.

---

## 25. Chat como interface humana da colaboração

A longo prazo, separar conceitualmente:

```text
fw.webex.feature.collaboration
              │
      ┌───────┴─────────┐
      │                 │
    chat              b2b
      │                 │
 internal          federation
                        │
                 business-events
```

Não é necessário criar `feature.collaboration` imediatamente. Primeiro validar o domínio no Chat; extrair a camada quando houver contratos estáveis.

O princípio é importante: **Chat é a interface humana; Collaboration é o domínio maior.**

---

## 26. Privacidade e fronteira de dados

Cada organização mantém:

- seus usuários;
- seu banco;
- suas ACLs;
- seus documentos internos;
- seus logs internos.

Somente dados explicitamente autorizados pelo contrato B2B atravessam a fronteira.

Uma empresa não precisa conceder login no seu Protheus ao parceiro.

---

## 27. Observabilidade

Registrar sem expor conteúdo sensível desnecessariamente:

```text
correlationId
message/event id
organization sender/receiver
conversation id
event type
attempt
transport
latency
status
error category
```

Criar diagnóstico para responder:

> "O fornecedor enviou a confirmação? Quando? Meu ambiente recebeu? Foi rejeitada por schema, ACL ou regra de negócio?"

---

## 27A. APIs REST do Protheus

A solução deve prever explicitamente duas superfícies REST distintas, ainda que ambas reutilizem o mesmo domínio interno.

### 27A.1. REST interna

Destinada a aplicações, rotinas, jobs, serviços e componentes dentro da infraestrutura do cliente.

Uso esperado:

- consumo através do serviço HTTP/REST disponibilizado pelo AppServer, inclusive porta multiprotocolo quando aplicável à arquitetura do ambiente;
- integração entre features FWWebEx;
- publicação de eventos por customizações Protheus;
- consulta de conversas/contextos por aplicações internas;
- automações e workers;
- integração de processos internos sem exposição à Internet.

Fluxo conceitual:

```text
Aplicação interna / Job / Feature FWWebEx
                 │
                 ▼
        REST INTERNAL API
                 │
                 ▼
     Collaboration/Chat Service
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
      DB       Events    Outbox
```

Namespace conceitual:

```text
/api/fwwebex/v1/chat/...
/api/fwwebex/v1/events/...
/api/fwwebex/v1/context/...
```

A URL definitiva e os mecanismos de autenticação devem respeitar os recursos suportados pela release Protheus alvo.

A API interna não deve significar "sem segurança". Deve possuir autenticação, autorização, validação, rate limit apropriado e auditoria.

### 27A.2. REST externa B2B

Destinada exclusivamente à comunicação entre organizações parceiras.

```text
Protheus Empresa A
      │
      │ HTTPS
      ▼
B2B REST API Empresa B
      │
      ▼
Federation Gateway
      │
      ▼
Inbox / Validation / Domain
```

Namespace conceitual:

```text
/api/fwwebex/b2b/v1/capabilities
/api/fwwebex/b2b/v1/events
/api/fwwebex/b2b/v1/messages
/api/fwwebex/b2b/v1/ack
/api/fwwebex/b2b/v1/partnerships
```

A API externa deve possuir políticas mais restritivas que a interna:

- TLS obrigatório;
- autenticação machine-to-machine;
- identificação da organização;
- assinatura ou mecanismo equivalente de autenticidade;
- scopes;
- anti-replay;
- idempotency key/event ID;
- limites de payload;
- rate limiting;
- nenhuma exposição direta de tabelas/aliases internos;
- nenhuma execução arbitrária de funções AdvPL/TLPP;
- contratos versionados;
- mensagens de erro sanitizadas.

### 27A.3. Um domínio, vários transports

Evitar implementar regra duplicada em cada API.

```text
TWebChannel ─────┐
Internal REST ───┼──> Application Service / Domain
B2B REST ────────┤
Protheus Hooks ──┤
Workers ─────────┘
```

Exemplo: enviar uma mensagem deve convergir para o mesmo `ChatService.SendMessage()`; publicar alteração de pedido deve convergir para o mesmo `BusinessEventService.Publish()`.

### 27A.4. OpenAPI e contratos

As APIs REST devem possuir contrato versionado e, quando viável, documentação OpenAPI gerável/versionada no repositório.

Objetivos:

- permitir testes automatizados;
- facilitar integração de terceiros;
- detectar breaking changes;
- documentar schemas B2B;
- gerar exemplos de request/response;
- separar contrato público de implementação TLPP.

Nunca expor nomes físicos de tabelas como contrato público.

---

## 27B. Protheus Event Adapter / Pontos de Entrada

A integração com processos do ERP deve aproveitar mecanismos oficiais de extensibilidade do Protheus, principalmente Pontos de Entrada, quando disponíveis e adequados.

Objetivo: capturar **eventos de negócio confirmados** no momento correto do fluxo, sem alterar o fonte padrão e sem acoplar diretamente a rotina padrão ao Chat.

### 27B.1. Arquitetura

```text
Rotina padrão Protheus
        │
        ▼
Ponto de Entrada oficial
        │
        ▼
FWWebExProtheusEventAdapter
        │
        ▼
Canonical Business Event
        │
        ▼
BusinessEventService.Publish()
        │
   ┌────┼───────────────┐
   ▼    ▼               ▼
 Chat  Internal Bus   B2B Outbox
```

O Ponto de Entrada deve ser um adapter fino. Ele não deve possuir lógica de transporte B2B, chamadas HTTP longas, UI ou regra complexa de Chat.

### 27B.2. Eventos canônicos

Mapear eventos específicos do Protheus para nomes independentes da rotina/fonte:

```text
PURCHASE_REQUEST.CREATED
PURCHASE_REQUEST.UPDATED
QUOTATION.CREATED
QUOTATION.UPDATED
QUOTATION.CONFIRMED
QUOTATION.CANCELLED
PURCHASE_ORDER.CREATED
PURCHASE_ORDER.UPDATED
PURCHASE_ORDER.CONFIRMED
PURCHASE_ORDER.CANCELLED
SALES_ORDER.CREATED
SALES_ORDER.UPDATED
SALES_ORDER.CONFIRMED
SALES_ORDER.CANCELLED
DELIVERY.STATUS_CHANGED
INVOICE.ISSUED
INVOICE.CANCELLED
```

O protocolo externo nunca deve depender do nome do Ponto de Entrada. O Ponto de Entrada é apenas uma fonte de eventos.

### 27B.3. Catálogo de Pontos de Entrada

Criar no projeto um catálogo versionado por domínio/release contendo, para cada integração:

```text
DOMAIN
ROUTINE
ENTRY_POINT
WHEN/FIRES_AT
BEFORE_OR_AFTER_COMMIT
AVAILABLE_CONTEXT
RETURN_CONTRACT
SUPPORTED_RELEASES
CAN_BLOCK_TRANSACTION
NOTES
CANONICAL_EVENT
```

Exemplo conceitual:

```text
Compras / Pedido
  Rotina........: <mapear na documentação oficial>
  Ponto Entrada.: <mapear>
  Momento.......: confirmação da inclusão/alteração
  Evento........: PURCHASE_ORDER.CONFIRMED / UPDATED
```

**Não assumir nomes de Pontos de Entrada por memória.** Cada hook deverá ser confirmado na documentação/release Protheus e validado em ambiente de teste antes de entrar no catálogo suportado.

### 27B.4. Before x After

É essencial distinguir hooks executados antes e depois da efetivação da transação.

Para notificação/federação, preferir evento que represente estado confirmado.

```text
BEFORE COMMIT
   │
   ├─ validação pode falhar
   └─ NÃO enviar B2B imediatamente

AFTER COMMIT / estado confirmado
   │
   └─ registrar evento/outbox
```

Se o único Ponto de Entrada disponível ocorrer antes do commit, o adapter não deve enviar HTTP para o parceiro. Deve registrar intenção/correlation e validar posteriormente o estado confirmado antes de publicar o evento externo.

### 27B.5. Não bloquear a transação comercial com rede externa

Regra crítica:

> Nenhuma confirmação de Pedido, Cotação, NF ou outro documento deve depender da disponibilidade online do parceiro B2B.

Evitar:

```text
Ponto de Entrada -> HTTP externo síncrono -> timeout -> usuário não grava pedido
```

Preferir:

```text
Ponto de Entrada
      │
      ▼
registrar evento/outbox local
      │
      ▼
retornar rapidamente ao Protheus
      │
      ▼
worker assíncrono envia ao parceiro
```

### 27B.6. Payload mínimo e snapshot

O hook deve capturar apenas as chaves necessárias para reconstruir o evento com segurança.

Exemplo:

```json
{
  "event": "PURCHASE_ORDER.UPDATED",
  "company": "01",
  "branch": "01",
  "documentKey": "104587",
  "source": {
    "routine": "PROTHEUS",
    "hook": "..."
  }
}
```

Um enricher/service pode então carregar os dados autorizados e construir o payload B2B. Isso reduz custo dentro do Ponto de Entrada e evita enviar work areas/estado transitório para outras camadas.

Para eventos que exigem preservar exatamente o estado daquele instante, avaliar snapshot transacional mínimo na Outbox.

### 27B.7. Registro genérico de adapters

Evitar uma classe monolítica com `If cRotina == ...`.

Modelo conceitual:

```advpl
FWWebExEvents():RegisterAdapter("PURCHASE_ORDER", oPurchaseOrderAdapter)
FWWebExEvents():RegisterAdapter("QUOTATION",      oQuotationAdapter)
FWWebExEvents():RegisterAdapter("SALES_ORDER",    oSalesOrderAdapter)
```

Contrato:

```text
CanHandle(source, event)
BuildContext()
ValidateState()
BuildCanonicalEvent()
Publish()
```

### 27B.8. Eventos originados por REST também passam pelo mesmo domínio

Se uma API B2B provocar uma ação autorizada no ERP, a alteração correspondente pode disparar o Ponto de Entrada padrão. Devemos evitar loop de eventos.

Usar:

```text
correlationId
causationId
origin = LOCAL | INTERNAL_API | B2B | SYSTEM
```

Exemplo:

```text
B2B recebe DELIVERY.RESCHEDULED
       │
       ▼
atualiza processo local autorizado
       │
       ▼
Ponto de Entrada dispara
       │
       ▼
Event Adapter detecta causationId/origin
       │
       └─ não devolve o mesmo evento ao emissor
```

### 27B.9. Configuração por evento/parceiro

Nem todo evento local deve virar evento externo.

Configuração futura:

```text
Event                           Internal Chat   Partner A   Partner B
PURCHASE_ORDER.CREATED              YES           YES         NO
PURCHASE_ORDER.UPDATED              YES           YES         YES
INVOICE.ISSUED                      YES           YES         YES
PRODUCT.COST_CHANGED                NO            NO          NO
```

A política deve ser server-side e auditável.

---

## 28. Testes

### Internos

- runtime JS;
- protocolo;
- ACL;
- idempotência;
- paginação;
- ordering;
- polling/realtime;
- multi-AppServer;
- REST interna;
- autenticação/autorização REST;
- contrato OpenAPI/schema;
- adapters de Pontos de Entrada;
- before/after transaction;
- eventos duplicados;
- prevenção de loops por correlation/causation.

### Federação

- organization identity;
- handshake;
- assinatura válida/inválida;
- replay;
- scopes;
- peer revogado;
- schema incompatível;
- retry/outbox;
- duplicidade;
- timeout;
- indisponibilidade do peer;
- mapeamento PO comprador ↔ SO fornecedor;
- isolamento entre organizações;
- REST externa sem vazamento de detalhes internos;
- evento local capturado por hook -> Outbox -> peer -> Inbox.

---

## 29. POCs

### POC 0 — transporte interno

Provar A -> AppServer -> B entre duas sessões.

### POC 1 — chat direto

Persistência, histórico, unread e idempotência.

### POC 2 — room/context

Sala vinculada a entidade Protheus.

### POC 3 — evento ERP

Rotina TLPP publica evento para uma sala/contexto.

### POC 4 — REST interna

Publicar e consultar eventos/chat via REST interna do AppServer reutilizando o mesmo domínio do TWebChannel.

### POC 5 — Ponto de Entrada -> evento canônico

Mapear um processo real de homologação, preferencialmente pedido ou cotação:

```text
confirma inclusão/alteração
       -> Ponto de Entrada
       -> Event Adapter
       -> Canonical Event
       -> persistência/outbox
       -> Chat interno
```

Aceite: nenhuma chamada de rede externa dentro da transação do ERP.

### POC B2B-0 — duas instalações controladas

Dois ambientes Protheus independentes trocam envelope autenticado sem compartilhar banco nem sessão.

### POC B2B-1 — pedido/status

Ambiente comprador envia referência de pedido; ambiente fornecedor responde status estruturado.

### POC B2B-2 — cotação

Solicitação de cotação -> resposta estruturada -> conversa -> revisão de proposta.

### POC B2B-3 — REST externa + Hook

Fluxo completo:

```text
Protheus A
pedido confirmado
      │
Ponto de Entrada
      │
Canonical Event
      │
Outbox
      │ HTTPS REST B2B
      ▼
Protheus B
Inbox
      │
Chat/ERP Context
```

---

## 30. Roadmap

| Fase | Prioridade | Objetivo |
|---|---|---|
| CHAT-000 | P0 | Definir protocolo `fw.webex.chat/1` |
| CHAT-001 | P0 | Skeleton `WebExFeatureChat` |
| CHAT-002 | P0 | Identity Provider |
| CHAT-003 | P0 | Authorization Provider |
| CHAT-004 | P0 | Repository mínimo |
| CHAT-005 | P0 | POC TWebChannel entre sessões |
| CHAT-006 | P0 | Polling incremental fallback |
| CHAT-007 | P0 | Mensagem direta |
| CHAT-008 | P0 | Histórico/paginação |
| CHAT-009 | P0 | Read/unread |
| CHAT-010 | P1 | Rooms/grupos |
| CHAT-011 | P1 | UI completa |
| CHAT-012 | P1 | Context rooms ERP |
| CHAT-013 | P1 | ERP references |
| CHAT-014 | P1 | API TLPP Publish/Notify |
| CHAT-015 | P1 | ERP/System events |
| CHAT-016 | P1 | Multi-AppServer/Broker |
| CHAT-017 | P1 | Security hardening |
| CHAT-018 | P1 | Observabilidade |
| CHAT-019 | P2 | Presence |
| CHAT-020 | P2 | Typing |
| CHAT-021 | P2 | Reactions/emoji |
| CHAT-022 | P2 | Search |
| CHAT-023 | P2 | Attachments |
| CHAT-024 | P2 | Bots/automation |
| CHAT-025 | P2 | External notifications/provider |
| API-000 | P0 | Definir Application Service comum a TWebChannel/REST/Hooks |
| API-001 | P1 | REST interna via AppServer/multiprotocolo |
| API-002 | P1 | Versionamento de endpoints e schemas |
| API-003 | P1 | OpenAPI/contratos e testes |
| API-004 | P1 | Autenticação/autorização REST interna |
| API-005 | P1 | REST externa B2B |
| API-006 | P1 | Security hardening da REST externa |
| ERP-000 | P0 | Definir Canonical Business Event |
| ERP-001 | P1 | Criar Protheus Event Adapter registry |
| ERP-002 | P1 | Catálogo versionado de Pontos de Entrada por release |
| ERP-003 | P1 | Mapear inclusão/alteração/confirmação de Pedido |
| ERP-004 | P1 | Mapear Cotação |
| ERP-005 | P1 | Mapear Pedido de Venda |
| ERP-006 | P1 | Mapear Faturamento/NF |
| ERP-007 | P1 | Validar before/after commit e consistência transacional |
| ERP-008 | P1 | Correlation/Causation/Origin e prevenção de loop |
| ERP-009 | P1 | Política de roteamento por evento/parceiro |
| B2B-000 | P1 | Definir `fw.webex.chat.b2b/1` |
| B2B-001 | P1 | Organization Identity |
| B2B-002 | P1 | Partnership handshake/scopes |
| B2B-003 | P1 | FederationTransportProvider |
| B2B-004 | P1 | Outbox/Inbox confiável |
| B2B-005 | P1 | POC entre dois Protheus independentes |
| B2B-006 | P1 | Purchase Order / status events |
| B2B-007 | P1 | Cotação federada |
| B2B-008 | P1 | UI de ações estruturadas |
| B2B-009 | P1 | Auditoria e observabilidade ponta a ponta |
| B2B-010 | P1 | Security hardening externo |
| B2B-011 | P2 | Delivery/logistics events |
| B2B-012 | P2 | Invoice events |
| B2B-013 | P2 | Attachments/document exchange |
| B2B-014 | P2 | Discovery/capabilities |
| B2B-015 | P2 | Avaliar extração para `fw.webex.feature.collaboration` |

---

## 31. Critérios anti-monólito

- UI não conhece SQL/tabelas;
- Repository não conhece DOM;
- transport não aplica regra comercial;
- REST controller não contém regra de domínio;
- Ponto de Entrada não contém transporte B2B;
- adapter de Protheus apenas traduz contexto para evento canônico;
- protocolo B2B não conhece tela Protheus;
- Chat interno não depende de federação;
- federação não depende de TWebChannel remoto;
- eventos estruturados são independentes da renderização humana;
- providers devem ser substituíveis;
- cliente específico não deve exigir fork do core.

---

## 32. Definição de sucesso

A arquitetura será considerada bem-sucedida quando:

1. não depender do protocolo WebSocket privado do WebApp;
2. identidade/autorização forem server-side;
3. sessões locais trocarem mensagens com entrega confiável;
4. funcionar em topologia real com múltiplos AppServers;
5. possuir fallback incremental;
6. mensagens conhecerem entidades Protheus;
7. qualquer rotina TLPP puder publicar eventos;
8. tabelas puderem ser instaladas por pacote de dicionário versionado;
9. a feature for reutilizável sem fork por cliente;
10. dois Protheus independentes puderem colaborar sem compartilhar banco, sessão ou login;
11. uma organização puder revogar outra imediatamente;
12. eventos B2B forem auditáveis, idempotentes e autenticados;
13. pedido/cotação/status puderem combinar conversa humana e evento estruturado;
14. TWebChannel, REST interna, REST externa e hooks reutilizarem o mesmo domínio;
15. eventos relevantes do Protheus puderem ser capturados por adapters de Pontos de Entrada oficialmente mapeados;
16. nenhuma indisponibilidade de parceiro B2B bloquear a gravação de pedido/cotação/NF no ERP;
17. eventos externos não dependerem do nome físico de rotina, tabela ou Ponto de Entrada;
18. correlation/causation impeçam loops entre evento recebido e evento republicado.

---

## 33. Próximo passo

A prioridade imediata continua sendo o núcleo interno, mas agora com o contrato de domínio preparado para múltiplas entradas:

```text
CHAT-000 -> protocolo
CHAT-001 -> skeleton
API-000  -> Application Service comum
ERP-000  -> Canonical Business Event
CHAT-005 -> POC entre duas sessões
```

Em paralelo:

```text
1. documentar B2B-000;
2. desenhar API-001/REST interna;
3. iniciar ERP-002, catálogo de Pontos de Entrada suportados;
4. escolher um processo de homologação para ERP-003/ERP-004;
5. validar que o hook apenas registra/publica localmente e nunca depende de chamada B2B síncrona.
```

A primeira pergunta técnica do chat continua sendo:

> Qual é o mecanismo suportado e confiável para propagar um evento de chat de uma sessão Protheus para outra em topologia WebApp/AppServer/Broker?

E a primeira pergunta técnica da integração ERP passa a ser:

> Quais Pontos de Entrada oficiais, em cada release alvo, representam com segurança a confirmação de inclusão/alteração de Pedido, Cotação e demais documentos, e em que momento eles executam em relação ao commit da transação?

Depois de estabilizar o núcleo, a primeira POC federada deve usar **dois ambientes Protheus controlados**, HTTPS autenticado, REST B2B e Outbox/Inbox, antes de qualquer piloto com cliente/fornecedor real.
