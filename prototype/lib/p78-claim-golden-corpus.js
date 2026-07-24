(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;
var Lexicon=global.MRDP78ControlledRussianLexicon;

if(!Canonical||!Lexicon||Lexicon.status!=='READY'){
  global.MRDP78ClaimGoldenCorpus=Object.freeze({
    version:VERSION,
    status:'BLOCKED',
    code:!Canonical?'CANONICAL_JSON_UNAVAILABLE':'CONTROLLED_RUSSIAN_LEXICON_UNAVAILABLE'
  });
  return;
}

var freeze=Canonical.deepFreeze;
var SCHEMAS=freeze({
  corpus:'meridian.claim-golden-corpus/1',
  fixture:'meridian.claim-golden-fixture/1'
});
var STATUSES=freeze({RESOLVED:true,AMBIGUOUS:true,OOV:true});
var POLARITIES=freeze({POSITIVE:true,NEGATIVE:true});
var MODALITIES=freeze({FACT:true,REPORTED:true,DERIVED:true,HYPOTHESIS:true,INTERPRETATION:true});
var QUALIFIERS=freeze({TIME:true,PLACE:true,POPULATION:true,METHOD:true,CONDITION:true,MEASURE:true});
var ERROR_CODES=freeze({
  READY:'READY',
  INVALID_SCHEMA:'INVALID_SCHEMA',
  INVALID_VERSION:'INVALID_VERSION',
  INVALID_VALUE:'INVALID_VALUE',
  UNKNOWN_FIELD:'UNKNOWN_FIELD',
  REQUIRED_FIELD_MISSING:'REQUIRED_FIELD_MISSING',
  DUPLICATE_FIXTURE_ID:'DUPLICATE_FIXTURE_ID',
  DUPLICATE_SENTENCE:'DUPLICATE_SENTENCE',
  FIXTURE_HASH_MISMATCH:'FIXTURE_HASH_MISMATCH',
  CORPUS_HASH_MISMATCH:'CORPUS_HASH_MISMATCH',
  STALE_CORPUS:'STALE_CORPUS',
  STALE_LEXICON:'STALE_LEXICON',
  PATTERN_REF_INVALID:'PATTERN_REF_INVALID',
  PREDICATE_REF_INVALID:'PREDICATE_REF_INVALID',
  SENSE_REF_INVALID:'SENSE_REF_INVALID',
  EXPECTATION_INCONSISTENT:'EXPECTATION_INCONSISTENT',
  CANONICAL_JSON_UNAVAILABLE:'CANONICAL_JSON_UNAVAILABLE',
  CONTROLLED_RUSSIAN_LEXICON_UNAVAILABLE:'CONTROLLED_RUSSIAN_LEXICON_UNAVAILABLE'
});
var ID=/^p78:[a-z][a-z0-9._:-]{1,191}$/;
var ROLE=/^[A-Z][A-Z0-9_]{1,63}$/;
var HASH=/^sha256:[0-9a-f]{64}$/;
var hasOwn=Object.prototype.hasOwnProperty;

function corpusError(code,message,path){
  var error=new TypeError(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78ClaimGoldenCorpusError';
  error.code=code;
  error.path=path||'$';
  return error;
}

function reject(code,message,path){ throw corpusError(code,message,path); }
function isObject(value){ return Canonical.isPlainObject(value); }

function assertObject(value,path){
  if(!isObject(value)) reject(ERROR_CODES.INVALID_VALUE,'plain object required',path);
}

function assertExactKeys(value,required,optional,path){
  var allowed={},keys=Object.keys(value),i,key;
  for(i=0;i<required.length;i++) allowed[required[i]]=true;
  for(i=0;i<optional.length;i++) allowed[optional[i]]=true;
  for(i=0;i<required.length;i++){
    if(!hasOwn.call(value,required[i])) reject(ERROR_CODES.REQUIRED_FIELD_MISSING,required[i],path+'.'+required[i]);
  }
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(!allowed[key]) reject(ERROR_CODES.UNKNOWN_FIELD,key,path+'.'+key);
  }
}

function assertString(value,path,options){
  options=options||{};
  if(typeof value!=='string') reject(ERROR_CODES.INVALID_VALUE,'string required',path);
  Canonical.hashText(value);
  if(options.nonEmpty&&value.length===0) reject(ERROR_CODES.INVALID_VALUE,'non-empty string required',path);
  if(options.trimmed&&value.trim()!==value) reject(ERROR_CODES.INVALID_VALUE,'surrounding whitespace forbidden',path);
  if(options.max!==undefined&&value.length>options.max) reject(ERROR_CODES.INVALID_VALUE,'string too long',path);
  if(options.pattern&&!options.pattern.test(value)) reject(ERROR_CODES.INVALID_VALUE,'string format rejected',path);
}

function assertId(value,path,prefix){
  assertString(value,path,{nonEmpty:true,trimmed:true,max:192,pattern:ID});
  if(prefix&&value.indexOf(prefix)!==0) reject(ERROR_CODES.INVALID_VALUE,'identifier prefix rejected',path);
}

function assertHash(value,path){ assertString(value,path,{nonEmpty:true,trimmed:true,max:71,pattern:HASH}); }

function assertEnum(value,values,path){
  if(typeof value!=='string'||!values[value]) reject(ERROR_CODES.INVALID_VALUE,'enumeration value rejected',path);
}

function assertStringArray(value,path,options){
  var seen=Object.create(null),i,item;
  options=options||{};
  if(!Array.isArray(value)) reject(ERROR_CODES.INVALID_VALUE,'array required',path);
  if(options.min!==undefined&&value.length<options.min) reject(ERROR_CODES.INVALID_VALUE,'array too short',path);
  if(options.max!==undefined&&value.length>options.max) reject(ERROR_CODES.INVALID_VALUE,'array too long',path);
  for(i=0;i<value.length;i++){
    item=value[i];
    assertString(item,path+'['+i+']',{nonEmpty:true,trimmed:true,max:options.itemMax||256,pattern:options.pattern});
    if(seen[item]) reject(ERROR_CODES.INVALID_VALUE,'duplicate array item',path+'['+i+']');
    seen[item]=true;
  }
}

function omit(value,key){
  var result={},keys=Object.keys(value),i,name;
  for(i=0;i<keys.length;i++){
    name=keys[i];
    if(name!==key) result[name]=value[name];
  }
  return result;
}

function sealFixture(value){
  var copy=Canonical.deepCopy(value);
  copy.contentHash=Canonical.hashCanonical(copy);
  return freeze(copy);
}

function sealCorpus(value){
  var copy=Canonical.deepCopy(value);
  copy.corpusHash=Canonical.hashCanonical(copy);
  return freeze(copy);
}

function patternRef(pattern){
  return freeze({patternId:pattern.patternId,version:pattern.version,contentHash:pattern.contentHash});
}

function predicateRef(frame){
  return freeze({predicateId:frame.predicateId,version:frame.version,contentHash:frame.contentHash});
}

function senseId(suffix){ return suffix===null?null:'p78:sense:'+suffix; }
function senseIds(suffixes){ return suffixes.map(senseId); }

/*
 * Rows are the gold annotation. No parser or inference function contributes
 * predicate, polarity, modality, qualifiers, roles, ambiguity, or OOV labels.
 */
var FIXTURE_ROWS=[
  ['g001','Частица движется по орбите.','RESOLVED','claim.move.positive','move','POSITIVE','FACT',{},[['THEME','Частица','particle.unit',[]],['PATH','орбите','orbit.path',[]]],[],[]],
  ['g002','Процесс движется по траектории.','RESOLVED','claim.move.positive','move','POSITIVE','FACT',{},[['THEME','Процесс','process.dynamic',[]],['PATH','траектории','trajectory.path',[]]],[],[]],
  ['g003','Информация движется по пути.','RESOLVED','claim.move.positive','move','POSITIVE','FACT',{},[['THEME','Информация','information.content',[]],['PATH','пути','path.role',[]]],[],[]],
  ['g004','Частица не движется по траектории.','RESOLVED','claim.move.negative','move','NEGATIVE','FACT',{},[['THEME','Частица','particle.unit',[]],['PATH','траектории','trajectory.path',[]]],[],[]],
  ['g005','Система продолжает процесс.','RESOLVED','claim.continue.positive','continue','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['PROCESS','процесс','process.dynamic',[]]],[],[]],
  ['g006','Редактор продолжает статью.','RESOLVED','claim.continue.positive','continue','POSITIVE','FACT',{},[['AGENT','Редактор','editor.person',[]],['PROCESS','статью','article.document',[]]],[],[]],
  ['g007','Исследователь продолжает проверку.','RESOLVED','claim.continue.positive','continue','POSITIVE','FACT',{},[['AGENT','Исследователь','researcher.person',[]],['PROCESS','проверку','verification.operation',[]]],[],[]],
  ['g008','Система продолжает статью.','RESOLVED','claim.continue.positive','continue','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['PROCESS','статью','article.document',[]]],[],[]],
  ['g009','Система обобщает информацию.','RESOLVED','claim.generalize.positive','generalize','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['INPUT','информацию','information.content',[]]],[],[]],
  ['g010','Исследователь обобщает детали.','RESOLVED','claim.generalize.positive','generalize','POSITIVE','FACT',{},[['AGENT','Исследователь','researcher.person',[]],['INPUT','детали','detail.part',[]]],[],[]],
  ['g011','Редактор обобщает утверждение.','RESOLVED','claim.generalize.positive','generalize','POSITIVE','FACT',{},[['AGENT','Редактор','editor.person',[]],['INPUT','утверждение','claim.statement',[]]],[],[]],
  ['g012','Алгоритм обобщает корпус.','RESOLVED','claim.generalize.positive','generalize','POSITIVE','FACT',{},[['AGENT','Алгоритм','algorithm.procedure',[]],['INPUT','корпус','corpus.collection',[]]],[],[]],
  ['g013','Редактор детализирует текст.','RESOLVED','claim.detail.positive','detail','POSITIVE','FACT',{},[['AGENT','Редактор','editor.person',[]],['WHOLE','текст','text.document',[]]],[],[]],
  ['g014','Исследователь детализирует утверждение.','RESOLVED','claim.detail.positive','detail','POSITIVE','FACT',{},[['AGENT','Исследователь','researcher.person',[]],['WHOLE','утверждение','claim.statement',[]]],[],[]],
  ['g015','Система детализирует определение.','RESOLVED','claim.detail.positive','detail','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['WHOLE','определение','definition.text',[]]],[],[]],
  ['g016','Алгоритм детализирует результат.','RESOLVED','claim.detail.positive','detail','POSITIVE','FACT',{},[['AGENT','Алгоритм','algorithm.procedure',[]],['WHOLE','результат','result.role',[]]],[],[]],
  ['g017','Редактор разделяет текст на части.','RESOLVED','claim.split.positive','split','POSITIVE','FACT',{},[['AGENT','Редактор','editor.person',[]],['WHOLE','текст','text.document',[]],['PART','части','part.component',[]]],[],[]],
  ['g018','Система разделяет утверждение на части.','RESOLVED','claim.split.positive','split','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['WHOLE','утверждение','claim.statement',[]],['PART','части','part.component',[]]],[],[]],
  ['g019','Алгоритм разделяет предложение на слова.','RESOLVED','claim.split.positive','split','POSITIVE','FACT',{},[['AGENT','Алгоритм','algorithm.procedure',[]],['WHOLE','предложение','sentence.text',[]],['PART','слова','word.text',[]]],[],[]],
  ['g020','Исследователь разделяет целое на детали.','RESOLVED','claim.split.positive','split','POSITIVE','FACT',{},[['AGENT','Исследователь','researcher.person',[]],['WHOLE','целое','whole.aggregate',[]],['PART','детали','detail.part',[]]],[],[]],
  ['g021','Система объединяет части в целое.','RESOLVED','claim.merge.positive','merge','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['PART','части','part.component',[]],['RESULT','целое','whole.aggregate',[]]],[],[]],
  ['g022','Редактор объединяет слово в предложение.','RESOLVED','claim.merge.positive','merge','POSITIVE','FACT',{},[['AGENT','Редактор','editor.person',[]],['PART','слово','word.text',[]],['RESULT','предложение','sentence.text',[]]],[],[]],
  ['g023','Исследователь объединяет утверждение в заключение.','RESOLVED','claim.merge.positive','merge','POSITIVE','FACT',{},[['AGENT','Исследователь','researcher.person',[]],['PART','утверждение','claim.statement',[]],['RESULT','заключение','conclusion.result',[]]],[],[]],
  ['g024','Алгоритм объединяет детали в описание.','RESOLVED','claim.merge.positive','merge','POSITIVE','FACT',{},[['AGENT','Алгоритм','algorithm.procedure',[]],['PART','детали','detail.part',[]],['RESULT','описание','description.operation',[]]],[],[]],
  ['g025','Давление вызывает распад.','RESOLVED','claim.cause.positive','cause','POSITIVE','FACT',{},[['CAUSE','Давление','pressure.measure',[]],['EFFECT','распад','decay.state',[]]],[],[]],
  ['g026','Условие вызывает изменение.','RESOLVED','claim.cause.positive','cause','POSITIVE','FACT',{},[['CAUSE','Условие','condition.rule',[]],['EFFECT','изменение','change.operation',[]]],[],[]],
  ['g027','Ввод вызывает эффект.','RESOLVED','claim.cause.positive','cause','POSITIVE','FACT',{},[['CAUSE','Ввод','input.data',[]],['EFFECT','эффект','effect.result',[]]],[],[]],
  ['g028','Параметр не вызывает коллапс.','RESOLVED','claim.cause.negative','cause','NEGATIVE','FACT',{},[['CAUSE','Параметр','parameter.value',[]],['EFFECT','коллапс','collapse.state',[]]],[],[]],
  ['g029','Система сохраняет смысл.','RESOLVED','claim.preserve.positive','preserve','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['THEME','смысл','meaning.semantic',[]]],[],[]],
  ['g030','Редактор сохраняет контекст.','RESOLVED','claim.preserve.positive','preserve','POSITIVE','FACT',{},[['AGENT','Редактор','editor.person',[]],['THEME','контекст','context.semantic',[]]],[],[]],
  ['g031','Алгоритм сохраняет последовательность.','RESOLVED','claim.preserve.positive','preserve','POSITIVE','FACT',{},[['AGENT','Алгоритм','algorithm.procedure',[]],['THEME','последовательность','sequence.relation',[]]],[],[]],
  ['g032','Система не сохраняет контекст.','RESOLVED','claim.preserve.negative','preserve','NEGATIVE','FACT',{},[['AGENT','Система','system.closed',[]],['THEME','контекст','context.semantic',[]]],[],[]],
  ['g033','Исследователь проверяет утверждение.','RESOLVED','claim.verify.fact','verify','POSITIVE','FACT',{METHOD:'по источнику'},[['AGENT','Исследователь','researcher.person',[]],['CLAIM','утверждение','claim.statement',[]]],[],[]],
  ['g034','Редактор проверяет формулу.','RESOLVED','claim.verify.fact','verify','POSITIVE','FACT',{METHOD:'по правилу'},[['AGENT','Редактор','editor.person',[]],['CLAIM','формулу','formula.expression',[]]],[],[]],
  ['g035','Система проверяет документ.','RESOLVED','claim.verify.fact','verify','POSITIVE','FACT',{METHOD:'по хешу'},[['AGENT','Система','system.closed',[]],['CLAIM','документ','document.source',[]]],[],[]],
  ['g036','Исследователь проверяет гипотезу утверждения.','RESOLVED','claim.verify.hypothesis','verify','POSITIVE','HYPOTHESIS',{METHOD:'по корпусу'},[['AGENT','Исследователь','researcher.person',[]],['CLAIM','утверждения','claim.statement',[]]],[],[]],
  ['g037','Документ описывает процесс.','RESOLVED','claim.describe.positive','describe','POSITIVE','FACT',{},[['AGENT','Документ','document.source',[]],['THEME','процесс','process.dynamic',[]]],[],[]],
  ['g038','Исследователь описывает траекторию.','RESOLVED','claim.describe.positive','describe','POSITIVE','FACT',{},[['AGENT','Исследователь','researcher.person',[]],['THEME','траекторию','trajectory.path',[]]],[],[]],
  ['g039','Редактор описывает параметр.','RESOLVED','claim.describe.positive','describe','POSITIVE','FACT',{},[['AGENT','Редактор','editor.person',[]],['THEME','параметр','parameter.value',[]]],[],[]],
  ['g040','Система описывает алгоритм.','RESOLVED','claim.describe.positive','describe','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['THEME','алгоритм','algorithm.procedure',[]]],[],[]],
  ['g041','Частица вращается вокруг орбиты.','RESOLVED','claim.rotate.positive','rotate','POSITIVE','FACT',{MEASURE:'один оборот'},[['THEME','Частица','particle.unit',[]],['AROUND','орбиты','orbit.path',[]]],[],[]],
  ['g042','Система вращается вокруг радиуса.','RESOLVED','claim.rotate.positive','rotate','POSITIVE','FACT',{MEASURE:'равномерно'},[['THEME','Система','system.closed',[]],['AROUND','радиуса','radius.measure',[]]],[],[]],
  ['g043','Поток вращается вокруг границы.','RESOLVED','claim.rotate.positive','rotate','POSITIVE','FACT',{MEASURE:'медленно'},[['THEME','Поток','flow.process',[]],['AROUND','границы','boundary.limit',[]]],[],[]],
  ['g044','Частица вращается вокруг пути.','RESOLVED','claim.rotate.positive','rotate','POSITIVE','FACT',{MEASURE:'два оборота'},[['THEME','Частица','particle.unit',[]],['AROUND','пути','path.role',[]]],[],[]],
  ['g045','Информация входит в систему.','RESOLVED','claim.enter.positive','enter','POSITIVE','FACT',{},[['THEME','Информация','information.content',[]],['CONTAINER','систему','system.closed',[]]],[],[]],
  ['g046','Частица входит в систему.','RESOLVED','claim.enter.positive','enter','POSITIVE','FACT',{},[['THEME','Частица','particle.unit',[]],['CONTAINER','систему','system.closed',[]]],[],[]],
  ['g047','Ввод входит в систему.','RESOLVED','claim.enter.positive','enter','POSITIVE','FACT',{},[['THEME','Ввод','input.data',[]],['CONTAINER','систему','system.closed',[]]],[],[]],
  ['g048','Параметр входит в систему.','RESOLVED','claim.enter.positive','enter','POSITIVE','FACT',{},[['THEME','Параметр','parameter.value',[]],['CONTAINER','систему','system.closed',[]]],[],[]],
  ['g049','Информация выходит из системы.','RESOLVED','claim.exit.positive','exit','POSITIVE','FACT',{},[['THEME','Информация','information.content',[]],['CONTAINER','системы','system.closed',[]]],[],[]],
  ['g050','Частица выходит из системы.','RESOLVED','claim.exit.positive','exit','POSITIVE','FACT',{},[['THEME','Частица','particle.unit',[]],['CONTAINER','системы','system.closed',[]]],[],[]],
  ['g051','Результат выходит из системы.','RESOLVED','claim.exit.positive','exit','POSITIVE','FACT',{},[['THEME','Результат','result.role',[]],['CONTAINER','системы','system.closed',[]]],[],[]],
  ['g052','Параметр выходит из системы.','RESOLVED','claim.exit.positive','exit','POSITIVE','FACT',{},[['THEME','Параметр','parameter.value',[]],['CONTAINER','системы','system.closed',[]]],[],[]],
  ['g053','Частица достигает границы.','RESOLVED','claim.reach.positive','reach','POSITIVE','FACT',{TIME:'за один цикл'},[['THEME','Частица','particle.unit',[]],['BOUNDARY','границы','boundary.limit',[]]],[],[]],
  ['g054','Процесс достигает результата.','RESOLVED','claim.reach.positive','reach','POSITIVE','FACT',{TIME:'после проверки'},[['THEME','Процесс','process.dynamic',[]],['BOUNDARY','результата','result.role',[]]],[],[]],
  ['g055','Поток достигает равновесия.','RESOLVED','claim.reach.positive','reach','POSITIVE','FACT',{TIME:'в цикле'},[['THEME','Поток','flow.process',[]],['BOUNDARY','равновесия','balance.state',[]]],[],[]],
  ['g056','Алгоритм достигает заключения.','RESOLVED','claim.reach.positive','reach','POSITIVE','FACT',{TIME:'после шага'},[['THEME','Алгоритм','algorithm.procedure',[]],['BOUNDARY','заключения','conclusion.result',[]]],[],[]],
  ['g057','Система избегает коллапса.','RESOLVED','claim.avoid.positive','avoid','POSITIVE','FACT',{CONDITION:'при обобщении'},[['AGENT','Система','system.closed',[]],['STATE','коллапса','collapse.state',[]]],[],[]],
  ['g058','Система избегает распада.','RESOLVED','claim.avoid.positive','avoid','POSITIVE','FACT',{CONDITION:'при детализации'},[['AGENT','Система','system.closed',[]],['STATE','распада','decay.state',[]]],[],[]],
  ['g059','Редактор избегает неоднозначности.','RESOLVED','claim.avoid.positive','avoid','POSITIVE','FACT',{CONDITION:'при выборе значения'},[['AGENT','Редактор','editor.person',[]],['STATE','неоднозначности','ambiguity.state',[]]],[],[]],
  ['g060','Исследователь избегает отрицания.','RESOLVED','claim.avoid.positive','avoid','POSITIVE','FACT',{CONDITION:'при положительном тезисе'},[['AGENT','Исследователь','researcher.person',[]],['STATE','отрицания','negation.logic',[]]],[],[]],
  ['g061','Система уравновешивает давление и поток.','RESOLVED','claim.balance.positive','balance','POSITIVE','FACT',{MEASURE:'поровну'},[['AGENT','Система','system.closed',[]],['FORCE_A','давление','pressure.measure',[]],['FORCE_B','поток','flow.process',[]]],[],[]],
  ['g062','Алгоритм уравновешивает обобщение и детализацию.','RESOLVED','claim.balance.positive','balance','POSITIVE','FACT',{MEASURE:'по правилу'},[['AGENT','Алгоритм','algorithm.procedure',[]],['FORCE_A','обобщение','generalization.operation',[]],['FORCE_B','детализацию','detailing.operation',[]]],[],[]],
  ['g063','Модель уравновешивает коллапс и распад.','RESOLVED','claim.balance.positive','balance','POSITIVE','FACT',{MEASURE:'в кольце'},[['AGENT','Модель','model.representation',[]],['FORCE_A','коллапс','collapse.state',[]],['FORCE_B','распад','decay.state',[]]],[],[]],
  ['g064','Редактор уравновешивает деталь и целое.','RESOLVED','claim.balance.positive','balance','POSITIVE','FACT',{MEASURE:'по смыслу'},[['AGENT','Редактор','editor.person',[]],['FORCE_A','деталь','detail.part',[]],['FORCE_B','целое','whole.aggregate',[]]],[],[]],
  ['g065','Свидетельство поддерживает утверждение.','RESOLVED','claim.support.reported','support','POSITIVE','REPORTED',{METHOD:'по документу'},[['EVIDENCE','Свидетельство','evidence.support',[]],['CLAIM','утверждение','claim.statement',[]]],[],[]],
  ['g066','Документ поддерживает тезис.','RESOLVED','claim.support.reported','support','POSITIVE','REPORTED',{METHOD:'по фрагменту'},[['EVIDENCE','Документ','document.source',[]],['CLAIM','тезис','statement.text',[]]],[],[]],
  ['g067','Свидетельство поддерживает определение.','RESOLVED','claim.support.reported','support','POSITIVE','REPORTED',{METHOD:'по контексту'},[['EVIDENCE','Свидетельство','evidence.support',[]],['CLAIM','определение','definition.text',[]]],[],[]],
  ['g068','Документ поддерживает заключение.','RESOLVED','claim.support.reported','support','POSITIVE','REPORTED',{METHOD:'по источнику'},[['EVIDENCE','Документ','document.source',[]],['CLAIM','заключение','conclusion.result',[]]],[],[]],
  ['g069','Свидетельство опровергает тезис.','RESOLVED','claim.refute.reported','refute','POSITIVE','REPORTED',{METHOD:'по документу'},[['EVIDENCE','Свидетельство','evidence.support',[]],['CLAIM','тезис','statement.text',[]]],[],[]],
  ['g070','Документ опровергает утверждение.','RESOLVED','claim.refute.reported','refute','POSITIVE','REPORTED',{METHOD:'по фрагменту'},[['EVIDENCE','Документ','document.source',[]],['CLAIM','утверждение','claim.statement',[]]],[],[]],
  ['g071','Свидетельство опровергает определение.','RESOLVED','claim.refute.reported','refute','POSITIVE','REPORTED',{METHOD:'по контексту'},[['EVIDENCE','Свидетельство','evidence.support',[]],['CLAIM','определение','definition.text',[]]],[],[]],
  ['g072','Документ опровергает заключение.','RESOLVED','claim.refute.reported','refute','POSITIVE','REPORTED',{METHOD:'по источнику'},[['EVIDENCE','Документ','document.source',[]],['CLAIM','заключение','conclusion.result',[]]],[],[]],
  ['g073','Условие ограничивает процесс.','RESOLVED','claim.limit.positive','limit','POSITIVE','FACT',{CONDITION:'при проверке'},[['CONSTRAINT','Условие','condition.rule',[]],['THEME','процесс','process.dynamic',[]]],[],[]],
  ['g074','Граница ограничивает систему.','RESOLVED','claim.limit.positive','limit','POSITIVE','FACT',{CONDITION:'на орбите'},[['CONSTRAINT','Граница','boundary.limit',[]],['THEME','систему','system.closed',[]]],[],[]],
  ['g075','Параметр ограничивает вывод.','RESOLVED','claim.limit.positive','limit','POSITIVE','FACT',{CONDITION:'в этой версии'},[['CONSTRAINT','Параметр','parameter.value',[]],['THEME','вывод','output.result',[]]],[],[]],
  ['g076','Контекст ограничивает утверждение.','RESOLVED','claim.limit.positive','limit','POSITIVE','FACT',{CONDITION:'в статье'},[['CONSTRAINT','Контекст','context.semantic',[]],['THEME','утверждение','claim.statement',[]]],[],[]],
  ['g077','Результат зависит от параметра.','RESOLVED','claim.depend.positive','depend','POSITIVE','FACT',{CONDITION:'в этой версии'},[['DEPENDENT','Результат','result.role',[]],['CONDITION','параметра','parameter.value',[]]],[],[]],
  ['g078','Вывод зависит от ввода.','RESOLVED','claim.depend.positive','depend','POSITIVE','FACT',{CONDITION:'в системе'},[['DEPENDENT','Вывод','output.result',[]],['CONDITION','ввода','input.data',[]]],[],[]],
  ['g079','Продолжение зависит от контекста.','RESOLVED','claim.depend.positive','depend','POSITIVE','FACT',{CONDITION:'в тексте'},[['DEPENDENT','Продолжение','continuation.process',[]],['CONDITION','контекста','context.semantic',[]]],[],[]],
  ['g080','Давление зависит от радиуса.','RESOLVED','claim.depend.positive','depend','POSITIVE','FACT',{CONDITION:'в кольце'},[['DEPENDENT','Давление','pressure.measure',[]],['CONDITION','радиуса','radius.measure',[]]],[],[]],
  ['g081','Текст состоит из частей.','RESOLVED','claim.consist.positive','consist','POSITIVE','FACT',{},[['WHOLE','Текст','text.document',[]],['PART','частей','part.component',[]]],[],[]],
  ['g082','Статья состоит из предложения.','RESOLVED','claim.consist.positive','consist','POSITIVE','FACT',{},[['WHOLE','Статья','article.document',[]],['PART','предложения','sentence.text',[]]],[],[]],
  ['g083','Система состоит из процесса.','RESOLVED','claim.consist.positive','consist','POSITIVE','FACT',{},[['WHOLE','Система','system.closed',[]],['PART','процесса','process.dynamic',[]]],[],[]],
  ['g084','Корпус состоит из документа.','RESOLVED','claim.consist.positive','consist','POSITIVE','FACT',{},[['WHOLE','Корпус','corpus.collection',[]],['PART','документа','document.source',[]]],[],[]],
  ['g085','Текст включает предложение.','RESOLVED','claim.include.positive','include','POSITIVE','FACT',{},[['WHOLE','Текст','text.document',[]],['PART','предложение','sentence.text',[]]],[],[]],
  ['g086','Статья включает определение.','RESOLVED','claim.include.positive','include','POSITIVE','FACT',{},[['WHOLE','Статья','article.document',[]],['PART','определение','definition.text',[]]],[],[]],
  ['g087','Система включает процесс.','RESOLVED','claim.include.positive','include','POSITIVE','FACT',{},[['WHOLE','Система','system.closed',[]],['PART','процесс','process.dynamic',[]]],[],[]],
  ['g088','Корпус включает документ.','RESOLVED','claim.include.positive','include','POSITIVE','FACT',{},[['WHOLE','Корпус','corpus.collection',[]],['PART','документ','document.source',[]]],[],[]],
  ['g089','Предложение следует после слова.','RESOLVED','claim.follow.positive','follow','POSITIVE','FACT',{TIME:'в тексте'},[['NEXT','Предложение','sentence.text',[]],['PREVIOUS','слова','word.text',[]]],[],[]],
  ['g090','Вывод следует после ввода.','RESOLVED','claim.follow.positive','follow','POSITIVE','FACT',{TIME:'в цикле'},[['NEXT','Вывод','output.result',[]],['PREVIOUS','ввода','input.data',[]]],[],[]],
  ['g091','Заключение следует после проверки.','RESOLVED','claim.follow.positive','follow','POSITIVE','FACT',{TIME:'на следующем шаге'},[['NEXT','Заключение','conclusion.result',[]],['PREVIOUS','проверки','verification.operation',[]]],[],[]],
  ['g092','Деталь следует после обобщения.','RESOLVED','claim.follow.positive','follow','POSITIVE','FACT',{TIME:'при детализации'},[['NEXT','Деталь','detail.part',[]],['PREVIOUS','обобщения','generalization.operation',[]]],[],[]],
  ['g093','Система изменяет состояние.','RESOLVED','claim.change.positive','change','POSITIVE','FACT',{CONDITION:'при вводе',MEASURE:'на один шаг'},[['AGENT','Система','system.closed',[]],['THEME','состояние','state.system',[]]],[],[]],
  ['g094','Редактор изменяет текст.','RESOLVED','claim.change.positive','change','POSITIVE','FACT',{CONDITION:'при проверке'},[['AGENT','Редактор','editor.person',[]],['THEME','текст','text.document',[]]],[],[]],
  ['g095','Исследователь изменяет модель.','RESOLVED','claim.change.positive','change','POSITIVE','FACT',{CONDITION:'после опыта'},[['AGENT','Исследователь','researcher.person',[]],['THEME','модель','model.representation',[]]],[],[]],
  ['g096','Алгоритм изменяет параметр.','RESOLVED','claim.change.positive','change','POSITIVE','FACT',{MEASURE:'на единицу'},[['AGENT','Алгоритм','algorithm.procedure',[]],['THEME','параметр','parameter.value',[]]],[],[]],
  ['g097','Кольцо движется по траектории.','AMBIGUOUS','claim.move.positive','move','POSITIVE','FACT',{},[['THEME','Кольцо',null,['ring.semantic','ring.object']],['PATH','траектории','trajectory.path',[]]],['ring.semantic','ring.object'],[]],
  ['g098','Центр вращается вокруг орбиты.','AMBIGUOUS','claim.rotate.positive','rotate','POSITIVE','FACT',{MEASURE:'один оборот'},[['THEME','Центр',null,['center.geometry','center.generalization']],['AROUND','орбиты','orbit.path',[]]],['center.geometry','center.generalization'],[]],
  ['g099','Источник описывает процесс.','AMBIGUOUS','claim.describe.positive','describe','POSITIVE','FACT',{},[['AGENT','Источник',null,['source.document','source.cause']],['THEME','процесс','process.dynamic',[]]],['source.document','source.cause'],[]],
  ['g100','Поле включает частицу.','AMBIGUOUS','claim.include.positive','include','POSITIVE','FACT',{},[['WHOLE','Поле',null,['field.semantic','field.physical']],['PART','частицу','particle.unit',[]]],['field.semantic','field.physical'],[]],
  ['g101','Связь зависит от контекста.','AMBIGUOUS','claim.depend.positive','depend','POSITIVE','FACT',{CONDITION:'в тексте'},[['DEPENDENT','Связь',null,['relation.semantic','relation.communication']],['CONDITION','контекста','context.semantic',[]]],['relation.semantic','relation.communication'],[]],
  ['g102','Система описывает движение.','AMBIGUOUS','claim.describe.positive','describe','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['THEME','движение',null,['movement.semantic','movement.physical']]],['movement.semantic','movement.physical'],[]],
  ['g103','Документ описывает центр.','AMBIGUOUS','claim.describe.positive','describe','POSITIVE','FACT',{},[['AGENT','Документ','document.source',[]],['THEME','центр',null,['center.geometry','center.generalization']]],['center.geometry','center.generalization'],[]],
  ['g104','Редактор детализирует поле.','AMBIGUOUS','claim.detail.positive','detail','POSITIVE','FACT',{},[['AGENT','Редактор','editor.person',[]],['WHOLE','поле',null,['field.semantic','field.physical']]],['field.semantic','field.physical'],[]],
  ['g105','Условие ограничивает связь.','AMBIGUOUS','claim.limit.positive','limit','POSITIVE','FACT',{CONDITION:'при проверке'},[['CONSTRAINT','Условие','condition.rule',[]],['THEME','связь',null,['relation.semantic','relation.communication']]],['relation.semantic','relation.communication'],[]],
  ['g106','Источник поддерживает тезис.','AMBIGUOUS','claim.support.reported','support','POSITIVE','REPORTED',{METHOD:'по фрагменту'},[['EVIDENCE','Источник',null,['source.document','source.cause']],['CLAIM','тезис','statement.text',[]]],['source.document','source.cause'],[]],
  ['g107','Кольцо выходит из системы.','AMBIGUOUS','claim.exit.positive','exit','POSITIVE','FACT',{},[['THEME','Кольцо',null,['ring.semantic','ring.object']],['CONTAINER','системы','system.closed',[]]],['ring.semantic','ring.object'],[]],
  ['g108','Поле вызывает эффект.','AMBIGUOUS','claim.cause.positive','cause','POSITIVE','FACT',{},[['CAUSE','Поле',null,['field.semantic','field.physical']],['EFFECT','эффект','effect.result',[]]],['field.semantic','field.physical'],[]],
  ['g109','Квазикольцо движется по орбите.','OOV','claim.move.positive','move','POSITIVE','FACT',{},[['THEME','Квазикольцо',null,[]],['PATH','орбите','orbit.path',[]]],[],['Квазикольцо']],
  ['g110','Система продолжает метапоток.','OOV','claim.continue.positive','continue','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['PROCESS','метапоток',null,[]]],[],['метапоток']],
  ['g111','Исследователь обобщает инфоны.','OOV','claim.generalize.positive','generalize','POSITIVE','FACT',{},[['AGENT','Исследователь','researcher.person',[]],['INPUT','инфоны',null,[]]],[],['инфоны']],
  ['g112','Редактор детализирует квазитекст.','OOV','claim.detail.positive','detail','POSITIVE','FACT',{},[['AGENT','Редактор','editor.person',[]],['WHOLE','квазитекст',null,[]]],[],['квазитекст']],
  ['g113','Алгоритм разделяет метатезис на части.','OOV','claim.split.positive','split','POSITIVE','FACT',{},[['AGENT','Алгоритм','algorithm.procedure',[]],['WHOLE','метатезис',null,[]],['PART','части','part.component',[]]],[],['метатезис']],
  ['g114','Система объединяет кванты в целое.','OOV','claim.merge.positive','merge','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['PART','кванты',null,[]],['RESULT','целое','whole.aggregate',[]]],[],['кванты']],
  ['g115','Турбулентность вызывает распад.','OOV','claim.cause.positive','cause','POSITIVE','FACT',{},[['CAUSE','Турбулентность',null,[]],['EFFECT','распад','decay.state',[]]],[],['Турбулентность']],
  ['g116','Система сохраняет метасмысл.','OOV','claim.preserve.positive','preserve','POSITIVE','FACT',{},[['AGENT','Система','system.closed',[]],['THEME','метасмысл',null,[]]],[],['метасмысл']],
  ['g117','Исследователь проверяет псевдофакт.','OOV','claim.verify.fact','verify','POSITIVE','FACT',{METHOD:'по словарю'},[['AGENT','Исследователь','researcher.person',[]],['CLAIM','псевдофакт',null,[]]],[],['псевдофакт']],
  ['g118','Документ описывает гиперобъект.','OOV','claim.describe.positive','describe','POSITIVE','FACT',{},[['AGENT','Документ','document.source',[]],['THEME','гиперобъект',null,[]]],[],['гиперобъект']],
  ['g119','Квазичастица вращается вокруг орбиты.','OOV','claim.rotate.positive','rotate','POSITIVE','FACT',{MEASURE:'один оборот'},[['THEME','Квазичастица',null,[]],['AROUND','орбиты','orbit.path',[]]],[],['Квазичастица']],
  ['g120','Метаполе входит в систему.','OOV','claim.enter.positive','enter','POSITIVE','FACT',{},[['THEME','Метаполе',null,[]],['CONTAINER','систему','system.closed',[]]],[],['Метаполе']]
];

function makeArgument(row){
  return {
    role:row[0],
    surface:row[1],
    senseId:senseId(row[2]),
    candidateSenseIds:senseIds(row[3])
  };
}

function makeFixture(row){
  var pattern=Lexicon.getStructuralPattern('p78:pattern:'+row[3]);
  var predicate=Lexicon.getPredicateFrame('p78:predicate:'+row[4]);
  if(!pattern) reject(ERROR_CODES.PATTERN_REF_INVALID,row[3],'$.fixtureRows');
  if(!predicate) reject(ERROR_CODES.PREDICATE_REF_INVALID,row[4],'$.fixtureRows');
  return sealFixture({
    schema:SCHEMAS.fixture,
    version:VERSION,
    fixtureId:'p78:golden:'+row[0],
    sentence:row[1],
    genre:'P78_SHORT_CLAIM',
    expected:{
      resolutionStatus:row[2],
      patternRef:patternRef(pattern),
      predicateRef:predicateRef(predicate),
      polarity:row[5],
      modality:row[6],
      qualifiers:row[7],
      arguments:row[8].map(makeArgument),
      ambiguitySenseIds:senseIds(row[9]),
      oovSurfaces:row[10]
    }
  });
}

var fixtures=freeze(FIXTURE_ROWS.map(makeFixture));

function validatePinnedRef(ref,kind,path){
  var target;
  assertObject(ref,path);
  if(kind==='pattern'){
    assertExactKeys(ref,['patternId','version','contentHash'],[],path);
    assertId(ref.patternId,path+'.patternId','p78:pattern:');
    target=Lexicon.getStructuralPattern(ref.patternId);
    if(!target||target.version!==ref.version||target.contentHash!==ref.contentHash){
      reject(ERROR_CODES.PATTERN_REF_INVALID,'pattern reference is missing or stale',path);
    }
  }else{
    assertExactKeys(ref,['predicateId','version','contentHash'],[],path);
    assertId(ref.predicateId,path+'.predicateId','p78:predicate:');
    target=Lexicon.getPredicateFrame(ref.predicateId);
    if(!target||target.version!==ref.version||target.contentHash!==ref.contentHash){
      reject(ERROR_CODES.PREDICATE_REF_INVALID,'predicate reference is missing or stale',path);
    }
  }
  assertString(ref.version,path+'.version',{nonEmpty:true,trimmed:true,max:32});
  assertHash(ref.contentHash,path+'.contentHash');
  return target;
}

function compareArrays(left,right){
  var a=left.slice().sort(),b=right.slice().sort(),i;
  if(a.length!==b.length) return false;
  for(i=0;i<a.length;i++) if(a[i]!==b[i]) return false;
  return true;
}

function validateArgument(argument,path,patternRoles,ambiguousIds,oovSurfaces){
  var sense,j,candidate;
  assertObject(argument,path);
  assertExactKeys(argument,['role','surface','senseId','candidateSenseIds'],[],path);
  assertString(argument.role,path+'.role',{nonEmpty:true,trimmed:true,max:64,pattern:ROLE});
  if(!patternRoles[argument.role]) reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'argument role absent from pattern',path+'.role');
  assertString(argument.surface,path+'.surface',{nonEmpty:true,trimmed:true,max:256});
  assertStringArray(argument.candidateSenseIds,path+'.candidateSenseIds',{max:16,pattern:ID});
  if(argument.senseId!==null){
    assertId(argument.senseId,path+'.senseId','p78:sense:');
    sense=Lexicon.getSense(argument.senseId);
    if(!sense||sense.surfaceForms.indexOf(argument.surface)===-1){
      reject(ERROR_CODES.SENSE_REF_INVALID,'resolved surface does not exactly name the pinned sense',path+'.senseId');
    }
    if(argument.candidateSenseIds.length!==0) reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'resolved argument cannot retain candidates',path);
    return;
  }
  if(argument.candidateSenseIds.length>0){
    if(argument.candidateSenseIds.length<2) reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'ambiguity requires at least two candidates',path);
    for(j=0;j<argument.candidateSenseIds.length;j++){
      candidate=Lexicon.getSense(argument.candidateSenseIds[j]);
      if(!candidate||candidate.surfaceForms.indexOf(argument.surface)===-1){
        reject(ERROR_CODES.SENSE_REF_INVALID,'ambiguous candidate does not exactly name the surface',path+'.candidateSenseIds['+j+']');
      }
      ambiguousIds.push(argument.candidateSenseIds[j]);
    }
    return;
  }
  oovSurfaces.push(argument.surface);
}

function validateFixture(fixture,path){
  var expected,pattern,predicate,patternRoles=Object.create(null),argumentRoles=Object.create(null);
  var ambiguousIds=[],oovSurfaces=[],keys,i,key;
  path=path||'$';
  assertObject(fixture,path);
  assertExactKeys(fixture,['schema','version','fixtureId','sentence','genre','expected','contentHash'],[],path);
  if(fixture.schema!==SCHEMAS.fixture) reject(ERROR_CODES.INVALID_SCHEMA,'fixture schema rejected',path+'.schema');
  if(fixture.version!==VERSION) reject(ERROR_CODES.INVALID_VERSION,'fixture version rejected',path+'.version');
  assertId(fixture.fixtureId,path+'.fixtureId','p78:golden:');
  assertString(fixture.sentence,path+'.sentence',{nonEmpty:true,trimmed:true,max:512});
  if(fixture.genre!=='P78_SHORT_CLAIM') reject(ERROR_CODES.INVALID_VALUE,'fixture genre rejected',path+'.genre');
  expected=fixture.expected;
  assertObject(expected,path+'.expected');
  assertExactKeys(expected,['resolutionStatus','patternRef','predicateRef','polarity','modality','qualifiers','arguments','ambiguitySenseIds','oovSurfaces'],[],path+'.expected');
  assertEnum(expected.resolutionStatus,STATUSES,path+'.expected.resolutionStatus');
  pattern=validatePinnedRef(expected.patternRef,'pattern',path+'.expected.patternRef');
  predicate=validatePinnedRef(expected.predicateRef,'predicate',path+'.expected.predicateRef');
  if(pattern.predicateRef.predicateId!==predicate.predicateId||pattern.predicateRef.contentHash!==predicate.contentHash){
    reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'pattern and predicate references disagree',path+'.expected');
  }
  assertEnum(expected.polarity,POLARITIES,path+'.expected.polarity');
  assertEnum(expected.modality,MODALITIES,path+'.expected.modality');
  if(expected.polarity!==pattern.polarity||expected.modality!==pattern.modality){
    reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'polarity or modality differs from pattern',path+'.expected');
  }
  assertObject(expected.qualifiers,path+'.expected.qualifiers');
  keys=Object.keys(expected.qualifiers);
  for(i=0;i<keys.length;i++){
    key=keys[i];
    if(!QUALIFIERS[key]||pattern.qualifierKeys.indexOf(key)===-1) reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'qualifier absent from pattern',path+'.expected.qualifiers.'+key);
    assertString(expected.qualifiers[key],path+'.expected.qualifiers.'+key,{nonEmpty:true,trimmed:true,max:256});
  }
  for(i=0;i<pattern.roles.length;i++) patternRoles[pattern.roles[i]]=true;
  if(!Array.isArray(expected.arguments)||expected.arguments.length===0) reject(ERROR_CODES.INVALID_VALUE,'expected arguments required',path+'.expected.arguments');
  for(i=0;i<expected.arguments.length;i++){
    validateArgument(expected.arguments[i],path+'.expected.arguments['+i+']',patternRoles,ambiguousIds,oovSurfaces);
    if(argumentRoles[expected.arguments[i].role]) reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'duplicate expected role',path+'.expected.arguments['+i+'].role');
    argumentRoles[expected.arguments[i].role]=true;
  }
  for(i=0;i<pattern.roles.length;i++){
    if(!argumentRoles[pattern.roles[i]]) reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'pattern role lacks expected argument',path+'.expected.arguments');
  }
  assertStringArray(expected.ambiguitySenseIds,path+'.expected.ambiguitySenseIds',{max:32,pattern:ID});
  assertStringArray(expected.oovSurfaces,path+'.expected.oovSurfaces',{max:16});
  if(!compareArrays(expected.ambiguitySenseIds,ambiguousIds)||!compareArrays(expected.oovSurfaces,oovSurfaces)){
    reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'summary labels differ from argument labels',path+'.expected');
  }
  if(expected.resolutionStatus==='RESOLVED'&&(ambiguousIds.length!==0||oovSurfaces.length!==0)) reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'RESOLVED fixture contains unresolved arguments',path+'.expected');
  if(expected.resolutionStatus==='AMBIGUOUS'&&(ambiguousIds.length<2||oovSurfaces.length!==0)) reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'AMBIGUOUS fixture labels rejected',path+'.expected');
  if(expected.resolutionStatus==='OOV'&&(oovSurfaces.length===0||ambiguousIds.length!==0)) reject(ERROR_CODES.EXPECTATION_INCONSISTENT,'OOV fixture labels rejected',path+'.expected');
  assertHash(fixture.contentHash,path+'.contentHash');
  if(fixture.contentHash!==Canonical.hashCanonical(omit(fixture,'contentHash'))){
    reject(ERROR_CODES.FIXTURE_HASH_MISMATCH,'fixture content hash mismatch',path+'.contentHash');
  }
  return true;
}

function validateCorpus(value,expectedCorpusHash,expectedLexiconHash){
  var ids=Object.create(null),sentences=Object.create(null),i,fixture;
  assertObject(value,'$');
  assertExactKeys(value,['schema','version','language','domain','lexiconRef','fixtures','corpusHash'],[],'$');
  if(value.schema!==SCHEMAS.corpus) reject(ERROR_CODES.INVALID_SCHEMA,'corpus schema rejected','$.schema');
  if(value.version!==VERSION) reject(ERROR_CODES.INVALID_VERSION,'corpus version rejected','$.version');
  if(value.language!=='ru'||value.domain!=='P78_SHORT_DEFINITIONS_AND_CLAIMS') reject(ERROR_CODES.INVALID_VALUE,'corpus domain rejected','$');
  assertObject(value.lexiconRef,'$.lexiconRef');
  assertExactKeys(value.lexiconRef,['version','lexiconHash','patternSetHash'],[],'$.lexiconRef');
  if(value.lexiconRef.version!==Lexicon.version||value.lexiconRef.lexiconHash!==Lexicon.lexiconHash||value.lexiconRef.patternSetHash!==Lexicon.patternSetHash){
    reject(ERROR_CODES.STALE_LEXICON,'corpus pins a different lexicon','$.lexiconRef');
  }
  if(expectedLexiconHash!==undefined){
    assertHash(expectedLexiconHash,'$.expectedLexiconHash');
    if(expectedLexiconHash!==value.lexiconRef.lexiconHash) reject(ERROR_CODES.STALE_LEXICON,'expected lexicon hash differs','$.lexiconRef.lexiconHash');
  }
  if(!Array.isArray(value.fixtures)||value.fixtures.length<100) reject(ERROR_CODES.INVALID_VALUE,'at least 100 fixtures required','$.fixtures');
  for(i=0;i<value.fixtures.length;i++){
    fixture=value.fixtures[i];
    validateFixture(fixture,'$.fixtures['+i+']');
    if(ids[fixture.fixtureId]) reject(ERROR_CODES.DUPLICATE_FIXTURE_ID,'duplicate fixtureId','$.fixtures['+i+'].fixtureId');
    if(sentences[fixture.sentence]) reject(ERROR_CODES.DUPLICATE_SENTENCE,'duplicate sentence','$.fixtures['+i+'].sentence');
    ids[fixture.fixtureId]=true;
    sentences[fixture.sentence]=true;
  }
  assertHash(value.corpusHash,'$.corpusHash');
  if(expectedCorpusHash!==undefined){
    assertHash(expectedCorpusHash,'$.expectedCorpusHash');
    if(value.corpusHash!==expectedCorpusHash) reject(ERROR_CODES.STALE_CORPUS,'corpus hash differs from pinned hash','$.corpusHash');
  }
  if(value.corpusHash!==Canonical.hashCanonical(omit(value,'corpusHash'))){
    reject(ERROR_CODES.CORPUS_HASH_MISMATCH,'corpus hash mismatch','$.corpusHash');
  }
  return true;
}

var corpus=sealCorpus({
  schema:SCHEMAS.corpus,
  version:VERSION,
  language:'ru',
  domain:'P78_SHORT_DEFINITIONS_AND_CLAIMS',
  lexiconRef:{version:Lexicon.version,lexiconHash:Lexicon.lexiconHash,patternSetHash:Lexicon.patternSetHash},
  fixtures:fixtures
});
validateCorpus(corpus,corpus.corpusHash,Lexicon.lexiconHash);

var fixtureById=Object.create(null),i;
for(i=0;i<fixtures.length;i++) fixtureById[fixtures[i].fixtureId]=fixtures[i];

function getFixture(fixtureId){ return fixtureById[fixtureId]||null; }
function listByStatus(status){
  var result=[],j;
  assertEnum(status,STATUSES,'$.status');
  for(j=0;j<fixtures.length;j++) if(fixtures[j].expected.resolutionStatus===status) result.push(fixtures[j]);
  return freeze(result);
}

function verifyCorpus(value,expectedCorpusHash,expectedLexiconHash){
  try{
    validateCorpus(value,expectedCorpusHash,expectedLexiconHash);
    return freeze({status:'READY',code:ERROR_CODES.READY,version:value.version,corpusHash:value.corpusHash});
  }catch(error){
    return freeze({
      status:'REJECTED',
      code:error&&error.code?error.code:ERROR_CODES.INVALID_VALUE,
      path:error&&error.path?error.path:'$',
      corpusHash:value&&value.corpusHash?value.corpusHash:null
    });
  }
}

var api=freeze({
  version:VERSION,
  status:'READY',
  schema:SCHEMAS.corpus,
  fixtureSchema:SCHEMAS.fixture,
  language:'ru',
  domain:'P78_SHORT_DEFINITIONS_AND_CLAIMS',
  corpus:corpus,
  fixtures:fixtures,
  corpusHash:corpus.corpusHash,
  lexiconHash:Lexicon.lexiconHash,
  patternSetHash:Lexicon.patternSetHash,
  fixtureCount:fixtures.length,
  errorCodes:ERROR_CODES,
  getFixture:getFixture,
  listByStatus:listByStatus,
  validateFixture:validateFixture,
  validateCorpus:validateCorpus,
  verifyCorpus:verifyCorpus
});

global.MRDP78ClaimGoldenCorpus=api;
})(typeof globalThis!=='undefined'?globalThis:this);
