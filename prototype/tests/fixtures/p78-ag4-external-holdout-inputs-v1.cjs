'use strict';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return Object.freeze(value);
}

const commonProvenance = {
  provenanceFamilyId: 'ru.wikipedia.org',
  retrievedAt: '2026-07-21',
  licenseSpdx: 'CC-BY-SA-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  attribution: 'Участники Русской Википедии',
};

const sources = [
  {
    sourceId: 'p78.holdout.ruwiki.system',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Система — множество элементов, находящихся в отношениях и связях друг с другом, которое образует определённую целостность, единство.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Система',
      pageUrl: 'https://ru.wikipedia.org/wiki/Система',
      transformation: 'ETYMOLOGY_OMITTED; STRESS_MARKS_REMOVED',
    },
  },
  {
    sourceId: 'p78.holdout.ruwiki.document',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Документ — это зафиксированная на материальном носителе информация в виде текста, звукозаписи или изображения с реквизитами, позволяющими её идентифицировать.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Документ',
      pageUrl: 'https://ru.wikipedia.org/wiki/Документ',
      transformation: 'ETYMOLOGY_AND_EXAMPLE_OMITTED; STRESS_MARKS_REMOVED',
    },
  },
  {
    sourceId: 'p78.holdout.ruwiki.algorithm',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Алгоритм — совокупность точно заданных правил решения некоторого класса задач или набор инструкций, описывающих порядок действий исполнителя для решения определённой задачи.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Алгоритм',
      pageUrl: 'https://ru.wikipedia.org/wiki/Алгоритм',
      transformation: 'ETYMOLOGY_OMITTED; STRESS_MARKS_REMOVED',
    },
  },
  {
    sourceId: 'p78.holdout.ruwiki.orbit',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Орбита — траектория движения материальной точки в заданной системе пространственных координат для заданной конфигурации поля сил, которые на точку действуют.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Орбита',
      pageUrl: 'https://ru.wikipedia.org/wiki/Орбита',
      transformation: 'ETYMOLOGY_OMITTED; STRESS_MARKS_REMOVED',
    },
  },
  {
    sourceId: 'p78.holdout.ruwiki.sentence',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Предложение — единица языка и синтаксиса, представляющая собой грамматически выстроенное соединение слов или одно слово, обладающее смысловой и интонационной законченностью.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Предложение (лингвистика)',
      pageUrl: 'https://ru.wikipedia.org/wiki/Предложение_(лингвистика)',
      transformation: 'PARENTHETICALS_OMITTED; STRESS_MARKS_REMOVED',
    },
  },
  {
    sourceId: 'p78.holdout.ruwiki.hypothesis',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Гипотеза — предположение или догадка, утверждение, которое, в отличие от аксиом, требует доказательства.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Гипотеза',
      pageUrl: 'https://ru.wikipedia.org/wiki/Гипотеза',
      transformation: 'ETYMOLOGY_AND_FOOTNOTES_OMITTED; STRESS_MARKS_REMOVED',
    },
  },
  {
    sourceId: 'p78.holdout.ruwiki.modeling',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Моделирование — исследование объектов познания на их моделях; построение и изучение моделей реально существующих объектов, процессов или явлений.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Моделирование',
      pageUrl: 'https://ru.wikipedia.org/wiki/Моделирование',
      transformation: 'PURPOSE_CLAUSE_OMITTED; STRESS_MARKS_REMOVED',
    },
  },
  {
    sourceId: 'p78.holdout.ruwiki.information',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Информация может передаваться, способна наделять знанием и обуславливать действия, обладать количественным измерением.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Информация',
      pageUrl: 'https://ru.wikipedia.org/wiki/Информация',
      transformation: 'FOOTNOTE_OMITTED',
    },
  },
  {
    sourceId: 'p78.holdout.ruwiki.text',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Текст — зафиксированная на каком-либо материальном носителе человеческая мысль; в общем плане связная и полная последовательность символов.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Текст',
      pageUrl: 'https://ru.wikipedia.org/wiki/Текст',
      transformation: 'ETYMOLOGY_OMITTED',
    },
  },
  {
    sourceId: 'p78.holdout.ruwiki.formula',
    revision: '2026-07-21',
    language: 'ru',
    text: 'Математическая формула — символическая запись высказывания либо формы высказывания.',
    provenance: {
      ...commonProvenance,
      pageTitle: 'Математическая формула',
      pageUrl: 'https://ru.wikipedia.org/wiki/Математическая_формула',
      transformation: 'ETYMOLOGY_AND_PARENTHETICALS_OMITTED; STRESS_MARKS_REMOVED',
    },
  },
];

