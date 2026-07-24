(function(global){
'use strict';

var VERSION='1.0.0';

function create(options){
  var engine=options&&options.engine,view=options&&options.view,root=options&&options.root,input=options&&options.input,lastResult=null;
  if(!engine||typeof engine.run!=='function'||!view||typeof view.render!=='function'||!root||!input) throw new Error('P78_CLAIM_ADAPTER_DEPENDENCY_UNAVAILABLE');
  function render(){
    lastResult=engine.run(input.value);
    view.render(root,lastResult);
    return lastResult;
  }
  return Object.freeze({version:VERSION,render:render,current:function(){ return lastResult; },identity:engine.identity||null});
}

global.MRDP78ClaimAdapter=Object.freeze({version:VERSION,create:create});
})(typeof globalThis!=='undefined'?globalThis:this);
