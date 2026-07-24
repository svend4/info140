# -*- coding: utf-8 -*-
"""make_vectors.py — честный словарь векторов для приборов MERIDIAN (G6+B2 из docs/18).

Каскад провайдеров (паттерн деградации p34):
  1) sentence-transformers через docstoolkit (настоящая семантика, если установлен);
  2) TFIDFProvider docstoolkit (лексическая близость, всегда работает);
  3) PPMI-профили из semantic_engine Котла (дистрибутивная, наш фикс Н1).

Пишет prototype/data/vectors.json:
  {provider, generated, words: {слово: {токен: вес}}, demo: {пара: cos}}
Разреженные dict-векторы: JS-косинус в приборах тривиален.
"""
import io
import json
import math
import os
import sys
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

LORENZO = r"C:\Users\stefan\Documents\lorenzo\docs-toolkit"
CAULDRON = r"C:\Users\stefan\Documents\New project ai colab\tools"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "prototype", "data", "vectors.json")

# Понятия: слово + определение + контекстные предложения (мини-корпус со сшивками тем)
CONCEPTS = {
    "город":  ["город растёт вдоль реки узлами улиц",
               "вечерний город зажигает окна и мосты",
               "улицы города ведут людей к площади"],
    "мост":   ["мост связывает берега и потоки людей",
               "старый мост держит дорогу через реку",
               "под мостом течёт вода и время"],
    "путь":   ["путь складывается из решений на развилках",
               "долгий путь ведёт через город и сад",
               "путник выбирает путь по свету зари"],
    "река":   ["река несёт воду и время мимо города",
               "река поит сад и отражает свет",
               "тихая река течёт под мостом"],
    "сад":    ["сад копит тепло и тень для отдыха",
               "в саду тишина и мягкий свет вечера",
               "сад у реки хранит покой и листья"],
    "свет":   ["свет проявляет форму и задаёт ритм дня",
               "утренний свет заливает сад и улицы",
               "свет зари отражается в реке"],
    "заря":   ["заря переключает город из ночи в день",
               "тихая заря красит небо мягким светом",
               "заря будит сад и реку теплом"],
    "тишина": ["тишина хранит место для новой мысли",
               "вечерняя тишина накрывает сад и реку",
               "в тишине слышен только свет зари"],
    "время":  ["время дозирует движение всех процессов",
               "время течёт как река мимо города",
               "тихое время вечера хранит мысли"],
    "слово":  ["слово упаковывает мысль для передачи",
               "точное слово несёт смысл как мост",
               "слово рождается из тишины и мысли"],
    "мысль":  ["мысль ищет связи между далёкими вещами",
               "ясная мысль складывает слова в смысл",
               "мысль зреет в тишине как сад"],
    "смысл":  ["смысл живёт между дроблением и обобщением",
               "смысл собирается из слов и мыслей",
               "потерянный смысл рассыпается в шум"],
    "шум":    ["шум ломает связи и глушит слово",
               "уличный шум мешает ясной мысли",
               "шум это рассыпанный не собранный смысл"],
}
DEMO_PAIRS = [("тишина", "сад"), ("шум", "смысл"), ("город", "мост"),
              ("свет", "заря"), ("время", "река"), ("город", "смысл")]


def cos_sparse(a, b):
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def try_sentence_transformers(texts):
    sys.path.insert(0, LORENZO)
    from docstoolkit.embeddings.dispatch import get_provider
    prov = get_provider("sentence-transformers")
    name = getattr(prov, "name", "unknown")
    if name != "sentence-transformers":
        # dispatch у docstoolkit сам деградирует до tfidf — честно фиксируем
        raise RuntimeError("не установлен; dispatch тихо отдал '%s'" % name)
    vecs = prov.encode(texts)
    out = [vec if isinstance(vec, dict)
           else {str(i): float(v) for i, v in enumerate(vec)} for vec in vecs]
    return out, "sentence-transformers"