const cases = [
  {
    caseId: 'system-composition',
    targetText: 'Система состоит из частей.',
    sourceIds: ['p78.holdout.ruwiki.system', 'p78.holdout.ruwiki.text'],
    tags: ['COMPOSITION', 'PARAPHRASE'],
    critical: false,
  },
  {
    caseId: 'system-negation',
    targetText: 'Система не состоит из частей.',
    sourceIds: ['p78.holdout.ruwiki.system', 'p78.holdout.ruwiki.text'],
    tags: ['COMPOSITION', 'NEGATION'],
    critical: true,
  },
  {
    caseId: 'document-information',
    targetText: 'Документ включает информацию.',
    sourceIds: ['p78.holdout.ruwiki.document', 'p78.holdout.ruwiki.information'],
    tags: ['CONTAINMENT', 'PARAPHRASE'],
    critical: false,
  },
  {
    caseId: 'algorithm-sequence',
    targetText: 'Алгоритм сохраняет последовательность.',
    sourceIds: ['p78.holdout.ruwiki.algorithm', 'p78.holdout.ruwiki.formula'],
    tags: ['ORDER', 'QUALIFICATION'],
    critical: false,
  },
  {
    caseId: 'orbit-motion',
    targetText: 'Частица движется по орбите.',
    sourceIds: ['p78.holdout.ruwiki.orbit', 'p78.holdout.ruwiki.system'],
    tags: ['MOTION', 'PARAPHRASE'],
    critical: false,
  },
  {
    caseId: 'sentence-words',
    targetText: 'Предложение состоит из слов.',
    sourceIds: ['p78.holdout.ruwiki.sentence', 'p78.holdout.ruwiki.text'],
    tags: ['LINGUISTIC_COMPOSITION', 'MORPHOLOGY'],
    critical: false,
  },
  {
    caseId: 'hypothesis-check',
    targetText: 'Исследователь проверяет гипотезу утверждения.',
    sourceIds: ['p78.holdout.ruwiki.hypothesis', 'p78.holdout.ruwiki.modeling'],
    tags: ['NO_EVIDENCE', 'AGENT_ROLE'],
    critical: true,
  },
  {
    caseId: 'model-process',
    targetText: 'Модель описывает процесс.',
    sourceIds: ['p78.holdout.ruwiki.modeling', 'p78.holdout.ruwiki.formula'],
    tags: ['REPRESENTATION', 'QUALIFICATION'],
    critical: false,
  },
  {
    caseId: 'information-motion',
    targetText: 'Информация движется по пути.',
    sourceIds: ['p78.holdout.ruwiki.information', 'p78.holdout.ruwiki.orbit'],
    tags: ['NO_EVIDENCE', 'METAPHOR_GUARD'],
    critical: true,
  },
  {
    caseId: 'text-composition',
    targetText: 'Текст состоит из частей.',
    sourceIds: ['p78.holdout.ruwiki.text', 'p78.holdout.ruwiki.sentence'],
    tags: ['LINGUISTIC_COMPOSITION', 'PARAPHRASE'],
    critical: false,
  },
  {
    caseId: 'formula-statement',
    targetText: 'Формула описывает утверждение.',
    sourceIds: ['p78.holdout.ruwiki.formula', 'p78.holdout.ruwiki.algorithm'],
    tags: ['REPRESENTATION', 'QUALIFICATION'],
    critical: false,
  },
  {
    caseId: 'unknown-metaflow',
    targetText: 'Модель продолжает метапоток.',
    sourceIds: ['p78.holdout.ruwiki.formula', 'p78.holdout.ruwiki.system'],
    tags: ['TARGET_OOV', 'FAIL_CLOSED'],
    critical: true,
  },
];

module.exports = deepFreeze({
  schema: 'meridian.ag4-external-holdout-inputs/1',
  datasetId: 'p78.ag4.ru.wikipedia-definitions.pilot.v1',
  version: '1.0.0',
  status: 'SEALED',
  split: 'HOLDOUT',
  language: 'ru',
  domain: 'RUSSIAN_ENCYCLOPEDIC_DEFINITIONS',
  offsetUnit: 'UTF16_CODE_UNIT',
  excerptPolicy: 'MANUAL_LEAD_EXCERPT_MAX_25_WORDS',
  sources,
  cases,
});
