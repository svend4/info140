(function(global){
'use strict';

var VERSION='1.0.0';
var DEFAULT_TOP_K=3;
var BOUNDED_WEIGHT=.05;
var DEFAULT_URLS={
  vectors:'data/vectors.json',
  phiCalibration:'data/phi_calibration.json',
  adaptiveK:'data/adaptive_k.json'
};
var state=emptySnapshot('UNAVAILABLE',[]);

function core(){ return global.MRDSemanticCore||null; }
function isRecord(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function finite01(value){ value=Number(value); return isFinite(value)&&value>=0&&value<=1; }
function clamp01(value){ value=Number(value); return isFinite(value)?Math.max(0,Math.min(1,value)):0; }
function clean(value){ return String(value||'').replace(/\s+/g,' ').trim(); }
function hash(value){
  var text=String(value||''), out=2166136261>>>0;
  for(var i=0;i<text.length;i++){ out^=text.charCodeAt(i); out=Math.imul(out,16777619); }
  return out>>>0;
}
function hashHex(value){ return ('00000000'+hash(value).toString(16)).slice(-8); }
function stable(value){
  if(Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if(isRecord(value)) return '{'+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+':'+stable(value[key]);}).join(',')+'}';
  return JSON.stringify(value);
}
function clone(value){
  if(value==null||typeof value!=='object') return value;
  if(Array.isArray(value)) return value.map(clone);
  var out={}; Object.keys(value).forEach(function(key){out[key]=clone(value[key]);}); return out;
}
function error(code,asset,detail){ return {code:code,asset:asset||null,detail:clean(detail)||null}; }
function emptySnapshot(status,errors){
  return {
    version:VERSION,kind:'MRDSemanticDataEvidenceSnapshot',status:status||'UNAVAILABLE',
    provider:null,generated:null,vectorCount:0,topK:DEFAULT_TOP_K,boundedWeight:BOUNDED_WEIGHT,
    thresholds:{growth:null,novelty:null},assets:{vectors:false,phiCalibration:false,adaptiveK:false},
    vectors:{},provenance:{scope:'local-mini-corpus',provider:null,generated:null,hash:null},
    errors:errors||[],evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'
  };
}
function validateSparseVector(value){
  if(!isRecord(value)||!Object.keys(value).length) return false;
  return Object.keys(value).every(function(key){return clean(key)&&isFinite(Number(value[key]));});
}
function validateVectors(value){
  if(!isRecord(value)||!isRecord(value.words)) return {ok:false,error:error('DATA_VECTORS_SCHEMA','vectors')};
  var words={}, keys=Object.keys(value.words);
  for(var i=0;i<keys.length;i++){
    var word=clean(keys[i]).toLowerCase(), vector=value.words[keys[i]];
    if(!word||!validateSparseVector(vector)) continue;
    words[word]={};
    Object.keys(vector).sort().forEach(function(key){ words[word][key]=Number(vector[key]); });
  }
  if(Object.keys(words).length<2) return {ok:false,error:error('DATA_VECTORS_EMPTY','vectors')};
  return {ok:true,words:words,provider:clean(value.provider)||'unknown',generated:clean(value.generated)||null,raw:value};
}
function validateCalibration(value){
  var calibrated=value&&value.calibrated;
  if(!isRecord(calibrated)||!finite01(calibrated.tG)||!finite01(calibrated.tN)) return {ok:false,error:error('DATA_CALIBRATION_SCHEMA','phiCalibration')};
  return {ok:true,growth:Number(calibrated.tG),novelty:Number(calibrated.tN),raw:value};
}
function parseArm(value){
  var match=/^K=(\d+)$/.exec(clean(value));
  return match?Number(match[1]):null;
}
function validateAdaptive(value){
  var truth=parseArm(value&&value.true_best), bandit=parseArm(value&&value.bandit_best);
  if(truth==null||bandit==null||value.match!==true||truth!==bandit) return {ok:false,error:error('DATA_ADAPTIVE_SCHEMA','adaptiveK')};
  return {ok:true,topK:Math.max(1,Math.min(5,truth)),raw:value};
}
function buildSnapshot(payloads){
  payloads=payloads||{};
  var vectors=validateVectors(payloads.vectors), calibration=validateCalibration(payloads.phiCalibration), adaptive=validateAdaptive(payloads.adaptiveK), errors=[];
  if(!vectors.ok) errors.push(vectors.error);
  if(!calibration.ok) errors.push(calibration.error);
  if(!adaptive.ok) errors.push(adaptive.error);
  if(!vectors.ok){
    var invalid=emptySnapshot(payloads.vectors==null?'UNAVAILABLE':'INVALID',errors);
    invalid.assets.phiCalibration=!!calibration.ok; invalid.assets.adaptiveK=!!adaptive.ok;
    return invalid;
  }
  var assetHash=hashHex(stable({provider:vectors.provider,generated:vectors.generated,words:vectors.words}));
  return {
    version:VERSION,kind:'MRDSemanticDataEvidenceSnapshot',status:calibration.ok&&adaptive.ok?'READY':'PARTIAL',
    provider:vectors.provider,generated:vectors.generated,vectorCount:Object.keys(vectors.words).length,
    topK:adaptive.ok?adaptive.topK:DEFAULT_TOP_K,boundedWeight:BOUNDED_WEIGHT,
    thresholds:{growth:calibration.ok?calibration.growth:null,novelty:calibration.ok?calibration.novelty:null},
    assets:{vectors:true,phiCalibration:!!calibration.ok,adaptiveK:!!adaptive.ok},vectors:vectors.words,
    provenance:{scope:'local-mini-corpus',provider:vectors.provider,generated:vectors.generated,hash:assetHash},
    errors:errors,evidenceLevel:'LOCAL_CORPUS',soundness:'NOT_COMPUTED'
  };
}
function install(payloads){ state=buildSnapshot(payloads); return snapshot(); }
function reset(){ state=emptySnapshot('UNAVAILABLE',[]); return snapshot(); }
function snapshot(){ var result=clone(state); delete result.vectors; return result; }
function normalizeToken(token){
  token=String(token||'').toLowerCase().replace(/^[^a-z\u0430-\u044f\u04510-9]+|[^a-z\u0430-\u044f\u04510-9]+$/gi,'');
  var c=core(), entry=c&&typeof c.lookup==='function'?c.lookup(token):null;
  return entry&&entry.lemma?String(entry.lemma).toLowerCase():token;
}
function tokens(text){
  var c=core(), raw=c&&typeof c.tokenize==='function'?c.tokenize(text,64):String(text||'').toLowerCase().split(/[^a-z\u0430-\u044f\u04510-9]+/i);
  var out=[], seen={};
  for(var i=0;i<raw.length;i++){
    var token=normalizeToken(raw[i]);
    if(token.length<2||seen[token]) continue;
    seen[token]=1; out.push(token);
  }
  return out;
}
function knownPack(textValue){
  var all=tokens(textValue), known=[];
  for(var i=0;i<all.length;i++) if(state.vectors[all[i]]) known.push(all[i]);
  return {tokens:all,known:known,coverage:all.length?known.length/all.length:0};
}
function centroid(words){
  var out={}, count=0;
  for(var i=0;i<words.length;i++){
    var vector=state.vectors[words[i]];
    if(!vector) continue;
    count++;
    Object.keys(vector).forEach(function(key){out[key]=(out[key]||0)+Number(vector[key]);});
  }
  if(count) Object.keys(out).forEach(function(key){out[key]/=count;});
  return out;
}
function cosine(left,right){
  left=left||{}; right=right||{};
  var dot=0,nl=0,nr=0;
  Object.keys(left).forEach(function(key){var value=Number(left[key])||0; nl+=value*value; if(right[key]!=null) dot+=value*(Number(right[key])||0);});
  Object.keys(right).forEach(function(key){var value=Number(right[key])||0; nr+=value*value;});
  return nl&&nr?clamp01(dot/Math.sqrt(nl*nr)):0;
}
function intersection(left,right){
  var map={},out=[];
  left.forEach(function(value){map[value]=1;});
  right.forEach(function(value){if(map[value]) out.push(value);});
  return out;
}
function retrieval(vector,limit){
  return Object.keys(state.vectors).map(function(word){return {word:word,score:cosine(vector,state.vectors[word])};})
    .sort(function(a,b){return b.score-a.score||(a.word<b.word?-1:a.word>b.word?1:0);}).slice(0,limit);
}
function abstain(code,source,candidate,target){
  return {
    version:VERSION,kind:'MRDSemanticDataAssessment',status:'ABSTAIN',code:code,
    score:0,affinity:0,targetAffinity:0,sourceCoverage:source.coverage||0,candidateCoverage:candidate.coverage||0,targetCoverage:target.coverage||0,
    sourceTokenCount:(source.tokens||[]).length,candidateTokenCount:(candidate.tokens||[]).length,targetTokenCount:(target.tokens||[]).length,
    sourceAnchors:source.known||[],candidateAnchors:candidate.known||[],targetAnchors:target.known||[],sharedAnchors:[],retrieval:[],
    topK:state.topK||DEFAULT_TOP_K,boundedWeight:BOUNDED_WEIGHT,rankingDelta:0,relationHash:null,
    provenance:clone(state.provenance),evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'
  };
}
function assess(sourceText,candidateText,targetText){
  var source=knownPack(sourceText), candidate=knownPack(candidateText), target=knownPack(targetText);
  if(!state.assets.vectors) return abstain('DATA_UNAVAILABLE',source,candidate,target);
  if(!source.known.length||!candidate.known.length) return abstain('DATA_COVERAGE',source,candidate,target);
  var sourceVector=centroid(source.known), candidateVector=centroid(candidate.known), targetVector=centroid(target.known);
  var affinity=cosine(sourceVector,candidateVector), targetAffinity=target.known.length?cosine(candidateVector,targetVector):0;
  var shared=intersection(source.known,candidate.known), continuity=shared.length/Math.max(1,Math.min(source.known.length,candidate.known.length));
  var score=target.known.length?.65*affinity+.25*targetAffinity+.10*continuity:.85*affinity+.15*continuity;
  score=clamp01(score);
  var relationHash=hashHex([
    state.provenance.hash||'none',source.known.join(','),candidate.known.join(','),target.known.join(','),score.toFixed(6)
  ].join('|'));
  return {
    version:VERSION,kind:'MRDSemanticDataAssessment',status:'READY',code:null,score:score,affinity:affinity,targetAffinity:targetAffinity,
    sourceCoverage:source.coverage,candidateCoverage:candidate.coverage,targetCoverage:target.coverage,
    sourceTokenCount:source.tokens.length,candidateTokenCount:candidate.tokens.length,targetTokenCount:target.tokens.length,
    sourceAnchors:source.known,candidateAnchors:candidate.known,targetAnchors:target.known,sharedAnchors:shared,
    retrieval:retrieval(sourceVector,state.topK||DEFAULT_TOP_K),topK:state.topK||DEFAULT_TOP_K,
    boundedWeight:BOUNDED_WEIGHT,rankingDelta:BOUNDED_WEIGHT*(score-.5),relationHash:relationHash,
    provenance:clone(state.provenance),evidenceLevel:'LOCAL_CORPUS',soundness:'NOT_COMPUTED'
  };
}
function fetchJson(fetcher,url,asset){
  if(typeof fetcher!=='function') return Promise.reject(error('DATA_FETCH_UNAVAILABLE',asset));
  return fetcher(url,{cache:'no-store'}).then(function(response){
    if(!response||response.ok===false) throw error('DATA_FETCH_HTTP',asset,response&&response.status);
    if(typeof response.json!=='function') throw error('DATA_FETCH_RESPONSE',asset);
    return response.json();
  });
}
function load(urls,options){
  urls=urls||{}; options=options||{};
  var resolved={
    vectors:urls.vectors||DEFAULT_URLS.vectors,
    phiCalibration:urls.phiCalibration||DEFAULT_URLS.phiCalibration,
    adaptiveK:urls.adaptiveK||DEFAULT_URLS.adaptiveK
  };
  var fetcher=options.fetch||global.fetch;
  state=emptySnapshot('LOADING',[]);
  var names=['vectors','phiCalibration','adaptiveK'];
  return Promise.all(names.map(function(name){
    return fetchJson(fetcher,resolved[name],name).then(function(value){return {name:name,value:value};},function(reason){return {name:name,error:reason};});
  })).then(function(results){
    var payloads={}, loadErrors=[];
    results.forEach(function(result){
      if(result.error) loadErrors.push(result.error&&result.error.code?result.error:error('DATA_FETCH_FAILED',result.name,result.error));
      else payloads[result.name]=result.value;
    });
    state=buildSnapshot(payloads);
    if(loadErrors.length) state.errors=loadErrors.concat(state.errors||[]);
    return snapshot();
  });
}

global.MRDSemanticDataEvidence={
  version:VERSION,install:install,reset:reset,snapshot:snapshot,assess:assess,load:load,
  constants:{boundedWeight:BOUNDED_WEIGHT,defaultTopK:DEFAULT_TOP_K}
};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
