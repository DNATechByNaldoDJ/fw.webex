# MIGRATION.md — v0 → Próxima Geração fw.webex

## 1) Propósito

> Execução operacional do congelamento: ver `V0_FREEZE.md`.

Este documento descreve a migração da linha **v0 (congelada)** para a **nova geração** do fw.webex.

- v0: baseline estável, manutenção corretiva/crítica.
- Próxima geração: evolução arquitetural com possível breaking change.

---

## 2) Princípios da Migração

1. Migração orientada por etapas (não big-bang obrigatório).
2. Sem garantia de compatibilidade automática completa.
3. Toda mudança relevante deve ter exemplo e documentação de uso.
4. Recursos antigos podem ser deprecados com aviso prévio.

---

## 3) Escopos Iniciais de Mudança

## 3.1 Inicializador de DOM configurável

Contrato inicial implementado:
- `FWWebEx.init(config)`
- `FWWebEx.ready(fn)`
- hooks de ciclo de vida (ex.: `beforeInit`, `afterInit`, `onError`)
- eventos de ciclo (`FWWebEx:init:before`, `FWWebEx:init:after`, `FWWebEx:init:error`, `FWWebEx:dom:ready`)

Impacto esperado:
- substituição/organização de pontos de bootstrap implícitos;
- maior previsibilidade de inicialização por página/componente.

Uso recomendado:
```javascript
window.FWWebEx.config = {
    ready: {
        datatable: {
            timeout: 600,
            optional: true
        }
    },
    hooks: {
        beforeInit: function(config, state, FWWebEx) {},
        afterInit: function(config, state, FWWebEx) {},
        onError: function(payload, state, FWWebEx) {}
    }
};

FWWebEx.ready(function(state, FWWebEx) {
    // DOM pronto e runtime disponivel.
});
```

Exemplo de referência:
- `src/fw.webex/tests/fw.webex.examples/027/fw.webex.example.027.tlpp`

## 3.2 DataTable Form estabilizado

Contrato inicial implementado:
- `WebExDataTableForm():New(cTitle,jDataTableFields,cMode,aReadOnlyFields)`
- `SetFormConfig(jFormConfig)` para `required`, `readonly` e `lookups`
- `LoadFromDataTableRow(jRowData)` para popular o formulario
- `RenderHTMLWithModal()` para renderizar em modal Bootstrap
- `SetUpdateFunction(cUpdateFunction)` para callback JavaScript ou endpoint `POST`

Impacto esperado:
- substituicao do prototipo anterior do datatable form;
- formularios de view/edit gerados a partir da mesma configuracao de campos da DataTable;
- submits locais, por funcao JS ou por endpoint HTTP.

Uso recomendado:
- configurar `required`, `readonly` e `lookups` antes de chamar `LoadFromDataTableRow()`;
- usar `SetDataTableID()` quando o submit precisar redesenhar/recarregar uma tabela vinculada;
- para grids client-side, atualizar os dados na funcao JS definida em `SetUpdateFunction()`.

Exemplos de referência:
- `src/fw.webex/tests/fw.webex.examples/028/fw.webex.example.028.tlpp`
- `src/fw.webex/tests/fw.webex.examples/029/fw.webex.example.029.tlpp`

## 3.3 Externalização de JavaScript

Mudança alvo:
- reduzir JS inline;
- separar core e features em módulos carregáveis.

Impacto esperado:
- melhor manutenção e cache;
- maior controle de carregamento por contexto.

## 3.4 Modelo Plugável

Mudança alvo:
- registrar features/plugins com contrato mínimo (nome, versão, init, dependências).

Impacto esperado:
- desacoplamento entre core e extensões;
- evolução incremental com menor atrito.

---

## 4) Guia de Migração por Fases

### Fase A — Preparação
- Identificar pontos de entrada v0 usados no projeto.
- Mapear dependências JS inline e componentes críticos.

### Fase B — Bootstrap Novo
- Introduzir `FWWebEx.init(config)` no app. **Concluído no core**
- Migrar inicialização principal para hooks explícitos. **Concluído no core**
- Aplicar configuração por página via `window.FWWebEx.config` antes do `DOMContentLoaded`.

### Fase C — Plugins
- Migrar uma feature piloto (datatable) para registro plugável.
- Validar carregamento e fallback em ambiente de teste.

### Fase D — Consolidação
- Atualizar exemplos, testes e READMEs.
- Remover dependências legadas selecionadas.

---

## 5) Checklist de Migração

- [x] Bootstrap novo aplicado no projeto.
- [x] DataTable Form estabilizado com exemplos.
- [ ] JS inline crítico externalizado.
- [ ] Plugin piloto ativo e validado.
- [x] Exemplos atualizados.
- [ ] Testes essenciais executados.
- [x] Impactos documentados.

---

## 6) Convenção de Versionamento sugerida

- v0.x.x: manutenção da linha congelada.
- v1.0.0-alpha.N: maturação da nova geração.
- v1.0.0-beta/rc: estabilização.
- v1.0.0: release geral.

---

## 7) Observações

Este guia será atualizado a cada sprint com:
- mudanças introduzidas;
- decisões de depreciação;
- ajustes de fluxo de migração.
