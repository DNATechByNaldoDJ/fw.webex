# TODO.md — `fw.webex.feature.dictionary`

> **Status:** proposta / arquitetura inicial  
> **Componente:** `fw.webex.feature.dictionary`  
> **Projeto:** `fw.webex`  
> **Data:** 2026-09-14  
> **Objetivo:** permitir que features FWWebEx declarem tabelas, campos, índices e helps Protheus e gerem automaticamente os artefatos de atualização consumidos pelo `UPDDISTR`, eliminando a criação manual de estruturas pelo SIGACFG.

---

## 1. Visão

Criar uma infraestrutura genérica para empacotamento de dicionário Protheus a partir de uma definição declarativa versionada no próprio projeto FWWebEx.

A primeira necessidade concreta é o `fw.webex.feature.chat`, que dependerá de tabelas de usuário para rooms, membros, mensagens, referências, recibos e demais estruturas persistentes.

A infraestrutura, porém, **não deve pertencer ao chat**. Ela deve ser reutilizável por qualquer feature FWWebEx que necessite instalar ou evoluir seu próprio dicionário.

Fluxo desejado:

```text
Feature FWWebEx
    │
    ▼
dictionary definition
    │
    ▼
FWWebEx.DictionaryPackage
    │
    ├── sdfbra.txt
    ├── manifest_update.txt
    ├── hlppor.txt
    ├── hlpeng.txt
    └── hlpspa.txt
            │
            ▼
      Protheus_Data/systemload
            │
            ▼
         UPDDISTR
            │
            ▼
      SX2 / SX3 / SIX / etc.
```

A ferramenta **não deverá alterar diretamente SX2/SX3/SIX no banco**. O objetivo é produzir os artefatos oficiais de atualização e deixar a aplicação efetiva sob responsabilidade do `UPDDISTR`.

---

## 2. Motivação

Hoje a criação de tabelas customizadas pelo SIGACFG exige trabalho manual repetitivo:

- criar tabela;
- informar modo de compartilhamento;
- criar campos;
- configurar tipo/tamanho/decimal;
- configurar título/descrição/picture;
- configurar usado/obrigatório/browse;
- criar índices;
- configurar unique/nickname quando necessário;
- cadastrar helps;
- repetir em outros ambientes;
- documentar exatamente a mesma estrutura no fonte.

Isso gera risco de divergência entre:

```text
DEV
HOMOLOGAÇÃO
PRODUÇÃO
```

A definição do dicionário deve passar a ser **infraestrutura como código**.

```text
Git = fonte da verdade
```

---

## 3. Compatibilidade com o mecanismo TOTVS

O gerador deve seguir o mecanismo utilizado pelo próprio Protheus:

```text
SDFBRA.TXT
   +
HELP diferencial/completo
   +
SYSTEMLOAD
   +
UPDDISTR
```

O projeto deve evitar criar um instalador paralelo que altere diretamente metadados internos.

A primeira implementação deve validar o formato produzido comparando-o com arquivos reais gerados pelo SIGACFG/rotinas TOTVS.

Fixtures de referência devem ser obtidos de um ambiente Protheus real, por exemplo:

```text
C:\totvs\protheus1212410\protheusdata\systemload
```

Arquivos de interesse:

```text
sdfbra.txt
manifest_update.txt
hlppor.txt
hlpeng.txt
hlpspa.txt
```

Os formatos não devem ser assumidos por memória ou recriados aproximadamente. O parser/writer deverá ser validado byte a byte contra arquivos reais da release alvo.

---

## 4. Escopo inicial

### P0

Gerar estruturas necessárias para criação de:

- SX2 — tabela;
- SX3 — campos;
- SIX — índices;
- helps de campo;
- metadata necessária ao `manifest_update.txt`.

### P1

Adicionar suporte declarativo para:

- SX1 — perguntas;
- SX5 — tabelas genéricas;
- SX6 — parâmetros;
- SX7 — gatilhos;
- SX9 — relacionamentos;
- SXA — pastas;
- outras estruturas necessárias a features futuras.

