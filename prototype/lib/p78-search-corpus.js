(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var Contracts=global.MRDP78SearchContracts;
if(!Canonical||!Contracts) throw new Error('P78_SEARCH_CORPUS_DEPENDENCY_UNAVAILABLE');

var RAW=[
  {
    sourceId:'p78.formula.balance',revision:'1.0.0',language:'ru',
    title:'Баланс кольца',section:'docs/32#формулы',
    text:'Формула ring.balance вычисляет M лямбда как 4u(1-u). Баланс равен нулю у двух полюсов и достигает максимума в середине.'
  },
  {
    sourceId:'p78.formula.pressure',revision:'1.0.0',language:'ru',
    title:'Четыре давления',section:'docs/32#формулы',
    text:'pressure.closure задаёт давление центра C=xy. pressure.edge задаёт давление края E=(1-x)(1-y). pressure.orbit-forward и pressure.orbit-reverse описывают два направления орбиты.'
  },
  {
    sourceId:'p78.formula.margin',revision:'1.0.0',language:'ru',
    title:'Запас двумерной орбиты',section:'docs/32#формулы',
    text:'pressure.margin сравнивает полную орбиту с сильнейшей крайностью. Положительный запас 2D означает, что движение превосходит давление центра и края в выбранной модели.'
  },
  {
    sourceId:'p78.formula.vitality',revision:'1.0.0',language:'ru',
    title:'Траектория жизненности',section:'docs/32#формулы',
    text:'vitality.snapshot-geomean строит структурный снимок, а vitality.trajectory связывает предыдущую и текущую жизненность. Эти числа не доказывают истинность текста.'
  },
  {
    sourceId:'p78.search.status',revision:'1.0.0',language:'ru',
    title:'Лестница статусов',section:'docs/33#status-ladder',
    text:'Найденный фрагмент получает только статус LOCATED. После разбора возможен PARSED, после проверки формы STRUCTURAL_MATCH. Переход LOCATED прямо в SUPPORTED запрещён.'
  },
  {
    sourceId:'p78.search.ring',revision:'1.0.0',language:'ru',
    title:'Два направления поиска',section:'docs/33#grep-ast',
    text:'Направление grep к AST находит адресуемые фрагменты и проверяет структуру. Направление AST к grep проектирует точные запросы, варианты и контрпоиск обратно в корпус.'
  },
  {
    sourceId:'p78.search.evidence',revision:'1.0.0',language:'ru',
    title:'Граница доказательности',section:'docs/33#evidence',
    text:'Структурное совпадение формул не означает их математическую эквивалентность. Поисковое совпадение текста не является доказательством утверждения. При недостатке опоры система возвращает ABSTAIN.'
  },
  {
    sourceId:'p78.science.split-merge',revision:'1.0.0',language:'ru',
    title:'Научное разделение и слияние',section:'docs/30#split-merge',
    text:'Научный split разделяет составное утверждение на проверяемые части с отдельными источниками. Merge допускается только для совместимых областей действия и сохраняет происхождение каждого факта.'
  },
  {
    sourceId:'p78.geometry.2d',revision:'1.0.0',language:'ru',
    title:'Автономное двумерное кольцо',section:'docs/27#геометрия',
    text:'В автономном 2D кольце движение наружу раскрывает детали, движение внутрь выполняет ограниченное обобщение, а движение по окружности сравнивает и продолжает тему без достижения крайностей.'
  }
];

function snapshot(record){
  return Contracts.createSourceSnapshot({
    sourceId:record.sourceId,
    revision:record.revision,
    language:record.language,
    text:record.text
  });
}

var records=RAW.map(snapshot);
var metadata=RAW.map(function(record){
  return Canonical.copyAndFreeze({sourceId:record.sourceId,title:record.title,section:record.section});
});
var metadataBySourceId={};
metadata.forEach(function(item){ metadataBySourceId[item.sourceId]=item; });
var sourceSetHash=Contracts.computeSourceSetHash(records);

global.MRDP78SearchCorpus=Canonical.deepFreeze({
  version:VERSION,
  schema:'meridian.search-corpus/1',
  sourceSchema:Contracts.schemas.sourceSnapshot,
  sourceSetHash:sourceSetHash,
  records:records,
  metadata:metadata,
  metadataBySourceId:metadataBySourceId
});
})(typeof globalThis!=='undefined'?globalThis:this);
