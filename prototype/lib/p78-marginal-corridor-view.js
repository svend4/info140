(function(global){
'use strict';

var VERSION='1.0.1';
var LABELS={
  '1D_LIMIT':'1D · предел распада',
  '1.5D':'1.5D · фрагментационный порог',
  '2D':'2D · открытая циркуляция',
  '2.5D':'2.5D · порог жёсткости',
  '3D_LIMIT':'3D · предел схлопывания',
  'ABSTAIN':'ABSTAIN · данных мало'
};

function documentFor(root){
  var doc=root&&root.ownerDocument||global.document;
  if(!doc||typeof doc.createElement!=='function') throw new Error('P78_MARGINAL_CORRIDOR_VIEW_DOM_REQUIRED');
  return doc;
}
function clear(root){ while(root&&root.firstChild) root.removeChild(root.firstChild); }
function node(root,tag,className,text){
  var item=documentFor(root).createElement(tag);
  if(className) item.className=className;
  if(text!==undefined&&text!==null) item.textContent=String(text);
  return item;
}
function number(value){
  value=Number(value);
  return isFinite(value)?value:0;
}
function fixed(value){ return number(value).toFixed(2); }
function label(value){ return LABELS[value]||String(value||'ABSTAIN'); }
function renderTrack(root,overall){
  var track=node(root,'div','corridorTrack');
  var axis=node(root,'div','corridorAxis');
  ['1D','1.5D','2D','2.5D','3D'].forEach(function(value){
    axis.appendChild(node(root,'span','',value));
  });
  var marker=node(root,'i','corridorMarker');
  marker.style.left=(Math.max(0,Math.min(1,number(overall.position)))*100).toFixed(1)+'%';
  marker.title=label(overall.regime);
  track.appendChild(axis); track.appendChild(marker); root.appendChild(track);
}
function renderLayer(root,layer){
  var row=node(root,'div','corridorLayer');
  var layerStatus=String(layer.status||'ABSTAIN');
  row.dataset.layer=layer.id;
  row.dataset.status=layerStatus;
  row.dataset.regime=layer.regime;
  row.appendChild(node(root,'b','',layer.label));
  row.appendChild(node(root,'span','',label(layer.regime)+' · F '+fixed(layer.fragmentation)+' · R '+fixed(layer.rigidity)));
  row.appendChild(node(root,'i','',layerStatus+' · '+fixed(layer.confidence)));
  if(layer.note) row.title=layer.note;
  root.appendChild(row);
}
function renderJamming(root,jamming){
  var row=node(root,'div','corridorTheory');
  row.dataset.theory='jamming';
  row.dataset.status=jamming&&jamming.status||'ABSTAIN';
  row.appendChild(node(root,'b','','2.5D / jamming'));
  if(!jamming||jamming.status!=='READY'){
    row.appendChild(node(root,'span','','KΔ, NΔ, DΔ · недостаточно частиц'));
    row.appendChild(node(root,'i','','DIAGNOSTIC'));
  }else{
    row.appendChild(node(root,'span','',
      'KΔ '+fixed(jamming.K)+' · NΔ '+fixed(jamming.N)+' · DΔ '+fixed(jamming.D)+' · gap '+fixed(jamming.gap)
    ));
    row.appendChild(node(root,'i','',jamming.side==='toward_3d'?'к 3D':jamming.side==='toward_1d'?'к 1D':'середина'));
  }
  row.title='Дискретная адаптация; физическое D=2N не является целевым порогом P78';
  root.appendChild(row);
}
function render(root,model){
  if(!root) return null;
  model=model||{}; clear(root);
  var overall=model.overall||{status:'ABSTAIN',regime:'ABSTAIN',position:.5,fragmentation:0,rigidity:0,circulation:0,recommendation:''};
  root.dataset.status=model.status||overall.status||'ABSTAIN';
  root.dataset.regime=overall.regime||'ABSTAIN';
  root.dataset.fragmentation=fixed(overall.fragmentation);
  root.dataset.rigidity=fixed(overall.rigidity);
  root.dataset.circulation=fixed(overall.circulation);
  root.dataset.position=fixed(overall.position);
  root.dataset.jammingStatus=model.jamming&&model.jamming.status||'ABSTAIN';

  var head=node(root,'div','corridorHead '+String(overall.regime||'ABSTAIN').toLowerCase().replace(/[^a-z0-9]+/g,'-'));
  head.appendChild(node(root,'b','',label(overall.regime)));
  head.appendChild(node(root,'span','','распад '+fixed(overall.fragmentation)+' · жёсткость '+fixed(overall.rigidity)+' · ход '+fixed(overall.circulation)));
  root.appendChild(head);
  renderTrack(root,overall);

  var layers=node(root,'div','corridorLayers');
  (Array.isArray(model.layers)?model.layers:[]).forEach(function(layer){ renderLayer(layers,layer); });
  root.appendChild(layers);
  renderJamming(root,model.jamming);

  root.appendChild(node(root,'div','corridorRecommendation',overall.recommendation||'Недостаточно данных для рекомендации.'));
  root.appendChild(node(root,'div','corridorProof','RAMSEY: границы · PERCOLATION: 1.5D · JAMMING: 2.5D · HEURISTIC / NOT_COMPUTED'));
  return {
    version:VERSION,kind:'MRDP78MarginalCorridorViewRender',
    status:root.dataset.status,regime:root.dataset.regime,layers:Array.isArray(model.layers)?model.layers.length:0
  };
}

global.MRDP78MarginalCorridorView=Object.freeze({version:VERSION,render:render});
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