---

## 5. Artefatos obrigatórios

### 5.1. `sdfbra.txt`

Responsável pelo dicionário diferencial.

O writer deverá suportar pelo menos:

```text
SX2
SX3
SIX
```

Deve ser possível gerar inclusão e evolução de estruturas sem depender do SIGACFG.

### 5.2. `manifest_update.txt`

Gerar o manifesto correspondente ao pacote produzido.

O formato deverá ser derivado de fixtures reais da release Protheus e possuir testes de compatibilidade.

Nunca inventar propriedades não observadas no formato oficial.

### 5.3. `hlppor.txt`

Help em Português.

### 5.4. `hlpeng.txt`

Help em Inglês.

### 5.5. `hlpspa.txt`

Help em Espanhol.

O modelo interno deve permitir declarar os três idiomas juntos, ainda que inicialmente alguns campos utilizem fallback do português.

---

## 6. Definição declarativa

Criar um modelo independente do formato SDF.

Exemplo conceitual em TLPP:

```advpl
FWWebExDictionary():Table("ZWC", {
    "description" => {
        "pt" => "FWWebEx Chat - Conversas",
        "en" => "FWWebEx Chat - Rooms",
        "es" => "FWWebEx Chat - Conversaciones"
    },
    "sharing" => "EXCLUSIVE"
})

FWWebExDictionary():Field("ZWC", "ZWC_FILIAL", {
    "type"      => "C",
    "length"    => 8,
    "decimal"   => 0,
    "title"     => {"pt"=>"Filial", "en"=>"Branch", "es"=>"Sucursal"},
    "help"      => {
        "pt" => "Filial do sistema.",
        "en" => "System branch.",
        "es" => "Sucursal del sistema."
    },
    "used"      => .T.,
    "required"  => .F.,
    "browse"    => .F.
})
```

A sintaxe exata poderá mudar. O ponto obrigatório é separar:

```text
modelo lógico
      !=
formato físico SDF
```

---

## 7. Alternativa por manifesto JSON

Avaliar também um manifesto versionável e fácil de validar:

```json
{
  "schema": "fw.webex.dictionary/1",
  "package": "fw.webex.feature.chat",
  "version": "0.1.0",
  "country": "BRA",
  "tables": [
    {
      "alias": "ZWC",
      "description": {
        "pt": "FWWebEx Chat - Conversas",
        "en": "FWWebEx Chat - Rooms",
        "es": "FWWebEx Chat - Conversaciones"
      },
      "sharing": "EXCLUSIVE",
      "fields": [],
      "indexes": []
    }
  ]
}
```

Vantagens:

- diff limpo no Git;
- validação automática;
- geração reproduzível;
- possível uso por CI/CD;
- não exige recompilar TLPP apenas para alterar metadata de dicionário;
- pode alimentar documentação automática.

Arquitetura recomendada:

```text
*.dictionary.json
        │
        ▼
Dictionary Model
        │
        ├─ validator
        ├─ SDF writer
        ├─ help writer
        └─ manifest writer
```

---

## 8. Estrutura proposta

```text
src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.dictionary/
│
├── TODO.md
├── README.md
│
├── fw.webex.feature.dictionary.tlpp
├── fw.webex.dictionary.model.tlpp
├── fw.webex.dictionary.validator.tlpp
├── fw.webex.dictionary.diff.tlpp
├── fw.webex.dictionary.sdf.writer.tlpp
├── fw.webex.dictionary.help.writer.tlpp
├── fw.webex.dictionary.manifest.writer.tlpp
├── fw.webex.dictionary.systemload.tlpp
│
├── schema/
│   └── fw.webex.dictionary.schema.json
│
├── fixtures/
│   ├── protheus-12.1.2410/
│   │   ├── sdfbra.txt
│   │   ├── manifest_update.txt
│   │   ├── hlppor.txt
│   │   ├── hlpeng.txt
│   │   └── hlpspa.txt
│   └── README.md
│
└── tests/
    ├── dictionary-model.test.mjs
    ├── dictionary-sdf.test.mjs
    ├── dictionary-help.test.mjs
    ├── dictionary-manifest.test.mjs
    └── dictionary-roundtrip.test.mjs
```

