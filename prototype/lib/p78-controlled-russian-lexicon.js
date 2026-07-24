(function(global){
'use strict';

var VERSION='1.0.0';
var Canonical=global.MRDP78CanonicalJSON;

if(!Canonical){
  global.MRDP78ControlledRussianLexicon=Object.freeze({
    version:VERSION,
    status:'BLOCKED',
    code:'CANONICAL_JSON_UNAVAILABLE'
  });
  return;
}

var freeze=Canonical.deepFreeze;
var SCHEMAS=freeze({
  lexicon:'meridian.controlled-russian-lexicon/1',
  sense:'meridian.controlled-russian-sense/1',
  predicateFrame:'meridian.controlled-russian-predicate-frame/1',
  structuralPattern:'meridian.controlled-russian-structural-pattern/1',
  resolution:'meridian.controlled-russian-resolution/1'
});
var POS=freeze({
  NOUN:true,VERB:true,ADJECTIVE:true,ADVERB:true,PARTICLE:true,
  PREPOSITION:true,CONJUNCTION:true,PRONOUN:true,NUMERAL:true,
  PROPER_NOUN:true,SYMBOL:true
});
var POLARITIES=freeze({POSITIVE:true,NEGATIVE:true});
var MODALITIES=freeze({FACT:true,REPORTED:true,DERIVED:true,HYPOTHESIS:true,INTERPRETATION:true});
var QUALIFIERS=freeze({TIME:true,PLACE:true,POPULATION:true,METHOD:true,CONDITION:true,MEASURE:true});
var RESOLUTION_STATUSES=freeze({RESOLVED:true,AMBIGUOUS:true,OOV:true,REJECTED:true});
var ERROR_CODES=freeze({
  READY:'READY',
  EXACT_SINGLE:'EXACT_SINGLE',
  EXACT_MULTIPLE:'EXACT_MULTIPLE',
  OOV_SURFACE:'OOV_SURFACE',
  INVALID_SCHEMA:'INVALID_SCHEMA',
  INVALID_VERSION:'INVALID_VERSION',
  INVALID_VALUE:'INVALID_VALUE',
  UNKNOWN_FIELD:'UNKNOWN_FIELD',
  REQUIRED_FIELD_MISSING:'REQUIRED_FIELD_MISSING',
  DUPLICATE_ID:'DUPLICATE_ID',
  DUPLICATE_SURFACE_FORM:'DUPLICATE_SURFACE_FORM',
  RECORD_HASH_MISMATCH:'RECORD_HASH_MISMATCH',
  LEXICON_HASH_MISMATCH:'LEXICON_HASH_MISMATCH',
  STALE_LEXICON:'STALE_LEXICON',
  SENSE_REF_INVALID:'SENSE_REF_INVALID',
  PREDICATE_REF_INVALID:'PREDICATE_REF_INVALID',
  PATTERN_REF_INVALID:'PATTERN_REF_INVALID',
  ROLE_REF_INVALID:'ROLE_REF_INVALID',
  CANONICAL_JSON_UNAVAILABLE:'CANONICAL_JSON_UNAVAILABLE'
});
var SEMVER=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
var ID=/^p78:[a-z][a-z0-9._:-]{1,191}$/;
var ROLE=/^[A-Z][A-Z0-9_]{1,63}$/;
var hasOwn=Object.prototype.hasOwnProperty;

function lexiconError(code,message,path){
  var error=new TypeError(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78ControlledRussianLexiconError';
  error.code=code;
  error.path=path||'$';
  return error;
}

function reject(code,message,path){ throw lexiconError(code,message,path); }
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

function assertVersion(value,path){ assertString(value,path,{nonEmpty:true,trimmed:true,max:32,pattern:SEMVER}); }
function assertHash(value,path){
  if(!Canonical.isSha256(value)) reject(ERROR_CODES.INVALID_VALUE,'SHA-256 required',path);
}

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
    assertString(item,path+'['+i+']',{nonEmpty:true,trimmed:options.trimmed!==false,max:options.itemMax||256,pattern:options.pattern});
    if(seen[item]) reject(options.duplicateCode||ERROR_CODES.INVALID_VALUE,'duplicate array item',path+'['+i+']');
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

function recordHash(value){ return Canonical.hashCanonical(omit(value,'contentHash')); }

function seal(value){
  var copy=Canonical.deepCopy(value);
  copy.contentHash=Canonical.hashCanonical(copy);
  return freeze(copy);
}

function compareText(left,right){ return left<right?-1:(left>right?1:0); }

function senseRef(record){
  return freeze({senseId:record.senseId,version:record.version,contentHash:record.contentHash});
}

function predicateRef(record){
  return freeze({predicateId:record.predicateId,version:record.version,contentHash:record.contentHash});
}

var SENSE_ROWS=[
  ['ring.semantic','ring','кольцо','NOUN',['SEMANTIC_SYSTEM','TOPOLOGY'],['кольцо','Кольцо','кольца','кольцу','кольцом','кольце'],'Замкнутая двумерная система смыслового движения.'],
  ['ring.object','ring','кольцо','NOUN',['PHYSICAL_OBJECT','SHAPE'],['кольцо','Кольцо','кольца','кольцу','кольцом','кольце'],'Предмет или геометрическая область кольцевой формы.'],
  ['center.geometry','center','центр','NOUN',['PLACE','GEOMETRY'],['центр','Центр','центра','центре'],'Средняя точка или область геометрической системы.'],
  ['center.generalization','center','центр','NOUN',['ABSTRACT_STATE','GENERALIZATION'],['центр','Центр','центра','центре'],'Полюс максимального смыслового обобщения.'],
  ['edge.boundary','edge','край','NOUN',['PLACE','BOUNDARY'],['край','Край','края','краю'],'Внешняя граница рассматриваемой области.'],
  ['orbit.path','orbit','орбита','NOUN',['PATH','TOPOLOGY'],['орбита','Орбита','орбите','орбиту','орбиты'],'Замкнутый путь движения вокруг центра.'],
  ['radius.measure','radius','радиус','NOUN',['MEASURE','GEOMETRY'],['радиус','Радиус','радиуса','радиусе'],'Расстояние от центра до позиции в кольце.'],
  ['dimension.axis','dimension','измерение','NOUN',['AXIS','MODEL'],['измерение','Измерение','измерения','измерении'],'Независимая координата описания состояния.'],
  ['state.system','state','состояние','NOUN',['STATE'],['состояние','Состояние','состояния','состоянии'],'Зафиксированный набор параметров системы.'],
  ['system.closed','system','система','NOUN',['SYSTEM'],['система','Система','системы','систему','системе'],'Совокупность элементов и правил их взаимодействия.'],
  ['process.dynamic','process','процесс','NOUN',['PROCESS'],['процесс','Процесс','процесса','процессе'],'Упорядоченное изменение состояния во времени модели.'],
  ['movement.semantic','movement','движение','NOUN',['SEMANTIC_PROCESS','PROCESS'],['движение','Движение','движения','движению'],'Переход между смысловыми состояниями.'],
  ['movement.physical','movement','движение','NOUN',['PHYSICAL_PROCESS','PROCESS'],['движение','Движение','движения','движению'],'Изменение физического положения объекта.'],
  ['continuation.process','continuation','продолжение','NOUN',['PROCESS','TEXT_OPERATION'],['продолжение','Продолжение','продолжения','продолжению'],'Следующий связный шаг незавершённого процесса или текста.'],
  ['collapse.state','collapse','коллапс','NOUN',['STATE','GENERALIZATION'],['коллапс','Коллапс','коллапса'],'Предельное уплотнение различий в одно состояние.'],
  ['decay.state','decay','распад','NOUN',['STATE','DETAILING'],['распад','Распад','распада'],'Предельное разделение целого на несвязанные части.'],
  ['balance.state','balance','равновесие','NOUN',['STATE','POLICY'],['равновесие','Равновесие','равновесия'],'Состояние без доминирования коллапса или распада.'],
  ['pressure.measure','pressure','давление','NOUN',['MEASURE','STATE'],['давление','Давление','давления'],'Направленная мера воздействия на состояние кольца.'],
  ['particle.unit','particle','частица','NOUN',['UNIT','ENTITY'],['частица','Частица','частицы','частицу'],'Минимальный различимый элемент моделируемого потока.'],
  ['flow.process','flow','поток','NOUN',['PROCESS','COLLECTION'],['поток','Поток','потока','потоке'],'Последовательное движение множества элементов.'],
  ['cycle.process','cycle','цикл','NOUN',['PROCESS','TOPOLOGY'],['цикл','Цикл','цикла','цикле'],'Повторяемая последовательность переходов.'],
  ['trajectory.path','trajectory','траектория','NOUN',['PATH'],['траектория','Траектория','траектории','траекторию'],'Упорядоченный путь последовательных состояний.'],
  ['boundary.limit','boundary','граница','NOUN',['BOUNDARY','CONSTRAINT'],['граница','Граница','границы','границу'],'Предел допустимой области состояния.'],
  ['input.data','input','ввод','NOUN',['DATA','OPERATION'],['ввод','Ввод','ввода'],'Данные, переданные системе для обработки.'],
  ['output.result','output','вывод','NOUN',['RESULT','DATA'],['вывод','Вывод','вывода'],'Результат, явно возвращённый системой.'],
  ['parameter.value','parameter','параметр','NOUN',['PARAMETER'],['параметр','Параметр','параметра','параметру'],'Именованная величина, изменяющая вычисление.'],
  ['condition.rule','condition','условие','NOUN',['CONSTRAINT','QUALIFIER'],['условие','Условие','условия','условии'],'Ограничение, при котором утверждение применимо.'],
  ['information.content','information','информация','NOUN',['CONTENT','DATA'],['информация','Информация','информации','информацию'],'Содержание, доступное для передачи или обработки.'],
  ['matter.material','matter','материя','NOUN',['PHYSICAL_ENTITY'],['материя','Материя','материи'],'Физическое содержание внешнего воздействия.'],
  ['text.document','text','текст','NOUN',['TEXT','CONTENT'],['текст','Текст','текста','тексте'],'Связная последовательность языковых единиц.'],
  ['document.source','document','документ','NOUN',['DOCUMENT','SOURCE'],['документ','Документ','документа','документе'],'Версионированный текстовый источник.'],
  ['sentence.text','sentence','предложение','NOUN',['TEXT_UNIT','CLAIM_CONTAINER'],['предложение','Предложение','предложения','предложении'],'Короткая законченная языковая конструкция.'],
  ['word.text','word','слово','NOUN',['TEXT_UNIT'],['слово','Слово','слова','слове'],'Лексическая единица текста.'],
  ['syllable.text','syllable','слог','NOUN',['TEXT_UNIT'],['слог','Слог','слога','слоге'],'Произносительная часть слова.'],
  ['letter.text','letter','буква','NOUN',['TEXT_UNIT','SYMBOL'],['буква','Буква','буквы','букву'],'Графический знак письменной системы.'],
  ['fact.claim','fact','факт','NOUN',['CLAIM','EVIDENCE_TARGET'],['факт','Факт','факта','факте'],'Утверждение, требующее источниковой проверки.'],
  ['claim.statement','claim','утверждение','NOUN',['CLAIM'],['утверждение','Утверждение','утверждения','утверждении'],'Минимальная смысловая единица с предикатом и ролями.'],
  ['definition.text','definition','определение','NOUN',['TEXT_UNIT','CLAIM'],['определение','Определение','определения'],'Краткое раскрытие значения понятия.'],
  ['concept.semantic','concept','понятие','NOUN',['SEMANTIC_ENTITY'],['понятие','Понятие','понятия','понятии'],'Единица классифицированного знания.'],
  ['meaning.semantic','meaning','смысл','NOUN',['SEMANTIC_ENTITY'],['смысл','Смысл','смысла','смысле'],'Интерпретируемое содержание выражения.'],
  ['context.semantic','context','контекст','NOUN',['QUALIFIER','TEXT'],['контекст','Контекст','контекста','контексте'],'Окружение, ограничивающее интерпретацию.'],
  ['theme.topic','topic','тема','NOUN',['TOPIC'],['тема','Тема','темы','тему'],'Предмет связного текста или исследования.'],
  ['detail.part','detail','деталь','NOUN',['PART','INFORMATION'],['деталь','Деталь','детали','деталью'],'Отдельная уточняющая часть описания.'],
  ['whole.aggregate','whole','целое','NOUN',['WHOLE','COLLECTION'],['целое','Целое','целого','целом'],'Объект, рассматриваемый как единая совокупность частей.'],
  ['part.component','part','часть','NOUN',['PART'],['часть','Часть','части','частью','частей'],'Компонент более крупного целого.'],
  ['generalization.operation','generalization','обобщение','NOUN',['OPERATION','GENERALIZATION'],['обобщение','Обобщение','обобщения'],'Операция сокращения различий с сохранением общего.'],
  ['detailing.operation','detailing','детализация','NOUN',['OPERATION','DETAILING'],['детализация','Детализация','детализации','детализацию'],'Операция явного раскрытия частей и ограничений.'],
  ['split.operation','split','разделение','NOUN',['OPERATION','DETAILING'],['разделение','Разделение','разделения'],'Операция получения нескольких частей из целого.'],
  ['merge.operation','merge','объединение','NOUN',['OPERATION','GENERALIZATION'],['объединение','Объединение','объединения'],'Операция построения целого из совместимых частей.'],
  ['cause.relation','cause','причина','NOUN',['CAUSE','RELATION'],['причина','Причина','причины','причиной'],'Условие или событие, связанное с возникновением эффекта.'],
  ['effect.result','effect','эффект','NOUN',['EFFECT','RESULT'],['эффект','Эффект','эффекта','эффекте'],'Наблюдаемое следствие причины или операции.'],
  ['source.document','source','источник','NOUN',['SOURCE','DOCUMENT'],['источник','Источник','источника','источнике'],'Документ, из которого извлечено утверждение.'],
  ['source.cause','source','источник','NOUN',['SOURCE','CAUSE'],['источник','Источник','источника','источнике'],'Начальная причина потока или воздействия.'],
  ['evidence.support','evidence','свидетельство','NOUN',['EVIDENCE'],['свидетельство','Свидетельство','свидетельства'],'Фрагмент источника, рассматриваемый для проверки claim.'],
  ['verification.operation','verification','проверка','NOUN',['OPERATION','VERIFICATION'],['проверка','Проверка','проверки','проверку'],'Операция сопоставления утверждения с правилами и источниками.'],
  ['description.operation','description','описание','NOUN',['OPERATION','TEXT'],['описание','Описание','описания'],'Явное представление свойств объекта словами.'],
  ['preservation.operation','preservation','сохранение','NOUN',['OPERATION','CONTINUITY'],['сохранение','Сохранение','сохранения'],'Удержание выбранного свойства при переходе.'],
  ['change.operation','change','изменение','NOUN',['OPERATION','PROCESS'],['изменение','Изменение','изменения'],'Переход от одного значения или состояния к другому.'],
  ['relation.semantic','relation','связь','NOUN',['RELATION','SEMANTIC_ENTITY'],['связь','Связь','связи','связью'],'Формальное отношение между смысловыми объектами.'],
  ['relation.communication','relation','связь','NOUN',['COMMUNICATION','PROCESS'],['связь','Связь','связи','связью'],'Канал передачи сообщений между участниками.'],
  ['field.semantic','field','поле','NOUN',['SEMANTIC_SYSTEM','COLLECTION'],['поле','Поле','поля'],'Область связанных понятий и отношений.'],
  ['field.physical','field','поле','NOUN',['PHYSICAL_ENTITY','PLACE'],['поле','Поле','поля'],'Пространственная область физического воздействия.'],
  ['role.semantic','role','роль','NOUN',['ROLE'],['роль','Роль','роли','ролью'],'Тип участия аргумента в предикатной рамке.'],
  ['predicate.semantic','predicate','предикат','NOUN',['PREDICATE'],['предикат','Предикат','предиката'],'Нормализованное отношение утверждения.'],
  ['subject.semantic','subject','субъект','NOUN',['ENTITY','ROLE'],['субъект','Субъект','субъекта'],'Участник, о котором сделано утверждение.'],
  ['object.semantic','object','объект','NOUN',['ENTITY','ROLE'],['объект','Объект','объекта'],'Участник, на который направлено отношение.'],
  ['agent.role','agent','агент','NOUN',['ENTITY','AGENT'],['агент','Агент','агента'],'Участник, инициирующий контролируемую операцию.'],
  ['theme.role','theme','носитель','NOUN',['ENTITY','THEME'],['носитель','Носитель','носителя'],'Участник, состояние которого изменяется или сохраняется.'],
  ['path.role','path','путь','NOUN',['PATH'],['путь','Путь','пути','путём'],'Маршрут перемещения или последовательности шагов.'],
  ['direction.role','direction','направление','NOUN',['DIRECTION'],['направление','Направление','направления'],'Ориентация перехода между состояниями.'],
  ['result.role','result','результат','NOUN',['RESULT'],['результат','Результат','результата','результате'],'Явный итог операции или проверки.'],
  ['method.qualifier','method','метод','NOUN',['METHOD','QUALIFIER'],['метод','Метод','метода','методом'],'Способ выполнения операции или исследования.'],
  ['time.qualifier','time','время','NOUN',['TIME','QUALIFIER'],['время','Время','времени'],'Временное ограничение утверждения.'],
  ['place.qualifier','place','место','NOUN',['PLACE','QUALIFIER'],['место','Место','места'],'Пространственное ограничение утверждения.'],
  ['population.qualifier','population','группа','NOUN',['POPULATION','QUALIFIER'],['группа','Группа','группы','группе'],'Множество объектов, для которых применимо утверждение.'],
  ['measure.qualifier','measure','мера','NOUN',['MEASURE','QUALIFIER'],['мера','Мера','меры','мерой'],'Числовое или порядковое ограничение свойства.'],
  ['hypothesis.modality','hypothesis','гипотеза','NOUN',['MODALITY','CLAIM'],['гипотеза','Гипотеза','гипотезы'],'Предположение, не представленное как установленный факт.'],
  ['interpretation.modality','interpretation','интерпретация','NOUN',['MODALITY','CLAIM'],['интерпретация','Интерпретация','интерпретации'],'Объяснительное прочтение данных или текста.'],
  ['report.modality','report','сообщение','NOUN',['MODALITY','TEXT'],['сообщение','Сообщение','сообщения'],'Атрибутированная передача чужого утверждения.'],
  ['fact.modality','factuality','фактичность','NOUN',['MODALITY'],['фактичность','Фактичность','фактичности'],'Представление утверждения как факта без доказательства истинности.'],
  ['negation.logic','negation','отрицание','NOUN',['LOGIC','POLARITY'],['отрицание','Отрицание','отрицания'],'Явное изменение положительной polarity на отрицательную.'],
  ['support.relation','support','поддержка','NOUN',['RELATION','EVIDENCE'],['поддержка','Поддержка','поддержки'],'Отношение свидетельства к совместимому утверждению.'],
  ['refutation.relation','refutation','опровержение','NOUN',['RELATION','EVIDENCE'],['опровержение','Опровержение','опровержения'],'Отношение свидетельства к несовместимому утверждению.'],
  ['dependency.relation','dependency','зависимость','NOUN',['RELATION'],['зависимость','Зависимость','зависимости'],'Отношение, при котором один объект требует другого.'],
  ['limit.relation','limit','ограничение','NOUN',['CONSTRAINT','RELATION'],['ограничение','Ограничение','ограничения'],'Явное сужение допустимой области.'],
  ['inclusion.relation','inclusion','включение','NOUN',['RELATION','COLLECTION'],['включение','Включение','включения'],'Отношение принадлежности части целому.'],
  ['sequence.relation','sequence','последовательность','NOUN',['ORDER','COLLECTION'],['последовательность','Последовательность','последовательности'],'Упорядоченный ряд элементов или операций.'],
  ['structure.form','structure','структура','NOUN',['STRUCTURE'],['структура','Структура','структуры'],'Набор элементов и явных отношений между ними.'],
  ['pattern.structure','pattern','паттерн','NOUN',['STRUCTURE','RULE'],['паттерн','Паттерн','паттерна'],'Версионированный шаблон контролируемого предложения.'],
  ['index.structure','index','индекс','NOUN',['INDEX','DATA_STRUCTURE'],['индекс','Индекс','индекса'],'Структура точного поиска по ключам и позициям.'],
  ['token.unit','token','токен','NOUN',['TEXT_UNIT','INDEX_UNIT'],['токен','Токен','токена'],'Индексируемая последовательность символов текста.'],
  ['position.location','position','позиция','NOUN',['LOCATION','INDEX_UNIT'],['позиция','Позиция','позиции'],'Точное смещение элемента в источнике.'],
  ['span.text','span','фрагмент','NOUN',['TEXT_UNIT','SOURCE_SPAN'],['фрагмент','Фрагмент','фрагмента'],'Ограниченная позициями часть исходного текста.'],
  ['hash.identity','hash','хеш','NOUN',['IDENTIFIER','INTEGRITY'],['хеш','Хеш','хеша'],'Канонический идентификатор содержимого.'],
  ['version.identity','version','версия','NOUN',['IDENTIFIER','REVISION'],['версия','Версия','версии'],'Именованная редакция схемы или набора данных.'],
  ['corpus.collection','corpus','корпус','NOUN',['COLLECTION','DATASET'],['корпус','Корпус','корпуса'],'Фиксированная коллекция размеченных текстовых примеров.'],
  ['dictionary.collection','dictionary','словарь','NOUN',['COLLECTION','LEXICON'],['словарь','Словарь','словаря'],'Версионированный набор лексических значений и форм.'],
  ['sense.semantic','sense','значение','NOUN',['SENSE','SEMANTIC_ENTITY'],['значение','Значение','значения'],'Одно явно идентифицированное значение леммы.'],
  ['ambiguity.state','ambiguity','неоднозначность','NOUN',['STATE','RESOLUTION_STATUS'],['неоднозначность','Неоднозначность','неоднозначности'],'Наличие нескольких точных кандидатов без выбора одного.'],
  ['oov.state','oov','внесловарность','NOUN',['STATE','RESOLUTION_STATUS'],['внесловарность','Внесловарность','внесловарности'],'Отсутствие точной формы в текущей версии словаря.'],
  ['provenance.trace','provenance','происхождение','NOUN',['PROVENANCE'],['происхождение','Происхождение','происхождения'],'Проверяемая цепочка источников и преобразований.'],
  ['trace.record','trace','трасса','NOUN',['TRACE','RECORD'],['трасса','Трасса','трассы'],'Детерминированная запись выполненных шагов.'],
  ['query.request','query','запрос','NOUN',['QUERY'],['запрос','Запрос','запроса'],'Закрытая структура условия поиска.'],
  ['search.operation','search','поиск','NOUN',['OPERATION','RETRIEVAL'],['поиск','Поиск','поиска'],'Получение совпадений по явному запросу.'],
  ['match.result','match','совпадение','NOUN',['RESULT','RETRIEVAL'],['совпадение','Совпадение','совпадения'],'Найденное структурное или строковое соответствие.'],
  ['candidate.result','candidate','кандидат','NOUN',['RESULT','CANDIDATE'],['кандидат','Кандидат','кандидата'],'Вариант, ожидающий отдельной проверки и решения.'],
  ['qualifier.constraint','qualifier','квалификатор','NOUN',['QUALIFIER','CONSTRAINT'],['квалификатор','Квалификатор','квалификатора'],'Именованное ограничение области утверждения.'],
  ['polarity.logic','polarity','полярность','NOUN',['POLARITY','LOGIC'],['полярность','Полярность','полярности'],'Признак положительного или отрицательного утверждения.'],
  ['modality.logic','modality','модальность','NOUN',['MODALITY','LOGIC'],['модальность','Модальность','модальности'],'Способ представления статуса высказывания.'],
  ['quantifier.logic','quantifier','квантор','NOUN',['QUANTIFIER','LOGIC'],['квантор','Квантор','квантора'],'Явное указание охвата множества.'],
  ['autonomy.property','autonomy','автономность','NOUN',['PROPERTY','SYSTEM'],['автономность','Автономность','автономности'],'Способность работать на фиксированных локальных данных.'],
  ['article.document','article','статья','NOUN',['DOCUMENT','TEXT'],['статья','Статья','статьи','статью'],'Связный текст, состоящий из утверждений и разделов.'],
  ['researcher.person','researcher','исследователь','NOUN',['PERSON','AGENT'],['исследователь','Исследователь','исследователя'],'Участник, выполняющий научную операцию.'],
  ['editor.person','editor','редактор','NOUN',['PERSON','AGENT'],['редактор','Редактор','редактора'],'Участник, изменяющий структуру и формулировки текста.'],
  ['method.procedure','procedure','процедура','NOUN',['METHOD','PROCESS'],['процедура','Процедура','процедуры'],'Явно заданная последовательность действий.'],
  ['formula.expression','formula','формула','NOUN',['FORMULA','EXPRESSION'],['формула','Формула','формулы','формулу'],'Формальное выражение зависимости величин.'],
  ['model.representation','model','модель','NOUN',['MODEL','REPRESENTATION'],['модель','Модель','модели','моделью'],'Ограниченное представление системы или процесса.'],
  ['algorithm.procedure','algorithm','алгоритм','NOUN',['ALGORITHM','PROCESS'],['алгоритм','Алгоритм','алгоритма'],'Детерминированная последовательность вычислительных шагов.'],
  ['conclusion.result','conclusion','заключение','NOUN',['RESULT','TEXT'],['заключение','Заключение','заключения'],'Итоговое утверждение после явно описанной проверки.'],
  ['statement.text','statement','тезис','NOUN',['CLAIM','TEXT_UNIT'],['тезис','Тезис','тезиса'],'Кратко сформулированное утверждение.'],
  ['move.process','move','двигаться','VERB',['PREDICATE','PROCESS'],['двигаться','движется','движутся','двигался','двигалась','двигалось'],'Менять позицию вдоль явного пути.'],
  ['continue.process','continue','продолжать','VERB',['PREDICATE','PROCESS'],['продолжать','продолжает','продолжают','продолжил','продолжается'],'Выполнять следующий связный шаг процесса.'],
  ['generalize.operation','generalize','обобщать','VERB',['PREDICATE','GENERALIZATION'],['обобщать','обобщает','обобщают','обобщил'],'Сводить совместимые детали к более общему представлению.'],
  ['detail.operation','detail-verb','детализировать','VERB',['PREDICATE','DETAILING'],['детализировать','детализирует','детализируют','детализировал'],'Раскрывать явные части, признаки или ограничения.'],
  ['split.operation-verb','split-verb','разделять','VERB',['PREDICATE','DETAILING'],['разделять','разделяет','разделяют','разделил'],'Получать несколько частей из одного целого.'],
  ['merge.operation-verb','merge-verb','объединять','VERB',['PREDICATE','GENERALIZATION'],['объединять','объединяет','объединяют','объединил'],'Строить одно целое из совместимых частей.'],
  ['cause.relation-verb','cause-verb','вызывать','VERB',['PREDICATE','CAUSE'],['вызывать','вызывает','вызывают','вызвал'],'Связывать причину с возникающим эффектом.'],
  ['preserve.operation-verb','preserve','сохранять','VERB',['PREDICATE','CONTINUITY'],['сохранять','сохраняет','сохраняют','сохранил'],'Удерживать выбранное свойство при переходе.'],
  ['verify.operation-verb','verify','проверять','VERB',['PREDICATE','VERIFICATION'],['проверять','проверяет','проверяют','проверил'],'Сопоставлять объект с явными правилами или источниками.'],
  ['describe.operation-verb','describe','описывать','VERB',['PREDICATE','TEXT_OPERATION'],['описывать','описывает','описывают','описал'],'Представлять объект через явные свойства и отношения.'],
  ['rotate.process','rotate','вращаться','VERB',['PREDICATE','PROCESS'],['вращаться','вращается','вращаются','вращалось'],'Двигаться вокруг центра или оси.'],
  ['enter.process','enter','входить','VERB',['PREDICATE','PROCESS'],['входить','входит','входят','вошёл'],'Переходить внутрь обозначенной области.'],
  ['exit.process','exit','выходить','VERB',['PREDICATE','PROCESS'],['выходить','выходит','выходят','вышел'],'Переходить за пределы обозначенной области.'],
  ['reach.process','reach','достигать','VERB',['PREDICATE','PROCESS'],['достигать','достигает','достигают','достиг'],'Приходить к обозначенной границе или результату.'],
  ['avoid.operation','avoid','избегать','VERB',['PREDICATE','POLICY'],['избегать','избегает','избегают','избежал'],'Не допускать обозначенного предельного состояния.'],
  ['balance.operation','balance-verb','уравновешивать','VERB',['PREDICATE','POLICY'],['уравновешивать','уравновешивает','уравновешивают','уравновесил'],'Компенсировать противоположные направленные воздействия.'],
  ['support.relation-verb','support-verb','поддерживать','VERB',['PREDICATE','EVIDENCE_RELATION'],['поддерживать','поддерживает','поддерживают','поддержал'],'Указывать совместимость свидетельства с тезисом.'],
  ['refute.relation-verb','refute','опровергать','VERB',['PREDICATE','EVIDENCE_RELATION'],['опровергать','опровергает','опровергают','опроверг'],'Указывать несовместимость свидетельства с тезисом.'],
  ['limit.operation-verb','limit-verb','ограничивать','VERB',['PREDICATE','CONSTRAINT'],['ограничивать','ограничивает','ограничивают','ограничил'],'Сужать допустимую область объекта или утверждения.'],
  ['depend.relation-verb','depend','зависеть','VERB',['PREDICATE','RELATION'],['зависеть','зависит','зависят','зависел'],'Иметь явно указанную необходимую связь с другим объектом.'],
  ['consist.relation-verb','consist','состоять','VERB',['PREDICATE','PART_WHOLE'],['состоять','состоит','состоят','состоял'],'Иметь перечисленные части.'],
  ['include.relation-verb','include','включать','VERB',['PREDICATE','PART_WHOLE'],['включать','включает','включают','включил'],'Содержать обозначенную часть в составе целого.'],
  ['follow.relation-verb','follow','следовать','VERB',['PREDICATE','ORDER'],['следовать','следует','следуют','следовал'],'Занимать следующую позицию в последовательности.'],
  ['change.operation-verb','change-verb','изменять','VERB',['PREDICATE','PROCESS'],['изменять','изменяет','изменяют','изменил'],'Переводить объект в другое состояние или значение.']
];

function makeSense(row){
  return seal({
    schema:SCHEMAS.sense,
    version:VERSION,
    senseId:'p78:sense:'+row[0],
    conceptId:'p78:concept:'+row[1],
    lemma:row[2],
    pos:row[3],
    ontologyTypes:row[4],
    surfaceForms:row[5],
    definition:row[6]
  });
}

var senses=freeze(SENSE_ROWS.map(makeSense));
var senseById=Object.create(null);
var i;
for(i=0;i<senses.length;i++) senseById[senses[i].senseId]=senses[i];

var PREDICATE_ROWS=[
  ['move','move.process',['двигаться','движется','движутся'],[['THEME',true,['ENTITY','PROCESS']],['PATH',false,['PATH']],['DIRECTION',false,['DIRECTION']]],'Перемещение носителя по пути.'],
  ['continue','continue.process',['продолжать','продолжает','продолжается'],[['AGENT',false,['AGENT','SYSTEM']],['PROCESS',true,['PROCESS','TEXT']]],'Продолжение процесса или текста.'],
  ['generalize','generalize.operation',['обобщать','обобщает','обобщают'],[['AGENT',true,['AGENT','SYSTEM']],['INPUT',true,['INFORMATION','COLLECTION']],['RESULT',false,['RESULT','CONCEPT']]],'Переход от деталей к общему представлению.'],
  ['detail','detail.operation',['детализировать','детализирует','детализируют'],[['AGENT',true,['AGENT','SYSTEM']],['WHOLE',true,['WHOLE','CLAIM','TEXT']],['PART',false,['PART','DETAIL']]],'Раскрытие частей и ограничений целого.'],
  ['split','split.operation-verb',['разделять','разделяет','разделяют'],[['AGENT',true,['AGENT','SYSTEM']],['WHOLE',true,['WHOLE','TEXT','CLAIM']],['PART',false,['PART']]],'Разделение целого на части.'],
  ['merge','merge.operation-verb',['объединять','объединяет','объединяют'],[['AGENT',true,['AGENT','SYSTEM']],['PART',true,['PART','COLLECTION']],['RESULT',false,['RESULT','WHOLE']]],'Объединение совместимых частей.'],
  ['cause','cause.relation-verb',['вызывать','вызывает','вызывают'],[['CAUSE',true,['CAUSE','EVENT','STATE']],['EFFECT',true,['EFFECT','STATE','PROCESS']]],'Причинное отношение между условием и эффектом.'],
  ['preserve','preserve.operation-verb',['сохранять','сохраняет','сохраняют'],[['AGENT',true,['AGENT','SYSTEM']],['THEME',true,['PROPERTY','INFORMATION','STATE']],['TRANSITION',false,['PROCESS']]],'Сохранение свойства при переходе.'],
  ['verify','verify.operation-verb',['проверять','проверяет','проверяют'],[['AGENT',true,['AGENT','SYSTEM']],['CLAIM',true,['CLAIM','FORMULA','DOCUMENT']],['METHOD',false,['METHOD']]],'Проверка объекта по правилам или источникам.'],
  ['describe','describe.operation-verb',['описывать','описывает','описывают'],[['AGENT',true,['AGENT','DOCUMENT','SYSTEM']],['THEME',true,['ENTITY','PROCESS','STATE']]],'Описание свойств и отношений темы.'],
  ['rotate','rotate.process',['вращаться','вращается','вращаются'],[['THEME',true,['ENTITY','PARTICLE','SYSTEM']],['AROUND',true,['PLACE','CENTER']],['DIRECTION',false,['DIRECTION']]],'Вращение вокруг центра или оси.'],
  ['enter','enter.process',['входить','входит','входят'],[['THEME',true,['ENTITY','PARTICLE','INFORMATION']],['CONTAINER',true,['SYSTEM','PLACE']]],'Переход внутрь области.'],
  ['exit','exit.process',['выходить','выходит','выходят'],[['THEME',true,['ENTITY','PARTICLE','INFORMATION']],['CONTAINER',true,['SYSTEM','PLACE']]],'Переход за пределы области.'],
  ['reach','reach.process',['достигать','достигает','достигают'],[['THEME',true,['ENTITY','PROCESS','MEASURE']],['BOUNDARY',true,['BOUNDARY','RESULT','STATE']]],'Достижение границы или результата.'],
  ['avoid','avoid.operation',['избегать','избегает','избегают'],[['AGENT',true,['AGENT','SYSTEM']],['STATE',true,['STATE','PROCESS']]],'Недопущение предельного состояния.'],
  ['balance','balance.operation',['уравновешивать','уравновешивает','уравновешивают'],[['AGENT',true,['AGENT','SYSTEM']],['FORCE_A',true,['MEASURE','PROCESS']],['FORCE_B',true,['MEASURE','PROCESS']]],'Компенсация противоположных воздействий.'],
  ['support','support.relation-verb',['поддерживать','поддерживает','поддерживают'],[['EVIDENCE',true,['EVIDENCE','SOURCE']],['CLAIM',true,['CLAIM']]],'Структурно совместимое отношение свидетельства к тезису.'],
  ['refute','refute.relation-verb',['опровергать','опровергает','опровергают'],[['EVIDENCE',true,['EVIDENCE','SOURCE']],['CLAIM',true,['CLAIM']]],'Структурно несовместимое отношение свидетельства к тезису.'],
  ['limit','limit.operation-verb',['ограничивать','ограничивает','ограничивают'],[['CONSTRAINT',true,['CONSTRAINT','RULE']],['THEME',true,['ENTITY','CLAIM','PROCESS']],['SCOPE',false,['QUALIFIER','COLLECTION']]],'Сужение допустимой области.'],
  ['depend','depend.relation-verb',['зависеть','зависит','зависят'],[['DEPENDENT',true,['ENTITY','PROCESS','RESULT']],['CONDITION',true,['CONDITION','ENTITY','PROCESS']]],'Явная зависимость одного объекта от другого.'],
  ['consist','consist.relation-verb',['состоять','состоит','состоят'],[['WHOLE',true,['WHOLE','SYSTEM','TEXT']],['PART',true,['PART','COLLECTION']]],'Отношение целого к перечисленным частям.'],
  ['include','include.relation-verb',['включать','включает','включают'],[['WHOLE',true,['WHOLE','SYSTEM','TEXT']],['PART',true,['PART','ENTITY']]],'Включение части в целое.'],
  ['follow','follow.relation-verb',['следовать','следует','следуют'],[['NEXT',true,['ENTITY','PROCESS','TEXT_UNIT']],['PREVIOUS',true,['ENTITY','PROCESS','TEXT_UNIT']]],'Отношение порядка между двумя элементами.'],
  ['change','change.operation-verb',['изменять','изменяет','изменяют'],[['AGENT',true,['AGENT','SYSTEM','CONDITION']],['THEME',true,['ENTITY','STATE','PARAMETER']],['RESULT',false,['RESULT','STATE']]],'Изменение объекта или состояния.']
];

function makeRole(row){ return {role:row[0],required:row[1],ontologyTypes:row[2]}; }

function makePredicate(row){
  var sense=senseById['p78:sense:'+row[1]];
  if(!sense) reject(ERROR_CODES.SENSE_REF_INVALID,row[1],'$.predicateRows');
  return seal({
    schema:SCHEMAS.predicateFrame,
    version:VERSION,
    predicateId:'p78:predicate:'+row[0],
    lemma:sense.lemma,
    senseRef:senseRef(sense),
    surfaceForms:row[2],
    roles:row[3].map(makeRole),
    description:row[4]
  });
}

var predicateFrames=freeze(PREDICATE_ROWS.map(makePredicate));
var predicateById=Object.create(null);
var predicateBySenseId=Object.create(null);
var predicateByLemma=Object.create(null);
for(i=0;i<predicateFrames.length;i++){
  predicateById[predicateFrames[i].predicateId]=predicateFrames[i];
  predicateBySenseId[predicateFrames[i].senseRef.senseId]=predicateFrames[i];
  predicateByLemma[predicateFrames[i].lemma]=predicateFrames[i];
}

var PATTERN_ROWS=[
  ['claim.move.positive','move','{THEME} движется по {PATH}.',['THEME','PATH'],'POSITIVE','FACT',[]],
  ['claim.move.negative','move','{THEME} не движется по {PATH}.',['THEME','PATH'],'NEGATIVE','FACT',[]],
  ['claim.continue.positive','continue','{AGENT} продолжает {PROCESS}.',['AGENT','PROCESS'],'POSITIVE','FACT',[]],
  ['claim.continue.reported','continue','Источник сообщает, что {PROCESS} продолжается.',['PROCESS'],'POSITIVE','REPORTED',[]],
  ['claim.generalize.positive','generalize','{AGENT} обобщает {INPUT}.',['AGENT','INPUT'],'POSITIVE','FACT',[]],
  ['claim.generalize.negative','generalize','{AGENT} не обобщает {INPUT}.',['AGENT','INPUT'],'NEGATIVE','FACT',[]],
  ['claim.detail.positive','detail','{AGENT} детализирует {WHOLE}.',['AGENT','WHOLE'],'POSITIVE','FACT',[]],
  ['claim.split.positive','split','{AGENT} разделяет {WHOLE} на {PART}.',['AGENT','WHOLE','PART'],'POSITIVE','FACT',[]],
  ['claim.merge.positive','merge','{AGENT} объединяет {PART} в {RESULT}.',['AGENT','PART','RESULT'],'POSITIVE','FACT',[]],
  ['claim.cause.positive','cause','{CAUSE} вызывает {EFFECT}.',['CAUSE','EFFECT'],'POSITIVE','FACT',[]],
  ['claim.cause.negative','cause','{CAUSE} не вызывает {EFFECT}.',['CAUSE','EFFECT'],'NEGATIVE','FACT',[]],
  ['claim.preserve.positive','preserve','{AGENT} сохраняет {THEME}.',['AGENT','THEME'],'POSITIVE','FACT',[]],
  ['claim.preserve.negative','preserve','{AGENT} не сохраняет {THEME}.',['AGENT','THEME'],'NEGATIVE','FACT',[]],
  ['claim.verify.fact','verify','{AGENT} проверяет {CLAIM}.',['AGENT','CLAIM'],'POSITIVE','FACT',['METHOD']],
  ['claim.verify.hypothesis','verify','{AGENT} проверяет гипотезу {CLAIM}.',['AGENT','CLAIM'],'POSITIVE','HYPOTHESIS',['METHOD']],
  ['claim.describe.positive','describe','{AGENT} описывает {THEME}.',['AGENT','THEME'],'POSITIVE','FACT',[]],
  ['claim.rotate.positive','rotate','{THEME} вращается вокруг {AROUND}.',['THEME','AROUND'],'POSITIVE','FACT',['MEASURE']],
  ['claim.enter.positive','enter','{THEME} входит в {CONTAINER}.',['THEME','CONTAINER'],'POSITIVE','FACT',[]],
  ['claim.exit.positive','exit','{THEME} выходит из {CONTAINER}.',['THEME','CONTAINER'],'POSITIVE','FACT',[]],
  ['claim.reach.positive','reach','{THEME} достигает {BOUNDARY}.',['THEME','BOUNDARY'],'POSITIVE','FACT',['TIME']],
  ['claim.avoid.positive','avoid','{AGENT} избегает {STATE}.',['AGENT','STATE'],'POSITIVE','FACT',['CONDITION']],
  ['claim.balance.positive','balance','{AGENT} уравновешивает {FORCE_A} и {FORCE_B}.',['AGENT','FORCE_A','FORCE_B'],'POSITIVE','FACT',['MEASURE']],
  ['claim.support.reported','support','{EVIDENCE} поддерживает {CLAIM}.',['EVIDENCE','CLAIM'],'POSITIVE','REPORTED',['METHOD']],
  ['claim.refute.reported','refute','{EVIDENCE} опровергает {CLAIM}.',['EVIDENCE','CLAIM'],'POSITIVE','REPORTED',['METHOD']],
  ['claim.limit.positive','limit','{CONSTRAINT} ограничивает {THEME}.',['CONSTRAINT','THEME'],'POSITIVE','FACT',['CONDITION']],
  ['claim.depend.positive','depend','{DEPENDENT} зависит от {CONDITION}.',['DEPENDENT','CONDITION'],'POSITIVE','FACT',['CONDITION']],
  ['claim.consist.positive','consist','{WHOLE} состоит из {PART}.',['WHOLE','PART'],'POSITIVE','FACT',[]],
  ['claim.include.positive','include','{WHOLE} включает {PART}.',['WHOLE','PART'],'POSITIVE','FACT',[]],
  ['claim.follow.positive','follow','{NEXT} следует после {PREVIOUS}.',['NEXT','PREVIOUS'],'POSITIVE','FACT',['TIME']],
  ['claim.change.positive','change','{AGENT} изменяет {THEME}.',['AGENT','THEME'],'POSITIVE','FACT',['CONDITION','MEASURE']]
];

function makePattern(row){
  var predicate=predicateById['p78:predicate:'+row[1]];
  if(!predicate) reject(ERROR_CODES.PREDICATE_REF_INVALID,row[1],'$.patternRows');
  return seal({
    schema:SCHEMAS.structuralPattern,
    version:VERSION,
    patternId:'p78:pattern:'+row[0],
    genre:'P78_SHORT_CLAIM',
    predicateRef:predicateRef(predicate),
    surfaceTemplate:row[2],
    roles:row[3],
    polarity:row[4],
    modality:row[5],
    qualifierKeys:row[6]
  });
}

var structuralPatterns=freeze(PATTERN_ROWS.map(makePattern));
var patternById=Object.create(null);
for(i=0;i<structuralPatterns.length;i++) patternById[structuralPatterns[i].patternId]=structuralPatterns[i];
var patternSetHash=Canonical.hashCanonical(structuralPatterns.map(function(pattern){
  return {patternId:pattern.patternId,version:pattern.version,contentHash:pattern.contentHash};
}));

function validateSenseRecord(record,path){
  var expected;
  path=path||'$';
  assertObject(record,path);
  assertExactKeys(record,['schema','version','senseId','conceptId','lemma','pos','ontologyTypes','surfaceForms','definition','contentHash'],[],path);
  if(record.schema!==SCHEMAS.sense) reject(ERROR_CODES.INVALID_SCHEMA,'sense schema rejected',path+'.schema');
  assertVersion(record.version,path+'.version');
  if(record.version!==VERSION) reject(ERROR_CODES.INVALID_VERSION,'sense version rejected',path+'.version');
  assertId(record.senseId,path+'.senseId','p78:sense:');
  assertId(record.conceptId,path+'.conceptId','p78:concept:');
  assertString(record.lemma,path+'.lemma',{nonEmpty:true,trimmed:true,max:128});
  assertEnum(record.pos,POS,path+'.pos');
  assertStringArray(record.ontologyTypes,path+'.ontologyTypes',{min:1,max:16,pattern:ROLE});
  assertStringArray(record.surfaceForms,path+'.surfaceForms',{min:1,max:32,trimmed:true,duplicateCode:ERROR_CODES.DUPLICATE_SURFACE_FORM});
  if(record.surfaceForms.indexOf(record.lemma)===-1) reject(ERROR_CODES.INVALID_VALUE,'lemma must be an explicit surface form',path+'.surfaceForms');
  assertString(record.definition,path+'.definition',{nonEmpty:true,trimmed:true,max:512});
  assertHash(record.contentHash,path+'.contentHash');
  expected=recordHash(record);
  if(record.contentHash!==expected) reject(ERROR_CODES.RECORD_HASH_MISMATCH,'sense content hash mismatch',path+'.contentHash');
  return true;
}

function validateSenseRef(ref,senseIndex,path){
  var target;
  assertObject(ref,path);
  assertExactKeys(ref,['senseId','version','contentHash'],[],path);
  assertId(ref.senseId,path+'.senseId','p78:sense:');
  assertVersion(ref.version,path+'.version');
  assertHash(ref.contentHash,path+'.contentHash');
  target=senseIndex[ref.senseId];
  if(!target||target.version!==ref.version||target.contentHash!==ref.contentHash){
    reject(ERROR_CODES.SENSE_REF_INVALID,'unpinned or missing sense reference',path);
  }
}

function validatePredicateFrame(record,senseIndex,path){
  var roleNames=Object.create(null),sense,j,role;
  path=path||'$';
  assertObject(record,path);
  assertExactKeys(record,['schema','version','predicateId','lemma','senseRef','surfaceForms','roles','description','contentHash'],[],path);
  if(record.schema!==SCHEMAS.predicateFrame) reject(ERROR_CODES.INVALID_SCHEMA,'predicate schema rejected',path+'.schema');
  if(record.version!==VERSION) reject(ERROR_CODES.INVALID_VERSION,'predicate version rejected',path+'.version');
  assertId(record.predicateId,path+'.predicateId','p78:predicate:');
  assertString(record.lemma,path+'.lemma',{nonEmpty:true,trimmed:true,max:128});
  validateSenseRef(record.senseRef,senseIndex,path+'.senseRef');
  sense=senseIndex[record.senseRef.senseId];
  if(sense.pos!=='VERB'||sense.lemma!==record.lemma) reject(ERROR_CODES.SENSE_REF_INVALID,'predicate must pin its verb sense',path+'.senseRef');
  assertStringArray(record.surfaceForms,path+'.surfaceForms',{min:1,max:32});
  for(j=0;j<record.surfaceForms.length;j++){
    if(sense.surfaceForms.indexOf(record.surfaceForms[j])===-1) reject(ERROR_CODES.SENSE_REF_INVALID,'predicate form absent from sense',path+'.surfaceForms['+j+']');
  }
  if(!Array.isArray(record.roles)||record.roles.length===0||record.roles.length>16) reject(ERROR_CODES.INVALID_VALUE,'predicate roles rejected',path+'.roles');
  for(j=0;j<record.roles.length;j++){
    role=record.roles[j];
    assertObject(role,path+'.roles['+j+']');
    assertExactKeys(role,['role','required','ontologyTypes'],[],path+'.roles['+j+']');
    assertString(role.role,path+'.roles['+j+'].role',{nonEmpty:true,trimmed:true,max:64,pattern:ROLE});
    if(roleNames[role.role]) reject(ERROR_CODES.DUPLICATE_ID,'duplicate predicate role',path+'.roles['+j+'].role');
    roleNames[role.role]=true;
    if(typeof role.required!=='boolean') reject(ERROR_CODES.INVALID_VALUE,'boolean required',path+'.roles['+j+'].required');
    assertStringArray(role.ontologyTypes,path+'.roles['+j+'].ontologyTypes',{min:1,max:16,pattern:ROLE});
  }
  assertString(record.description,path+'.description',{nonEmpty:true,trimmed:true,max:512});
  assertHash(record.contentHash,path+'.contentHash');
  if(record.contentHash!==recordHash(record)) reject(ERROR_CODES.RECORD_HASH_MISMATCH,'predicate content hash mismatch',path+'.contentHash');
  return true;
}

function validatePredicateRef(ref,predicateIndex,path){
  var target;
  assertObject(ref,path);
  assertExactKeys(ref,['predicateId','version','contentHash'],[],path);
  assertId(ref.predicateId,path+'.predicateId','p78:predicate:');
  assertVersion(ref.version,path+'.version');
  assertHash(ref.contentHash,path+'.contentHash');
  target=predicateIndex[ref.predicateId];
  if(!target||target.version!==ref.version||target.contentHash!==ref.contentHash){
    reject(ERROR_CODES.PREDICATE_REF_INVALID,'unpinned or missing predicate reference',path);
  }
}

function validateStructuralPattern(record,predicateIndex,path){
  var predicate,roles=Object.create(null),frameRoles=Object.create(null),j,name;
  path=path||'$';
  assertObject(record,path);
  assertExactKeys(record,['schema','version','patternId','genre','predicateRef','surfaceTemplate','roles','polarity','modality','qualifierKeys','contentHash'],[],path);
  if(record.schema!==SCHEMAS.structuralPattern) reject(ERROR_CODES.INVALID_SCHEMA,'pattern schema rejected',path+'.schema');
  if(record.version!==VERSION) reject(ERROR_CODES.INVALID_VERSION,'pattern version rejected',path+'.version');
  assertId(record.patternId,path+'.patternId','p78:pattern:');
  if(record.genre!=='P78_SHORT_CLAIM') reject(ERROR_CODES.INVALID_VALUE,'pattern genre rejected',path+'.genre');
  validatePredicateRef(record.predicateRef,predicateIndex,path+'.predicateRef');
  predicate=predicateIndex[record.predicateRef.predicateId];
  for(j=0;j<predicate.roles.length;j++) frameRoles[predicate.roles[j].role]=true;
  assertString(record.surfaceTemplate,path+'.surfaceTemplate',{nonEmpty:true,trimmed:true,max:512});
  assertStringArray(record.roles,path+'.roles',{min:1,max:16,pattern:ROLE});
  for(j=0;j<record.roles.length;j++){
    name=record.roles[j];
    if(roles[name]) reject(ERROR_CODES.DUPLICATE_ID,'duplicate pattern role',path+'.roles['+j+']');
    roles[name]=true;
    if(!frameRoles[name]) reject(ERROR_CODES.ROLE_REF_INVALID,'pattern role absent from predicate frame',path+'.roles['+j+']');
    if(record.surfaceTemplate.indexOf('{'+name+'}')===-1) reject(ERROR_CODES.ROLE_REF_INVALID,'pattern role absent from template',path+'.surfaceTemplate');
  }
  assertEnum(record.polarity,POLARITIES,path+'.polarity');
  assertEnum(record.modality,MODALITIES,path+'.modality');
  assertStringArray(record.qualifierKeys,path+'.qualifierKeys',{max:6,pattern:ROLE});
  for(j=0;j<record.qualifierKeys.length;j++) assertEnum(record.qualifierKeys[j],QUALIFIERS,path+'.qualifierKeys['+j+']');
  assertHash(record.contentHash,path+'.contentHash');
  if(record.contentHash!==recordHash(record)) reject(ERROR_CODES.RECORD_HASH_MISMATCH,'pattern content hash mismatch',path+'.contentHash');
  return true;
}

function validateLexicon(value,expectedHash){
  var senseIndex=Object.create(null),predicateIndex=Object.create(null),patternIndex=Object.create(null),j,record;
  assertObject(value,'$');
  assertExactKeys(value,['schema','version','language','domain','senses','predicateFrames','structuralPatterns','contentHash'],[],'$');
  if(value.schema!==SCHEMAS.lexicon) reject(ERROR_CODES.INVALID_SCHEMA,'lexicon schema rejected','$.schema');
  if(value.version!==VERSION) reject(ERROR_CODES.INVALID_VERSION,'lexicon version rejected','$.version');
  if(value.language!=='ru') reject(ERROR_CODES.INVALID_VALUE,'language must be ru','$.language');
  if(value.domain!=='P78_SHORT_DEFINITIONS_AND_CLAIMS') reject(ERROR_CODES.INVALID_VALUE,'domain rejected','$.domain');
  if(!Array.isArray(value.senses)||value.senses.length<100) reject(ERROR_CODES.INVALID_VALUE,'at least 100 senses required','$.senses');
  if(!Array.isArray(value.predicateFrames)||value.predicateFrames.length<20) reject(ERROR_CODES.INVALID_VALUE,'at least 20 predicates required','$.predicateFrames');
  if(!Array.isArray(value.structuralPatterns)||value.structuralPatterns.length<20||value.structuralPatterns.length>50){
    reject(ERROR_CODES.INVALID_VALUE,'20 to 50 structural patterns required','$.structuralPatterns');
  }
  assertHash(value.contentHash,'$.contentHash');
  if(expectedHash!==undefined){
    assertHash(expectedHash,'$.expectedHash');
    if(value.contentHash!==expectedHash) reject(ERROR_CODES.STALE_LEXICON,'lexicon hash differs from pinned hash','$.contentHash');
  }
  for(j=0;j<value.senses.length;j++){
    record=value.senses[j];
    validateSenseRecord(record,'$.senses['+j+']');
    if(senseIndex[record.senseId]) reject(ERROR_CODES.DUPLICATE_ID,'duplicate senseId','$.senses['+j+'].senseId');
    senseIndex[record.senseId]=record;
  }
  for(j=0;j<value.predicateFrames.length;j++){
    record=value.predicateFrames[j];
    validatePredicateFrame(record,senseIndex,'$.predicateFrames['+j+']');
    if(predicateIndex[record.predicateId]) reject(ERROR_CODES.DUPLICATE_ID,'duplicate predicateId','$.predicateFrames['+j+'].predicateId');
    predicateIndex[record.predicateId]=record;
  }
  for(j=0;j<value.structuralPatterns.length;j++){
    record=value.structuralPatterns[j];
    validateStructuralPattern(record,predicateIndex,'$.structuralPatterns['+j+']');
    if(patternIndex[record.patternId]) reject(ERROR_CODES.DUPLICATE_ID,'duplicate patternId','$.structuralPatterns['+j+'].patternId');
    patternIndex[record.patternId]=record;
  }
  if(value.contentHash!==recordHash(value)) reject(ERROR_CODES.LEXICON_HASH_MISMATCH,'lexicon content hash mismatch','$.contentHash');
  return true;
}

var lexicon=seal({
  schema:SCHEMAS.lexicon,
  version:VERSION,
  language:'ru',
  domain:'P78_SHORT_DEFINITIONS_AND_CLAIMS',
  senses:senses,
  predicateFrames:predicateFrames,
  structuralPatterns:structuralPatterns
});
validateLexicon(lexicon,lexicon.contentHash);

var surfaceIndex=Object.create(null);
for(i=0;i<senses.length;i++){
  var forms=senses[i].surfaceForms,j,form;
  for(j=0;j<forms.length;j++){
    form=forms[j];
    if(!surfaceIndex[form]) surfaceIndex[form]=[];
    surfaceIndex[form].push(senseRef(senses[i]));
  }
}
Object.keys(surfaceIndex).forEach(function(surface){
  surfaceIndex[surface].sort(function(left,right){ return compareText(left.senseId,right.senseId); });
  freeze(surfaceIndex[surface]);
});

function resolutionResult(surface,status,code,candidates,selectedSenseId){
  return seal({
    schema:SCHEMAS.resolution,
    version:VERSION,
    surface:surface,
    matchMode:'EXACT',
    lexiconHash:lexicon.contentHash,
    status:status,
    code:code,
    candidates:candidates,
    selectedSenseId:selectedSenseId
  });
}

function resolveExact(surface,expectedLexiconHash){
  var candidates;
  assertString(surface,'$.surface',{nonEmpty:true,max:256});
  if(expectedLexiconHash!==undefined){
    assertHash(expectedLexiconHash,'$.expectedLexiconHash');
    if(expectedLexiconHash!==lexicon.contentHash){
      return resolutionResult(surface,'REJECTED',ERROR_CODES.STALE_LEXICON,[],null);
    }
  }
  candidates=surfaceIndex[surface]||[];
  if(candidates.length===0) return resolutionResult(surface,'OOV',ERROR_CODES.OOV_SURFACE,[],null);
  if(candidates.length===1) return resolutionResult(surface,'RESOLVED',ERROR_CODES.EXACT_SINGLE,candidates,candidates[0].senseId);
  return resolutionResult(surface,'AMBIGUOUS',ERROR_CODES.EXACT_MULTIPLE,candidates,null);
}

function getSense(senseId){ return senseById[senseId]||null; }
function getPredicateFrame(predicateId){ return predicateById[predicateId]||null; }
function getStructuralPattern(patternId){ return patternById[patternId]||null; }
function predicateFrame(key){
  return predicateBySenseId[key]||predicateByLemma[key]||predicateById[key]||null;
}

function verifyLexicon(value,expectedHash){
  try{
    validateLexicon(value,expectedHash);
    return freeze({status:'READY',code:ERROR_CODES.READY,version:value.version,contentHash:value.contentHash});
  }catch(error){
    return freeze({
      status:'REJECTED',
      code:error&&error.code?error.code:ERROR_CODES.INVALID_VALUE,
      path:error&&error.path?error.path:'$',
      contentHash:value&&value.contentHash?value.contentHash:null
    });
  }
}

var api=freeze({
  version:VERSION,
  status:'READY',
  schema:SCHEMAS.lexicon,
  schemas:SCHEMAS,
  language:'ru',
  domain:'P78_SHORT_DEFINITIONS_AND_CLAIMS',
  lexicon:lexicon,
  lexiconHash:lexicon.contentHash,
  patternSetHash:patternSetHash,
  concepts:senses,
  senses:senses,
  predicateFrames:predicateFrames,
  structuralPatterns:structuralPatterns,
  recordCount:senses.length,
  predicateCount:predicateFrames.length,
  patternCount:structuralPatterns.length,
  resolutionStatuses:freeze(Object.keys(RESOLUTION_STATUSES).sort()),
  errorCodes:ERROR_CODES,
  resolve:resolveExact,
  resolveExact:resolveExact,
  predicateFrame:predicateFrame,
  getSense:getSense,
  getPredicateFrame:getPredicateFrame,
  getStructuralPattern:getStructuralPattern,
  validateSenseRecord:validateSenseRecord,
  validatePredicateFrame:function(record){ return validatePredicateFrame(record,senseById,'$'); },
  validateStructuralPattern:function(record){ return validateStructuralPattern(record,predicateById,'$'); },
  validateLexicon:validateLexicon,
  verifyLexicon:verifyLexicon
});

global.MRDP78ControlledRussianLexicon=api;
})(typeof globalThis!=='undefined'?globalThis:this);
