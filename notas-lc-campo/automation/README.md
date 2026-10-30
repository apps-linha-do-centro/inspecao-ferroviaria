# Notas LC — duas entradas independentes (V3, 27/10/2026)

Gmail pessoal → Apps Script `atualizarNotasLC` (gatilho existente de 15 minutos) → branch `notas-lc-inbox` → workflow `atualizar-notas-lc.yml` → `main` → GitHub Pages.

## Entradas

- Base completa de notas: `automation/incoming.csv`, com as 13 colunas obrigatórias do relatório LC. O campo opcional `Campo de ordenação` também é preservado quando presente. Mantém as validações de remetente, estrutura, identificadores, criticidade, perfil ferroviário e variação máxima de 35% do volume.
- Tratativas: `automation/tratativas/<sha256>.csv`. Cada anexo distinto fica preservado; novos arquivos não substituem os anteriores. São exigidas as colunas Colaborador, Início conferência, Número da Nota, Tratativa e Texto livre, com os nomes completos do consolidado.
- Os arquivos podem chegar juntos, separados, em horários distintos e com nomes/assuntos diferentes. A classificação usa as colunas. PDFs, imagens, Excel e relatórios sem o contrato são ignorados.
- O Apps Script consulta os últimos sete dias para recuperar atrasos. Não altera leitura, marcadores ou conteúdo dos e-mails.
- Dois CSVs completos de notas no mesmo e-mail são ambíguos: a parte de notas é bloqueada para revisão, mas os consolidadores de conferências ainda são processados.

## Idempotência e publicação

`processed-inputs.json` registra o SHA-256 da base de notas e dos anexos de tratativas aceitos. Não depende do SHA global da branch de entrada. Reenvios idênticos não geram nova conferência ou publicação. A marcação só é gravada no mesmo commit que os dados validados.

O workflow usa scripts da própria `main`, sem depender da antiga branch de ferramentas. Cada arquivo é validado separadamente; uma entrada rejeitada mantém a última base dessa categoria, sem impedir a outra categoria válida. Ao final, erros ficam visíveis no Actions. O agendamento também recupera entradas não processadas de dias anteriores.

## Conferida 30d

- O importador e a interface associam IDs numéricos como texto, removendo apenas zeros à esquerda. Os identificadores originais das notas e das inspeções locais são preservados.
- Apenas `Manter` produz confirmação de existência. A aplicação mostra um círculo verde com dias decorridos e permite abrir responsável e data. As outras tratativas não são reclassificadas pelo importador.
- Cada confirmação mantém sua data original. O CSV atual informa o início da conferência, sem horário; essa limitação aparece nos detalhes. O recebimento do e-mail e a reimportação não renovam o prazo.
- O indicador vale enquanto a diferença de dias civis em `America/Sao_Paulo` for 0 a 29. Ao completar 30 dias, desaparece. Outro `Manter` recente renova a confirmação.
- Notas confirmadas são excluídas do filtro Não avaliadas durante a validade. O filtro `Conferida 30d` seleciona essas notas. As seleções simultâneas usam união.
- `audit-data.js` armazena apenas ID normalizado, nome, dia e origem. Texto livre não é publicado nesse recurso. O histórico é mesclado sem apagar confirmações porque uma nota está temporariamente fora da base.
- O service worker inclui os recursos de conferência, e o cache muda com alterações da base, código ou conferências. Não limpa IndexedDB nem histórico de inspeções.

## Atualização opcional no aparelho

- Ao abrir, voltar ao aplicativo ou recuperar a conexão, a interface consulta `base-status.json` pela rede sem usar o cache do service worker. Só oferece **Atualizar base** quando a versão publicada é diferente da carregada.
- A base baixada é validada e salva em IndexedDB separado antes de substituir a base em uso. A inspeção e o histórico são preservados; um formulário de avaliação aberto termina antes da troca em memória.
- Sem sinal ou se o download falhar, a base anterior continua disponível. Quando a versão carregada coincide com a publicada, há apenas um pequeno indicador verde ao lado da data. A verificação manual fica no rodapé.
- O importador preserva `Campo de ordenação` do CSV, inclusive na publicação atual. Se um relatório não trouxer a coluna, a interface indica que ela não foi informada.

## Apps Script

O arquivo `apps-script-v3-extension.gs` usa os auxiliares da V2 e a propriedade existente `GITHUB_TOKEN`, sem reproduzir ou mudar o segredo. Antes da instalação, preservar o código V2; renomear a função antiga para `atualizarNotasLC_V2_DESATIVADA` e acrescentar a extensão V3. Não reinstalar o gatilho: o nome ativo continua `atualizarNotasLC`.

## Verificação e recuperação

Rodar os testes Python `test_*.py`, `test-audit-ui.mjs` e `test-apps-script.mjs`. Cobrem CSVs juntos/separados, repetição, falha isolada, IDs com zeros, auditor/data, prazo e recursos offline.

Backup do GitHub anterior: branch `backup/notas-lc-antes-conferencias-20261027`, commit `07b9c1b5ff698bb86767abeffad44bef0956ca44`. O Apps Script conserva a V2 em `BackupV2_20261027.html`, como texto sem execução. A versão Sites usada para ensaio é independente do GitHub e não recebe sincronização automática.
