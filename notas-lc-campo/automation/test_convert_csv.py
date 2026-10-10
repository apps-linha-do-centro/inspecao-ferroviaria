#!/usr/bin/env python3
"""Testes de regressão do contrato Notas LC. Executar: python3 -m unittest discover -s notas-lc-campo/automation -p 'test_*.py'"""
import csv
import gzip
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

CONVERTER = Path(__file__).with_name("convert_csv.py")

class ConversaoNotasTest(unittest.TestCase):
    def test_preserva_id_prioridade_e_localizacao(self):
        with tempfile.TemporaryDirectory() as temp:
            origem = Path(temp) / "entrada.csv"
            destino = Path(temp) / "saida.json.gz"
            colunas = [
                "Número da nota", "Texto referente à prioridade",
                "Centro para centro de trabalho responsável",
                "Tipo de atividade de manutenção", "Data da nota",
                "Local de instalação TPLNR", "Texto breve", "Codificação 1",
                "Texto breve para o código", "Marcador para o ponto de partida",
                "Market Dist Start 2", "Marcador para o ponto final",
                "Maker Dist End 1"
            ]
            with origem.open("w", encoding="utf-8", newline="") as arq:
                w = csv.DictWriter(arq, fieldnames=colunas)
                w.writeheader()
                for nota, prioridade in [
                    ("000013558789", "1-Muito alta"),
                    ("000013827803", "2-Alta"),
                    ("14600288", "3-Média"),
                    ("14619762", "4-Baixa"),
                ]:
                    w.writerow({
                        "Número da nota": nota,
                        "Texto referente à prioridade": prioridade,
                        "Centro para centro de trabalho responsável": "CFCL",
                        "Local de instalação TPLNR": "MF-LC2-FCL_FCL-L000004",
                        "Texto breve": "Teste",
                        "Marcador para o ponto de partida": "KM461",
                        "Market Dist Start 2": "0,532",
                        "Marcador para o ponto final": "KM461",
                        "Maker Dist End 1": "0,612",
                    })
            subprocess.run([sys.executable, str(CONVERTER), str(origem), str(destino)], check=True, capture_output=True, text=True)
            with gzip.open(destino, "rt", encoding="utf-8") as arq:
                dados = json.load(arq)
            linhas = dados["abas"][0]["linhas"]
            self.assertEqual([r[2] for r in linhas], ["000013558789", "000013827803", "14600288", "14619762"])
            self.assertEqual([r[3] for r in linhas], ["1-Muito alta", "2-Alta", "3-Média", "4-Baixa"])
            self.assertEqual(linhas[0][9], "KM 461")
            self.assertEqual(linhas[0][10], "0,532")
            self.assertEqual(len(linhas), 4)


    def test_rejeita_relatorio_de_inconsistencias(self):
        with tempfile.TemporaryDirectory() as temp:
            origem=Path(temp)/"relatorio_inconsistencias.csv"
            destino=Path(temp)/"saida.json.gz"
            with origem.open("w", encoding="utf-8", newline="") as arq:
                w=csv.DictWriter(arq, fieldnames=["Número da nota", "Situação", "Observação"])
                w.writeheader()
                w.writerow({"Número da nota":"000014600288", "Situação":"Corrigir", "Observação":"Relatório parcial"})
            resultado=subprocess.run([sys.executable,str(CONVERTER),str(origem),str(destino)],
                                     capture_output=True,text=True)
            self.assertNotEqual(resultado.returncode,0)
            self.assertIn("REJEITADO",resultado.stderr)
            self.assertFalse(destino.exists())

    def test_rejeita_base_de_outro_dashboard_mas_com_colunas_iguais(self):
        with tempfile.TemporaryDirectory() as temp:
            origem=Path(temp)/"amv_renomeado.csv"
            destino=Path(temp)/"saida.json.gz"
            colunas=[
                "Centro para centro de trabalho responsável", "Tipo de atividade de manutenção",
                "Número da nota", "Texto referente à prioridade", "Data da nota",
                "Local de instalação TPLNR", "Texto breve", "Codificação 1",
                "Texto breve para o código", "Marcador para o ponto de partida",
                "Market Dist Start 2", "Marcador para o ponto final", "Maker Dist End 1",
            ]
            with origem.open("w",encoding="utf-8",newline="") as arq:
                writer=csv.DictWriter(arq,fieldnames=colunas)
                writer.writeheader()
                for i in range(600):
                    writer.writerow({
                        "Centro para centro de trabalho responsável":"OUTRO",
                        "Tipo de atividade de manutenção":"AMV",
                        "Número da nota":str(15000000+i),
                        "Texto referente à prioridade":"3-Média",
                        "Data da nota":"09/10/2026",
                        "Local de instalação TPLNR":"OUTRO-ATIVO",
                        "Marcador para o ponto de partida":"KM461",
                        "Market Dist Start 2":"0",
                        "Marcador para o ponto final":"KM461",
                        "Maker Dist End 1":"0",
                    })
            resultado=subprocess.run([sys.executable,str(CONVERTER),str(origem),str(destino)],
                                     capture_output=True,text=True)
            self.assertNotEqual(resultado.returncode,0)
            self.assertIn("REJEITADO",resultado.stderr)
            self.assertFalse(destino.exists())

if __name__ == "__main__":
    unittest.main()