def try_tfidf(texts):
    sys.path.insert(0, LORENZO)
    from docstoolkit.embeddings import TFIDFProvider
    prov = TFIDFProvider()
    prov.fit(texts, force=True)
    return prov.encode(texts), "docstoolkit-tfidf"


def try_ppmi(words, corpus):
    """PPMI-профили слов по мини-корпусу (исправленный semantic_engine Котла)."""
    sys.path.insert(0, CAULDRON)
    import re
    from collections import defaultdict, Counter
    from semantic_engine import AdvancedAlgorithms as A
    co = defaultdict(Counter)
    for doc in corpus:
        ws = [w for w in re.findall(r"\b[a-zа-яё\-]{3,}\b", doc.lower())
              if w not in A.STOPWORDS]
        for i, w1 in enumerate(ws):
            for j in range(max(0, i - 3), min(len(ws), i + 4)):
                if i != j:
                    co[w1][ws[j]] += 1
    row = {w: sum(v.values()) for w, v in co.items()}
    col = Counter()
    for w, v in co.items():
        for c, n in v.items():
            col[c] += n
    total = sum(row.values()) or 1
    out = []
    for w in words:
        vec = {}
        rw = row.get(w, 0)
        if rw:
            for c, n in co[w].items():
                ratio = (n * total) / (rw * col[c]) if col[c] else 0
                if ratio > 1:
                    vec[c] = math.log2(ratio)
        out.append(vec)
    return out, "cauldron-ppmi"


def main():
    words = list(CONCEPTS.keys())
    defs = [" . ".join(CONCEPTS[w]) for w in words]
    corpus = [s for sents in CONCEPTS.values() for s in sents]

    attempts, vecs, provider = [], None, None
    for fn, arg in ((try_sentence_transformers, defs), (try_tfidf, defs)):
        try:
            vecs, provider = fn(arg)
            break
        except Exception as exc:
            attempts.append("%s: %s: %s" % (fn.__name__, type(exc).__name__, exc))
    if vecs is None:
        try:
            vecs, provider = try_ppmi(words, corpus)
        except Exception as exc:
            attempts.append("try_ppmi: %s" % exc)
            print("FATAL: ни один провайдер не доступен"); [print("  -", a) for a in attempts]
            return 1

    wv = dict(zip(words, vecs))
    demo = {}
    for a, b in DEMO_PAIRS:
        demo["%s+%s" % (a, b)] = round(cos_sparse(wv[a], wv[b]), 3)

    # альтернативное представление для сравнения: PPMI-профили (Котёл)
    alt_demo = None
    if provider != "cauldron-ppmi":
        try:
            pv, _ = try_ppmi(words, corpus)
            pwv = dict(zip(words, pv))
            alt_demo = {"%s+%s" % (a, b): round(cos_sparse(pwv[a], pwv[b]), 3)
                        for a, b in DEMO_PAIRS}
        except Exception as exc:
            attempts.append("try_ppmi(alt): %s" % exc)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"provider": provider,
                   "generated": datetime.now().isoformat(timespec="seconds"),
                   "note": "sparse dict-векторы; cos = dot/(|a||b|) по общим ключам",
                   "words": {w: {k: round(v, 4) for k, v in vec.items()} for w, vec in wv.items()},
                   "demo": demo,
                   "alt_demo_ppmi": alt_demo},
                  f, ensure_ascii=False, indent=1)

    print("provider:", provider)
    if attempts:
        print("недоступны:", "; ".join(attempts))
    print("слов:", len(words), "->", OUT)
    print("демо-пары: %-16s %s" % (provider, "| cauldron-ppmi" if alt_demo else ""))
    for k, v in demo.items():
        extra = ("| %.3f" % alt_demo[k]) if alt_demo else ""
        print("  %-14s %.3f  %s" % (k, v, extra))
    return 0


if __name__ == "__main__":
    sys.exit(main())
