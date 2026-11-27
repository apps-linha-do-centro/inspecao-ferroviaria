# Histórico de publicações

## V24 — 27/11/2026

Inspeção a pé com foto opcional da anomalia, rodapé com KM, coordenadas e horário do registro, e inclusão no PDF. O mesmo aplicativo é compilado para Sites e GitHub Pages. O comando pnpm build:pages gera a distribuição em github-pages/dist/.

Para voltar à V23, consulte a branch inspecao-v23-retorno. No repositório público, restaure somente index.html, sw.js e os demais arquivos da aplicação referenciados pela publicação V23. Preserve notas-lc-campo e os dados locais do navegador. As fotos da V24 voltam a ser exibidas ao retornar à V24.

## V23 — referência recuperável

Código do Sites e7bfa7a17ac57211a00e53ec3ab08f0167bea9a7, com adaptação de caminhos e cache para GitHub Pages. A base IndexedDB permanece na versão 2. Para recompilar a distribuição estática, execute pnpm build:pages a partir da raiz.

## V16 — 08/10/2026

Atualização a partir do Sites, origem ffce6bf5ba19632ae7efa92386343aa222e4fd4c.

- Brita descarregada dentro de Lastro.
- Taludes e Aterros com três opções; mantidos 10 botões.
- Falta de canaleta de crista em Drenagem.
- KM manual para precisão acima de 100 m ou localização ferroviária indisponível, preservando GPS original.
- Teclado numérico, sinal + automático, instruções curtas e precisão com uma casa decimal.

Compilação e 21 cenários simulados aprovados. Validação real em iPhone/Android permanece pendente, conforme autorizado. Dados locais e aplicativo Notas LC preservados.

O histórico de commits mantém as versões anteriores. Para reverter, restaure os arquivos da inspeção em um novo commit, preservando notas-lc-campo/.
