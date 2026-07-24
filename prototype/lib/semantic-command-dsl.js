(function(root,factory){
'use strict';
var api=factory();
root.MRDSemanticCommandDSL=api;
if(typeof module==='object'&&module&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(){
'use strict';

var VERSION='1.0.0';
var MAX_SOURCE_LENGTH=16384;
var MAX_TOKENS=1024;
var MAX_DEPTH=40;
var hasOwn=Object.prototype.hasOwnProperty;
var TYPE_NAMES=['QTY','ORD','ID','OP','STATE','EFFECT'];
var TYPES={QTY:'QTY',ORD:'ORD',ID:'ID',OP:'OP',STATE:'STATE',EFFECT:'EFFECT'};
var RESERVED={__proto__:true,prototype:true,constructor:true};

function own(object,key){ return object!=null&&hasOwn.call(object,key); }
function nullMap(){ return Object.create?Object.create(null):{}; }
function freeze(value){
  if(typeof Object.freeze==='function'&&value&&typeof value==='object') Object.freeze(value);
  return value;
}
function deepFreeze(value,seen){
  if(!value||typeof value!=='object'||typeof Object.freeze!=='function') return value;
  seen=seen||[];
  if(seen.indexOf(value)>=0) return value;
  seen.push(value);
  Object.keys(value).forEach(function(key){ deepFreeze(value[key],seen); });
  return Object.freeze(value);
}
function location(source,index){
  var line=1,column=1,i;
  index=Math.max(0,Math.min(String(source||'').length,Number(index)||0));
  for(i=0;i<index;i++){
    if(source.charAt(i)==='\n'){ line++; column=1; }
    else column++;
  }
  return {index:index,line:line,column:column};
}
function errorObject(code,phase,message,source,index,details){
  var loc=location(source,index),error={
    name:'SemanticCommandDSLError',code:code,phase:phase,message:message,
    index:loc.index,line:loc.line,column:loc.column
  };
  if(details) Object.keys(details).forEach(function(key){ error[key]=details[key]; });
  return error;
}
function resultFailure(errors,extra){
  var result={ok:false,errors:errors||[]};
  result.error=result.errors[0]||null;
  if(extra) Object.keys(extra).forEach(function(key){ result[key]=extra[key]; });
  return result;
}
function normalizeType(type){
  if(type&&typeof type==='object') type=type.type||type.valueType||type.name;
  type=String(type||'').toUpperCase();
  return own(TYPES,type)?type:null;
}
function compatible(actual,expected){ return !!actual&&!!expected&&actual===expected; }
function isFiniteNumber(value){ return typeof value==='number'&&isFinite(value); }
function valueType(value){
  if(value&&typeof value==='object'&&normalizeType(value.type||value.valueType)) return normalizeType(value.type||value.valueType);
  if(typeof value==='number'&&isFinite(value)) return TYPES.QTY;
  if(typeof value==='string') return TYPES.ID;
  if(typeof value==='boolean') return TYPES.STATE;
  return null;
}

function signature(inputPorts,outputPort,inputPort,kind){
  return {inputPorts:inputPorts.slice(),inputs:inputPorts.slice(),outputPort:outputPort,output:outputPort,inputPort:inputPort||null,kind:kind||'pure'};
}
function buildSignatures(){
  var table=nullMap();
  table.add=[
    signature([TYPES.QTY,TYPES.QTY],TYPES.QTY,TYPES.QTY,'pure'),
    signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect')
  ];
  table.sub=[signature([TYPES.QTY,TYPES.QTY],TYPES.QTY,TYPES.QTY,'pure')];
  table.mul=[signature([TYPES.QTY,TYPES.QTY],TYPES.QTY,TYPES.QTY,'pure')];
  table.div=[signature([TYPES.QTY,TYPES.QTY],TYPES.QTY,TYPES.QTY,'pure')];
  table.compare=[
    signature([TYPES.QTY,TYPES.QTY],TYPES.ORD,TYPES.QTY,'pure'),
    signature([TYPES.ORD,TYPES.ORD],TYPES.ORD,TYPES.ORD,'pure')
  ];
  table.eq=[];
  table.neq=[];
  [TYPES.QTY,TYPES.ORD,TYPES.ID,TYPES.OP,TYPES.STATE].forEach(function(type){
    table.eq.push(signature([type,type],TYPES.STATE,type,'predicate'));
    table.neq.push(signature([type,type],TYPES.STATE,type,'predicate'));
  });
  ['lt','lte','gt','gte'].forEach(function(name){
    table[name]=[
      signature([TYPES.QTY,TYPES.QTY],TYPES.STATE,TYPES.QTY,'predicate'),
      signature([TYPES.ORD,TYPES.ORD],TYPES.STATE,TYPES.ORD,'predicate')
    ];
  });
  table.identity=[];
  TYPE_NAMES.forEach(function(type){ table.identity.push(signature([type],type,type,'pure')); });
  table.apply=[];
  [TYPES.QTY,TYPES.ORD,TYPES.ID,TYPES.STATE,TYPES.EFFECT].forEach(function(type){
    table.apply.push(signature([TYPES.OP,type],TYPES.EFFECT,TYPES.OP,'effect'));
  });
  table.bridge=[signature([TYPES.ID,TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect')];
  table.detail=[signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect')];
  table.synth=[signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect')];
  table.orbit=[signature([],TYPES.EFFECT,null,'effect'),signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect')];
  table.wait=[signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect'),signature([TYPES.STATE],TYPES.EFFECT,TYPES.STATE,'effect')];
  table.edge=[signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect')];
  table.core=[signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect')];
  table.bind=[signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect')];
  table.keep=[
    signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect'),
    signature([TYPES.STATE],TYPES.EFFECT,TYPES.STATE,'effect'),
    signature([TYPES.EFFECT],TYPES.EFFECT,TYPES.EFFECT,'effect')
  ];
  table.next=[
    signature([],TYPES.EFFECT,null,'effect'),
    signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect'),
    signature([TYPES.QTY],TYPES.EFFECT,TYPES.QTY,'effect')
  ];
  table.continue=[
    signature([],TYPES.EFFECT,null,'effect'),
    signature([TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect'),
    signature([TYPES.QTY],TYPES.EFFECT,TYPES.QTY,'effect')
  ];
  table.chant=[signature([TYPES.ID,TYPES.ID,TYPES.ID],TYPES.EFFECT,TYPES.ID,'effect')];
  table.rhythm=[signature([],TYPES.EFFECT,null,'effect')];
  table['\u2194']=table.bridge;
  table['\u21d1']=table.synth;
  table['\u21d3']=table.detail;
  Object.keys(table).forEach(function(name){
    table[name].forEach(function(item){ deepFreeze(item); });
    freeze(table[name]);
  });
  return freeze(table);
}
var SIGNATURES=buildSignatures();

function identifierStart(ch){ return !!ch&&(/[A-Za-z_$]/.test(ch)||ch.charCodeAt(0)>=128); }
function identifierPart(ch){ return !!ch&&(/[A-Za-z0-9_$]/.test(ch)||ch.charCodeAt(0)>=128); }
function digit(ch){ return ch>='0'&&ch<='9'; }
function hex(ch){ return !!ch&&/[0-9A-Fa-f]/.test(ch); }

function Lexer(source){
  this.source=source;
  this.index=0;
  this.tokens=[];
}
Lexer.prototype.fail=function(code,message,index,details){
  throw {dslParseAbort:true,error:errorObject(code,'parse',message,this.source,index==null?this.index:index,details)};
};
Lexer.prototype.push=function(type,value,start,end,raw,extra){
  if(this.tokens.length>=MAX_TOKENS) this.fail('TOKEN_LIMIT','DSL token limit exceeded.',start,{limit:MAX_TOKENS});
  var token={type:type,value:value,start:start,end:end,raw:raw==null?this.source.slice(start,end):raw};
  if(extra) Object.keys(extra).forEach(function(key){ token[key]=extra[key]; });
  this.tokens.push(token);
};
Lexer.prototype.readNumber=function(){
  var start=this.index,s=this.source,i=this.index;
  while(digit(s.charAt(i))) i++;
  if(s.charAt(i)==='.'){
    i++;
    if(!digit(s.charAt(i))) this.fail('INVALID_NUMBER','A decimal point must be followed by a digit.',i);
    while(digit(s.charAt(i))) i++;
  }
  if(s.charAt(i)==='e'||s.charAt(i)==='E'){
    i++;
    if(s.charAt(i)==='+'||s.charAt(i)==='-') i++;
    if(!digit(s.charAt(i))) this.fail('INVALID_NUMBER','An exponent must contain a digit.',i);
    while(digit(s.charAt(i))) i++;
  }
  var raw=s.slice(start,i),number=Number(raw);
  if(!isFinite(number)) this.fail('INVALID_NUMBER','Numeric literals must be finite.',start);
  this.index=i;
  this.push('NUMBER',number,start,i,raw);
};
Lexer.prototype.readString=function(){
  var start=this.index,quote=this.source.charAt(this.index++),out='',ch,i,code;
  while(this.index<this.source.length){
    ch=this.source.charAt(this.index++);
    if(ch===quote){
      this.push('STRING',out,start,this.index,this.source.slice(start,this.index));
      return;
    }
    if(ch==='\n'||ch==='\r') this.fail('UNTERMINATED_STRING','String literals cannot contain a raw newline.',this.index-1);
    if(ch!=='\\'){ out+=ch; continue; }
    if(this.index>=this.source.length) this.fail('UNTERMINATED_STRING','Unterminated string escape.',this.index-1);
    ch=this.source.charAt(this.index++);
    if(ch==='n') out+='\n';
    else if(ch==='r') out+='\r';
    else if(ch==='t') out+='\t';
    else if(ch==='b') out+='\b';
    else if(ch==='f') out+='\f';
    else if(ch==='\\'||ch==='"'||ch==="'") out+=ch;
    else if(ch==='u'){
      code='';
      for(i=0;i<4;i++){
        ch=this.source.charAt(this.index++);
        if(!hex(ch)) this.fail('INVALID_ESCAPE','Unicode escapes require four hexadecimal digits.',this.index-1);
        code+=ch;
      }
      out+=String.fromCharCode(parseInt(code,16));
    }else this.fail('INVALID_ESCAPE','Unsupported string escape.',this.index-1,{escape:ch});
  }
  this.fail('UNTERMINATED_STRING','Unterminated string literal.',start);
};
Lexer.prototype.readIdentifier=function(){
  var start=this.index,explicitPort=false,ch=this.source.charAt(this.index);
  if(ch==='$'){
    explicitPort=true;
    this.index++;
    if(!identifierStart(this.source.charAt(this.index))||this.source.charAt(this.index)==='$'){
      this.fail('INVALID_REFERENCE','A port reference must have a name after "$".',start);
    }
  }
  while(identifierPart(this.source.charAt(this.index))) this.index++;
  var raw=this.source.slice(start,this.index),value=explicitPort?raw.slice(1):raw;
  this.push('IDENT',value,start,this.index,raw,{explicitPort:explicitPort});
};
Lexer.prototype.scan=function(){
  var s=this.source,ch,start,two;
  while(this.index<s.length){
    ch=s.charAt(this.index);
    if(/\s/.test(ch)){ this.index++; continue; }
    start=this.index;
    two=s.slice(this.index,this.index+2);
    if(two==='->'||two==='&&'||two==='<='||two==='>='||two==='=='||two==='!='){
      this.index+=2;
      this.push(two,two,start,this.index,two);
      continue;
    }
    if(ch==='('||ch===')'||ch===','||ch===':'||ch==='<'||ch==='>'||ch==='+'||ch==='-'||ch==='!'){
      this.index++;
      this.push(ch,ch,start,this.index,ch);
      continue;
    }
    if(ch==='"'||ch==="'"){ this.readString(); continue; }
    if(digit(ch)){ this.readNumber(); continue; }
    if(identifierStart(ch)){ this.readIdentifier(); continue; }
    this.fail('INVALID_CHARACTER','Invalid character in DSL source.',start,{character:ch});
  }
  this.push('EOF',null,this.index,this.index,'');
  return this.tokens;
};

function Parser(source,tokens){
  this.source=source;
  this.tokens=tokens;
  this.index=0;
  this.depth=0;
}
Parser.prototype.current=function(){ return this.tokens[this.index]; };
Parser.prototype.consume=function(type,message){
  var token=this.current();
  if(token.type!==type) this.fail('UNEXPECTED_TOKEN',message||('Expected "'+type+'".'),token,{expected:type,actual:token.type});
  this.index++;
  return token;
};
Parser.prototype.match=function(type){
  if(this.current().type!==type) return null;
  return this.tokens[this.index++];
};
Parser.prototype.fail=function(code,message,token,details){
  token=token||this.current();
  throw {dslParseAbort:true,error:errorObject(code,'parse',message,this.source,token.start,details)};
};
Parser.prototype.enter=function(token){
  this.depth++;
  if(this.depth>MAX_DEPTH) this.fail('DEPTH_LIMIT','DSL nesting limit exceeded.',token,{limit:MAX_DEPTH});
};
Parser.prototype.leave=function(){ this.depth--; };
Parser.prototype.parse=function(){
  if(this.current().type==='EOF') this.fail('EMPTY_SOURCE','A command expression is required.',this.current());
  var start=this.current().start,head=this.parseExpression(),effects=[];
  if(head.type!=='CallExpression') this.fail('EXPECTED_OPERATION','A command must start with an operation call.',this.tokens[0]);
  if(this.match('->')){
    if(this.current().type==='EOF') this.fail('MISSING_EFFECT','Expected an effect after "->".',this.current());
    effects.push(this.parseExpression());
    while(this.match('&&')){
      if(this.current().type==='EOF') this.fail('MISSING_EFFECT','Expected an effect after "&&".',this.current());
      effects.push(this.parseExpression());
    }
  }
  if(this.current().type!=='EOF') this.fail('TRAILING_TOKEN','Unexpected token after the command.',this.current(),{actual:this.current().raw});
  return {type:'Command',version:1,source:this.source,head:head,operation:head,effects:effects,span:{start:start,end:this.source.length}};
};
Parser.prototype.parseExpression=function(){ return this.parseComparison(); };
Parser.prototype.parseComparison=function(){
  var first=this.parseUnary(),operators=[],operands=[first],token;
  while(/^(<|<=|>|>=|==|!=)$/.test(this.current().type)){
    token=this.current();
    this.index++;
    operators.push(token.type);
    operands.push(this.parseUnary());
  }
  if(!operators.length) return first;
  return {type:'ComparisonExpression',operators:operators,operands:operands,valueType:TYPES.STATE,span:{start:first.span.start,end:operands[operands.length-1].span.end}};
};
Parser.prototype.parseUnary=function(){
  var token=this.current();
  if(token.type==='+'||token.type==='-'||token.type==='!'){
    this.index++;
    var argument=this.parseUnary();
    return {type:'UnaryExpression',operator:token.type,argument:argument,span:{start:token.start,end:argument.span.end}};
  }
  return this.parsePrimary();
};
Parser.prototype.parsePrimary=function(){
  var token=this.current(),node,start,args,close,typeToken;
  if(token.type==='NUMBER'){
    this.index++;
    node={type:'Literal',value:token.value,valueType:TYPES.QTY,raw:token.raw,explicitType:false,span:{start:token.start,end:token.end}};
  }else if(token.type==='STRING'){
    this.index++;
    node={type:'Literal',value:token.value,valueType:TYPES.ID,raw:token.raw,explicitType:false,span:{start:token.start,end:token.end}};
  }else if(token.type==='IDENT'){
    this.index++;
    start=token.start;
    if((token.value==='true'||token.value==='false')&&!token.explicitPort){
      node={type:'Literal',value:token.value==='true',valueType:TYPES.STATE,raw:token.raw,explicitType:false,span:{start:start,end:token.end}};
    }else if(this.match('(')){
      this.enter(token);
      args=[];
      if(this.current().type!==')'){
        args.push(this.parseExpression());
        while(this.match(',')){
          if(this.current().type===')') this.fail('TRAILING_COMMA','Trailing commas are not allowed.',this.current());
          args.push(this.parseExpression());
        }
      }
      close=this.consume(')','Expected ")" to close the call.');
      this.leave();
      if(normalizeType(token.value)){
        if(args.length!==1) this.fail('TYPE_ARITY','A type constructor accepts exactly one value.',token,{typeName:normalizeType(token.value),actualArity:args.length});
        node={type:'TypedExpression',valueType:normalizeType(token.value),expression:args[0],explicitType:true,span:{start:start,end:close.end}};
      }else{
        node={type:'CallExpression',callee:token.value,rawCallee:token.raw,arguments:args,span:{start:start,end:close.end}};
      }
    }else{
      if(own(RESERVED,token.value)) this.fail('RESERVED_IDENTIFIER','Reserved identifier is not allowed.',token,{identifier:token.value});
      var bareType=normalizeType(token.value);
      node={
        type:'Reference',name:token.value,explicitPort:!!token.explicitPort,
        valueType:bareType,declaredType:bareType,typePlaceholder:!!bareType,
        span:{start:start,end:token.end}
      };
    }
  }else if(token.type==='('){
    this.index++;
    this.enter(token);
    node=this.parseExpression();
    close=this.consume(')','Expected ")" to close the expression.');
    this.leave();
    node={type:'GroupExpression',expression:node,span:{start:token.start,end:close.end}};
  }else{
    this.fail('UNEXPECTED_TOKEN','Expected a literal, reference, or operation call.',token,{actual:token.type});
  }
  if(this.match(':')){
    typeToken=this.consume('IDENT','Expected a type name after ":".');
    if(typeToken.explicitPort||!normalizeType(typeToken.value)) this.fail('UNKNOWN_TYPE','Unknown DSL type.',typeToken,{typeName:typeToken.raw});
    if(node.type==='Reference'){
      node.declaredType=normalizeType(typeToken.value);
      node.valueType=node.declaredType;
      node.span.end=typeToken.end;
    }else{
      node={type:'TypedExpression',valueType:normalizeType(typeToken.value),expression:node,explicitType:true,span:{start:node.span.start,end:typeToken.end}};
    }
  }
  return node;
};

/** Parse a command string into a data-only AST. */
function parse(source){
  source=String(source==null?'':source);
  if(source.length>MAX_SOURCE_LENGTH){
    return resultFailure([errorObject('SOURCE_LIMIT','parse','DSL source length limit exceeded.',source,MAX_SOURCE_LENGTH,{limit:MAX_SOURCE_LENGTH,actual:source.length})],{source:source});
  }
  try{
    var tokens=new Lexer(source).scan();
    var ast=new Parser(source,tokens).parse();
    return {ok:true,ast:ast,errors:[],source:source};
  }catch(error){
    if(error&&error.dslParseAbort) return resultFailure([error.error],{source:source});
    return resultFailure([errorObject('INTERNAL_PARSE_ERROR','parse','The parser failed without executing the source.',source,0)],{source:source});
  }
}

function operationKey(name){
  name=String(name||'');
  return /^[A-Z_a-z][A-Z_a-z0-9]*$/.test(name)?name.toLowerCase():name;
}
function operationSignatures(name){
  var key=operationKey(name);
  return own(SIGNATURES,key)?SIGNATURES[key]:null;
}
function nodeIndex(node){ return node&&node.span?node.span.start:0; }
function addValidationError(state,code,message,node,details){
  state.errors.push(errorObject(code,'validate',message,state.source,nodeIndex(node),details));
}
function referenceOptionType(options,name){
  var sources=[options&&options.referenceTypes,options&&options.references,options&&options.bindings],i,source,value,type;
  for(i=0;i<sources.length;i++){
    source=sources[i];
    if(!source||!own(source,name)) continue;
    value=source[name];
    type=normalizeType(typeof value==='string'?value:(value&&typeof value==='object'?(value.type||value.valueType):null));
    if(!type) type=valueType(value&&typeof value==='object'&&own(value,'value')?value.value:value);
    return type;
  }
  return null;
}
function peekType(node,state){
  var inner;
  if(!node) return null;
  if(node.valueType) return normalizeType(node.valueType);
  if(node.type==='Reference') return normalizeType(node.declaredType)||referenceOptionType(state.options,node.name)||(state.references[node.name]&&state.references[node.name].type)||null;
  if(node.type==='TypedExpression') return normalizeType(node.valueType);
  if(node.type==='ComparisonExpression') return TYPES.STATE;
  if(node.type==='GroupExpression') return peekType(node.expression,state);
  if(node.type==='UnaryExpression') return peekType(node.argument,state);
  if(node.type==='CallExpression'&&node.signature) return node.signature.outputPort;
  if(node.type==='Literal') return normalizeType(node.valueType);
  if(node.type==='GroupExpression'){ inner=peekType(node.expression,state); return inner; }
  return null;
}
function rememberReference(node,type,state){
  var name=node.name,existing=state.references[name],declared=normalizeType(node.declaredType),optionType=referenceOptionType(state.options,name),resolved=declared||optionType||type;
  if(declared&&optionType&&!compatible(declared,optionType)){
    addValidationError(state,'REFERENCE_TYPE_CONFLICT','Reference declaration conflicts with the supplied reference type.',node,{reference:name,expected:declared,actual:optionType});
    return declared;
  }
  if(existing&&resolved&&!compatible(existing.type,resolved)){
    addValidationError(state,'REFERENCE_TYPE_CONFLICT','One reference cannot have two DSL types.',node,{reference:name,expected:existing.type,actual:resolved});
    return existing.type;
  }
  if(type&&resolved&&!compatible(resolved,type)){
    addValidationError(state,'TYPE_MISMATCH','Reference type does not match the operation signature.',node,{reference:name,expected:type,actual:resolved});
  }
  resolved=resolved||type||TYPES.ID;
  if(!existing){
    existing={name:name,type:resolved,explicitPort:!!node.explicitPort,positions:[nodeIndex(node)]};
    state.references[name]=existing;
    state.referenceOrder.push(name);
  }else{
    existing.explicitPort=existing.explicitPort||!!node.explicitPort;
    existing.positions.push(nodeIndex(node));
  }
  node.valueType=existing.type;
  return existing.type;
}
function inferTyped(node,state){
  var target=normalizeType(node.valueType),inner=node.expression,actual;
  if(!target){
    addValidationError(state,'UNKNOWN_TYPE','Unknown DSL type.',node,{typeName:node.valueType});
    return null;
  }
  if(target===TYPES.ORD&&inner.type==='Literal'&&inner.valueType===TYPES.QTY){
    if(!isFiniteNumber(inner.value)||Math.floor(inner.value)!==inner.value){
      addValidationError(state,'INVALID_TYPED_LITERAL','ORD literals must be finite integers.',inner,{expected:TYPES.ORD,actual:inner.value});
    }
    inner.valueType=TYPES.ORD;
    actual=TYPES.ORD;
  }else if(target===TYPES.OP&&inner.type==='Literal'&&inner.valueType===TYPES.ID){
    if(!operationSignatures(inner.value)) addValidationError(state,'UNKNOWN_OPERATION','OP literal names an unknown operation.',inner,{operation:inner.value});
    actual=TYPES.OP;
  }else if(target===TYPES.OP&&inner.type==='Reference'&&!inner.explicitPort&&!inner.declaredType){
    if(!operationSignatures(inner.name)) addValidationError(state,'UNKNOWN_OPERATION','OP literal names an unknown operation.',inner,{operation:inner.name});
    inner.valueType=TYPES.OP;
    actual=TYPES.OP;
  }else{
    actual=inferExpression(inner,target,state);
  }
  if(actual&&!compatible(actual,target)) addValidationError(state,'INVALID_TYPED_LITERAL','Value cannot be represented by the requested DSL type.',node,{expected:target,actual:actual});
  node.valueType=target;
  return target;
}
function inferComparison(node,state){
  var known=[],i,type,base=null,operator;
  for(i=0;i<node.operands.length;i++){
    type=peekType(node.operands[i],state);
    if(type) known.push(type);
  }
  if(known.length) base=known[0];
  if(!base) base=TYPES.QTY;
  for(i=1;i<known.length;i++) if(!compatible(base,known[i])){
    addValidationError(state,'TYPE_MISMATCH','Comparison operands must have one DSL type.',node,{expected:base,actual:known[i]});
    break;
  }
  for(i=0;i<node.operators.length;i++){
    operator=node.operators[i];
    if((operator!=='=='&&operator!=='!=')&&base!==TYPES.QTY&&base!==TYPES.ORD){
      addValidationError(state,'INVALID_COMPARISON','Ordered comparison requires QTY or ORD operands.',node,{operator:operator,actual:base});
    }
  }
  for(i=0;i<node.operands.length;i++) inferExpression(node.operands[i],base,state);
  node.valueType=TYPES.STATE;
  return TYPES.STATE;
}
function signatureText(item){ return item.inputPorts.join(',')+' -> '+item.outputPort; }
function inferCall(node,expected,state){
  var name=operationKey(node.callee),signatures=operationSignatures(name),candidates=[],arityCandidates=[],known=[],i,j,item,type,score,best;
  if(!signatures){
    addValidationError(state,'UNKNOWN_OPERATION','Unknown DSL operation.',node,{operation:node.callee});
    return null;
  }
  node.callee=name;
  for(i=0;i<node.arguments.length;i++) known.push(peekType(node.arguments[i],state));
  for(i=0;i<signatures.length;i++){
    item=signatures[i];
    if(item.inputPorts.length!==node.arguments.length) continue;
    arityCandidates.push(item);
    if(expected&&!compatible(item.outputPort,expected)) continue;
    score=0;
    for(j=0;j<known.length;j++){
      if(known[j]&&!compatible(known[j],item.inputPorts[j])) break;
      if(known[j]) score+=4;
      else if(item.inputPorts[j]===TYPES.ID) score+=1;
    }
    if(j===known.length) candidates.push({signature:item,index:i,score:score});
  }
  if(!candidates.length){
    addValidationError(state,'SIGNATURE_MISMATCH','Arguments do not match any signature for the operation.',node,{
      operation:name,actualTypes:known.map(function(value){ return value||'UNKNOWN'; }),
      expectedSignatures:(arityCandidates.length?arityCandidates:signatures).map(signatureText),expectedOutput:expected||null
    });
    return null;
  }
  candidates.sort(function(a,b){ return b.score-a.score||a.index-b.index; });
  best=candidates[0];
  node.signature={operation:name,index:best.index,inputPorts:best.signature.inputPorts.slice(),inputPort:best.signature.inputPort,outputPort:best.signature.outputPort,kind:best.signature.kind};
  node.valueType=best.signature.outputPort;
  for(i=0;i<node.arguments.length;i++) inferExpression(node.arguments[i],best.signature.inputPorts[i],state);
  if(expected&&!compatible(node.valueType,expected)) addValidationError(state,'TYPE_MISMATCH','Operation output does not match the required type.',node,{operation:name,expected:expected,actual:node.valueType});
  return node.valueType;
}
function inferExpression(node,expected,state){
  var actual,operator;
  if(!node||typeof node!=='object'){
    addValidationError(state,'INVALID_AST','Invalid AST expression.',state.ast,{expected:expected||null});
    return null;
  }
  if(node.type==='Literal') actual=normalizeType(node.valueType);
  else if(node.type==='Reference') actual=rememberReference(node,expected,state);
  else if(node.type==='TypedExpression') actual=inferTyped(node,state);
  else if(node.type==='CallExpression') actual=inferCall(node,expected,state);
  else if(node.type==='ComparisonExpression') actual=inferComparison(node,state);
  else if(node.type==='GroupExpression') actual=inferExpression(node.expression,expected,state);
  else if(node.type==='UnaryExpression'){
    operator=node.operator;
    if(operator==='!') actual=inferExpression(node.argument,TYPES.STATE,state);
    else{
      actual=inferExpression(node.argument,expected,state);
      if(operator==='-'&&actual!==TYPES.QTY&&actual!==TYPES.ORD) addValidationError(state,'INVALID_UNARY','Unary "-" requires QTY or ORD.',node,{operator:operator,actual:actual});
      if(operator==='+'&&actual!==TYPES.QTY&&actual!==TYPES.ORD&&actual!==TYPES.ID) addValidationError(state,'INVALID_UNARY','Unary "+" requires QTY, ORD, or symbolic ID.',node,{operator:operator,actual:actual});
    }
    node.valueType=actual;
  }else{
    addValidationError(state,'INVALID_AST','Unknown AST node type.',node,{nodeType:node.type});
    return null;
  }
  if(expected&&actual&&!compatible(actual,expected)) addValidationError(state,'TYPE_MISMATCH','Expression type does not match the required type.',node,{expected:expected,actual:actual});
  if(node.type==='Literal'&&actual===TYPES.QTY&&!isFiniteNumber(node.value)) addValidationError(state,'INVALID_TYPED_LITERAL','QTY literals must be finite numbers.',node,{actual:node.value});
  return actual;
}
function normalizedPortOption(state,name,inferred,node){
  if(!state.options||state.options[name]==null) return inferred;
  var supplied=normalizeType(state.options[name]);
  if(!supplied){
    addValidationError(state,'UNKNOWN_TYPE','Unknown '+name+' type.',node,{port:name,typeName:state.options[name]});
    return inferred;
  }
  if(inferred&&!compatible(inferred,supplied)) addValidationError(state,'PORT_DECLARATION_MISMATCH','Declared port conflicts with the operation signature.',node,{port:name,expected:inferred,actual:supplied});
  return supplied;
}

/** Validate operation signatures, references, effects, and command ports. */
function validate(input,options){
  options=options||{};
  var parsed=input&&input.ok!=null&&input.ast?input:(typeof input==='string'||input==null?parse(input):null);
  if(parsed&&!parsed.ok) return resultFailure(parsed.errors.slice(),{ast:null,source:parsed.source||String(input||''),evidence:'UNVERIFIED',evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'});
  var ast=parsed?parsed.ast:input;
  if(!ast||ast.type!=='Command'||!ast.head){
    return resultFailure([errorObject('INVALID_AST','validate','validate() requires a command source or Command AST.',ast&&ast.source||'',0)],{ast:null,evidence:'UNVERIFIED',evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'});
  }
  var state={ast:ast,source:String(ast.source||''),options:options,errors:[],references:nullMap(),referenceOrder:[]};
  var outputPort=inferExpression(ast.head,null,state),i;
  for(i=0;i<ast.effects.length;i++){
    if(ast.effects[i].type!=='CallExpression'){
      addValidationError(state,'EXPECTED_EFFECT_OPERATION','Each expression after "->" or "&&" must be an operation call.',ast.effects[i]);
      inferExpression(ast.effects[i],TYPES.EFFECT,state);
    }else inferExpression(ast.effects[i],TYPES.EFFECT,state);
  }
  var inputPort=ast.head.signature?ast.head.signature.inputPort:null;
  inputPort=normalizedPortOption(state,'inputPort',inputPort,ast.head);
  outputPort=normalizedPortOption(state,'outputPort',outputPort,ast.head);
  var references=state.referenceOrder.map(function(name){
    var item=state.references[name];
    return {name:item.name,type:item.type,explicitPort:item.explicitPort,positions:item.positions.slice()};
  });
  var explicitPort=null,headRefs=[];
  references.forEach(function(item){ if(item.explicitPort&&!explicitPort) explicitPort=item.name; });
  collectReferences(ast.head,headRefs);
  if(!explicitPort){
    for(i=0;i<headRefs.length;i++) if(state.references[headRefs[i]]&&state.references[headRefs[i]].type===inputPort){ explicitPort=headRefs[i]; break; }
  }
  if(state.errors.length) return resultFailure(state.errors,{ast:ast,source:state.source,inputPort:inputPort,outputPort:outputPort,references:references,evidence:'UNVERIFIED',evidenceLevel:'UNVERIFIED',soundness:'NOT_COMPUTED'});
  ast.inputPort=inputPort;
  ast.outputPort=outputPort;
  ast.references=references;
  return {
    ok:true,ast:ast,source:state.source,errors:[],inputPort:inputPort,
    inputPorts:ast.head.signature.inputPorts.slice(),outputPort:outputPort,
    portReference:explicitPort,references:references,evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED'
  };
}

function collectReferences(node,out){
  var i;
  if(!node||typeof node!=='object') return;
  if(node.type==='Reference'){
    if(out.indexOf(node.name)<0) out.push(node.name);
    return;
  }
  if(node.type==='CallExpression') for(i=0;i<node.arguments.length;i++) collectReferences(node.arguments[i],out);
  else if(node.type==='TypedExpression'||node.type==='GroupExpression'||node.type==='UnaryExpression') collectReferences(node.expression||node.argument,out);
  else if(node.type==='ComparisonExpression') for(i=0;i<node.operands.length;i++) collectReferences(node.operands[i],out);
}
function contractText(value,fallback){
  if(value==null||value==='') return fallback;
  if(typeof value==='string') return value.trim()||fallback;
  if(typeof value==='boolean') return value?'TRUE':'FALSE';
  if(value&&typeof value.text==='string') return value.text;
  return String(value);
}
function compileContract(validation,contract){
  contract=contract||{};
  var operation=validation.ast.head.callee,input=validation.inputPort||'NONE',output=validation.outputPort||'NONE';
  return {
    pre:contractText(contract.pre,'signature '+operation+' accepts inputPort '+input),
    inv:contractText(contract.inv,'typed ports remain unchanged during structural execution'),
    post:contractText(contract.post,'result has outputPort '+output),
    proof:contractText(contract.proof,'parse and signature trace only; no mathematical proof was computed'),
    evidence:'STRUCTURAL',soundness:'NOT_COMPUTED'
  };
}
function copyBindings(base,extra){
  var out=nullMap();
  [base,extra].forEach(function(source){
    if(!source||typeof source!=='object') return;
    Object.keys(source).forEach(function(key){ if(!own(RESERVED,key)) out[key]=source[key]; });
  });
  return out;
}
function runtimeError(state,code,message,node,details){
  state.errors.push(errorObject(code,'runtime',message,state.source,nodeIndex(node),details));
  throw {dslRuntimeAbort:true};
}
function unwrapRuntime(value){
  if(value&&typeof value==='object'&&normalizeType(value.type||value.valueType)&&own(value,'value')) return {type:normalizeType(value.type||value.valueType),value:value.value};
  return {type:valueType(value),value:value};
}
function validRuntimeValue(type,value){
  if(type===TYPES.QTY) return isFiniteNumber(value);
  if(type===TYPES.ORD) return isFiniteNumber(value)&&Math.floor(value)===value;
  if(type===TYPES.ID) return typeof value==='string';
  if(type===TYPES.OP) return typeof value==='string'&&!!operationSignatures(value);
  if(type===TYPES.STATE) return typeof value==='boolean';
  if(type===TYPES.EFFECT) return !!value&&typeof value==='object'&&value.type===TYPES.EFFECT;
  return false;
}
function makeEffect(name,args){ return deepFreeze({type:TYPES.EFFECT,operation:name,args:args.slice()}); }
function builtinOperation(name,args,signatureInfo,state,node){
  if(name==='add') return signatureInfo.outputPort===TYPES.QTY?args[0]+args[1]:makeEffect(name,args);
  if(name==='sub') return args[0]-args[1];
  if(name==='mul') return args[0]*args[1];
  if(name==='div'){
    if(args[1]===0) runtimeError(state,'DIVIDE_BY_ZERO','Division by zero is not defined.',node,{operation:name});
    return args[0]/args[1];
  }
  if(name==='compare') return args[0]===args[1]?0:(args[0]<args[1]?-1:1);
  if(name==='eq') return args[0]===args[1];
  if(name==='neq') return args[0]!==args[1];
  if(name==='lt') return args[0]<args[1];
  if(name==='lte') return args[0]<=args[1];
  if(name==='gt') return args[0]>args[1];
  if(name==='gte') return args[0]>=args[1];
  if(name==='identity') return args[0];
  return makeEffect(name,args);
}
function evaluateReference(node,state){
  var raw,unwrapped,expected=node.valueType;
  if(own(state.bindings,node.name)){
    raw=state.bindings[node.name];
    unwrapped=unwrapRuntime(raw);
    if(unwrapped.type&&!compatible(unwrapped.type,expected)) runtimeError(state,'RUNTIME_TYPE_MISMATCH','Reference value has the wrong DSL type.',node,{reference:node.name,expected:expected,actual:unwrapped.type});
    if(!validRuntimeValue(expected,unwrapped.value)) runtimeError(state,'INVALID_RUNTIME_VALUE','Reference value is invalid for its DSL type.',node,{reference:node.name,expected:expected});
    return unwrapped.value;
  }
  if(expected===TYPES.ID&&!node.explicitPort) return node.name;
  if(expected===TYPES.OP&&!node.explicitPort&&operationSignatures(node.name)) return operationKey(node.name);
  runtimeError(state,'MISSING_REFERENCE','No runtime value was supplied for a reference.',node,{reference:node.name,expected:expected});
}
function evaluateExpression(node,state){
  var i,left,right,args=[],value,handler,unwrapped;
  if(node.type==='Literal') return node.value;
  if(node.type==='Reference') return evaluateReference(node,state);
  if(node.type==='GroupExpression') return evaluateExpression(node.expression,state);
  if(node.type==='TypedExpression'){
    value=evaluateExpression(node.expression,state);
    if(!validRuntimeValue(node.valueType,value)) runtimeError(state,'INVALID_RUNTIME_VALUE','Typed expression produced an invalid value.',node,{expected:node.valueType});
    return value;
  }
  if(node.type==='UnaryExpression'){
    value=evaluateExpression(node.argument,state);
    if(node.operator==='-') return -value;
    if(node.operator==='!') return !value;
    return value;
  }
  if(node.type==='ComparisonExpression'){
    for(i=0;i<node.operators.length;i++){
      left=evaluateExpression(node.operands[i],state);
      right=evaluateExpression(node.operands[i+1],state);
      if(node.operators[i]==='<'&&!(left<right)) return false;
      if(node.operators[i]==='<='&&!(left<=right)) return false;
      if(node.operators[i]==='>'&&!(left>right)) return false;
      if(node.operators[i]==='>='&&!(left>=right)) return false;
      if(node.operators[i]==='=='&&left!==right) return false;
      if(node.operators[i]==='!='&&left===right) return false;
    }
    return true;
  }
  if(node.type==='CallExpression'){
    for(i=0;i<node.arguments.length;i++) args.push(evaluateExpression(node.arguments[i],state));
    handler=state.operations&&own(state.operations,node.callee)?state.operations[node.callee]:null;
    try{
      value=typeof handler==='function'?handler(args.slice(),deepFreeze({operation:node.callee,signature:node.signature})):builtinOperation(node.callee,args,node.signature,state,node);
    }catch(error){
      if(error&&error.dslRuntimeAbort) throw error;
      runtimeError(state,'OPERATION_FAILED','Operation handler failed.',node,{operation:node.callee,reason:error&&error.message?String(error.message):'unknown'});
    }
    unwrapped=unwrapRuntime(value);
    if(unwrapped.type&&compatible(unwrapped.type,node.valueType)) value=unwrapped.value;
    if(!validRuntimeValue(node.valueType,value)) runtimeError(state,'INVALID_OPERATION_RESULT','Operation returned a value with the wrong DSL type.',node,{operation:node.callee,expected:node.valueType,actual:unwrapped.type});
    return value;
  }
  runtimeError(state,'INVALID_AST','Cannot execute an unknown AST node.',node,{nodeType:node.type});
}
function makeExecutor(validation,options){
  var baseBindings=copyBindings(options.bindings,null),operations=options.operations||null,ast=validation.ast,source=validation.source;
  return function(bindings){
    var state={source:source,bindings:copyBindings(baseBindings,bindings),operations:operations,errors:[]},effects=[],value,i;
    try{
      value=evaluateExpression(ast.head,state);
      for(i=0;i<ast.effects.length;i++) effects.push(evaluateExpression(ast.effects[i],state));
      return {ok:true,value:value,valueType:validation.outputPort,outputPort:validation.outputPort,effects:effects,errors:[]};
    }catch(error){
      if(error&&error.dslRuntimeAbort) return resultFailure(state.errors,{value:null,valueType:validation.outputPort,outputPort:validation.outputPort,effects:effects});
      return resultFailure([errorObject('INTERNAL_RUNTIME_ERROR','runtime','The interpreter failed without evaluating source code.',source,0)],{value:null,valueType:validation.outputPort,outputPort:validation.outputPort,effects:effects});
    }
  };
}

/** Compile to a validated descriptor backed by a safe AST interpreter. */
function compile(input,options){
  options=options||{};
  var validation=validate(input,options);
  if(!validation.ok) return validation;
  var contract=compileContract(validation,options.contract),compiled={
    ok:true,kind:'CompiledCommand',version:VERSION,id:String(options.id||options.name||validation.ast.head.callee),
    source:validation.source,ast:validation.ast,operation:validation.ast.head.callee,
    inputPort:validation.inputPort,inputPorts:validation.inputPorts.slice(),outputPort:validation.outputPort,
    portReference:options.portReference||validation.portReference||null,references:validation.references,
    contract:contract,errors:[],evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED',
    structuralTrace:{parsed:true,signatures:true,effectsTyped:true,ports:{input:validation.inputPort,output:validation.outputPort},mathematicalProof:false}
  };
  compiled.execute=makeExecutor(validation,options);
  compiled.run=compiled.execute;
  deepFreeze(compiled.ast);
  return compiled;
}

function componentName(component,fallback){ return String(component.id||component.name||component.operation||fallback); }
function componentContract(component){
  var contract=component.contract||{};
  return {
    pre:contractText(contract.pre,'structural precondition not supplied'),
    inv:contractText(contract.inv,'structural invariant not supplied'),
    post:contractText(contract.post,'structural postcondition not supplied'),
    proof:contractText(contract.proof,'component proof metadata not supplied')
  };
}
function coerceComponent(value,label,options){
  if(typeof value==='string'||(value&&value.type==='Command')||(value&&value.ast&&value.ast.type==='Command'&&value.kind!=='CompiledCommand')){
    return compile(value&&value.ast?value.ast:value,(options&&options[label])||{});
  }
  if(value&&value.ok===false) return value;
  if(value&&normalizeType(value.inputPort)&&normalizeType(value.outputPort)) return value;
  return resultFailure([errorObject('INVALID_COMPONENT','compose','compose() requires compiled commands or typed command descriptors.','',0,{component:label})],{evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED'});
}
function clauseText(name,stage,value){ return stage+' '+name+': ('+value+')'; }
function composedExecutor(left,right,portReference){
  if(typeof left.execute!=='function'||typeof right.execute!=='function') return null;
  return function(bindings){
    bindings=bindings||{};
    var shared=bindings.shared||bindings,leftBindings=copyBindings(shared,bindings.A),rightBindings=copyBindings(shared,bindings.B);
    var first=left.execute(leftBindings);
    if(!first.ok) return resultFailure(first.errors,{stage:'A',left:first,right:null,effects:first.effects||[]});
    if(portReference) rightBindings[portReference]={type:left.outputPort,value:first.value};
    var second=right.execute(rightBindings),effects=(first.effects||[]).concat(second.effects||[]);
    if(!second.ok) return resultFailure(second.errors,{stage:'B',left:first,right:second,effects:effects});
    return {ok:true,value:second.value,valueType:right.outputPort,outputPort:right.outputPort,effects:effects,left:first,right:second,errors:[]};
  };
}

/** Compose two typed commands after an exact structural port check. */
function compose(A,B,options){
  options=options||{};
  var left=coerceComponent(A,'A',options),right=coerceComponent(B,'B',options);
  if(!left.ok||!right.ok){
    var componentErrors=[];
    if(!left.ok) componentErrors=componentErrors.concat(left.errors||[]);
    if(!right.ok) componentErrors=componentErrors.concat(right.errors||[]);
    return resultFailure(componentErrors,{evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED'});
  }
  var out=normalizeType(left.outputPort),input=normalizeType(right.inputPort),leftName=componentName(left,'A'),rightName=componentName(right,'B');
  if(!out||!input){
    return resultFailure([errorObject('MISSING_PORT','compose','Both composition ports must have known DSL types.','',0,{leftOutputPort:left.outputPort||null,rightInputPort:right.inputPort||null})],{evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED'});
  }
  if(!compatible(out,input)){
    return resultFailure([errorObject('PORT_TYPE_MISMATCH','compose','A.outputPort is not compatible with B.inputPort.','',0,{componentA:leftName,componentB:rightName,actual:out,expected:input,outputPort:out,inputPort:input})],{
      portCheck:{ok:false,outputPort:out,inputPort:input},evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED'
    });
  }
  var ca=componentContract(left),cb=componentContract(right);
  var structure={
    pre:{kind:'SEQUENCE',clauses:[{component:leftName,stage:'before A',value:ca.pre},{component:rightName,stage:'after A',value:cb.pre}]},
    inv:{kind:'ALL',clauses:[{component:leftName,value:ca.inv},{component:rightName,value:cb.inv}]},
    post:{kind:'SEQUENCE',clauses:[{component:leftName,value:ca.post},{component:rightName,value:cb.post}]},
    proof:{kind:'STRUCTURAL_TRACE',portCheck:{ok:true,outputPort:out,inputPort:input},componentProofs:[{component:leftName,value:ca.proof,verified:false},{component:rightName,value:cb.proof,verified:false}],mathematicalProof:false,evidence:'STRUCTURAL',soundness:'NOT_COMPUTED'}
  };
  var contract={
    pre:clauseText(leftName,'before A',ca.pre)+' && '+clauseText(rightName,'after A',cb.pre),
    inv:'A '+leftName+': ('+ca.inv+') && B '+rightName+': ('+cb.inv+')',
    post:'A '+leftName+': ('+ca.post+') && B '+rightName+': ('+cb.post+')',
    proof:'STRUCTURAL only: '+leftName+'.outputPort '+out+' == '+rightName+'.inputPort '+input+'; component proof fields are preserved as unverified metadata; mathematical proof was not computed.',
    evidence:'STRUCTURAL',soundness:'NOT_COMPUTED'
  };
  var portReference=right.portReference||null,executor=composedExecutor(left,right,portReference);
  var composed={
    ok:true,kind:'ComposedCommand',version:VERSION,id:'compose('+leftName+','+rightName+')',
    inputPort:normalizeType(left.inputPort),outputPort:normalizeType(right.outputPort),
    components:[left,right],ast:{type:'Composition',left:left.ast||null,right:right.ast||null,portCheck:structure.proof.portCheck},
    contract:contract,contractStructure:structure,portCheck:structure.proof.portCheck,
    evidence:'STRUCTURAL',evidenceLevel:'STRUCTURAL',soundness:'NOT_COMPUTED',mathematicalProof:false,errors:[]
  };
  if(executor){ composed.execute=executor; composed.run=executor; }
  return composed;
}

deepFreeze(TYPES);
var api={
  version:VERSION,VERSION:VERSION,TYPES:TYPES,types:TYPES,SIGNATURES:SIGNATURES,signatures:SIGNATURES,
  parse:parse,validate:validate,compile:compile,compose:compose,isTypeCompatible:compatible
};
return freeze(api);
});
