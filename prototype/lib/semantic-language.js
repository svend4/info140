(function(global){
'use strict';

var VERSION='1.0.0';
var FORMULA='occurrence = surface + lemma + POS + features + contextual sense; grammar = agreement + valency; unresolved sense -> AMBIGUOUS';
var FUNCTION_WORDS={
  'и':{lemma:'и',pos:'CCONJ'},'а':{lemma:'а',pos:'CCONJ'},'но':{lemma:'но',pos:'CCONJ'},'или':{lemma:'или',pos:'CCONJ'},
  'не':{lemma:'не',pos:'PART'},'ни':{lemma:'ни',pos:'PART'},'без':{lemma:'без',pos:'ADP'},'нет':{lemma:'нет',pos:'PART'},
  'в':{lemma:'в',pos:'ADP'},'во':{lemma:'в',pos:'ADP'},'на':{lemma:'на',pos:'ADP'},'к':{lemma:'к',pos:'ADP'},'ко':{lemma:'к',pos:'ADP'},
  'с':{lemma:'с',pos:'ADP'},'со':{lemma:'с',pos:'ADP'},'из':{lemma:'из',pos:'ADP'},'через':{lemma:'через',pos:'ADP'},
  'между':{lemma:'между',pos:'ADP'},'для':{lemma:'для',pos:'ADP'},'по':{lemma:'по',pos:'ADP'},'до':{lemma:'до',pos:'ADP'},
  'от':{lemma:'от',pos:'ADP'},'под':{lemma:'под',pos:'ADP'},'над':{lemma:'над',pos:'ADP'},'при':{lemma:'при',pos:'ADP'},
  'это':{lemma:'это',pos:'PRON'},'что':{lemma:'что',pos:'PRON'},'кто':{lemma:'кто',pos:'PRON'},'он':{lemma:'он',pos:'PRON'},
  'она':{lemma:'она',pos:'PRON'},'они':{lemma:'они',pos:'PRON'},'мы':{lemma:'мы',pos:'PRON'},'вы':{lemma:'вы',pos:'PRON'},
  'я':{lemma:'я',pos:'PRON'},'его':{lemma:'он',pos:'PRON'},'ее':{lemma:'она',pos:'PRON'},'её':{lemma:'она',pos:'PRON'},
  'их':{lemma:'они',pos:'PRON'},'все':{lemma:'весь',pos:'DET'},'всё':{lemma:'весь',pos:'DET'},'один':{lemma:'один',pos:'NUM'}
};

var FORMS={};
function addForms(lemma,pos,forms){
  Object.keys(forms).forEach(function(surface){
    FORMS[surface]={lemma:lemma,pos:pos,features:forms[surface]||{}};
  });
}
function nominal(gender,caseName,number){ return {gender:gender,case:caseName,number:number||'Sing'}; }
function verb(tense,number,gender,person,verbForm){
  var out={tense:tense,number:number||null,gender:gender||null,person:person||null,verbForm:verbForm||'Fin'};
  Object.keys(out).forEach(function(key){ if(out[key]===null) delete out[key]; });
  return out;
}

addForms('ключ','NOUN',{'ключ':nominal('Masc','NOM|ACC'),'ключа':nominal('Masc','GEN'),'ключом':nominal('Masc','INS'),'ключе':nominal('Masc','PREP'),'ключи':nominal(null,'NOM|ACC','Plur')});
addForms('замок','NOUN',{'замок':nominal('Masc','NOM|ACC'),'замка':nominal('Masc','GEN'),'замком':nominal('Masc','INS'),'замке':nominal('Masc','PREP')});
addForms('лук','NOUN',{'лук':nominal('Masc','NOM|ACC'),'лука':nominal('Masc','GEN'),'луком':nominal('Masc','INS'),'луке':nominal('Masc','PREP')});
addForms('мир','NOUN',{'мир':nominal('Masc','NOM|ACC'),'мира':nominal('Masc','GEN'),'миром':nominal('Masc','INS'),'мире':nominal('Masc','PREP')});
addForms('мост','NOUN',{'мост':nominal('Masc','NOM|ACC'),'моста':nominal('Masc','GEN'),'мостом':nominal('Masc','INS'),'мосту':nominal('Masc','DAT'),'мосте':nominal('Masc','PREP')});
addForms('карта','NOUN',{'карта':nominal('Fem','NOM'),'карту':nominal('Fem','ACC'),'карты':nominal('Fem','GEN'),'картой':nominal('Fem','INS'),'карте':nominal('Fem','DAT|PREP')});
addForms('книга','NOUN',{'книга':nominal('Fem','NOM'),'книгу':nominal('Fem','ACC'),'книги':nominal('Fem','GEN'),'книгой':nominal('Fem','INS'),'книге':nominal('Fem','DAT|PREP')});
addForms('река','NOUN',{'река':nominal('Fem','NOM'),'реку':nominal('Fem','ACC'),'реки':nominal('Fem','GEN'),'рекой':nominal('Fem','INS'),'реке':nominal('Fem','DAT|PREP')});
addForms('дверь','NOUN',{'дверь':nominal('Fem','NOM|ACC'),'двери':nominal('Fem','GEN|DAT|PREP'),'дверью':nominal('Fem','INS')});
addForms('земля','NOUN',{'земля':nominal('Fem','NOM'),'землю':nominal('Fem','ACC'),'земли':nominal('Fem','GEN'),'землей':nominal('Fem','INS'),'землёй':nominal('Fem','INS')});
addForms('грядка','NOUN',{'грядка':nominal('Fem','NOM'),'грядку':nominal('Fem','ACC'),'грядке':nominal('Fem','DAT|PREP'),'грядки':nominal('Fem','GEN')});
addForms('стрела','NOUN',{'стрела':nominal('Fem','NOM'),'стрелу':nominal('Fem','ACC'),'стрелы':nominal('Fem','GEN'),'стрелой':nominal('Fem','INS')});
addForms('задача','NOUN',{'задача':nominal('Fem','NOM'),'задачу':nominal('Fem','ACC'),'задачи':nominal('Fem','GEN'),'задачей':nominal('Fem','INS')});
addForms('договор','NOUN',{'договор':nominal('Masc','NOM|ACC'),'договора':nominal('Masc','GEN'),'договором':nominal('Masc','INS')});

addForms('старый','ADJ',{'старый':nominal('Masc','NOM'),'старого':nominal('Masc','GEN|ACC'),'старому':nominal('Masc','DAT'),'старым':nominal('Masc','INS'),'старая':nominal('Fem','NOM'),'старую':nominal('Fem','ACC'),'старой':nominal('Fem','GEN|DAT|INS|PREP'),'старое':nominal('Neut','NOM|ACC'),'старые':nominal(null,'NOM|ACC','Plur')});
addForms('новый','ADJ',{'новый':nominal('Masc','NOM'),'нового':nominal('Masc','GEN|ACC'),'новому':nominal('Masc','DAT'),'новым':nominal('Masc','INS'),'новая':nominal('Fem','NOM'),'новую':nominal('Fem','ACC'),'новой':nominal('Fem','GEN|DAT|INS|PREP'),'новое':nominal('Neut','NOM|ACC'),'новые':nominal(null,'NOM|ACC','Plur')});
addForms('главный','ADJ',{'главный':nominal('Masc','NOM'),'главная':nominal('Fem','NOM'),'главное':nominal('Neut','NOM|ACC'),'главные':nominal(null,'NOM|ACC','Plur')});
addForms('общий','ADJ',{'общий':nominal('Masc','NOM'),'общая':nominal('Fem','NOM'),'общее':nominal('Neut','NOM|ACC'),'общие':nominal(null,'NOM|ACC','Plur')});

addForms('открыть','VERB',{'открыть':verb(null,null,null,null,'Inf'),'открыл':verb('Past','Sing','Masc'),'открыла':verb('Past','Sing','Fem'),'открыло':verb('Past','Sing','Neut'),'открыли':verb('Past','Plur'),'открывает':verb('Pres','Sing',null,'3')});
addForms('журчать','VERB',{'журчать':verb(null,null,null,null,'Inf'),'журчит':verb('Pres','Sing',null,'3'),'журчат':verb('Pres','Plur',null,'3')});
addForms('читать','VERB',{'читать':verb(null,null,null,null,'Inf'),'читает':verb('Pres','Sing',null,'3'),'читают':verb('Pres','Plur',null,'3'),'читал':verb('Past','Sing','Masc'),'читала':verb('Past','Sing','Fem')});
addForms('расти','VERB',{'расти':verb(null,null,null,null,'Inf'),'растет':verb('Pres','Sing',null,'3'),'растёт':verb('Pres','Sing',null,'3'),'вырос':verb('Past','Sing','Masc'),'выросла':verb('Past','Sing','Fem'),'выросли':verb('Past','Plur')});
addForms('выпустить','VERB',{'выпустить':verb(null,null,null,null,'Inf'),'выпустил':verb('Past','Sing','Masc'),'выпустила':verb('Past','Sing','Fem'),'выпустили':verb('Past','Plur')});
addForms('лежать','VERB',{'лежать':verb(null,null,null,null,'Inf'),'лежит':verb('Pres','Sing',null,'3'),'лежат':verb('Pres','Plur',null,'3')});
addForms('продолжать','VERB',{'продолжать':verb(null,null,null,null,'Inf'),'продолжает':verb('Pres','Sing',null,'3'),'продолжают':verb('Pres','Plur',null,'3'),'продолжить':verb(null,null,null,null,'Inf')});
addForms('вести','VERB',{'вести':verb(null,null,null,null,'Inf'),'ведет':verb('Pres','Sing',null,'3'),'ведёт':verb('Pres','Sing',null,'3'),'ведут':verb('Pres','Plur',null,'3'),'вел':verb('Past','Sing','Masc'),'вёл':verb('Past','Sing','Masc')});
addForms('подписать','VERB',{'подписать':verb(null,null,null,null,'Inf'),'подписал':verb('Past','Sing','Masc'),'подписала':verb('Past','Sing','Fem'),'подписали':verb('Past','Plur')});

var SENSES={
  'ключ':[
    {senseId:'key.object',label:'предмет для замка',cues:['замок','двер','откр','потер','карман','металл']},
    {senseId:'key.spring',label:'водный источник',cues:['вода','родник','источник','журч','земл','река']},
    {senseId:'key.solution',label:'решение или шифр',cues:['задач','решен','шифр','код','ответ','метод']}
  ],
  'замок':[
    {senseId:'lock.device',label:'запирающее устройство',cues:['ключ','двер','откр','закр','металл']},
    {senseId:'castle.building',label:'крепость или дворец',cues:['башн','стен','корол','рыцар','крепост','дворец']}
  ],
  'лук':[
    {senseId:'bow.weapon',label:'оружие со стрелой',cues:['стрел','тетив','выстрел','мишен','выпуст']},
    {senseId:'onion.plant',label:'овощное растение',cues:['гряд','овощ','рос','вырос','зелень','саж']}
  ],
  'мир':[
    {senseId:'world.reality',label:'мир как пространство жизни',cues:['планет','земл','стран','вселен','люд']},
    {senseId:'peace.state',label:'мир как отсутствие войны',cues:['войн','договор','перемир','подпис','соглаш']}
  ]
};

var VALENCY={
  'читать':[{relation:'obj',pos:'NOUN',case:'ACC',required:true,label:'что читать'}],
  'открыть':[{relation:'obj',pos:'NOUN',case:'ACC',required:true,label:'что открыть'}],
  'выпустить':[{relation:'obj',pos:'NOUN',case:'ACC',required:true,label:'что выпустить'}],
  'продолжать':[{relation:'obj',pos:'NOUN',case:'ACC',required:true,label:'что продолжать'}],
  'подписать':[{relation:'obj',pos:'NOUN',case:'ACC',required:true,label:'что подписать'}]
};

function core(){ return global.MRDSemanticCore||null; }
function clamp01(value){ value=Number(value); return isFinite(value)?Math.max(0,Math.min(1,value)):0; }
function normalize(value){ return String(value||'').toLowerCase().replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi,''); }
function hash(value){
  var c=core(); if(c&&typeof c.hash==='function') return c.hash(String(value||''));
  var text=String(value||''), out=2166136261>>>0;
  for(var i=0;i<text.length;i++){ out^=text.charCodeAt(i); out=Math.imul(out,16777619); }
  return out>>>0;
}
function clone(value){
  var out={}; Object.keys(value||{}).forEach(function(key){ out[key]=value[key]; }); return out;
}
function rawOccurrences(text){
  var source=String(text||''), regex=/[A-Za-zА-Яа-яЁё0-9]+/g, out=[], match, last=0, sentence=0;
  while((match=regex.exec(source))){
    var gap=source.slice(last,match.index), boundaries=gap.match(/[.!?]+/g);
    if(boundaries) sentence+=boundaries.length;
    out.push({raw:match[0],token:normalize(match[0]),index:out.length,offset:match.index,sentence:sentence});
    last=regex.lastIndex;
  }
  return out;
}
function inferPos(token){
  if(/^\d+(?:[.,]\d+)?$/.test(token)) return 'NUM';
  if(/(ться|ть|ти|чь)$/.test(token)) return 'VERB';
  if(/(ет|ёт|ит|ут|ют|ат|ят|ешь|ишь|ем|им|ете|ите)$/.test(token)) return 'VERB';
  if(/(ый|ий|ой|ая|яя|ое|ее|ые|ие|ого|его|ому|ему|ую|юю|ым|им)$/.test(token)) return 'ADJ';
  if(/(о|е)$/.test(token)&&token.length>4) return 'ADV';
  return token.length>1?'NOUN':'X';
}
function inferFeatures(token,pos){
  if(pos==='ADJ'){
    if(/(ая|яя)$/.test(token)) return nominal('Fem','NOM');
    if(/(ую|юю)$/.test(token)) return nominal('Fem','ACC');
    if(/(ое|ее)$/.test(token)) return nominal('Neut','NOM|ACC');
    if(/(ые|ие)$/.test(token)) return nominal(null,'NOM|ACC','Plur');
    if(/(ый|ий|ой)$/.test(token)) return nominal('Masc','NOM');
  }
  if(pos==='VERB'){
    if(/(ться|ть|ти|чь)$/.test(token)) return verb(null,null,null,null,'Inf');
    if(/ла$/.test(token)) return verb('Past','Sing','Fem');
    if(/ло$/.test(token)) return verb('Past','Sing','Neut');
    if(/ли$/.test(token)) return verb('Past','Plur');
    if(/л$/.test(token)) return verb('Past','Sing','Masc');
    if(/(ут|ют|ат|ят)$/.test(token)) return verb('Pres','Plur',null,'3');
    if(/(ет|ёт|ит)$/.test(token)) return verb('Pres','Sing',null,'3');
  }
  return {};
}
function entryMatch(token,form){
  var c=core(), entry=c&&typeof c.lookup==='function'?c.lookup(token):null, match='oov';
  if(form) match='morph';
  if(entry){
    if(token===entry.lemma) match='exact';
    else if((entry.aliases||[]).indexOf(token)>=0) match='alias';
    else match='stem';
  }
  return {entry:entry,match:match};
}
function annotate(raw){
  var token=raw.token, fn=FUNCTION_WORDS[token], form=FORMS[token], matched=entryMatch(token,form), entry=matched.entry;
  var lemma=fn?fn.lemma:(form?form.lemma:(entry?entry.lemma:token));
  var pos=fn?fn.pos:(form?form.pos:inferPos(token));
  var features=fn?{}:(form?clone(form.features):inferFeatures(token,pos));
  var match=fn?'function':matched.match, confidence=fn?1:(form?.96:(entry?.88:.28));
  return {
    raw:raw.raw,token:token,index:raw.index,offset:raw.offset,sentence:raw.sentence,
    lemma:lemma,pos:pos,features:features,match:match,confidence:confidence,
    role:entry?entry.role:'neutral',scale:entry?entry.scale:null,
    functionWord:!!fn,negation:token==='не'||token==='ни'||token==='нет'||token==='без',
    senseStatus:SENSES[lemma]?'PENDING':'NONE',senseId:null,senseConfidence:0
  };
}
function hasStem(word,stems){
  word=String(word||'');
  for(var i=0;i<(stems||[]).length;i++) if(word.indexOf(stems[i])>=0) return true;
  return false;
}
function resolveSenses(occurrences){
  var ambiguities=[];
  for(var i=0;i<occurrences.length;i++){
    var item=occurrences[i], inventory=SENSES[item.lemma]; if(!inventory) continue;
    var scored=inventory.map(function(sense){
      var score=0, witnesses=[];
      for(var j=0;j<occurrences.length;j++){
        var context=occurrences[j];
        if(j===i||context.sentence!==item.sentence||context.functionWord) continue;
        if(hasStem(context.token,sense.cues)||hasStem(context.lemma,sense.cues)){
          var distance=Math.max(1,Math.abs(j-i)), weight=1+.20/distance;
          score+=weight; witnesses.push({token:context.token,index:context.index,weight:Number(weight.toFixed(3))});
        }
      }
      return {senseId:sense.senseId,label:sense.label,score:Number(score.toFixed(3)),witnesses:witnesses};
    }).sort(function(a,b){ return b.score-a.score || (a.senseId<b.senseId?-1:1); });
    var top=scored[0]||{score:0}, second=scored[1]||{score:0}, margin=top.score-second.score;
    var resolved=top.score>=.75&&margin>=.35, confidence=resolved?clamp01(.55+Math.min(.28,top.score*.11)+Math.min(.17,margin*.09)):0;
    item.senseStatus=resolved?'RESOLVED':'AMBIGUOUS'; item.senseId=resolved?top.senseId:null; item.senseConfidence=confidence;
    item.senseCandidates=scored;
    ambiguities.push({token:item.token,lemma:item.lemma,index:item.index,resolved:resolved,senseId:item.senseId,confidence:confidence,candidates:scored});
  }
  return ambiguities;
}
function caseParts(value){ return String(value||'').split('|').filter(Boolean); }
function compatible(left,right){
  if(!left||!right) return null;
  var a=caseParts(left), b=caseParts(right);
  for(var i=0;i<a.length;i++) if(b.indexOf(a[i])>=0) return true;
  return false;
}
function agreementChecks(occurrences){
  var checks=[], dependencies=[];
  for(var i=0;i<occurrences.length-1;i++){
    var adjective=occurrences[i], noun=occurrences[i+1];
    if(adjective.sentence!==noun.sentence||adjective.pos!=='ADJ'||noun.pos!=='NOUN') continue;
    var issues=[], known=0, af=adjective.features||{}, nf=noun.features||{};
    if(af.number&&nf.number){ known++; if(af.number!==nf.number) issues.push('number'); }
    if(af.number!=='Plur'&&nf.number!=='Plur'&&af.gender&&nf.gender){ known++; if(af.gender!==nf.gender) issues.push('gender'); }
    var caseMatch=compatible(af.case,nf.case); if(caseMatch!==null){ known++; if(!caseMatch) issues.push('case'); }
    var status=issues.length?'FAIL':(known?'PASS':'UNKNOWN'), score=status==='PASS'?1:(status==='FAIL'?0:.5);
    checks.push({type:'agreement',relation:'amod',headIndex:noun.index,dependentIndex:adjective.index,status:status,score:score,known:known,issues:issues,reason:issues.length?'не совпадают '+issues.join(', '):'форма прилагательного согласуется с существительным'});
    dependencies.push({relation:'amod',headIndex:noun.index,dependentIndex:adjective.index,status:status,confidence:known?clamp01(.55+known*.14):.25});
  }
  return {checks:checks,dependencies:dependencies};
}
function nextNominal(occurrences,start,sentence){
  for(var i=start+1;i<occurrences.length&&i<=start+5;i++){
    if(occurrences[i].sentence!==sentence) break;
    if(occurrences[i].pos==='NOUN'||occurrences[i].pos==='PRON') return occurrences[i];
  }
  return null;
}
function valencyChecks(occurrences){
  var checks=[], dependencies=[], open=[];
  for(var i=0;i<occurrences.length;i++){
    var head=occurrences[i], frames=VALENCY[head.lemma]; if(head.pos!=='VERB'||!frames) continue;
    for(var f=0;f<frames.length;f++){
      var frame=frames[f], target=nextNominal(occurrences,i,head.sentence), status='OPEN', score=.65, actualCase=target&&target.features&&target.features.case||null;
      if(target){
        var fits=compatible(actualCase,frame.case);
        status=fits===true?'PASS':(fits===false?'FAIL':'UNKNOWN'); score=status==='PASS'?1:(status==='FAIL'?0:.5);
      }
      var check={type:'valency',relation:frame.relation,headIndex:head.index,dependentIndex:target?target.index:null,status:status,score:score,expected:{pos:frame.pos,case:frame.case},actual:target?{pos:target.pos,case:actualCase,lemma:target.lemma}:null,label:frame.label};
      checks.push(check);
      if(target) dependencies.push({relation:frame.relation,headIndex:head.index,dependentIndex:target.index,status:status,confidence:status==='PASS'?.88:(status==='FAIL'?.82:.35)});
      else open.push({headIndex:head.index,lemma:head.lemma,relation:frame.relation,expected:check.expected,label:frame.label});
    }
  }
  return {checks:checks,dependencies:dependencies,open:open};
}
function subjectDependencies(occurrences){
  var out=[];
  for(var i=0;i<occurrences.length;i++){
    var verbItem=occurrences[i]; if(verbItem.pos!=='VERB') continue;
    for(var j=i-1;j>=0&&j>=i-4;j--){
      var candidate=occurrences[j]; if(candidate.sentence!==verbItem.sentence) break;
      if(candidate.pos!=='NOUN'&&candidate.pos!=='PRON') continue;
      var caseName=candidate.features&&candidate.features.case, fits=!caseName||compatible(caseName,'NOM')!==false;
      if(fits) out.push({relation:'nsubj',headIndex:verbItem.index,dependentIndex:candidate.index,status:caseName?'PASS':'UNKNOWN',confidence:caseName?.78:.42});
      break;
    }
  }
  return out;
}
function grammarPack(occurrences){
  var agreement=agreementChecks(occurrences), valency=valencyChecks(occurrences), checks=agreement.checks.concat(valency.checks);
  var failures=checks.filter(function(item){return item.status==='FAIL';}), open=valency.open;
  var known=checks.filter(function(item){return item.status==='PASS'||item.status==='FAIL';}).length;
  var sum=0; checks.forEach(function(item){sum+=item.score;});
  var score=checks.length?clamp01(sum/checks.length):1;
  var status=failures.length?'CONFLICT':(open.length?'OPEN':(known?'PASS':'UNKNOWN'));
  return {
    status:status,score:score,checks:checks,failures:failures,openValencies:open,
    dependencies:agreement.dependencies.concat(valency.dependencies,subjectDependencies(occurrences)),
    metrics:{checks:checks.length,known:known,failed:failures.length,open:open.length,agreement:agreement.checks.length,valency:valency.checks.length},
    evidenceLevel:'HEURISTIC',soundness:'NOT_COMPUTED'
  };
}
function analyze(text){
  var source=String(text||''), raw=rawOccurrences(source), occurrences=raw.map(annotate), ambiguities=resolveSenses(occurrences);
  var content=occurrences.filter(function(item){return item.token.length>=2&&!item.functionWord;}), recognized=content.filter(function(item){return item.match!=='oov';});
  var provenance={exact:0,alias:0,stem:0,morph:0,function:0,oov:0};
  occurrences.forEach(function(item){ provenance[item.match]=(provenance[item.match]||0)+1; });
  var grammar=grammarPack(occurrences), coverage=content.length?recognized.length/content.length:0;
  var status=!occurrences.length?'EMPTY':(coverage>=.60?'READY':'PARTIAL');
  return {
    version:VERSION,kind:'MRDSemanticLanguageAnalysis',mode:'RULE_BASED_MINI_RU',status:status,text:source,
    occurrences:occurrences,contentCount:content.length,recognizedCount:recognized.length,coverage:coverage,
    ambiguities:ambiguities,grammar:grammar,provenance:provenance,
    occurrenceHash:hash(occurrences.map(function(item){return item.token+'@'+item.index;}).join('|')),
    formula:FORMULA,evidenceLevel:'HEURISTIC',soundness:'NOT_COMPUTED',
    limits:['русский мини-словарь','эвристические окончания','ограниченные agreement/valency','не является полным dependency parser']
  };
}

global.MRDSemanticLanguage={
  version:VERSION,formula:FORMULA,analyze:analyze,tokenize:rawOccurrences,annotate:annotate,
  constants:{mode:'RULE_BASED_MINI_RU',senseLemmas:Object.keys(SENSES),formCount:Object.keys(FORMS).length,valencyLemmas:Object.keys(VALENCY)}
};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