---

## 9. API alvo

### 9.1. Carregar definição

```advpl
local oDictionary := FWWebExDictionaryPackage():New()

oDictionary:Load("fw.webex.feature.chat.dictionary.json")
```

### 9.2. Validar

```advpl
local hResult := oDictionary:Validate()
```

### 9.3. Preview

```advpl
local hPreview := oDictionary:Preview()
```

Resultado conceitual:

```json
{
  "tables": {
    "create": ["ZWC", "ZWM", "ZWT"],
    "update": [],
    "unchanged": []
  },
  "fields": {
    "create": 32,
    "update": 0
  },
  "indexes": {
    "create": 7,
    "update": 0
  }
}
```

### 9.4. Gerar pacote

```advpl
oDictionary:Generate("C:\\temp\\fwwebex-chat-systemload")
```

Saída:

```text
fwwebex-chat-systemload/
├── sdfbra.txt
├── manifest_update.txt
├── hlppor.txt
├── hlpeng.txt
└── hlpspa.txt
```

### 9.5. Publicar no `systemload`

Somente mediante ação explícita:

```advpl
oDictionary:PublishToSystemLoad()
```

Nunca copiar automaticamente ao iniciar uma feature.

---

## 10. Segurança operacional

Alterações de dicionário são operações administrativas e potencialmente destrutivas.

Regras obrigatórias:

- [ ] geração pode ser feita sem privilégio de aplicação;
- [ ] publicação no `systemload` exige autorização administrativa;
- [ ] nunca executar `UPDDISTR` silenciosamente;
- [ ] nunca substituir arquivo existente sem backup;
- [ ] nunca editar diretamente SX2/SX3/SIX via SQL;
- [ ] gerar hash dos arquivos produzidos;
- [ ] gerar log da versão/feature/origem;
- [ ] validar alias customizado permitido;
- [ ] impedir sobrescrita de tabela padrão TOTVS por default;
- [ ] permitir whitelist explícita para evolução controlada;
- [ ] impedir redução destrutiva de campo sem confirmação específica;
- [ ] não remover campo/índice automaticamente no MVP.

---

## 11. Preview / Diff antes da geração

A ferramenta deve mostrar exatamente o que será produzido.

```text
FWWebEx Dictionary Package
────────────────────────────────────
Package : fw.webex.feature.chat
Version : 0.1.0
Country : BRA

TABLES
+ ZWC  FWWebEx Chat - Conversas
+ ZWM  FWWebEx Chat - Membros
+ ZWT  FWWebEx Chat - Mensagens

FIELDS
+ ZWC_FILIAL C(8)
+ ZWC_ID     C(36)
+ ZWC_TYPE   C(12)
...

INDEXES
+ ZWC01 ZWC_FILIAL+ZWC_ID
...

FILES
+ sdfbra.txt
+ manifest_update.txt
+ hlppor.txt
+ hlpeng.txt
+ hlpspa.txt
```

Nenhuma escrita no `systemload` durante preview.

---

## 12. Leitura do dicionário instalado

P1.

Para tornar o processo idempotente, criar provider capaz de consultar metadata do ambiente atual e comparar com a definição declarada.

```text
Desired Dictionary
       │
       ▼
     Diff Engine
       ▲
       │
Installed Dictionary
```

Fontes possíveis:

- APIs Framework disponíveis;
- SX2/SX3/SIX via aliases do Protheus;
- SX3 metadata helpers;
- queries controladas quando necessárias.

Evitar acoplamento direto a layout físico interno quando houver API pública equivalente.

---

## 13. Tipos de alteração

Classificação:

```text
CREATE_TABLE
CREATE_FIELD
CREATE_INDEX
UPDATE_FIELD_LABEL
UPDATE_FIELD_HELP
UPDATE_FIELD_PICTURE
UPDATE_FIELD_VALIDATION
UPDATE_FIELD_SIZE
UPDATE_INDEX
NO_CHANGE
DESTRUCTIVE_CHANGE
```

