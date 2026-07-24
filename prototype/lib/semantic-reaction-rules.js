(function(global){
'use strict';

var VERSION='1.1.0';
var POLICY_VERSION='1.0.0';
var KIND='MRDSemanticReactionRules';
var TERMINAL_PORT='STATE<PARTICLE_FIELD>';

var DEFINITIONS=[
  {
    id:'R_SYNTH',label:'\u0441\u0431\u043e\u0440\u043a\u0430',direction:'generalize',priority:70,cost:.16,
    inputPort:'STATE<PARTICLE_PAIR>',outputPort:'EFFECT<GENERALIZE>',modes:['generalize'],
    contract:{
      pre:'force >= target.thr',
      inv:'mass conserved and 0.18 < u < 0.82',
      post:'target moves inward without losing identity',
      proof:'deterministic force/threshold comparison'
    }
  },
  {
    id:'R_FRAGMENT',label:'\u0443\u0442\u043e\u0447\u043d\u0435\u043d\u0438\u0435',direction:'detail',priority:70,cost:.16,
    inputPort:'STATE<PARTICLE_PAIR>',outputPort:'EFFECT<DETAIL>',modes:['detail'],
    contract:{
      pre:'force >= target.thr',
      inv:'mass conserved and 0.18 < u < 0.82',
      post:'target moves outward by one bounded detail',
      proof:'deterministic force/threshold comparison'
    }
  },
  {
    id:'R_CATALYZE',label:'\u043c\u043e\u0441\u0442-\u043a\u0430\u0442\u0430\u043b\u0438\u0437\u0430\u0442\u043e\u0440',direction:'orbit',priority:80,cost:.14,
    inputPort:'STATE<PARTICLE_PAIR>',outputPort:'EFFECT<ORBIT>',modes:['orbit','repair'],
    contract:{
      pre:'bridge or seed reaches a compatible neighbor',
      inv:'mass conserved and cascade depth bounded',
      post:'target threshold falls and the next carrier activates',
      proof:'typed local state transition'
    }
  },
  {
    id:'R_MEDIATE',label:'\u043f\u043e\u0441\u0440\u0435\u0434\u043d\u0438\u0447\u0435\u0441\u0442\u0432\u043e',direction:'repair',priority:90,cost:.18,
    inputPort:'STATE<CONFLICT_PAIR>',outputPort:'EFFECT<BRIDGE>',modes:['repair'],
    contract:{
      pre:'conflict is reached by a bridge/seed',
      inv:'opposing tokens remain distinct inside the open ring',
      post:'conflict target becomes mediated',
      proof:'conflict edge plus explicit bridge transition'
    }
  },
  {
    id:'R_HOMEOSTASIS',label:'2D-\u043f\u0440\u0435\u0434\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435\u043b\u044c',direction:'repair',priority:100,cost:0,
    inputPort:'EFFECT<EXTREME>',outputPort:'STATE<OPEN_RING>',modes:['generalize','detail','orbit','repair'],
    contract:{
      pre:'candidate u leaves the open interval',
      inv:'0.18 < u < 0.82',
      post:'candidate is reflected into the living ring',
      proof:'exact boundary comparison'
    }
  }
];

function record(value){ return !!value&&typeof value==='object'&&!Array.isArray(value); }
function text(value){ return value==null?'':String(value); }
function copy(value){
  if(value==null||typeof value!=='object') return value;
  if(Array.isArray(value)) return value.map(copy);
  var out={}; Object.keys(value).forEach(function(key){out[key]=copy(value[key]);}); return out;
}
function freeze(value){
  if(!value||typeof value!=='object'||!Object.freeze) return value;
  Object.keys(value).forEach(function(key){freeze(value[key]);}); return Object.freeze(value);
}
function hashText(source){
  var h=2166136261>>>0; source=text(source);
  for(var i=0;i<source.length;i++){h^=source.charCodeAt(i);h=Math.imul(h,16777619);}
  return ('00000000'+(h>>>0).toString(16)).slice(-8);
}
function schemaErrors(rule,index){
  var errors=[],prefix='rule['+index+']';
  if(!record(rule)) return [prefix+':object'];
  ['id','label','direction','inputPort','outputPort'].forEach(function(key){if(!text(rule[key])) errors.push(prefix+':'+key);});
  if(!/^R_[A-Z_]+$/.test(text(rule.id))) errors.push(prefix+':id-format');
  if(!/^STATE<|^EFFECT</.test(text(rule.inputPort))) errors.push(prefix+':input-port');
  if(!/^STATE<|^EFFECT</.test(text(rule.outputPort))) errors.push(prefix+':output-port');
  if(!isFinite(Number(rule.priority))) errors.push(prefix+':priority');
  if(!Array.isArray(rule.modes)||!rule.modes.length) errors.push(prefix+':modes');
  if(!record(rule.contract)) errors.push(prefix+':contract');
  else ['pre','inv','post','proof'].forEach(function(key){if(!text(rule.contract[key])) errors.push(prefix+':contract.'+key);});
  return errors;
}

var BY_ID=Object.create(null),SCHEMA_ERRORS=[];
for(var di=0;di<DEFINITIONS.length;di++){
  SCHEMA_ERRORS=SCHEMA_ERRORS.concat(schemaErrors(DEFINITIONS[di],di));
  if(BY_ID[DEFINITIONS[di].id]) SCHEMA_ERRORS.push('duplicate:'+DEFINITIONS[di].id);
  BY_ID[DEFINITIONS[di].id]=DEFINITIONS[di];
}
if(SCHEMA_ERRORS.length) throw new Error(KIND+' invalid: '+SCHEMA_ERRORS.join(','));

var CATALOG_HASH=hashText(POLICY_VERSION+'||'+DEFINITIONS.map(function(rule){
  return [rule.id,rule.direction,rule.priority,rule.cost,rule.inputPort,rule.outputPort,rule.modes.join(','),rule.contract.pre,rule.contract.inv,rule.contract.post,rule.contract.proof].join('|');
}).join('||'));
freeze(DEFINITIONS); freeze(BY_ID);

function list(){ return DEFINITIONS.map(copy); }
function get(id){ return BY_ID[text(id)]?copy(BY_ID[text(id)]):null; }
function normalizeSelection(input){
  input=input||{};
  return {
    mode:text(input.mode)||'orbit',relationType:text(input.relationType),guarded:!!input.guarded,
    sourceBaseRole:text(input.sourceBaseRole),sourceReactionRole:text(input.sourceReactionRole),sourceSemanticRole:text(input.sourceSemanticRole),
    targetBaseRole:text(input.targetBaseRole),targetReactionRole:text(input.targetReactionRole),targetSemanticRole:text(input.targetSemanticRole)
  };
}
function selected(id,reason){
  var rule=get(id); if(rule) rule.selectionReason=reason; return rule;
}
function select(input){
  input=normalizeSelection(input);
  if(input.guarded) return selected('R_HOMEOSTASIS','guard:open-ring');
  if(input.mode==='repair'&&(input.relationType==='conflict'||input.targetBaseRole==='anti')) return selected('R_MEDIATE','pair:conflict');
  if(input.mode==='generalize') return selected('R_SYNTH','explicit:generalize');
  if(input.mode==='detail') return selected('R_FRAGMENT','explicit:detail');
  if(input.sourceReactionRole==='seed') return selected('R_CATALYZE','source:seed');
  if(input.sourceReactionRole==='mediated') return selected('R_CATALYZE','source:mediated');
  if(input.sourceBaseRole==='synth') return selected('R_SYNTH','source:synth');
  if(input.sourceBaseRole==='fragment') return selected('R_FRAGMENT','source:fragment');
  if(input.sourceBaseRole==='catalyst') return selected('R_CATALYZE','source:catalyst');
  if(input.targetBaseRole==='synth') return selected('R_SYNTH','target:synth');
  if(input.targetBaseRole==='fragment') return selected('R_FRAGMENT','target:fragment');
  return selected('R_CATALYZE','pair:carrier');
}
function typedPath(id,terminal){
  var rule=BY_ID[text(id)];
  return rule?rule.inputPort+' -> '+rule.outputPort+' -> '+(text(terminal)||TERMINAL_PORT):'';
}
function validateEvent(event){
  if(!record(event)) return {ok:false,code:'RULE_EVENT_INVALID',failures:['event']};
  var rule=BY_ID[text(event.ruleId)];
  if(!rule) return {ok:false,code:'RULE_UNKNOWN',failures:['ruleId']};
  var expectedPath=typedPath(rule.id),failures=[],expectedSelection=null;
  if(event.ruleVersion!==VERSION) failures.push('ruleVersion');
  if(event.ruleHash!==CATALOG_HASH) failures.push('ruleHash');
  if(event.direction!==rule.direction) failures.push('direction');
  if(Number(event.priority)!==rule.priority) failures.push('priority');
  if(event.inputPort!==rule.inputPort) failures.push('inputPort');
  if(event.outputPort!==rule.outputPort) failures.push('outputPort');
  if(event.portPath!==expectedPath) failures.push('portPath');
  if(!record(event.selectionInput)) failures.push('selectionInput');
  else {
    expectedSelection=select(event.selectionInput);
    if(!expectedSelection||expectedSelection.id!==rule.id) failures.push('ruleSelection');
    if(event.selectionReason!==expectedSelection.selectionReason) failures.push('selectionReason');
  }
  return {ok:failures.length===0,code:failures.length?'RULE_EVENT_MISMATCH':'RULE_EVENT_OK',failures:failures,rule:get(rule.id),expectedSelection:expectedSelection,expectedPath:expectedPath,ruleVersion:VERSION,ruleHash:CATALOG_HASH};
}

global.MRDSemanticReactionRules={
  version:VERSION,policyVersion:POLICY_VERSION,kind:KIND,hash:CATALOG_HASH,terminalPort:TERMINAL_PORT,
  rules:list(),list:list,get:get,normalizeSelection:normalizeSelection,select:select,typedPath:typedPath,validateEvent:validateEvent
};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
