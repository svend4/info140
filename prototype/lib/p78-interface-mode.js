(function(global){
'use strict';

var VERSION='1.0.0';
var MODES=['flow','analysis'];

function freeze(value){
  return typeof Object.freeze==='function'?Object.freeze(value):value;
}
function modeIndex(value){ return MODES.indexOf(value); }
function visible(surface,mode){
  return modeIndex(mode)>=0&&(surface==='shared'||surface===mode);
}
function dataValue(node,name){
  var value=node&&node.dataset&&node.dataset[name];
  if(value==null&&node&&typeof node.getAttribute==='function') value=node.getAttribute('data-'+name);
  return value==null?'':String(value);
}
function setRootMode(root,mode){
  if(root.dataset) root.dataset.mode=mode;
  else if(typeof root.setAttribute==='function') root.setAttribute('data-mode',mode);
}
function setOn(node,on){
  var names,i,out;
  if(node.classList&&typeof node.classList.toggle==='function'){
    node.classList.toggle('on',on);
    return;
  }
  names=String(node.className||'').split(/\s+/);
  out=[];
  for(i=0;i<names.length;i++){
    if(names[i]&&names[i]!=='on') out.push(names[i]);
  }
  if(on) out.push('on');
  node.className=out.join(' ');
}
function nodes(root,selector){
  return Array.prototype.slice.call(root.querySelectorAll(selector));
}

function create(root){
  if(!root||typeof root.querySelectorAll!=='function') throw new TypeError('P78_INTERFACE_MODE_ROOT_REQUIRED');

  var buttons=nodes(root,'[data-mode]');
  var surfaces=nodes(root,'[data-surface]');
  var bindings=[];
  var mode='flow';
  var destroyed=false;

  function render(){
    setRootMode(root,mode);
    surfaces.forEach(function(surface){
      surface.hidden=!visible(dataValue(surface,'surface'),mode);
    });
    buttons.forEach(function(button){
      var on=dataValue(button,'mode')===mode;
      if(typeof button.setAttribute==='function') button.setAttribute('aria-pressed',on?'true':'false');
      setOn(button,on);
    });
  }
  function snapshot(){
    return freeze({version:VERSION,mode:mode});
  }
  function select(nextMode){
    if(destroyed||modeIndex(nextMode)<0) return false;
    mode=nextMode;
    render();
    return true;
  }
  function focusMode(nextMode){
    var i;
    for(i=0;i<buttons.length;i++){
      if(dataValue(buttons[i],'mode')===nextMode&&typeof buttons[i].focus==='function'){
        buttons[i].focus();
        return;
      }
    }
  }
  function bind(button){
    if(typeof button.addEventListener!=='function') return;
    var click=function(){ select(dataValue(button,'mode')); };
    var keydown=function(event){
      var key=event&&event.key;
      var index=modeIndex(dataValue(button,'mode'));
      var nextMode;
      if(index<0) return;
      if(key==='ArrowLeft') nextMode=MODES[(index+MODES.length-1)%MODES.length];
      else if(key==='ArrowRight') nextMode=MODES[(index+1)%MODES.length];
      else if(key==='Home') nextMode=MODES[0];
      else if(key==='End') nextMode=MODES[MODES.length-1];
      else return;
      if(select(nextMode)){
        if(typeof event.preventDefault==='function') event.preventDefault();
        focusMode(nextMode);
      }
    };
    button.addEventListener('click',click);
    button.addEventListener('keydown',keydown);
    bindings.push({button:button,click:click,keydown:keydown});
  }
  function destroy(){
    if(destroyed) return false;
    bindings.forEach(function(binding){
      if(typeof binding.button.removeEventListener!=='function') return;
      binding.button.removeEventListener('click',binding.click);
      binding.button.removeEventListener('keydown',binding.keydown);
    });
    bindings=[];
    destroyed=true;
    return true;
  }

  buttons.forEach(bind);
  render();

  return freeze({select:select,snapshot:snapshot,destroy:destroy});
}

global.MRDP78InterfaceMode=freeze({version:VERSION,visible:visible,create:create});
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
