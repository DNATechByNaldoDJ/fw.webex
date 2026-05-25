# V0_FREEZE.md — Registro Oficial de Congelamento da Linha v0

## Motivo do Congelamento

A linha **v0** foi congelada para separar formalmente:
- a manutenção corretiva da versão estável atual; e
- a evolução arquitetural da próxima geração do fw.webex.

Essa decisão evita mistura de escopo (manutenção vs. evolução), reduz risco de regressão em produção e melhora a governança de releases.

## Escopo e Política da v0

A partir do congelamento:
- a v0 permanece como **baseline estável**;
- são permitidas apenas correções críticas/corretivas;
- novas features e refactors estruturais ficam restritos à nova geração.

## Dados do Congelamento

- **Data de referência:** 2026-05-24
- **Tag da baseline v0:** `v0.0.0`
- **Commit baseline (SHA):** `e7f31bf`
- **Branch de manutenção v0:** `release/v0`
- **Branch da nova geração:** `next`

## Relação com a Nova Geração

A evolução da próxima geração ocorre na branch `next`, guiada por:
- `TODO.md` (backlog e plano de sprint);
- `MIGRATION.md` (diretrizes e impactos de migração).

## Status do Congelamento

- [x] Baseline v0 definida
- [x] Política de manutenção da v0 definida
- [x] Estrutura de separação entre v0 e nova geração definida

> Observação: este documento é um **registro de decisão e estado** do congelamento da v0.
