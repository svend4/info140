(function(global){
'use strict';

var VERSION='1.0.0';

function number(value){ value=Number(value); return isFinite(value)?value:0; }
function score(value){ return number(value).toFixed(2); }
function documentFor(root){
  var doc=root&&root.ownerDocument||global.document;
  if(!doc||typeof doc.createElement!=='function') throw new Error('semantic-output-view requires a DOM document');
  return doc;
}
function clear(root){ while(root&&root.firstChild) root.removeChild(root.firstChild); }
function node(root,tag,className,text){
  var item=documentFor(root).createElement(tag);
  if(className) item.className=className;
  if(text!=null) item.textContent=String(text);
  return item;
}
function header(root,className,title,formula){
  var item=node(root,'div',className);
  item.appendChild(node(root,'b','',title));
  item.appendChild(node(root,'span','',formula));
  root.appendChild(item);
}
function command(root,label,className,disabled,callback){
  var item=node(root,'button',className||'',label);
  item.type='button'; item.disabled=!!disabled;
  item.onclick=function(){ if(!item.disabled&&typeof callback==='function') callback(); };
  return item;
}
function renderText(root,pack,handlers){
  if(!root) return null;
  pack=pack||{}; handlers=handlers||{}; clear(root);
  header(root,'resultHead',pack.title||'\u0432\u044b\u0432\u043e\u0434',pack.formula||'result = metrics -> text');
  root.appendChild(node(root,'div','resultSummary',pack.summary||'\u041d\u0435\u0442 \u0440\u0430\u0441\u0447\u0435\u0442\u0430.'));
  root.appendChild(node(root,'div','resultLine',pack.outputLine||''));
  if(pack.observedLine) root.appendChild(node(root,'div','resultLine observed',pack.observedLine));
  var rows=node(root,'div','resultRows'),sourceRows=Array.isArray(pack.rows)?pack.rows:[];
  sourceRows.forEach(function(entry){
    entry=entry||{};
    var row=node(root,'div','resultRow');
    row.appendChild(node(root,'b','',entry.label||''));
    row.appendChild(node(root,'span','',entry.value||''));
    row.appendChild(node(root,'i','',score(entry.score)));
    rows.appendChild(row);
  });
  root.appendChild(rows);
  var actions=node(root,'div','resultActions');
  actions.appendChild(command(root,'\u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0432\u044b\u0432\u043e\u0434','',false,function(){
    if(typeof handlers.onRefresh==='function') handlers.onRefresh(pack);
  }));
  actions.appendChild(command(root,'\u0432\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0432\u044b\u0432\u043e\u0434','primary',!pack.insertLine,function(){
    if(typeof handlers.onApply==='function') handlers.onApply(pack);
  }));
  root.appendChild(actions);
  return {version:VERSION,kind:'MRDSemanticOutputViewRender',surface:'text-result',status:pack.status||'unknown',rows:sourceRows.length,observed:!!pack.observedLine,actionable:!!pack.insertLine};
}
function appendMenuItem(root,item,handlers){
  item=item||{};
  var row=node(root,'div','outputItem '+(item.kind||'text'));
  row.appendChild(node(root,'b','',item.label||item.id||'\u0432\u044b\u0432\u043e\u0434'));
  row.appendChild(node(root,'span','',item.text||''));
  row.appendChild(node(root,'i','',score(item.score)));
  row.appendChild(command(root,'\u0432\u0441\u0442\u0430\u0432\u0438\u0442\u044c','',!item.insertLine,function(){
    if(typeof handlers.onApplyItem==='function') handlers.onApplyItem(item);
  }));
  root.appendChild(row);
}
function renderMenu(root,pack,handlers){
  if(!root) return null;
  pack=pack||{}; handlers=handlers||{}; clear(root);
  header(root,'outputHead',pack.title||'\u043c\u0435\u043d\u044e \u0432\u044b\u0432\u043e\u0434\u043e\u0432',pack.formula||'output_menu = text');
  var items=Array.isArray(pack.items)?pack.items:[];
  if(!items.length) root.appendChild(node(root,'div','outputItem',pack.summary||'\u043d\u0435\u0442 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u043e\u0432 \u0432\u044b\u0432\u043e\u0434\u0430'));
  else items.forEach(function(item){appendMenuItem(root,item,handlers);});
  return {version:VERSION,kind:'MRDSemanticOutputViewRender',surface:'output-menu',status:pack.status||'unknown',items:items.length,actionable:items.filter(function(item){return !!(item&&item.insertLine);}).length};
}

global.MRDSemanticOutputView={version:VERSION,renderText:renderText,renderMenu:renderMenu,formatScore:score};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
