/* MERIDIAN FX — переиспользуемый модуль: звук (WebAudio) + рекорды (localStorage).
   Подключение: <script src="lib/mrd-fx.js"></script>
   API:
     MRDFX.toggle() -> bool      переключить звук (вкл/выкл), инициализирует аудио по жесту
     MRDFX.isOn()                включён ли звук
     MRDFX.ambient(level)        громкость фонового дрона (0..~0.06), действует только при вкл.
     MRDFX.freq(hz)              частота дрона
     MRDFX.blip(hz,vol,type)     короткий звук (событие)
     MRDFX.chord(arr,vol)        аккорд из частот (победа/успех)
     MRDFX.best(key[,score])     прочитать рекорд; если передан score>рекорда — сохранить; вернёт рекорд
*/
window.MRDFX=(function(){
  var ctx=null,drone=null,dg=null,on=false;
  function init(){if(ctx)return;try{ctx=new (window.AudioContext||window.webkitAudioContext)();
    drone=ctx.createOscillator();dg=ctx.createGain();dg.gain.value=0;drone.type='sine';drone.frequency.value=110;
    drone.connect(dg);dg.connect(ctx.destination);drone.start();}catch(e){ctx=null;}}
  function note(f,v,type,at,dur){if(!ctx)return;try{var o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'triangle';
    o.frequency.value=f;o.connect(g);g.connect(ctx.destination);var t0=ctx.currentTime+(at||0);
    g.gain.setValueAtTime(v||0.05,t0);g.gain.exponentialRampToValueAtTime(0.0001,t0+(dur||0.2));o.start(t0);o.stop(t0+(dur||0.2)+0.02);}catch(e){}}
  return {
    init:init,
    setOn:function(v){on=v;if(v)init();},
    isOn:function(){return on;},
    toggle:function(){on=!on;if(on)init();return on;},
    ambient:function(level){if(ctx&&dg)dg.gain.setTargetAtTime(on?(level||0):0,ctx.currentTime,0.12);},
    freq:function(f){if(ctx&&drone)drone.frequency.setTargetAtTime(f,ctx.currentTime,0.12);},
    blip:function(f,v,type){if(!on)return;note(f,v||0.05,type,0,0.2);},
    chord:function(arr,v){if(!on)return;for(var i=0;i<arr.length;i++)note(arr[i],v||0.06,'triangle',i*0.07,0.4);},
    best:function(key,score){var b=0;try{b=parseFloat(localStorage.getItem(key)||'0')||0;}catch(e){}
      if(score!=null&&score>b){b=score;try{localStorage.setItem(key,String(Math.round(score)));}catch(e){}}return b;}
  };
})();
