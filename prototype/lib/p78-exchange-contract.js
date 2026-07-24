(function(global){
'use strict';

var VERSION='1.0.0';
var SCHEMA='p78.exchange/1';
var STRUCTURAL='STRUCTURAL';
var NOT_COMPUTED='NOT_COMPUTED';
var STATUS={READY:1,PARTIAL:1,ABSTAIN:1,BLOCKED:1,INVALID:1,UNAVAILABLE:1};
var KIND={REQUEST:1,RESULT:1,EVENT:1};
var DOMAIN={'1d':1,'2d':1,'3d':1};
var ROUTES={
  '2d>1d':{REQUEST:{ENCODE:1,DECOMPOSE:1},EVENT:{COMMITTED:1,ROLLED_BACK:1,STALE:1}},
  '1d>2d':{RESULT:{SEQUENCE_REPORT:1}},
  '2d>3d':{REQUEST:{DIAGNOSE_Q6:1,FIND_COUNTERFACTUAL:1},EVENT:{COMMITTED:1,ROLLED_BACK:1,STALE:1}},
  '3d>2d':{RESULT:{HYPERCUBE_REPORT:1}}
};

function hasOwn(value,key){ return Object.prototype.hasOwnProperty.call(value,key); }
function record(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function text(value){ return value==null?'':String(value); }
function clean(value){ return text(value).trim(); }
function upper(value){ return clean(value).toUpperCase(); }
function domain(value){ return clean(value).toLowerCase(); }
function integer(value){ return typeof value==='number'&&isFinite(value)&&Math.floor(value)===value&&value>=0; }

function freeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(key){ freeze(value[key]); });
  return Object.freeze(value);
}

function canonical(value){
  if(value===null) return 'null';
  if(typeof value==='string') return JSON.stringify(value);
  if(typeof value==='number') return isFinite(value)?String(value):'null';
  if(typeof value==='boolean') return value?'true':'false';
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(record(value)){
    return '{'+Object.keys(value).sort().filter(function(key){return value[key]!==undefined;}).map(function(key){
      return JSON.stringify(key)+':'+canonical(value[key]);
    }).join(',')+'}';
  }
  return 'null';
}

function hash(value){
  var source=typeof value==='string'?value:canonical(value), h=2166136261;
  for(var i=0;i<source.length;i++){
    h^=source.charCodeAt(i);
    h=Math.imul(h,16777619)>>>0;
  }
  return ('00000000'+h.toString(16)).slice(-8);
}

function operationOf(value){ return upper(value&&value.body&&value.body.operation); }
function routeKey(from,to){ return domain(from)+'>'+domain(to); }
function routeAllowed(from,to,kind,operation){
  var route=ROUTES[routeKey(from,to)], group=route&&route[upper(kind)];
  return !!(group&&group[upper(operation)]);
}

function failure(code,field,expected,actual){
  return freeze({code:code,field:field,expected:expected,actual:actual,evidence:STRUCTURAL,soundness:NOT_COMPUTED});
}

function proof(ok,errors,message){
  return freeze({
    version:VERSION,
    schema:SCHEMA,
    kind:'MRDP78ExchangeValidation',
    ok:!!ok,
    status:ok?'READY':'INVALID',
    code:ok?null:(errors[0]&&errors[0].code||'EXCHANGE_INVALID'),
    errors:errors,
    message:message||null,
    evidence:STRUCTURAL,
    evidenceLevel:STRUCTURAL,
    soundness:NOT_COMPUTED,
    semanticTruth:false
  });
}

function idMaterial(value){
  return {
    schema:value.schema,
    kind:value.kind,
    from:value.from,
    to:value.to,
    replyTo:value.replyTo,
    epoch:value.epoch,
    revision:value.revision,
    status:value.status,
    code:value.code,
    body:value.body,
    providerId:value.evidence&&value.evidence.providerId,
    providerVersion:value.evidence&&value.evidence.providerVersion,
    contentHash:value.evidence&&value.evidence.contentHash
  };
}

function expectedMessageId(value){ return 'p78x-'+hash(idMaterial(value)); }

function validate(value){
  var errors=[];
  if(!record(value)) return proof(false,[failure('EXCHANGE_ENVELOPE_REQUIRED','envelope','object',value)],null);
  var from=domain(value.from), to=domain(value.to), kind=upper(value.kind), status=upper(value.status), operation=operationOf(value);
  if(value.schema!==SCHEMA) errors.push(failure('EXCHANGE_SCHEMA','schema',SCHEMA,value.schema));
  if(!KIND[kind]) errors.push(failure('EXCHANGE_KIND','kind',Object.keys(KIND),value.kind));
  if(!DOMAIN[from]) errors.push(failure('EXCHANGE_FROM','from',Object.keys(DOMAIN),value.from));
  if(!DOMAIN[to]) errors.push(failure('EXCHANGE_TO','to',Object.keys(DOMAIN),value.to));
  if(from&&from===to) errors.push(failure('EXCHANGE_SELF_ROUTE','to','different domain',value.to));
  if(!integer(value.epoch)) errors.push(failure('EXCHANGE_EPOCH','epoch','non-negative integer',value.epoch));
  if(!clean(value.revision)) errors.push(failure('EXCHANGE_REVISION','revision','non-empty string',value.revision));
  if(!STATUS[status]) errors.push(failure('EXCHANGE_STATUS','status',Object.keys(STATUS),value.status));
  if(status&&status!=='READY'&&!clean(value.code)) errors.push(failure('EXCHANGE_CODE_REQUIRED','code','non-empty for non-READY',value.code));
  if(status==='READY'&&value.code!==null) errors.push(failure('EXCHANGE_READY_CODE','code',null,value.code));
  if(!record(value.body)) errors.push(failure('EXCHANGE_BODY','body','object',value.body));
  if(!operation) errors.push(failure('EXCHANGE_OPERATION','body.operation','non-empty operation',value.body&&value.body.operation));
  if(from&&to&&kind&&operation&&!routeAllowed(from,to,kind,operation)){
    errors.push(failure(from!=='2d'&&to!=='2d'?'EXCHANGE_2D_ARBITER_REQUIRED':'EXCHANGE_ROUTE','route','declared p78.exchange/1 route',routeKey(from,to)+' '+kind+' '+operation));
  }
  if(kind==='RESULT'&&!clean(value.replyTo)) errors.push(failure('EXCHANGE_REPLY_TO_REQUIRED','replyTo','request messageId',value.replyTo));
  if(kind!=='RESULT'&&value.replyTo!==null) errors.push(failure('EXCHANGE_REPLY_TO_FORBIDDEN','replyTo',null,value.replyTo));
  if(!record(value.evidence)){
    errors.push(failure('EXCHANGE_EVIDENCE','evidence','object',value.evidence));
  }else{
    if(!clean(value.evidence.providerId)) errors.push(failure('EXCHANGE_PROVIDER','evidence.providerId','non-empty',value.evidence.providerId));
    if(!clean(value.evidence.providerVersion)) errors.push(failure('EXCHANGE_PROVIDER_VERSION','evidence.providerVersion','non-empty',value.evidence.providerVersion));
    if(value.evidence.level!==STRUCTURAL) errors.push(failure('EXCHANGE_EVIDENCE_LEVEL','evidence.level',STRUCTURAL,value.evidence.level));
    if(value.evidence.soundness!==NOT_COMPUTED) errors.push(failure('EXCHANGE_SOUNDNESS','evidence.soundness',NOT_COMPUTED,value.evidence.soundness));
    if(value.evidence.contentHash!==hash(value.body)) errors.push(failure('EXCHANGE_CONTENT_HASH','evidence.contentHash',hash(value.body),value.evidence.contentHash));
  }
  if(!clean(value.messageId)) errors.push(failure('EXCHANGE_MESSAGE_ID','messageId','deterministic id',value.messageId));
  else if(value.messageId!==expectedMessageId(value)) errors.push(failure('EXCHANGE_MESSAGE_INTEGRITY','messageId',expectedMessageId(value),value.messageId));
  return proof(errors.length===0,errors,errors.length?null:value);
}

function create(input){
  input=record(input)?input:{};
  var body=record(input.body)?input.body:{}, evidence=record(input.evidence)?input.evidence:{};
  var value={
    schema:SCHEMA,
    messageId:'',
    kind:upper(input.kind)||'REQUEST',
    from:domain(input.from),
    to:domain(input.to),
    replyTo:input.replyTo==null?null:clean(input.replyTo),
    epoch:input.epoch,
    revision:clean(input.revision),
    status:upper(input.status)||'READY',
    code:input.code==null?null:upper(input.code),
    body:body,
    evidence:{
      providerId:clean(evidence.providerId),
      providerVersion:clean(evidence.providerVersion),
      level:STRUCTURAL,
      soundness:NOT_COMPUTED,
      contentHash:hash(body)
    }
  };
  value.messageId=expectedMessageId(value);
  var result=validate(value);
  return result.ok?freeze(value):result;
}

function reply(request,input){
  var requestProof=validate(request);
  if(!requestProof.ok||request.kind!=='REQUEST'){
    return proof(false,[failure('EXCHANGE_REQUEST_INVALID','request','valid REQUEST',requestProof.code)],null);
  }
  input=record(input)?input:{};
  return create({
    kind:'RESULT',
    from:request.to,
    to:request.from,
    replyTo:request.messageId,
    epoch:request.epoch,
    revision:request.revision,
    status:input.status||'READY',
    code:input.code==null?null:input.code,
    body:input.body,
    evidence:input.evidence
  });
}

function isStale(value,epoch,revision){
  var checked=validate(value);
  if(!checked.ok) return true;
  return value.epoch!==epoch||value.revision!==clean(revision);
}

function sameMessage(left,right){
  var a=validate(left), b=validate(right);
  return !!(a.ok&&b.ok&&left.messageId===right.messageId&&canonical(left)===canonical(right));
}

var API=freeze({
  version:VERSION,
  schema:SCHEMA,
  statuses:freeze(Object.keys(STATUS)),
  kinds:freeze(Object.keys(KIND)),
  domains:freeze(Object.keys(DOMAIN)),
  evidence:STRUCTURAL,
  soundness:NOT_COMPUTED,
  canonical:canonical,
  hash:hash,
  routeAllowed:routeAllowed,
  expectedMessageId:expectedMessageId,
  validate:validate,
  create:create,
  reply:reply,
  isStale:isStale,
  sameMessage:sameMessage
});

global.MRDP78ExchangeContract=API;
if(typeof module!=='undefined'&&module.exports) module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
