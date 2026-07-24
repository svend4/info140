# -*- coding: utf-8 -*-
"""adaptive_k.py — адаптивное K оконного ритма через ThompsonBandit (G2 из docs/18).

Идея (docs/17, открытый вопрос №1): K — число повторов петли до окна — не
назначается, а НАХОДИТСЯ самой системой. Руки бандита = K ∈ {0..5};
награда эпизода = Бернулли с вероятностью R(K), где R считается честной
симуляцией оконного ритма на реальном словаре vectors.json:

  Q(K)      — качество впусков: средний косинус нового слова к петле;
              растёт с K (повторы = закрепление = у окна время выбрать
              лучшее: пул кандидатов сужается top-(4−K) → top-1);
  N_eff(K)  — эффективный темп новизны: окна реже с ростом K, НО без
              повторов слово не приживается — вероятность отката
              retention(K) = min(1, 0.2+0.3K) («нагруженное возвращение»
              из гл.9: незакреплённое окно отваливается);
  R = clamp( Q/Q0 * sqrt(N_eff) ) — связность × темп живого роста.

Модельное допущение retention заявлено явно (это симуляционный стенд);
поставка G2 — сама машинерия самонастройки: Thompson-бандит docstoolkit
сходится к K* без знания кривой, что проверяется брутфорс-замером.
"""
import io
import json
import math
import os
import random
import sys
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, r"C:\Users\stefan\Documents\lorenzo\docs-toolkit")

from docstoolkit.bandit.bandit import ThompsonBandit  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VEC = os.path.join(BASE, "prototype", "data", "vectors.json")
OUT = os.path.join(BASE, "prototype", "data", "adaptive_k.json")

ARMS = ["K=%d" % k for k in range(6)]
CYCLES = 12          # оборотов петли в эпизоде
Q0 = 0.12            # нормировка качества (масштаб tf-idf-косинусов словаря)
THETA = 0.02         # порог связности впуска (из калибровки G3: tG=0.020)
PULLS = 400
SIMS_TRUE = 600
SEED = 42


def cos_sparse(a, b):
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def episode_reward(K, vocab, C, rng):
    """Один эпизод оконного ритма при данном K -> вероятность успеха R."""
    start = rng.choice(vocab)
    mate = max((w for w in vocab if w != start), key=lambda w: C[(start, w)])
    loop = [start, mate]
    retention = min(1.0, 0.2 + 0.3 * K)
    pool_size = max(1, 4 - K)

    accepted, q_sum = 0, 0.0
    rep = 0
    for _ in range(CYCLES):
        rep += 1
        if rep < K + 1:
            continue
        rep = 0
        # окно: кандидаты вне петли по средней связности с петлёй
        cands = []
        for w in vocab:
            if w in loop:
                continue
            score = sum(C[(w, m)] for m in loop) / len(loop)
            if score > THETA:
                cands.append((score, w))
        if not cands:
            continue
        cands.sort(reverse=True)
        score, w = rng.choice(cands[:pool_size])
        if rng.random() > retention:
            continue  # без закрепления слово не прижилось (откат)
        accepted += 1
        q_sum += score
        if len(loop) < 7:
            loop.append(w)
        else:
            weakest = min(range(len(loop)),
                          key=lambda i: sum(C[(loop[i], m)] for m in loop if m != loop[i]))
            loop[weakest] = w

    if not accepted:
        return 0.0
    Q = q_sum / accepted
    N_eff = accepted / CYCLES
    return max(0.0, min(0.95, (Q / Q0) * math.sqrt(N_eff)))


def main():
    with open(VEC, "r", encoding="utf-8") as f:
        wv = json.load(f)["words"]
    vocab = list(wv)
    C = {}
    for a in vocab:
        for b in vocab:
            C[(a, b)] = cos_sparse(wv[a], wv[b]) if a != b else 1.0

    rng = random.Random(SEED)

    # --- брутфорс: истинные кривые R(K) --------------------------------------
    true_means = {}
    for k in range(6):
        vals = [episode_reward(k, vocab, C, rng) for _ in range(SIMS_TRUE)]
        true_means["K=%d" % k] = round(sum(vals) / len(vals), 3)
    true_best = max(true_means, key=true_means.get)

    # --- Thompson-бандит docstoolkit сам ищет K* -----------------------------
    bandit = ThompsonBandit(ARMS, db_path=":memory:", seed=SEED)
    for _ in range(PULLS):
        arm = bandit.select()
        k = int(arm.split("=")[1])
        p = episode_reward(k, vocab, C, rng)
        reward = 1.0 if rng.random() < p else 0.0
        bandit.update(arm, reward)

    states = bandit.state()
    win = bandit.winner(confidence=0.9)
    bandit_best = max(states, key=lambda s: s.mean).arm_name

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"generated": datetime.now().isoformat(timespec="seconds"),
                   "seed": SEED, "pulls": PULLS, "sims_true": SIMS_TRUE,
                   "true_means": true_means, "true_best": true_best,
                   "bandit": [{"arm": s.arm_name, "mean": round(s.mean, 3),
                               "ci": [round(s.ci_low, 3), round(s.ci_high, 3)],
                               "pulls": s.total_pulls} for s in states],
                   "bandit_best": bandit_best,
                   "winner_ci90": win,
                   "match": bandit_best == true_best,
                   "model_note": "retention(K)=min(1,0.2+0.3K), pool=top-(4-K) — модельные допущения стенда"},
                  f, ensure_ascii=False, indent=1)

    print("истинные средние R(K) (брутфорс, %d симуляций/руку):" % SIMS_TRUE)
    for a in ARMS:
        mark = " <-- истинный оптимум" if a == true_best else ""
        print("  %s  %.3f%s" % (a, true_means[a], mark))
    print()
    print("Thompson-бандит (docstoolkit, %d вытягиваний, без знания кривой):" % PULLS)
    for s in states:
        mark = " <-- выбор бандита" if s.arm_name == bandit_best else ""
        print("  %s  mean %.3f  CI[%.2f..%.2f]  pulls %3d%s"
              % (s.arm_name, s.mean, s.ci_low, s.ci_high, s.total_pulls, mark))
    print()
    print("уверенный победитель (CI 90%%): %s" % (win or "ещё не выделился"))
    print("совпадение с истинным оптимумом: %s" % ("ДА" if bandit_best == true_best else "НЕТ"))
    print("->", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
