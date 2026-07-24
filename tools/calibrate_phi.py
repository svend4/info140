# -*- coding: utf-8 -*-
"""calibrate_phi.py — калибровка порогов вердикта живой/застой/шум (G3 из docs/18).

Снимает блокер docs/16 «пороги — эвристика»: паттерн GoldenSet из docstoolkit
(золотой набор + P/R/F1) в сочетании с их идеей counterfactual_corpus —
эталонные последовательности порождаются ПО ПОСТРОЕНИЮ:
  ЖИВОЙ  — цепочки по сильным рёбрам словаря без повторов (связный рост);
  ЗАСТОЙ — последовательности с доминирующими повторами;
  ШУМ    — прыжки по парам с нулевой близостью.
(eval docstoolkit цитатно-ориентирован, поэтому P/R/F1 реализованы локально
по его паттерну.)

Вердикт-правило (как в приборах p46/p52):
  NOV < tN          -> застой   (повторы душат новизну)
  иначе G < tG      -> шум      (нет связности)
  иначе             -> живой
где G = средняя связность шага (косинус к предыдущему слову по vectors.json),
NOV = средняя новизна шага (слово ещё не встречалось).

Grid-search (tG, tN) максимизирует macro-F1; результат пишется в
prototype/data/phi_calibration.json — приборы смогут читать откалиброванные
пороги вместо зашитых.
"""
import io
import itertools
import json
import math
import os
import random
import sys
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VEC = os.path.join(BASE, "prototype", "data", "vectors.json")
OUT = os.path.join(BASE, "prototype", "data", "phi_calibration.json")

SEQ_LEN = 6
PER_CLASS = 10
SEED = 42


