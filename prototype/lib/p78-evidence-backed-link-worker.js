'use strict';

importScripts(
  'p78-canonical-json.js',
  'semantic-core.js',
  'semantic-language.js',
  'p78-search-contracts.js',
  'p78-local-text-index.js',
  'p78-controlled-russian-lexicon.js',
  'p78-claim-ir.js',
  'p78-linguistic-parser-adapter.js',
  'p78-claim-structural-matcher.js',
  'p78-evidence-contracts.js',
  'p78-linguistic-structure-index.js',
  'p78-alpha-orbit-contracts.js',
  'p78-data7-adapter.js',
  'p78-qualifier-direction-contracts.js',
  'p78-evidence-backed-link-adapter.js',
  'p78-evidence-backed-link-projector.js'
);

var REQUEST_SCHEMA='meridian.evidence-backed-link-worker-request/1';
var RESPONSE_SCHEMA='meridian.evidence-backed-link-worker-response/1';
var Projector=self.MRDP78EvidenceBackedLinkProjector;

function safeCode(value,fallback){
  return typeof value==='string'&&value.length&&value.length<=128?value:fallback;
}
function respond(requestId,status,model,code){
  self.postMessage({
    schema:RESPONSE_SCHEMA,version:'1.0.0',requestId:requestId,status:status,
    model:model||null,code:code||null,semanticTruth:false,commitAllowed:false
  });
}

self.addEventListener('message',function(event){
  var message=event&&event.data,model;
  if(!message||message.schema!==REQUEST_SCHEMA||message.version!=='1.0.0'||message.type!=='PROJECT'||
     !Number.isSafeInteger(message.requestId)||message.requestId<1){
    respond(1,'ERROR',null,'WORKER_REQUEST_INVALID');
    return;
  }
  if(!Projector||Projector.status!=='READY'||Projector.version!=='1.1.0'){
    respond(message.requestId,'ERROR',null,'WORKER_PROJECTOR_UNAVAILABLE');
    return;
  }
  try{
    model=Projector.project(message.definition);
    respond(message.requestId,'READY',model,null);
  }catch(error){
    respond(message.requestId,'ERROR',null,safeCode(error&&error.code,'WORKER_PROJECTION_FAILED'));
  }
});
