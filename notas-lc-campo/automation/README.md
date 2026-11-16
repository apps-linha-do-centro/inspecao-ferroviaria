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

## Conferida 60d

- O importador e a interface associam IDs numéricos como texto, removendo apenas zeros à esquerda. Os identificadores originais das notas e das inspeções locais são preservados.
- Apenas `Manter` produz confirmação de existência. A aplicação mostra um círculo verde com dias decorridos e permite abrir responsável e data. As outras tratativas não são reclassificadas pelo importador.
- Cada confirmação mantém sua data original. O CSV atual informa o início da conferência, sem horário; essa limitação aparece nos detalhes. O recebimento do e-mail e a reimportação não renovam o prazo.
- O indicador vale enquanto a diferença de dias civis em `America/Sao_Paulo` for 0 a 59. Ao completar 60 dias, desaparece. Outro `Manter` recente renova a confirmação.
- Notas confirmadas são excluídas do filtro Não avaliadas durante a validade. O filtro `Conferida 60d` seleciona essas notas. As seleções simultâneas usam união.
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


## Ampliação de 16/11/2026 — FBR e FBV

`coordination-policy.json` define explicitamente seis centros autorizados e seus ramais observados na extração. A inclusão de novos códigos exige alteração revisada dessa política. O conversor preserva o contrato detalhado e os limiares de perfil ferroviário (75%) e datas (80%), exigindo 100% dos centros reconhecidos. O build exige as seis coordenações e bloqueia reduções superiores a 35% por coordenação, além da variação global de 35%.

A única exceção nova exige data 16/11/2026, base anterior de 1.651 notas, contagem exata de cada coordenação, SHA-256 do CSV sanitizado e das linhas convertidas, e retenção de todos os IDs anteriores. Depois da expansão para 4.632, essa exceção não se aplica novamente. Não há flag para ignorar validações.

### Instalação pendente no Apps Script externo

1. No projeto Google que já executa `atualizarNotasLC`, preserve uma cópia do código atual.
2. Substitua **integralmente a extensão V3** pelo conteúdo atualizado de `apps-script-v3-extension.gs`. Não cole uma segunda cópia das mesmas funções/constantes.
3. Preserve os auxiliares V2 (`normalizarColuna_`, `extrairEmail_`, `requisicaoGitHub_`, `lerConteudoGitHub_`, `bytesIguais_`, `dispatchAtualizacao_`), `CONFIG`, a propriedade secreta `GITHUB_TOKEN` e o gatilho de `atualizarNotasLC`. A V4 não chama mais o validador restrito aos quatro centros da V2.
4. Confira `CONFIG.remetentes` com o endereço verificado `gilberto.viana@mrs.com.br`, destinatário pessoal já configurado, repositório `apps-linha-do-centro/inspecao-ferroviaria`, branch `notas-lc-inbox`, caminho `notas-lc-campo/automation/incoming.csv`, fuso `America/Sao_Paulo` e limite de anexo de pelo menos 999136 bytes. Não acrescente remetentes sem autorização.
5. Salve e execute `atualizarNotasLC` uma vez. Confira o log e o workflow no GitHub. O fluxo deve reconhecer todas as seis coordenações; anexos parciais são rejeitados. Não recrie nem altere o horário do gatilho existente.

A extensão sanitiza o CSV de notas antes de enviá-lo ao repositório público, conservando as 13 colunas obrigatórias e os dois campos opcionais utilizados. Autores, responsáveis nominais e ordens do SAP não são enviados nessa entrada nova. Não há alteração dos arquivos de tratativas já existentes. Essa minimização não comprova autorização corporativa para publicação dos dados operacionais ou das conferências: a política interna da MRS não foi fornecida.

Os scripts de produção continuam vindo de `main`; não se deve mesclar a branch antiga `notas-lc-inbox` sobre `main`. Ela contém versões antigas da interface e serve somente de caixa de entrada.

### Geografia

A revisão de 16/11/2026 recuperou a planilha original `Eixo_Pontos_unificado_4326_5M 5.xlsx`, no Drive, pasta `1 - Quilometragem e georreferência`. O binário raiz já continha FBR/FBV, porém codificava os ramais desses centros como vazios. A planilha original contém `LocalInst`, `Deno`, `Linha`, `Coord`, `Ramal`, `LocInstSup`, `KM`, `Latitude` e `Longitude` e permite incorporar os trechos sem inventar relações.

