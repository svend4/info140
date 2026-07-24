(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var Contracts=global.MRDP78SearchContracts;

if(!Canonical||!Contracts||Contracts.status!=='READY'){
  throw new Error('P78_CLAIM_EVIDENCE_CORPUS_DEPENDENCY_UNAVAILABLE');
}

/*
 * Each source is a literal three-sentence passage. SourceSnapshot remains
 * closed: descriptive metadata is kept in a separate table below.
 */
var SOURCE_ROWS=[
  [
    'p78.ag4.movement-contrast',
    'Частица движется по орбите. Частица не движется по орбите. Частица вращается вокруг орбиты.'
  ],
  [
    'p78.ag4.preservation-contrast',
    'Система сохраняет состояние. Система не сохраняет состояние. Система изменяет состояние.'
  ],
  [
    'p78.ag4.continuation-generalization',
    'Система продолжает метапоток. Источник сообщает, что процесс продолжается. Система обобщает информацию.'
  ],
  [
    'p78.ag4.generalization-detail',
    'Редактор не обобщает утверждение. Редактор детализирует квазитекст. Редактор разделяет текст на части.'
  ],
  [
    'p78.ag4.composition-causality',
    'Редактор объединяет слово в предложение. Давление вызывает распад. Параметр не вызывает коллапс.'
  ],
  [
    'p78.ag4.verification-description',
    'Система проверяет документ. Исследователь проверяет гипотезу утверждения. Система описывает движение.'
  ],
  [
    'p78.ag4.boundary-transition',
    'Метаполе входит в систему. Кольцо выходит из системы. Частица достигает границы.'
  ],
  [
    'p78.ag4.balance-reporting',
    'Система избегает коллапса. Система уравновешивает давление и поток. Источник поддерживает тезис.'
  ],
  [
    'p78.ag4.constraints-relations',
    'Документ опровергает утверждение. Условие ограничивает связь. Связь зависит от контекста.'
  ],
  [
    'p78.ag4.composition-order',
    'Текст состоит из частей. Поле включает частицу. Вывод следует после ввода.'
  ]
];

var METADATA_ROWS=[
  ['p78.ag4.movement-contrast','Движение и вращение',1],
  ['p78.ag4.preservation-contrast','Сохранение и изменение',2],
  ['p78.ag4.continuation-generalization','Продолжение и обобщение',3],
  ['p78.ag4.generalization-detail','Обобщение и детализация',4],
  ['p78.ag4.composition-causality','Композиция и причинность',5],
  ['p78.ag4.verification-description','Проверка и описание',6],
  ['p78.ag4.boundary-transition','Переход через границу',7],
  ['p78.ag4.balance-reporting','Баланс и сообщение',8],
  ['p78.ag4.constraints-relations','Ограничения и зависимости',9],
  ['p78.ag4.composition-order','Состав и порядок',10]
];

function createSnapshot(row){
  return Contracts.createSourceSnapshot({
    sourceId:row[0],
    revision:VERSION,
    language:'ru',
    status:'ADMITTED',
    text:row[1]
  });
}

function createMetadata(row){
  return Canonical.copyAndFreeze({
    sourceId:row[0],
    title:row[1],
    collection:'p78.ag4.claim-passages',
    ordinal:row[2]
  });
}

function sourceRef(record){
  return {
    sourceId:record.sourceId,
    revision:record.revision,
    textHash:record.textHash,
    sourceHash:record.sourceHash
  };
}

var records=SOURCE_ROWS.map(createSnapshot);
var metadata=METADATA_ROWS.map(createMetadata);
var metadataBySourceId={};
var i;

for(i=0;i<metadata.length;i++){
  metadataBySourceId[metadata[i].sourceId]=metadata[i];
}

var counts=Canonical.copyAndFreeze({
  sourceCount:10,
  admittedSourceCount:10,
  passageSentenceCount:30
});
var sourceSetHash=Contracts.computeSourceSetHash(records);
var corpusManifest={
  schema:'meridian.claim-evidence-corpus-manifest/1',
  version:VERSION,
  sourceSchema:Contracts.schemas.sourceSnapshot,
  sourceSetHash:sourceSetHash,
  records:records.map(sourceRef),
  metadata:metadata,
  counts:counts
};
var corpusHash=Canonical.hashCanonical(corpusManifest);
var hashes=Canonical.copyAndFreeze({
  sourceSetHash:sourceSetHash,
  corpusHash:corpusHash
});

global.MRDP78ClaimEvidenceCorpus=Canonical.deepFreeze({
  version:VERSION,
  schema:'meridian.claim-evidence-corpus/1',
  status:'READY',
  sourceSchema:Contracts.schemas.sourceSnapshot,
  records:records,
  metadata:metadata,
  metadataBySourceId:metadataBySourceId,
  counts:counts,
  sourceSetHash:sourceSetHash,
  corpusHash:corpusHash,
  hashes:hashes
});
})(typeof globalThis!=='undefined'?globalThis:this);