`DESTRUCTIVE_CHANGE` deve abortar por default.

Exemplos:

```text
C(100) -> C(50)       DESTRUCTIVE_CHANGE
N(15,2) -> N(10,2)    DESTRUCTIVE_CHANGE
remover campo         DESTRUCTIVE_CHANGE
remover índice        DESTRUCTIVE_CHANGE
```

---

## 14. Helps multilíngues

Modelo lógico:

```json
{
  "help": {
    "pt": "Identificador único da conversa.",
    "en": "Unique conversation identifier.",
    "es": "Identificador único de la conversación."
  }
}
```

Writer:

```text
pt -> hlppor.txt
en -> hlpeng.txt
es -> hlpspa.txt
```

Fallback configurável:

```text
missing EN -> PT
missing ES -> PT
```

O fallback deve emitir warning para permitir tradução posterior.

---

## 15. Naming policy

Criar validador para evitar colisões.

Regras iniciais:

- aliases customizados devem respeitar política Protheus vigente;
- evitar famílias reservadas ao padrão TOTVS;
- definir namespace/tabela para FWWebEx;
- campos devem iniciar pelo prefixo da tabela;
- índices devem possuir nickname estável quando aplicável;
- IDs do pacote devem ser determinísticos.

A escolha dos aliases definitivos do chat deve ocorrer após validar disponibilidade no ambiente alvo.

---

## 16. Versionamento

Cada definição deverá declarar:

```json
{
  "package": "fw.webex.feature.chat",
  "version": "0.1.0",
  "dictionaryRevision": 1
}
```

Toda mudança em metadata deve produzir novo diff reproduzível.

Objetivo:

```text
v0.1.0 rev1 -> cria estrutura
v0.2.0 rev2 -> adiciona campo
v0.3.0 rev3 -> adiciona índice
```

Nunca depender de edição manual escondida no SIGACFG.

---

## 17. Reprodutibilidade

Com a mesma definição e mesma versão do writer, a saída deve ser determinística.

```text
input idêntico
+
writer idêntico
=
mesmo conteúdo / mesmo hash
```

Evitar timestamps dentro de arquivos quando o formato não exigir.

Se timestamp for obrigatório, separar teste estrutural de hash reproduzível.

---

## 18. Round-trip tests

Quando o formato for conhecido:

```text
arquivo oficial
     │ parse
     ▼
modelo
     │ write
     ▼
arquivo gerado
```

Comparar semanticamente e, quando possível, byte a byte.

Fixtures obrigatórias por release suportada.

---

## 19. Compatibilidade por release

Não assumir que o formato será eterno.

```text
DictionaryWriter
    │
    ├─ Protheus 12.1.2210
    ├─ Protheus 12.1.2310
    ├─ Protheus 12.1.2410
    └─ futuras releases
```

Implementar detecção/configuração explícita.

```advpl
oDictionary:SetTargetRelease("12.1.2410")
```

Se a release não estiver certificada:

```text
ABORTAR geração/publicação por default
```

ou exigir modo experimental explícito.

---

## 20. Integração com CI

Um pipeline deve conseguir validar os manifestos sem Protheus disponível.

```text
Git push
   │
   ▼
validate dictionary JSON
   │
   ├─ aliases
   ├─ field types
   ├─ lengths
   ├─ indexes
   ├─ translations
   └─ breaking changes
```

Quando fixtures estiverem disponíveis:

```text
unit tests -> generate -> compare golden files
```

---

## 21. Integração com o Chat

`fw.webex.feature.chat` deve possuir somente a definição:

```text
fw.webex.feature.chat/
├── dictionary/
│   └── fw.webex.feature.chat.dictionary.json
```

O chat não conhecerá detalhes de `SDFBRA`.

```text
Chat dictionary.json
       │
       ▼
FWWebEx.DictionaryPackage
       │
       ▼
SystemLoad package
```

