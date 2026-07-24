(function(global){
'use strict';

var VERSION='1.1.0';
var PARSER_ID='p78:parser:controlled-russian';
var Canonical=global.MRDP78CanonicalJSON;
var Language=global.MRDSemanticLanguage;
var Lexicon=global.MRDP78ControlledRussianLexicon;
var ClaimIR=global.MRDP78ClaimIR;

if(!Canonical||!Language||!Lexicon||Lexicon.status!=='READY'||!ClaimIR||ClaimIR.status!=='READY'){
  global.MRDP78LinguisticParserAdapter=Object.freeze({version:VERSION,status:'BLOCKED',code:'CLAIM_PARSER_DEPENDENCY_UNAVAILABLE'});
  return;
}

var freeze=Canonical.deepFreeze;
var own=Object.prototype.hasOwnProperty;
var MAX_CLAIM_CODE_UNITS=8192;
var OVERFLOW_HASH_CHUNK_CODE_UNITS=4096;
var CONTROL={
  'и':1,'а':1,'но':1,'или':1,'не':1,'ни':1,'нет':1,'без':1,'в':1,'во':1,'на':1,'к':1,'ко':1,'с':1,'со':1,
  'из':1,'от':1,'по':1,'под':1,'над':1,'при':1,'через':1,'между':1,'для':1,'до':1,'после':1,'вокруг':1,
  'что':1,'ли':1,'если':1,'как':1,'это':1,'один':1,'одна':1,'одно':1,'некоторые':1,'все':1,'всё':1,
  'каждый':1,'каждая':1,'большинство':1,'сейчас':1,'сегодня':1,'затем':1,'потом':1,
  'возможно':1,'вероятно':1,'может':1,'могут':1,'предположительно':1,'согласно':1,'данным':1,
  'сообщает':1,'сообщают':1,'следовательно':1,'поэтому':1,'получено':1,'выведено':1,
  'означает':1,'интерпретируется':1
};
var BROAD={
  AGENT:['SYSTEM','SEMANTIC_SYSTEM','DOCUMENT','SOURCE','ENTITY'],
  ENTITY:['ENTITY','SYSTEM','OBJECT','PARTICLE','UNIT','SEMANTIC_ENTITY'],
  PROCESS:['PROCESS','OPERATION','SEMANTIC_PROCESS','PHYSICAL_PROCESS','TEXT_OPERATION'],
  INFORMATION:['INFORMATION','CONTENT','DATA','TEXT','DOCUMENT','CLAIM'],
  STATE:['STATE','ABSTRACT_STATE'],
  CLAIM:['CLAIM','FORMULA','DOCUMENT','EVIDENCE_TARGET'],
  WHOLE:['WHOLE','SYSTEM','TEXT','COLLECTION','DOCUMENT'],
  PART:['PART','DETAIL','TEXT_UNIT','UNIT'],
  PLACE:['PLACE','BOUNDARY','PATH','GEOMETRY','TOPOLOGY'],
  CONDITION:['CONDITION','CONSTRAINT','RULE','QUALIFIER'],
  METHOD:['METHOD','OPERATION','FORMULA','VERIFICATION'],
  PROPERTY:['PROPERTY','STATE','MEASURE','CONTINUITY'],
  RESULT:['RESULT','STATE','WHOLE','CONCEPT'],
  CAUSE:['CAUSE','CONDITION','EVENT','STATE'],
  EFFECT:['EFFECT','RESULT','STATE','PROCESS'],
  SOURCE:['SOURCE','DOCUMENT','EVIDENCE'],
  EVIDENCE:['EVIDENCE','SOURCE','DOCUMENT'],
  PATH:['PATH','ORBIT','TRAJECTORY','TOPOLOGY'],
  BOUNDARY:['BOUNDARY','RESULT','STATE'],
  MEASURE:['MEASURE','PARAMETER','VALUE'],
  TEXT:['TEXT','DOCUMENT','TEXT_UNIT','CLAIM']
};
var PREPOSITION_HINTS={
  PATH:['по'],AROUND:['вокруг'],CONTAINER:['в','во','из'],CONDITION:['от','при','если'],PART:['из','на'],
  RESULT:['в','во'],METHOD:['через','по'],PLACE:['в','во','на'],POPULATION:['для'],TIME:['после','до']
};

function lower(value){ return String(value||'').toLocaleLowerCase('ru-RU'); }
function exactKeys(value,allowed){
  Object.keys(value||{}).forEach(function(key){ if(!allowed[key]) throw Object.assign(new TypeError('unknown option '+key),{code:'UNKNOWN_FIELD'}); });
}
function spanId(textHash,start,end){
  return 'span:'+Canonical.hashCanonical({schema:'meridian.claim-source-span/1',textHash:textHash,start:start,end:end}).slice(7);
}
function resolveToken(token){
  var outcome=Lexicon.resolveExact(token,Lexicon.lexiconHash),senses=[];
  (outcome.candidates||[]).forEach(function(ref){
    var sense=Lexicon.getSense(ref.senseId);
    if(sense) senses.push(sense);
  });
  return {status:outcome.status,code:outcome.code,senses:senses};
}
function ontologyScore(types,allowed,pos){
  var best=0,i,j,type,want,related;
  for(i=0;i<types.length;i++){
    type=types[i];
    for(j=0;j<allowed.length;j++){
      want=allowed[j];
      if(type===want) best=Math.max(best,10);
      else if(type.indexOf(want)!==-1||want.indexOf(type)!==-1) best=Math.max(best,7);
      related=BROAD[want]||[];
      if(related.indexOf(type)!==-1) best=Math.max(best,6);
    }
  }
  if(!best&&allowed.indexOf('ENTITY')!==-1&&(pos==='NOUN'||pos==='PROPER_NOUN')) best=3;
  return best;
}
function precedingToken(tokens,index){ return index>0?tokens[index-1].token:''; }
function roleHintScore(role,token,tokens){
  var hints=PREPOSITION_HINTS[role.role]||[],before=precedingToken(tokens,token.index);
  return hints.indexOf(before)!==-1?3:0;
}
function positionScore(roleIndex,token,predicateIndex){
  if(roleIndex===0) return token.index<predicateIndex?3:-1;
  return token.index>predicateIndex?3:-1;
}
function candidateScore(role,roleIndex,candidate,predicateIndex,tokens){
  return ontologyScore(candidate.sense.ontologyTypes,role.ontologyTypes,candidate.sense.pos)*10+
    positionScore(roleIndex,candidate.token,predicateIndex)+roleHintScore(role,candidate.token,tokens)-Math.abs(candidate.token.index-predicateIndex)*0.01;
}
function quantifier(tokens){
  var values=tokens.map(function(item){ return item.token; });
  var singular=['один','одна','одно'];
  if(values.indexOf('ни')!==-1&&singular.some(function(value){ return values.indexOf(value)!==-1; })) return 'NONE';
  if(values.indexOf('все')!==-1||values.indexOf('всё')!==-1||values.indexOf('каждый')!==-1||values.indexOf('каждая')!==-1) return 'ALL';
  if(values.indexOf('большинство')!==-1) return 'MOST';
  if(values.indexOf('некоторые')!==-1) return 'SOME';
  if(values.indexOf('один')!==-1||values.indexOf('одна')!==-1||values.indexOf('одно')!==-1) return 'ONE';
  return 'UNSPECIFIED';
}
function modality(tokens){
  var text=tokens.map(function(item){return item.token;}).join(' ');
  if(/(?:возможно|вероятно|может|могут|предположительно)/.test(text)) return 'HYPOTHESIS';
  if(/(?:согласно|данным|сообщает|сообщают)/.test(text)) return 'REPORTED';
  if(/(?:следовательно|поэтому|получено|выведено)/.test(text)) return 'DERIVED';
  if(/(?:означает|интерпретируется)/.test(text)) return 'INTERPRETATION';
  return 'FACT';
}
function polarity(tokens,predicateIndex){
  var start=Math.max(0,predicateIndex-2),i;
  for(i=start;i<predicateIndex;i++) if(tokens[i].token==='не'||tokens[i].token==='ни'||tokens[i].token==='нет') return 'NEGATIVE';
  return 'POSITIVE';
}
function qualifierValue(tokens,markerIndex){
  var values=[],i;
  for(i=markerIndex+1;i<tokens.length&&values.length<4;i++){
    if(tokens[i].token==='и'||tokens[i].token==='но') break;
    values.push(tokens[i].raw);
  }
  return values.join(' ').trim();
}
function qualifiers(tokens,resolutions){
  var result={},i,token,next,knownTypes;
  for(i=0;i<tokens.length;i++){
    token=tokens[i].token; next=tokens[i+1];
    if((token==='сейчас'||token==='сегодня'||token==='затем'||token==='потом')) result.time=tokens[i].raw;
    else if((token==='после'||token==='до')&&next) result.time=qualifierValue(tokens,i);
    else if(token==='если'||token==='при') result.condition=qualifierValue(tokens,i);
    else if(token==='для'&&next) result.population=qualifierValue(tokens,i);
    else if(token==='через'&&next) result.method=qualifierValue(tokens,i);
    else if((token==='в'||token==='во'||token==='на')&&next){
      knownTypes=(resolutions[next.index]&&resolutions[next.index].senses||[]).reduce(function(all,sense){ return all.concat(sense.ontologyTypes); },[]);
      if(knownTypes.some(function(type){ return BROAD.PLACE.indexOf(type)!==-1||type.indexOf('PLACE')!==-1; })) result.place=next.raw;
    }
    if(/^\d+(?:[.,]\d+)?$/.test(token)) result.measure=tokens[i].raw+(next?' '+next.raw:'');
  }
  return result;
}
function predicateMatches(tokens){
  var matches=[];
  Lexicon.predicateFrames.forEach(function(frame){
    var forms=frame.surfaceForms.map(lower);
    tokens.forEach(function(token){
      if(forms.indexOf(token.token)!==-1) matches.push({frame:frame,token:token});
    });
  });
  matches.sort(function(a,b){ return a.token.index-b.token.index||a.frame.predicateId.localeCompare(b.frame.predicateId); });
  return matches;
}
function templateParts(template){
  var parts=[],match,pattern=/\{([A-Z][A-Z0-9_]*)\}|[A-Za-zА-Яа-яЁё0-9]+/g;
  while((match=pattern.exec(template))) parts.push(match[1]?{role:match[1]}:{literal:lower(match[0])});
  return parts;
}
function matchPatternTemplate(pattern,tokens){
  var parts=templateParts(pattern.surfaceTemplate),bindings={},i,part;
  if(parts.length!==tokens.length) return null;
  for(i=0;i<parts.length;i++){
    part=parts[i];
    if(part.literal){ if(tokens[i].token!==part.literal) return null; }
    else{
      if(bindings[part.role]) return null;
      bindings[part.role]=tokens[i];
    }
  }
  for(i=0;i<pattern.roles.length;i++) if(!bindings[pattern.roles[i]]) return null;
  return {pattern:pattern,frame:Lexicon.getPredicateFrame(pattern.predicateRef.predicateId),bindings:bindings};
}
function exactTemplateMatches(tokens){
  var matches=[];
  Lexicon.structuralPatterns.forEach(function(pattern){
    var match=matchPatternTemplate(pattern,tokens);
    if(match&&match.frame) matches.push(match);
  });
  matches.sort(function(a,b){ return a.pattern.patternId.localeCompare(b.pattern.patternId); });
  return matches;
}
function contextualSense(frame,role,token,bindings,resolution){
  var wanted=null,i,around,hasCandidate=function(list,id){
    return list.some(function(item){ return item.senseId===id; });
  };
  if(frame.predicateId==='p78:predicate:rotate'&&role.role==='AROUND'&&hasCandidate(resolution.senses,'p78:sense:center.geometry')) wanted='p78:sense:center.geometry';
  if(frame.predicateId==='p78:predicate:rotate'&&role.role==='THEME'&&hasCandidate(resolution.senses,'p78:sense:ring.semantic')&&bindings.AROUND){
    around=resolveToken(bindings.AROUND.token);
    if(hasCandidate(around.senses,'p78:sense:center.geometry')) wanted='p78:sense:ring.semantic';
  }
  if(!wanted) return null;
  for(i=0;i<resolution.senses.length;i++) if(resolution.senses[i].senseId===wanted) return resolution.senses[i];
  return null;
}
function ontologyUnion(senses){
  var seen={},types=[];
  senses.forEach(function(sense){
    sense.ontologyTypes.forEach(function(type){ if(!seen[type]){ seen[type]=true; types.push(type); } });
  });
  return types.sort();
}
function buildTemplateArguments(match,textHash,issues){
  var argumentsOut=[],surfaces={},used={},i,role,token,resolution,sense,span,candidates;
  for(i=0;i<match.pattern.roles.length;i++){
    role=match.frame.roles.filter(function(item){ return item.role===match.pattern.roles[i]; })[0];
    token=match.bindings[match.pattern.roles[i]];
    if(!role||!token){ issues.push(issue('REQUIRED_ROLE_OPEN',null,match.pattern.roles[i])); continue; }
    resolution=resolveToken(token.token); sense=null;
    if(resolution.status==='RESOLVED'&&resolution.senses.length===1) sense=resolution.senses[0];
    else if(resolution.status==='AMBIGUOUS'){
      sense=contextualSense(match.frame,role,token,match.bindings,resolution);
      if(!sense){
        candidates=resolution.senses.map(function(item){ return item.senseId; }).sort();
        issues.push(issue('ROLE_AMBIGUOUS',token.token,role.role+':'+candidates.join(',')));
      }
    }else issues.push(issue('OOV_TOKEN',token.token,role.role));
    span=spanId(textHash,token.offset,token.offset+token.raw.length); surfaces[span]=token.raw; used[token.index]=true;
    argumentsOut.push({role:role.role,surfaceSpanId:span,entityId:null,senseId:sense?sense.senseId:null,ontologyTypes:sense?sense.ontologyTypes.slice():ontologyUnion(resolution.senses)});
  }
  return {arguments:argumentsOut,surfaces:surfaces,used:used};
}
function issue(code,token,detail){ return {code:code,token:token||null,detail:detail||''}; }
function failure(status,code,textHash,issues){
  var payload={
    schema:'meridian.claim-parse-result/1',version:VERSION,status:status,code:code,resolutionStatus:status==='AMBIGUOUS'?'AMBIGUOUS':'OOV',
    parserRef:{id:PARSER_ID,version:VERSION},lexiconHash:Lexicon.lexiconHash,inputHash:textHash,claimAst:null,
    surfaceBySpanId:{},tokens:[],dependencies:[],issues:issues||[],evidenceStatus:'NOT_COMPUTED',semanticTruth:false,soundness:'NOT_COMPUTED'
  };
  payload.resultHash=Canonical.hashCanonical(payload);
  return freeze(payload);
}
function buildArguments(frame,predicateToken,tokens,resolutions,textHash,issues){
  var pool=[],used={},argumentsOut=[],surfaces={},i,j,token,resolution,sense,role,scored,best,ties,span;
  for(i=0;i<tokens.length;i++){
    token=tokens[i];
    if(token.index===predicateToken.index||CONTROL[token.token]) continue;
    resolution=resolutions[token.index];
    if(!resolution||!resolution.senses.length) continue;
    for(j=0;j<resolution.senses.length;j++) pool.push({token:token,sense:resolution.senses[j]});
  }
  for(i=0;i<frame.roles.length;i++){
    role=frame.roles[i];
    scored=pool.filter(function(candidate){ return !used[candidate.token.index]; }).map(function(candidate){
      return {candidate:candidate,score:candidateScore(role,i,candidate,predicateToken.index,tokens)};
    }).filter(function(item){ return item.score>0; }).sort(function(a,b){ return b.score-a.score||a.candidate.token.index-b.candidate.token.index||a.candidate.sense.senseId.localeCompare(b.candidate.sense.senseId); });
    if(!scored.length){
      if(role.required) issues.push(issue('REQUIRED_ROLE_OPEN',null,role.role));
      continue;
    }
    best=scored[0]; ties=scored.filter(function(item){ return Math.abs(item.score-best.score)<0.000001; });
    if(ties.length>1){ issues.push(issue('ROLE_AMBIGUOUS',best.candidate.token.token,role.role)); continue; }
    token=best.candidate.token; sense=best.candidate.sense; used[token.index]=true;
    span=spanId(textHash,token.offset,token.offset+token.raw.length); surfaces[span]=token.raw;
    argumentsOut.push({role:role.role,surfaceSpanId:span,entityId:null,senseId:sense.senseId,ontologyTypes:sense.ontologyTypes.slice()});
  }
  return {arguments:argumentsOut,surfaces:surfaces,used:used};
}
function overflowInputHash(source){
  var state=Canonical.hashCanonical({
    schema:'meridian.claim-input-overflow-chain-seed/1',
    codeUnits:source.length
  });
  var start=0,end,ordinal=0,last,next,chunkHash;
  while(start<source.length){
    end=Math.min(source.length,start+OVERFLOW_HASH_CHUNK_CODE_UNITS);
    if(end<source.length){
      last=source.charCodeAt(end-1);
      next=source.charCodeAt(end);
      if(last>=0xd800&&last<=0xdbff&&next>=0xdc00&&next<=0xdfff) end--;
    }
    chunkHash=Canonical.hashText(source.slice(start,end));
    state=Canonical.hashCanonical({
      schema:'meridian.claim-input-overflow-chain-link/1',
      ordinal:ordinal,start:start,end:end,chunkHash:chunkHash,previousHash:state
    });
    start=end;
    ordinal++;
  }
  return state;
}
function parse(text,rawOptions){
  var options=rawOptions||{},rawSource=String(text||''),source,textHash,analysis,tokens,predicates,templates,templateMatch,frame,predicateToken,claimPolarity,claimModality,claimQualifiers,resolutions={},issues=[],unknown=[],args,claim,resolutionStatus,payload,sourceSpan,i,token,resolution,unbound;
  if(rawSource.length>MAX_CLAIM_CODE_UNITS) return failure('OOV','CLAIM_TEXT_BUDGET_EXCEEDED',overflowInputHash(rawSource),[issue('CLAIM_TEXT_BUDGET_EXCEEDED')]);
  source=rawSource.trim();
  textHash=Canonical.hashText(source);
  try{
    exactKeys(options,{expectedLexiconHash:1,maxTokens:1});
    if(own.call(options,'expectedLexiconHash')&&options.expectedLexiconHash!==Lexicon.lexiconHash) return failure('OOV','STALE_LEXICON',textHash,[issue('STALE_LEXICON')]);
    if(own.call(options,'maxTokens')&&(!Number.isInteger(options.maxTokens)||options.maxTokens<3||options.maxTokens>128)) throw Object.assign(new TypeError('maxTokens invalid'),{code:'INVALID_VALUE'});
    if(!source) return failure('OOV','EMPTY_INPUT',textHash,[issue('EMPTY_INPUT')]);
    analysis=Language.analyze(source); tokens=analysis.occurrences||[];
    if(tokens.length>(options.maxTokens||32)) return failure('OOV','TOKEN_BUDGET_EXCEEDED',textHash,[issue('TOKEN_BUDGET_EXCEEDED')]);
    if(tokens.some(function(item){ return item.sentence!==tokens[0].sentence; })) return failure('AMBIGUOUS','MULTI_SENTENCE_UNSUPPORTED',textHash,[issue('MULTI_SENTENCE_UNSUPPORTED')]);
    templates=exactTemplateMatches(tokens);
    if(templates.length>1) return failure('AMBIGUOUS','MULTIPLE_TEMPLATES',textHash,[issue('MULTIPLE_TEMPLATES')]);
    if(templates.length===1){
      templateMatch=templates[0]; frame=templateMatch.frame;
      args=buildTemplateArguments(templateMatch,textHash,issues);
      claimPolarity=templateMatch.pattern.polarity;
      claimModality=templateMatch.pattern.modality;
      claimQualifiers={};
    }else{
      predicates=predicateMatches(tokens);
      if(!predicates.length) return failure('OOV','PREDICATE_OOV',textHash,[issue('PREDICATE_OOV')]);
      if(predicates.length!==1) return failure('AMBIGUOUS','MULTIPLE_PREDICATES',textHash,[issue('MULTIPLE_PREDICATES')]);
      frame=predicates[0].frame; predicateToken=predicates[0].token;
      for(i=0;i<tokens.length;i++){
        token=tokens[i];
        if(token.index===predicateToken.index||CONTROL[token.token]) continue;
        resolution=resolveToken(token.token); resolutions[token.index]=resolution;
        if(resolution.status==='OOV') unknown.push(token);
      }
      unknown.forEach(function(item){ issues.push(issue('OOV_TOKEN',item.token)); });
      args=buildArguments(frame,predicateToken,tokens,resolutions,textHash,issues);
      unbound=[];
      Object.keys(resolutions).forEach(function(index){
        if(resolutions[index].senses.length&&!args.used[index]) unbound.push(tokens[Number(index)]);
      });
      unbound.forEach(function(item){ issues.push(issue('UNBOUND_TOKEN',item.token)); });
      claimPolarity=polarity(tokens,predicateToken.index);
      claimModality=modality(tokens);
      claimQualifiers=qualifiers(tokens,resolutions);
    }
    if(!args.arguments.length) return failure(unknown.length?'OOV':'AMBIGUOUS','NO_ARGUMENTS',textHash,issues.concat([issue('NO_ARGUMENTS')]));
    resolutionStatus=issues.some(function(item){ return item.code==='OOV_TOKEN'||item.code==='REQUIRED_ROLE_OPEN'; })?'OOV':
      (issues.length?'AMBIGUOUS':'RESOLVED');
    sourceSpan=spanId(textHash,0,source.length);
    claim=ClaimIR.createClaimAst({
      sourceSpanIds:[sourceSpan],
      predicate:{lemma:frame.lemma,senseId:frame.senseRef.senseId,relationTypeId:frame.predicateId},
      arguments:args.arguments,
      quantifier:quantifier(tokens),polarity:claimPolarity,modality:claimModality,
      qualifiers:claimQualifiers,parserRef:{id:PARSER_ID,version:VERSION},resolutionStatus:resolutionStatus
    });
    args.surfaces[sourceSpan]=source;
    payload={
      schema:'meridian.claim-parse-result/1',version:VERSION,status:resolutionStatus==='RESOLVED'?'READY':resolutionStatus,
      code:resolutionStatus==='RESOLVED'?null:resolutionStatus,resolutionStatus:resolutionStatus,parserRef:{id:PARSER_ID,version:VERSION},
      lexiconHash:Lexicon.lexiconHash,inputHash:textHash,claimAst:claim,surfaceBySpanId:args.surfaces,
      tokens:tokens.map(function(item){ return {surface:item.raw,token:item.token,index:item.index,offset:item.offset}; }),
      dependencies:(analysis.grammar&&analysis.grammar.dependencies||[]),issues:issues,
      evidenceStatus:'NOT_COMPUTED',semanticTruth:false,soundness:'NOT_COMPUTED'
    };
    payload.resultHash=Canonical.hashCanonical(payload);
    return freeze(payload);
  }catch(error){
    return failure('OOV',error&&error.code||'INVALID_VALUE',textHash,[issue(error&&error.code||'INVALID_VALUE',null,error&&error.message||String(error))]);
  }
}

global.MRDP78LinguisticParserAdapter=freeze({
  version:VERSION,status:'READY',schema:'meridian.linguistic-parser-adapter/1',parserRef:freeze({id:PARSER_ID,version:VERSION}),
  limits:freeze({maxClaimCodeUnits:MAX_CLAIM_CODE_UNITS,overflowInputHashMode:'CHUNK_CHAIN_SHA256',overflowHashChunkCodeUnits:OVERFLOW_HASH_CHUNK_CODE_UNITS}),
  lexiconHash:Lexicon.lexiconHash,evidenceStatus:'NOT_COMPUTED',semanticTruth:false,soundness:'NOT_COMPUTED',parse:parse,replay:parse
});
})(typeof globalThis!=='undefined'?globalThis:this);