`import_geography.py` acrescentou 39 referências FBR (19.426 segmentos) e 34 FBV (17.383 segmentos). As 238 referências e os 111.296 segmentos anteriores foram preservados, com os mesmos índices e bytes. `geography-source.json` registra SHA-256 do Excel, regras, contagens e hashes para auditoria. Não foi publicada a planilha completa. O importador requer Python com openpyxl para ler o Excel e só precisa ser executado quando a geografia original for atualizada.

O agrupamento usa os campos originais de coordenação, ramal, ativo, ativo superior, linha e denominação. Isso mantém separados registros cujo LocalInst é igual, mas o LocInstSup difere na origem. Segmentos com lacuna física ou de KM superior a 30 m são excluídos. Não há extrapolação fora dos segmentos existentes.

O GPS passa a usar VPB/TOD de FBR e VPB/ACL de FBV disponíveis na origem. A busca manual continua oferecendo referências das notas quando uma linha não consta dessa tabela. Não se declara cobertura total de todos os ativos das novas coordenações: por exemplo, não foram encontrados pontos originais FBR/LHO nesta planilha. Nesses casos a consulta manual permanece disponível e não recebe coordenadas fictícias.

Nos detalhes da nota, o ativo e o KM são cruzados com a linha de referência para calcular a coordenada inicial/final e oferecer Ver no mapa. Essa coordenada é identificada como tabela ferroviária e não substitui o GPS real do clique de avaliação. Se houver mais de uma linha ou posições divergentes, a aplicação informa a ambiguidade e não escolhe uma coordenada arbitrária. O GPS e a tabela mantêm suas origens distintas.

Uma nota pode estar atribuída no SAP a FBR e usar um ativo que a tabela territorial cadastra como FBV. A associação física só atravessa essa diferença quando o ramal e o ativo superior coincidem com a geometria original validada. O centro original da nota e o centro da tabela não são modificados. Isso recupera as 50 notas da faixa do km 530 na referência geográfica de Belo Vale, incluindo as cinco atribuídas a FBR.

URLs e cache acompanham código e geografia. Atualizações normais de notas não substituem `tracks.json` nem `rail.bin.gz`.


### Recuperação

Backup: branch `backup/notas-lc-antes-ampliacao-20261116`, commit `45dae4ed2614bc3f3a7de5359d14ee8d42ac65eb`. Para reverter, restaurar somente os arquivos desta alteração em um novo commit, mantendo alterações posteriores e históricos. Não forçar o ponteiro de `main`. Reverter o Apps Script externo a partir da cópia preservada no Google quando necessário.


### Consulta manual corrigida no km 530 (16/11/2026)

A lista manual usa a união de referências geométricas na tolerância informada e ativos distintos com notas válidas nessa mesma faixa. Referências extraídas das notas são identificadas como `Base de notas · sem geometria GPS`, mantendo ativo, coordenação e ramal originais. Não se amplia o intervalo entre notas esparsas nem se criam coordenadas ou segmentos. A consulta continua isolada por coordenação e ramal; a escolha de uma linha de referência não restringe as demais linhas/AMVs/ativos da mesma coordenação/ramal na faixa. Referências manuais são preservadas no histórico por seu próprio cadastro, sem índice fictício na geometria de GPS.

Caso verificado: km 530+000 ±500 m possui 29 referências únicas na extração atual, 45 notas FBV e 5 FBR. A lista antes mostrava zero porque dependia exclusivamente de `rail.bin.gz`. Testes cobrem a origem das referências, intervalos, ausência de duplicidade, separação de ramais/coordenações, restauração e coordenadas nulas. Navegador confirmou 45 notas FBV e mesma referência após reabrir. `core.js` e `app.js` receberam URLs de versão correspondentes no HTML e no pré-cache para impedir mistura de versões.

Backup anterior à correção manual: branch `backup/notas-lc-antes-km530-20261116`, commit `2baa998ea94bcde90af3c0788318d6a3068c2916`. Base de notas, auditorias e arquivos geográficos não foram modificados.