---

## 22. Tabelas iniciais do Chat

Aliases finais ainda deverão ser validados.

Entidades previstas:

```text
CHAT_ROOM
CHAT_MEMBER
CHAT_MESSAGE
CHAT_REFERENCE
CHAT_RECEIPT
```

O primeiro pacote deve conter apenas estruturas efetivamente necessárias ao MVP.

Evitar criar tabelas antecipadamente para features P2.

---

## 23. Gerador de documentação

A mesma definição declarativa poderá gerar automaticamente:

```text
DICTIONARY.md
```

Exemplo:

```text
## ZWC — FWWebEx Chat - Conversas

| Campo | Tipo | Tam. | Obrig. | Descrição |
|---|---:|---:|---|---|
| ZWC_FILIAL | C | 8 | Não | Filial do sistema |
| ZWC_ID | C | 36 | Sim | Identificador da conversa |
```

Isso mantém documentação e pacote alinhados.

---

## 24. UI FWWebEx para o gerador

P1/P2.

Criar uma interface administrativa FWWebEx:

```text
┌─────────────────────────────────────────────┐
│ FWWebEx Dictionary Package                 │
├─────────────────────────────────────────────┤
│ Feature: fw.webex.feature.chat             │
│ Release: 12.1.2410                         │
│                                             │
│ ✓ Definition valid                         │
│ ✓ 5 tables                                 │
│ ✓ 42 fields                                │
│ ✓ 9 indexes                                │
│ ! 2 helps using PT fallback                │
│                                             │
│ [Preview Diff] [Generate Package]           │
└─────────────────────────────────────────────┘
```

Publicação no `systemload` deve ficar separada de `Generate Package`.

---

## 25. Backup de `systemload`

Antes de publicar:

```text
systemload/
    sdfbra.txt
```

criar:

```text
systemload/fwwebex-backup/20260914-134500/
    sdfbra.txt
    manifest_update.txt
    hlppor.txt
    hlpeng.txt
    hlpspa.txt
```

Ou utilizar pasta externa configurável.

Nunca destruir artefatos existentes sem cópia.

---

## 26. Merge com SDF existente

P1 e somente após parser validado.

Problema:

```text
systemload já possui sdfbra.txt de outro pacote
```

O MVP deve preferir gerar pacote isolado em staging.

Não concatenar arquivos cegamente.

Futuro:

```text
parse existing SDF
parse FWWebEx SDF
        │
        ▼
semantic merge
        │
        ├─ collision detection
        ├─ conflict report
        └─ output validated
```

---

## 27. Staging directory

Por segurança, geração deve ocorrer primeiro em:

```text
<RootPath>/fwwebex/systemload-packages/<package>/<version>/
```

ou diretório configurável.

Somente depois:

```text
PublishToSystemLoad()
```

---

## 28. Manifest do próprio FWWebEx

Além do `manifest_update.txt` exigido/esperado pelo ecossistema Protheus, gerar metadata própria:

```text
fwwebex-package.json
```

Exemplo:

```json
{
  "generator": "FWWebEx.DictionaryPackage",
  "feature": "fw.webex.feature.chat",
  "version": "0.1.0",
  "targetRelease": "12.1.2410",
  "files": {
    "sdfbra.txt": "sha256:...",
    "manifest_update.txt": "sha256:...",
    "hlppor.txt": "sha256:...",
    "hlpeng.txt": "sha256:...",
    "hlpspa.txt": "sha256:..."
  }
}
```

Esse arquivo é para rastreabilidade FWWebEx e **não** deve ser confundido com o `manifest_update.txt` Protheus.

---

## 29. API conceitual completa

```advpl
local oPkg := FWWebExDictionaryPackage():New()

oPkg:SetTargetRelease("12.1.2410")
oPkg:Load("fw.webex.feature.chat.dictionary.json")

oPkg:Validate()
oPkg:Diff()
oPkg:Preview()

oPkg:Generate(cStagingPath)
oPkg:Verify(cStagingPath)

oPkg:BackupSystemLoad()
oPkg:PublishToSystemLoad(cStagingPath)
```

