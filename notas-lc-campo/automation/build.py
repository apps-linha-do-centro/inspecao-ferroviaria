#!/usr/bin/env python3
"""Valida nova base gerada pelo Google Apps Script; somente biblioteca padrão."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

COLUNAS = [
    "Coordenação", "TAM", "Número da Nota", "Prioridade", "Data da Nota",
    "Ativo", "Descrição", "Código anomalia", "Anomalia", "Marcador inic.",
    "Distância inic.", "Marcador final", "Distância final",
]

def processar(entrada, raiz):
    pasta = raiz / "notas-lc-campo"
    policy = json.loads(Path(__file__).with_name("coordination-policy.json").read_text())
    with gzip.open(entrada, "rt", encoding="utf-8") as f:
        data = json.load(f)
    abas = data.get("abas", [])
    if len(abas) < 2 or not isinstance(abas[0].get("linhas"), list):
        raise ValueError("Esperado abas[0].linhas e abas[1].linhas")
    colunas, linhas = abas[0].get("colunas"), abas[0]["linhas"]
    if not isinstance(colunas, list) or colunas[:13] != COLUNAS:
        raise ValueError("Colunas diferentes do contrato do aplicativo")
    if len(linhas) < 500 or len(linhas) > 250000:
        raise ValueError("Quantidade de notas fora dos limites de segurança")
    for i, row in enumerate(linhas, 1):
        if not isinstance(row, list) or len(row) != len(colunas):
            raise ValueError(f"Linha {i}: número de colunas incompatível")
        if not isinstance(row[2], str) or not re.fullmatch(r"\d{7,15}", row[2]) or not row[2].strip("0"):
            raise ValueError(f"Linha {i}: número da nota deve ser texto numérico preservado")
        if not str(row[2]).strip() or not str(row[0]).strip():
            raise ValueError(f"Linha {i}: identificador ou coordenação ausente")
    sem_ativo = sum(not str(r[5]).strip() for r in linhas)
    if sem_ativo / len(linhas) > 0.1:
        raise ValueError(f"Ativos ausentes em {sem_ativo} notas (>10%)")
    ids = [str(r[2]) for r in linhas]
    if len(set(ids)) != len(ids):
        raise ValueError(f"Números de nota duplicados: {len(ids) - len(set(ids))}")
    # Auditoria: criticidade original deve ser preservada; nao converter em P0/P1/P2.
    from collections import Counter
    criticidades = Counter(str(r[3]).strip() for r in linhas)
    classificacoes = {"1-Muito alta", "2-Alta", "3-Média", "4-Baixa"}
    fora_padrao = {k: v for k, v in criticidades.items() if k and k not in classificacoes}
    # Valores em branco sao validos e continuam como "Criticidade não informada".
    # Valores preenchidos fora do contrato devem bloquear a atualizacao.
    if fora_padrao:
        raise ValueError(f"Criticidades desconhecidas: {fora_padrao}")
    ids_normalizados = [re.sub(r"^0+(?=\d)", "", x) for x in ids]
    repetidos = len(ids_normalizados) - len(set(ids_normalizados))
    if repetidos:
        raise ValueError(f"{repetidos} notas duplicadas apos remover zeros a esquerda")
    version = str(data.get("versao_base", ""))
    if not re.fullmatch(r"20\d\d-\d\d-\d\d", version):
        raise ValueError("Data da extração inválida")
    for j in (9, 11):
        if any(str(r[j]).strip() and not re.fullmatch(r"KM\s*\d+(?:[.,]\d+)?", str(r[j]).strip(), re.I) for r in linhas):
            raise ValueError(f"Marcadores KM da coluna {j} não reconhecidos")
    status_path = pasta / "base-status.json"
    old_status = json.loads(status_path.read_text(encoding="utf-8")) if status_path.exists() else {}
    old_total = int(old_status.get("total", 0))
    variation = abs(len(linhas) - old_total) / old_total if old_total else 0
    counts = Counter(str(r[0]).strip() for r in linhas)
    expected = {c.removeprefix('C') for c in policy['centers']}
    if set(counts) != expected:
        raise ValueError(f"Relatório parcial ou coordenações desconhecidas: esperado {sorted(expected)}, recebido {sorted(counts)}")
    old_path = pasta / 'notes.json.gz'
    old_rows = []
    if old_path.exists():
        with gzip.open(old_path, 'rt', encoding='utf-8') as f:
            old_rows = json.load(f)['abas'][0]['linhas']
    old_counts = Counter(str(r[0]).strip() for r in old_rows)
    for center, total in old_counts.items():
        if counts.get(center, 0) < total * .65:
            raise ValueError(f"Relatório parcial: queda superior a 35% na coordenação {center}")
    expansion = policy['expansion']
    rows_hash = hashlib.sha256(json.dumps(linhas, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    retained = {str(r[2]).lstrip('0') for r in old_rows} <= set(ids_normalizados)
    ampliacao_confirmada = (
        old_total == expansion['previous_total']
        and version == expansion['date']
        and dict(counts) == expansion['counts']
        and data.get('source_sha256') == expansion['source_sha256']
        and rows_hash == expansion['rows_sha256']
        and retained
    )
    if variation > 0.35 and not ampliacao_confirmada:
        raise ValueError(
            f"Volume de {old_total} para {len(linhas)} notas ({variation:.1%}). "
            "Aprovação manual necessária para alteração excepcional."
        )
    missing = sum(not str(r[9]).strip() and not str(r[11]).strip() for r in linhas)
    def parsed_km(marker, offset):
        if not str(marker or '').strip(): return None
        m = re.fullmatch(r'KM\s*(\d+(?:[.,]\d+)?)', str(marker).strip(), re.I)
        d = re.sub(r'\s', '', str(offset or '0')).replace(',', '.')
        if not m or not re.fullmatch(r'[-+]?\d+(?:\.\d+)?', d): return None
        return round((float(m[1].replace(',', '.')) + float(d)) * 1000)
    inconsistent = sum(any(v is not None and v < 0 for v in
                           (parsed_km(r[9], r[10]), parsed_km(r[11], r[12]))) for r in linhas)
    resumo = {
        "version": version, "total": len(linhas), "coordination_counts": dict(sorted(counts.items())),
        "source_sha256": data.get("source_sha256"), "expansion_applied": ampliacao_confirmada, "located": len(linhas) - missing - inconsistent,
        "responsible_work_center": "Centro de trabalho responsável" in colunas,
        "unlocated": missing + inconsistent, "inconsistent_km": inconsistent, "missing_asset": sem_ativo,
        "reasons": {"Km em branco": missing, "Km inconsistente na base": inconsistent, "Ativo em branco": sem_ativo},
        "auditoria_criticidade": dict(sorted(criticidades.items())),
        "criticidades_fora_padrao": fora_padrao,
        "sem_criticidade": criticidades.get("", 0)
    }
    html_path = pasta / "index.html"
    html = html_path.read_text(encoding="utf-8")
    pt = "/".join(reversed(version.split("-")))
    html, n1 = re.subn(r"Notas LC · Base atualizada em \d{2}/\d{2}/\d{4}", f"Notas LC · Base atualizada em {pt}", html, count=1)
    html, n2 = re.subn(r"Notas em campo · Base \d{2}/\d{2}/\d{4}", f"Notas em campo · Base {pt}", html, count=1)
    if n1 != 1 or n2 != 1:
        raise ValueError("Não foi possível atualizar as datas do HTML")
    sw_path = pasta / "sw.js"
    sw = sw_path.read_text(encoding="utf-8")
    # A identidade do cache acompanha base e codigo, inclusive em atualizacoes no mesmo dia.
    digest = hashlib.sha256()
    digest.update(entrada.read_bytes())
    for recurso in ("app.js", "base-updates.js", "core.js", "style.css"):
        digest.update((pasta / recurso).read_bytes())
    identificador_cache = f"notas-lc-v14-{version.replace('-', '')}-{digest.hexdigest()[:12]}"
    sw, n = re.subn(r"const CACHE='notas-lc-v[^']+'", f"const CACHE='{identificador_cache}'", sw, count=1)
    if n != 1:
        raise ValueError("Não foi possível trocar versão de cache")
    shutil.copyfile(entrada, pasta / "notes.json.gz")
    status_path.write_text(json.dumps(resumo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    html_path.write_text(html, encoding="utf-8")
    sw_path.write_text(sw, encoding="utf-8")
    print(json.dumps({"resultado": "VALIDADO", "total": len(linhas), "sem_km": missing,
                      "sem_ativo": sem_ativo, "versao": version, "variacao": f"{variation:.1%}",
                      "criticidades": dict(sorted(criticidades.items())),
                      "criticidades_fora_padrao": fora_padrao}, ensure_ascii=False))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--entrada", required=True, type=Path)
    parser.add_argument("--raiz", default=Path("."), type=Path)
    args = parser.parse_args()
    try:
        processar(args.entrada, args.raiz)
    except Exception as e:
        print(f"BLOQUEADO: {e}", file=sys.stderr)
        sys.exit(1)