def cos_sparse(a, b):
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def load_vectors():
    with open(VEC, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["provider"], data["words"]


def build_golden(words, C, rng):
    """Порождение эталонов по построению (в духе counterfactual_corpus)."""
    vocab = list(words)
    golden = []

    # ЖИВОЙ: жадные цепочки по сильным рёбрам без повторов
    for _ in range(PER_CLASS):
        start = rng.choice(vocab)
        seq = [start]
        while len(seq) < SEQ_LEN:
            cands = [(C[(seq[-1], w)], w) for w in vocab
                     if w not in seq and C[(seq[-1], w)] > 0.05]
            if cands:
                cands.sort(reverse=True)
                # лёгкое разнообразие: из топ-2
                seq.append(rng.choice([w for _, w in cands[:2]]))
            else:
                rest = [w for w in vocab if w not in seq]
                seq.append(rng.choice(rest))
        golden.append(("живой", seq))

    # ЗАСТОЙ: повторы одного-двух слов
    for _ in range(PER_CLASS):
        a = rng.choice(vocab)
        b = rng.choice([w for w in vocab if w != a])
        pattern = [a, a, a, b, a, a]
        rng.shuffle(pattern)
        # гарантируем доминирование повторов: минимум 4 вхождения a
        seq = [a, a] + pattern[:4]
        golden.append(("застой", seq))

    # ШУМ: прыжки по парам с нулевой близостью (без немедленных повторов)
    for _ in range(PER_CLASS):
        seq = [rng.choice(vocab)]
        guard = 0
        while len(seq) < SEQ_LEN and guard < 200:
            guard += 1
            w = rng.choice(vocab)
            if w == seq[-1]:
                continue
            if C[(seq[-1], w)] <= 0.02:
                seq.append(w)
        while len(seq) < SEQ_LEN:  # добивка на случай плотного словаря
            seq.append(rng.choice([w for w in vocab if w != seq[-1]]))
        golden.append(("шум", seq))

    return golden


def measure(seq, C):
    g_sum, nov_sum, seen, steps = 0.0, 0.0, {seq[0]}, 0
    for prev, cur in zip(seq, seq[1:]):
        steps += 1
        g_sum += 1.0 if cur == prev else C[(prev, cur)]
        nov_sum += 0.0 if cur in seen else 1.0
        seen.add(cur)
    return (g_sum / steps, nov_sum / steps) if steps else (0.0, 0.0)


def verdict(G, NOV, tG, tN):
    if NOV < tN:
        return "застой"
    if G < tG:
        return "шум"
    return "живой"


def prf(golden, preds):
    classes = ("живой", "застой", "шум")
    out = {}
    f1s = []
    for c in classes:
        tp = sum(1 for (g, _), p in zip(golden, preds) if g == c and p == c)
        fp = sum(1 for (g, _), p in zip(golden, preds) if g != c and p == c)
        fn = sum(1 for (g, _), p in zip(golden, preds) if g == c and p != c)
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        out[c] = {"P": round(prec, 3), "R": round(rec, 3), "F1": round(f1, 3)}
        f1s.append(f1)
    out["macroF1"] = round(sum(f1s) / len(f1s), 3)
    return out


def main():
    provider, wv = load_vectors()
    vocab = list(wv)
    C = {}
    for a in vocab:
        for b in vocab:
            C[(a, b)] = cos_sparse(wv[a], wv[b]) if a != b else 1.0

    rng = random.Random(SEED)
    golden = build_golden(vocab, C, rng)
    feats = [measure(seq, C) for _, seq in golden]

    # базовые (зашитые в приборах) пороги — точка отсчёта
    base_tG, base_tN = 0.20, 0.50
    base_preds = [verdict(G, N, base_tG, base_tN) for G, N in feats]
    base = prf(golden, base_preds)

    # grid-search
    best = None
    for tG in [round(x, 3) for x in [0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.16, 0.20, 0.25, 0.30]]:
        for tN in [round(x, 2) for x in [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]]:
            preds = [verdict(G, N, tG, tN) for G, N in feats]
            score = prf(golden, preds)
            if best is None or score["macroF1"] > best[0]["macroF1"]:
                best = (score, tG, tN, preds)
    score, tG, tN, preds = best

    # матрица ошибок для лучших порогов
    classes = ("живой", "застой", "шум")
    conf = {g: {p: 0 for p in classes} for g in classes}
    for (g, _), p in zip(golden, preds):
        conf[g][p] += 1

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"provider": provider, "generated": datetime.now().isoformat(timespec="seconds"),
                   "seed": SEED, "per_class": PER_CLASS, "seq_len": SEQ_LEN,
                   "baseline": {"tG": base_tG, "tN": base_tN, "scores": base},
                   "calibrated": {"tG": tG, "tN": tN, "scores": score},
                   "confusion": conf,
                   "note": "вердикт: NOV<tN застой; G<tG шум; иначе живой"},
                  f, ensure_ascii=False, indent=1)

    print("словарь: %s (%d слов, провайдер %s)" % (os.path.basename(VEC), len(vocab), provider))
    print("золотой набор: %d последовательностей (по построению, seed %d)" % (len(golden), SEED))
    print()
    print("БАЗОВЫЕ пороги (зашиты в приборах): tG=%.2f tN=%.2f -> macro-F1 %.3f" % (base_tG, base_tN, base["macroF1"]))
    for c in classes:
        print("   %-7s P %.2f R %.2f F1 %.2f" % (c, base[c]["P"], base[c]["R"], base[c]["F1"]))
    print()
    print("ОТКАЛИБРОВАНО: tG=%.3f tN=%.2f -> macro-F1 %.3f" % (tG, tN, score["macroF1"]))
    for c in classes:
        print("   %-7s P %.2f R %.2f F1 %.2f" % (c, score[c]["P"], score[c]["R"], score[c]["F1"]))
    print()
    print("матрица (строка=истина, столбец=вердикт):")
    print("           живой застой шум")
    for g in classes:
        print("   %-7s %5d %6d %3d" % (g, conf[g]["живой"], conf[g]["застой"], conf[g]["шум"]))
    print()
    print("->", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