Operação explicitamente fora do escopo automático:

```advpl
// NÃO executar silenciosamente:
// UPDDISTR
```

---

## 30. Roadmap

| ID | Prioridade | Item | Status |
|---|---:|---|---|
| DICT-000 | P0 | Coletar fixtures reais de `systemload` | TODO |
| DICT-001 | P0 | Documentar formato `sdfbra.txt` | TODO |
| DICT-002 | P0 | Documentar formato `manifest_update.txt` | TODO |
| DICT-003 | P0 | Documentar formatos `hlp*.txt` | TODO |
| DICT-004 | P0 | Criar modelo lógico de dicionário | TODO |
| DICT-005 | P0 | Criar schema JSON | TODO |
| DICT-006 | P0 | Criar validator | TODO |
| DICT-007 | P0 | Implementar SDF writer SX2 | TODO |
| DICT-008 | P0 | Implementar SDF writer SX3 | TODO |
| DICT-009 | P0 | Implementar SDF writer SIX | TODO |
| DICT-010 | P0 | Implementar help writer PT/EN/ES | TODO |
| DICT-011 | P0 | Implementar manifest writer | TODO |
| DICT-012 | P0 | Golden/round-trip tests | TODO |
| DICT-013 | P0 | Criar dicionário inicial do Chat | TODO |
| DICT-014 | P0 | Gerar pacote Chat válido para UPDDISTR | TODO |
| DICT-015 | P1 | Installed dictionary reader | TODO |
| DICT-016 | P1 | Semantic diff | TODO |
| DICT-017 | P1 | Backup/publish systemload | TODO |
| DICT-018 | P1 | Merge seguro com SDF existente | TODO |
| DICT-019 | P1 | UI FWWebEx administrativa | TODO |
| DICT-020 | P1 | Gerador `DICTIONARY.md` | TODO |
| DICT-021 | P1 | SX1/SX5/SX6/SX7/SX9/SXA | TODO |
| DICT-022 | P1 | CI validation | TODO |
| DICT-023 | P2 | Multi-country writers | TODO |
| DICT-024 | P2 | Upgrade/migration planner | TODO |

---

## 31. POC obrigatória

### Objetivo

Criar uma única tabela de teste com poucos campos e um índice.

```text
manifest declarativo
       │
       ▼
FWWebEx.DictionaryPackage
       │
       ├── sdfbra.txt
       ├── manifest_update.txt
       ├── hlppor.txt
       ├── hlpeng.txt
       └── hlpspa.txt
       │
       ▼
SYSTEMLOAD de homologação
       │
       ▼
UPDDISTR
       │
       ▼
tabela criada corretamente
```

### Critérios de aceite

- [ ] arquivo aceito pelo `UPDDISTR` sem edição manual;
- [ ] SX2 criado corretamente;
- [ ] SX3 criado corretamente;
- [ ] SIX criado corretamente;
- [ ] help exibido corretamente;
- [ ] segunda execução é idempotente;
- [ ] log não apresenta inconsistências;
- [ ] arquivo gerado pode ser reproduzido a partir do Git.

---

## 32. Gate antes de usar no Chat

O Chat só deve depender do gerador depois que a POC provar:

> Uma definição declarativa versionada pelo FWWebEx consegue gerar um pacote `systemload` compatível com o `UPDDISTR`, criando tabela, campos, índice e help sem nenhuma intervenção manual no SIGACFG.

Após esse gate, a instalação do Chat passa a ser:

```text
git clone / update
      │
      ▼
generate dictionary package
      │
      ▼
preview
      │
      ▼
publish systemload
      │
      ▼
UPDDISTR
      │
      ▼
Chat ready
```

---

## 33. Princípio final

O FWWebEx deve tratar seu dicionário da mesma forma que trata seu código:

```text
versionado
reproduzível
revisável
testável
automatizável
```

Nenhuma feature deveria depender de alguém lembrar como recriar manualmente dezenas de campos no SIGACFG.
