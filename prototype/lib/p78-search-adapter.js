(function(global){
'use strict';

var VERSION='1.0.0';

function clear(node){ while(node&&node.firstChild) node.removeChild(node.firstChild); }
function create(options){
  var engine=options.engine,view=options.view,root=options.root,queryInput=options.queryInput,formulaSelect=options.formulaSelect,registry=options.registry,lastResult=null;
  if(!engine||typeof engine.run!=='function'||!view||typeof view.render!=='function'||!root||!queryInput||!formulaSelect||!registry) throw new Error('P78_SEARCH_ADAPTER_DEPENDENCY_UNAVAILABLE');

  function populate(){
    var doc=formulaSelect.ownerDocument||global.document,records=(registry.records||[]).filter(function(record){ return record.lifecycle==='ACTIVE'; }).slice().sort(function(a,b){ return a.formulaId.localeCompare(b.formulaId); }),preferred='pressure.margin';
    clear(formulaSelect);
    records.forEach(function(record){
      var option=doc.createElement('option');
      option.value=record.formulaId;
      option.textContent=record.formulaId+' · '+record.title;
      if(record.formulaId===preferred) option.selected=true;
      formulaSelect.appendChild(option);
    });
    if(!formulaSelect.value&&records.length) formulaSelect.value=records[0].formulaId;
  }
  function render(){
    lastResult=engine.run(queryInput.value,formulaSelect.value);
    view.render(root,lastResult);
    return lastResult;
  }

  populate();
  return Object.freeze({version:VERSION,render:render,current:function(){ return lastResult; },identity:engine.identity});
}

global.MRDP78SearchAdapter=Object.freeze({version:VERSION,create:create});
})(typeof globalThis!=='undefined'?globalThis:this);
