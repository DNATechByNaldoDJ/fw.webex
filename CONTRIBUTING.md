# Contribuindo com o FWWebEx

## Branches e integração

`main` é a única branch permanente do projeto. Ela reúne as alterações
integradas e é a origem das novas versões publicadas.

Cada trabalho independente deve usar uma branch temporária criada a partir
da `main` atualizada:

- `feature/<tarefa>` para funcionalidades, como `feature/chat`;
- `fix/<tarefa>` para correções, como `fix/labels-svg`;
- `chore/<tarefa>` para manutenção, como `chore/atualizar-documentacao`.

Fluxo de contribuição:

1. Selecione `main` com `git switch main` e atualize-a com
   `git pull --ff-only origin main`.
2. Crie a branch da tarefa, por exemplo `git switch -c feature/chat`.
3. Faça as alterações e execute as validações pertinentes. Informe no PR o
   que foi validado e eventuais limitações, incluindo verificações que
   dependam do ambiente Protheus.
4. Abra um pull request com destino à `main`, descrevendo o problema e o
   comportamento resultante.
5. Após revisão e integração, remova a branch temporária local e remota.

Trabalhos que possam avançar de forma independente devem usar branches
temporárias distintas. Não mantemos branches permanentes `dev`, `develop`,
`develop/*`, `release/*` ou `next`. As versões publicadas são identificadas
por tags.

As convenções de código, exemplos e commits estão na seção
[Como Participar do README](README.md).

## Publicação de versões

O workflow [release-freeze.yml](.github/workflows/release-freeze.yml) publica
versões a partir da `main`. O nome do arquivo é preservado por compatibilidade
com o fluxo anterior de congelamento.

Depois de integrar e validar na `main` as alterações da versão:

1. No GitHub, abra **Actions** e selecione **Publish Release**, definido em
   `release-freeze.yml`.
2. Clique em **Run workflow**, selecionando `main`.
3. Preencha `version` no formato `X.Y.Z`, sem prefixo, por exemplo `1.3.0`.
4. Execute o workflow e confira a tag e a publicação na página **Releases**.

O workflow usa a `main` remota como origem fixa, cria uma tag anotada no
formato `fw.webex-vX.Y.Z` e publica uma GitHub Release com notas geradas
automaticamente. Não cria branches de release ou de desenvolvimento.

A execução é idempotente: repetir a mesma versão reaproveita a tag e a
release existentes, sem mover a tag publicada. A tag existente precisa
pertencer ao histórico da `main`. Se a tag já existir e a publicação ainda
não tiver sido concluída, o workflow pode completar a release dessa tag.
Para publicar alterações posteriores, informe uma nova versão.

Se já houver uma release em rascunho para a versão, publique ou remova esse
rascunho no GitHub antes de repetir o workflow.

A automação não modifica `CHANGELOG.md`. Quando houver atualização manual
desse arquivo, ela deve entrar na `main` pelo mesmo fluxo de contribuição,
antes da publicação da versão.

## Registros históricos

[V0_FREEZE.md](V0_FREEZE.md) preserva a decisão de congelamento da linha v0.
As referências a branches nesse registro descrevem a organização da época;
a política vigente de branches e releases é a deste documento. Tags e
releases já publicadas permanecem como referência das versões anteriores.
