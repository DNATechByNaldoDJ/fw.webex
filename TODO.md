# TODO.md — fw.webex (Próxima Geração)

> **Status da linha atual:** v0 congelada (manutenção apenas corretiva/crítica)
>  
> **Nova linha evolutiva:** próxima geração (sem compromisso de retrocompatibilidade com v0)
>  
> **Data de início:** 2026-05-24

---

## 1) Visão da Geração

Esta geração inicia uma nova arquitetura do fw.webex com foco em:
- inicializador de DOM configurável;
- externalização de JavaScript;
- modelo plugável para recursos e integrações;
- fechamento orientado a prioridade dos TODOs legados críticos.

Fora de escopo imediato:
- migração automática completa de projetos v0;
- compatibilidade total e transparente entre v0 e nova geração.

---

## 2) Diretriz de Compatibilidade

- A versão **v0 está congelada** como baseline estável.
- A nova geração pode introduzir **breaking changes planejados**.
- A migração será tratada por documentação e guias (`MIGRATION.md`), não por camada de compatibilidade obrigatória.

---

## 3) Objetivos e Métricas

### Objetivos
- [ ] Definir API de bootstrap (`FWWebEx.init(config)`) e lifecycle.
- [ ] Implementar arquitetura plugável mínima (registro + init de plugins).
- [ ] Externalizar JS por módulos (core + features).
- [ ] Resolver TODOs P0/P1 com exemplos obrigatórios.

### Métricas
- TODOs P0 resolvidos: `0/2`
- TODOs P1 resolvidos: `0/2`
- Exemplos novos publicados: `0/2`
- Módulos migrados para modelo plugável: `0/1 (piloto)`

---

## 4) Backlog Priorizado

Legenda:
- Prioridade: P0 (crítico), P1 (alto), P2 (médio)
- Status: TODO | IN_PROGRESS | BLOCKED | DONE

| ID | Prioridade | Módulo | Item | Origem | Exemplo obrigatório | Status | Sprint |
|---|---|---|---|---|---|---|---|
| NX-000 | P0 | governança/release | Efetivar congelamento operacional da v0 (tag + branches + proteção) | `V0_FREEZE.md` | Não | TODO | S1 |
| NX-001 | P0 | core/table | Implementar carregamento real via AJAX | `src/fw.webex/core/component/fw.webex.table.tlpp` | Sim | TODO | S2 |
| NX-002 | P0 | contrib/datatable | Finalizar fluxo do datatable form e estabilizar uso | `src/fw.webex/contrib/fw.webex.datatable/fw.webex.datatable.form.tlpp` | Sim | TODO | S1 |
| NX-003 | P1 | features/markdown | Revisar TODOs de plugins markdown | `src/fw.webex/contrib/fw.webex.features/features/fw.webex.feature.markdown.tlpp` | Sim | TODO | S3 |
| NX-004 | P1 | tests/md | Corrigir cenário PageHeader/PageFooter | `src/fw.webex/tests/md/testemd.tlpp` | Não | TODO | S1 |
| NX-005 | P0 | core/bootstrap | Criar inicializador de DOM configurável com hooks | Novo | Sim | TODO | S1 |
| NX-006 | P0 | core/plugins | Definir registro e contrato mínimo de plugins | Novo | Sim | TODO | S2 |

---

## 5) Definition of Ready (DoR)

Um item entra em sprint quando:
- possui critério funcional objetivo;
- impacto técnico foi mapeado (core, contrib, docs e testes);
- há estratégia de teste local definida;
- se alterar comportamento: existe plano de exemplo e documentação.

## 6) Definition of Done (DoD)

Um item só pode ser concluído quando:
- [ ] Implementação finalizada.
- [ ] Testes/checagens locais executados.
- [ ] Documentação atualizada (README/changelog/TODO).
- [ ] Exemplo criado/atualizado (quando aplicável).
- [ ] Impacto de migração documentado em `MIGRATION.md`.

---

## 7) Plano de Sprint

### Sprint 1 — Fundação e primeira entrega visível

Objetivo: estabelecer a base arquitetural e concluir um TODO crítico com exemplo.

Escopo:
1. NX-005: inicializador de DOM configurável (`init`, `ready`, hooks principais).
2. NX-002: concluir datatable form.
3. NX-004: corrigir teste markdown de header/footer.
4. Criar 2 exemplos para datatable (mínimo e realista).
5. Atualizar documentação de uso da feature.

Critério de aceite:
- 100% dos itens P0 planejados da sprint concluídos;
- exemplos executáveis adicionados;
- testes da área alterada executados.

### Sprint 2 — Plugabilidade e núcleo de tabela

Objetivo: consolidar arquitetura plugável e resolver TODO crítico do core/table.

Escopo:
1. NX-006: registro e ciclo de vida de plugins (piloto).
2. NX-001: carregamento AJAX real em tabela.
3. Integração plugin piloto + datatable.
4. Atualização de guia de migração para mudanças técnicas.

### Sprint 3 — Features e qualidade

Objetivo: reduzir dívida técnica de markdown e elevar robustez.

Escopo:
1. NX-003: TODOs de markdown.
2. Ajustes de estilo/comportamento associados.
3. Revisão final de exemplos e testes da feature.

---

## 8) Política de Evolução

- v0 permanece disponível como referência estável.
- Nova geração evolui com versionamento próprio.
- Breaking changes devem ser documentados previamente.
- Cada alteração estrutural relevante precisa de impacto descrito no `MIGRATION.md`.
