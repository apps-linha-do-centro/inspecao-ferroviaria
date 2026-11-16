# Notas LC — ampliação de 16/11/2026

Relatório fonte: Gilberto Viana, remetente `gilberto.viana@mrs.com.br`, assunto **Notas Linha do Centro**, enviado em 16/11/2026 às 11h16 (Brasília), anexo `Notas_2026-11-16.csv`, 999136 bytes. O e-mail de 06h30 do mesmo dia contém uma extração menor (385311 bytes), ainda limitada aos quatro centros anteriores. O anexo mais recente contém todos os 1.651 IDs anteriores; não é necessário mesclar arquivos.

## Quantitativos conferidos

| Centro SAP | Coordenação no app | Antes | Nova base | Eletro | Via | Infra |
|---|---|---:|---:|---:|---:|---:|
| CFBC | FBC | 421 | 421 | 140 | 238 | 43 |
| CFBJ | FBJ | 377 | 377 | 120 | 257 | 0 |
| CFCL | FCL | 521 | 521 | 53 | 343 | 125 |
| CFFB | FFB | 332 | 332 | 50 | 282 | 0 |
| **CFBR** | **FBR** | **0** | **1502** | **854** | **559** | **89** |
| **CFBV** | **FBV** | **0** | **1479** | **1035** | **401** | **43** |
| **Total** | | **1651** | **4632** | **2252** | **2080** | **300** |

Aumento de 2.981 notas (+180,6%). Nenhuma duplicidade de ID, inclusive após normalização dos zeros. Todos os números originais são preservados como texto. Uma linha anterior recebeu somente alteração de caixa da anomalia: nota 000012749091, `ASSOREAMENTO DE PN` → `Assoreamento de PN`, conforme a extração recebida.

## Ativos, ramais e quilometragem

| Coordenação | Ativos distintos preenchidos | Ramais observados e notas | KM numérico não negativo informado |
|---|---:|---|---|
| FBR | 504 | VPB 1180; TOD 235; LHO 61; ACL 15; sem ativo 11 | 0+143 a 841+866 |
| FBV | 432 | VPB 1315; ACL 155; LC2 2; sem ativo 7 | 306+065 a 1187+000 |

Essas amplitudes são valores calculados dos campos originais do relatório, não limites territoriais validados. Há 301 notas FBR e 153 FBV sem ambos os marcadores KM. Mais 3 FBR e 5 FBV resultam em quilometragem negativa (exemplo: KM604 com distância -611.847); o app sinaliza inconsistência e não as usa na proximidade. Os campos originais permanecem preservados. A base completa tem 541 notas sem marcadores, 19 com resultado numérico negativo (11 anteriores e 8 novas) e 28 sem ativo: 4.072 notas com KM utilizável e 560 sem KM utilizável.

`tracks.json` não contém FBR/FBV. A geometria distribuída e o arquivo raiz `railway-segments-v2.bin` não fornecem metadados de ramais VPB/TOD/LHO/ACL vinculados a essas coordenações. Não foram criadas coordenadas, linhas ou correspondências. **GPS, busca por proximidade e seleção manual desses trechos continuam pendentes de cadastro geográfico oficial.** Consulta e avaliação pela opção Todas as notas funcionam, inclusive quando falta KM.

## Alterações

- `app.js`, `index.html`: filtro múltiplo Coordenação alimentado pela base, combinado com Departamento, criticidade e avaliação; ativos e anomalias disponíveis também na consulta geral; zeros originais nas telas e exportações; acesso a todas as notas e aviso da limitação geográfica.
- `core.js`: quilometragem negativa sinalizada como inconsistente, sem uso na proximidade.
- `automation/coordination-policy.json`, `convert_csv.py`, `build.py`: seis centros e ramais explícitos, contrato de colunas, perfil ferroviário, duplicidades, preservação dos IDs, presença de todas as coordenações e proteção de 35% global/por coordenação.
- Exceção da ampliação: exige exatamente data, total anterior, seis contagens, SHA-256 da entrada sanitizada, SHA-256 das linhas convertidas e retenção dos IDs antigos. Não pode liberar qualquer arquivo com o mesmo total; o crescimento posterior permanece protegido.
- `sync_inputs.py`, `processed-inputs.json`: registro da entrada sanitizada processada e contagem por coordenação no relatório de importação; importação de conferências continua independente.
- `apps-script-v3-extension.gs`: validador V4 com seis centros, sanitização antes do envio público e proteção contra relatório parcial. **Arquivo preparado no GitHub; instalação externa ainda necessária.**
- `.github/workflows/atualizar-notas-lc.yml`: inclui testes de coordenações e YAG. Cron existente preservado: 06h45 e 07h45 em Brasília. Não foi possível inspecionar o gatilho real no Google; a documentação anterior registra execução a cada 15 minutos.
- `notes.json.gz`, `base-status.json`, `sw.js`: base ampliada e identidade de atualização/cache, sem alteração do banco de inspeções.
- `tracks.json`, `rail.bin.gz`, `audit-data.js`: preservados.

## Validação

16 testes Python passaram. Cinco suítes Node passaram: Apps Script, coordenações, Conferida 30d, atualização da base e YAG/ATGMS. Cobertura nova: relatório com coordenação ausente, queda local mesmo abaixo do limite global, código desconhecido, duplicidade após normalizar zeros, exceção exata, arquivo adulterado e crescimento futuro acima de 35%.

No navegador local: 4.632 registros na consulta geral; seis opções de coordenação; FBR 1.502; FBR+FBV 2.981; FBR+FBV+Infra 132; avaliação Manter persistida após reabertura com Conferida 0d; indicação Pronto para uso offline. O teste usou inspeção fictícia somente no ambiente local. O histórico do iPhone do usuário não foi acessado; sua preservação foi verificada nos testes de atualização e na reabertura local, sem alteração do esquema de armazenamento.

A tela publicada do Sites foi inspecionada e continua bloqueando a versão antiga, oferecendo acesso ao GitHub. Não foi modificada.

## Segurança e pendências

O repositório e o Pages são públicos. A entrada nova foi reduzida aos 15 campos do aplicativo; não se publicou o CSV original com nomes de autores, responsáveis nominais e ordens SAP. O anexo recebido traz aviso de confidencialidade. A política interna de segurança da MRS não está disponível, portanto **não se atesta conformidade corporativa da publicação pública**. A base ainda contém informações operacionais; os dados e conferências preexistentes no histórico público não foram removidos nesta alteração.

1. Instalar no projeto Google a extensão atualizada conforme o passo a passo em `README.md`, preservando CONFIG, token e gatilhos. A sessão disponível não abriu o editor autenticado; não foi possível alterar ou verificar a execução do Apps Script real.
2. Receber a geometria/cadastro oficial para FBR/FBV e revisar as oito inconsistências de KM da nova extração.
3. Validar internamente a autorização de uso público dos dados operacionais e das conferências. A redução de colunas não substitui essa aprovação corporativa.

O GitHub está preparado para aceitar exclusivamente a base com as seis coordenações; um próximo arquivo parcial não apaga a ampliação. A atualização integral Gmail → Apps Script → GitHub só poderá ser declarada verificada depois da instalação e execução no Google.

## Reversão

Branch `backup/notas-lc-antes-ampliacao-20261116`, commit `45dae4ed2614bc3f3a7de5359d14ee8d42ac65eb`. Restaurar os arquivos alterados em novo commit sem forçar `main` e sem apagar mudanças posteriores. A reversão do código/base não apaga os registros locais de inspeção.
