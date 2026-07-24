(function(global){
'use strict';

var VERSION='1.0.0';
var HASH_PREFIX='sha256:';
var objectToString=Object.prototype.toString;
var hasOwn=Object.prototype.hasOwnProperty;

function fail(code,path,message){
  var error=new TypeError(code+(path?' at '+path:'')+(message?': '+message:''));
  error.name='P78CanonicalJsonError';
  error.code=code;
  error.path=path||'$';
  throw error;
}

function deepFreeze(value,seen){
  var keys,i;
  if(value===null||(typeof value!=='object'&&typeof value!=='function')) return value;
  seen=seen||[];
  if(seen.indexOf(value)!==-1) return value;
  seen.push(value);
  keys=Object.getOwnPropertyNames(value);
  for(i=0;i<keys.length;i++) deepFreeze(value[keys[i]],seen);
  return Object.freeze(value);
}

function assertUnicodeScalarString(value,path){
  var i,first,second;
  for(i=0;i<value.length;i++){
    first=value.charCodeAt(i);
    if(first>=0xd800&&first<=0xdbff){
      if(i+1>=value.length) fail('INVALID_UNICODE',path,'unpaired high surrogate');
      second=value.charCodeAt(i+1);
      if(second<0xdc00||second>0xdfff) fail('INVALID_UNICODE',path,'unpaired high surrogate');
      i++;
    }else if(first>=0xdc00&&first<=0xdfff){
      fail('INVALID_UNICODE',path,'unpaired low surrogate');
    }
  }
}

function assertPlainObject(value,path){
  var proto,names,keys,symbols,i,descriptor;
  if(objectToString.call(value)!=='[object Object]') fail('NON_JSON_VALUE',path,'object must be plain');
  proto=Object.getPrototypeOf(value);
  if(proto!==null&&Object.getPrototypeOf(proto)!==null) fail('NON_JSON_VALUE',path,'class instances are not allowed');
  symbols=Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(value):[];
  if(symbols.length) fail('NON_JSON_KEY',path,'symbol keys are not allowed');
  names=Object.getOwnPropertyNames(value);
  keys=Object.keys(value);
  if(names.length!==keys.length) fail('NON_JSON_KEY',path,'non-enumerable properties are not allowed');
  for(i=0;i<keys.length;i++){
    descriptor=Object.getOwnPropertyDescriptor(value,keys[i]);
    if(!descriptor||!hasOwn.call(descriptor,'value')) fail('NON_JSON_VALUE',path+'.'+keys[i],'accessors are not allowed');
  }
}

function copyData(value,path,ancestors){
  var type,i,keys,key,result;
  if(value===null) return null;
  type=typeof value;
  if(type==='string'){
    assertUnicodeScalarString(value,path);
    return value;
  }
  if(type==='boolean') return value;
  if(type==='number'){
    if(!Number.isFinite(value)) fail('NON_FINITE_NUMBER',path,'number must be finite');
    return value;
  }
  if(type!=='object') fail('NON_JSON_VALUE',path,'unsupported '+type);
  if(ancestors.indexOf(value)!==-1) fail('CYCLIC_VALUE',path,'cycles are not allowed');
  ancestors.push(value);
  if(Array.isArray(value)){
    if(Object.keys(value).length!==value.length) fail('SPARSE_ARRAY',path,'arrays must be dense and have no named properties');
    result=new Array(value.length);
    for(i=0;i<value.length;i++){
      if(!hasOwn.call(value,String(i))) fail('SPARSE_ARRAY',path+'['+i+']','missing item');
      result[i]=copyData(value[i],path+'['+i+']',ancestors);
    }
  }else{
    assertPlainObject(value,path);
    result={};
    keys=Object.keys(value);
    for(i=0;i<keys.length;i++){
      key=keys[i];
      assertUnicodeScalarString(key,path+'.<key>');
      Object.defineProperty(result,key,{
        value:copyData(value[key],path+'.'+key,ancestors),
        enumerable:true,
        configurable:true,
        writable:true
      });
    }
  }
  ancestors.pop();
  return result;
}

function deepCopy(value){ return copyData(value,'$',[]); }
function copyAndFreeze(value){ return deepFreeze(deepCopy(value)); }

function quote(value,path){
  assertUnicodeScalarString(value,path);
  return JSON.stringify(value);
}

function canonicalPart(value,path,ancestors){
  var type,parts,keys,i,key;
  if(value===null) return 'null';
  type=typeof value;
  if(type==='string') return quote(value,path);
  if(type==='boolean') return value?'true':'false';
  if(type==='number'){
    if(!Number.isFinite(value)) fail('NON_FINITE_NUMBER',path,'number must be finite');
    return Object.is(value,-0)?'0':JSON.stringify(value);
  }
  if(type!=='object') fail('NON_JSON_VALUE',path,'unsupported '+type);
  if(ancestors.indexOf(value)!==-1) fail('CYCLIC_VALUE',path,'cycles are not allowed');
  ancestors.push(value);
  parts=[];
  if(Array.isArray(value)){
    if(Object.keys(value).length!==value.length) fail('SPARSE_ARRAY',path,'arrays must be dense and have no named properties');
    for(i=0;i<value.length;i++){
      if(!hasOwn.call(value,String(i))) fail('SPARSE_ARRAY',path+'['+i+']','missing item');
      parts.push(canonicalPart(value[i],path+'['+i+']',ancestors));
    }
    ancestors.pop();
    return '['+parts.join(',')+']';
  }
  assertPlainObject(value,path);
  keys=Object.keys(value).sort();
  for(i=0;i<keys.length;i++){
    key=keys[i];
    parts.push(quote(key,path+'.<key>')+':'+canonicalPart(value[key],path+'.'+key,ancestors));
  }
  ancestors.pop();
  return '{'+parts.join(',')+'}';
}

function canonicalize(value){ return canonicalPart(value,'$',[]); }

function utf8Bytes(text){
  var bytes=[],i,first,second,point;
  if(typeof text!=='string') fail('TEXT_REQUIRED','$','UTF-8 input must be a string');
  assertUnicodeScalarString(text,'$');
  for(i=0;i<text.length;i++){
    first=text.charCodeAt(i);
    if(first>=0xd800&&first<=0xdbff){
      second=text.charCodeAt(++i);
      point=0x10000+((first-0xd800)<<10)+(second-0xdc00);
    }else{
      point=first;
    }
    if(point<=0x7f){
      bytes.push(point);
    }else if(point<=0x7ff){
      bytes.push(0xc0|(point>>>6),0x80|(point&0x3f));
    }else if(point<=0xffff){
      bytes.push(0xe0|(point>>>12),0x80|((point>>>6)&0x3f),0x80|(point&0x3f));
    }else{
      bytes.push(0xf0|(point>>>18),0x80|((point>>>12)&0x3f),0x80|((point>>>6)&0x3f),0x80|(point&0x3f));
    }
  }
  return bytes;
}

var SHA256_K=deepFreeze([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);

function rotateRight(value,count){ return (value>>>count)|(value<<(32-count)); }

function sha256HexBytes(input){
  var bytes=input.slice(),bitHigh=Math.floor(input.length/0x20000000),bitLow=(input.length<<3)>>>0;
  var hash=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var words=new Array(64),offset,i,a,b,c,d,e,f,g,h,s0,s1,choice,majority,temp1,temp2;
  bytes.push(0x80);
  while(bytes.length%64!==56) bytes.push(0);
  bytes.push((bitHigh>>>24)&255,(bitHigh>>>16)&255,(bitHigh>>>8)&255,bitHigh&255);
  bytes.push((bitLow>>>24)&255,(bitLow>>>16)&255,(bitLow>>>8)&255,bitLow&255);
  for(offset=0;offset<bytes.length;offset+=64){
    for(i=0;i<16;i++) words[i]=((bytes[offset+i*4]<<24)|(bytes[offset+i*4+1]<<16)|(bytes[offset+i*4+2]<<8)|bytes[offset+i*4+3])>>>0;
    for(i=16;i<64;i++){
      s0=(rotateRight(words[i-15],7)^rotateRight(words[i-15],18)^(words[i-15]>>>3))>>>0;
      s1=(rotateRight(words[i-2],17)^rotateRight(words[i-2],19)^(words[i-2]>>>10))>>>0;
      words[i]=(words[i-16]+s0+words[i-7]+s1)>>>0;
    }
    a=hash[0]; b=hash[1]; c=hash[2]; d=hash[3]; e=hash[4]; f=hash[5]; g=hash[6]; h=hash[7];
    for(i=0;i<64;i++){
      s1=(rotateRight(e,6)^rotateRight(e,11)^rotateRight(e,25))>>>0;
      choice=((e&f)^((~e)&g))>>>0;
      temp1=(h+s1+choice+SHA256_K[i]+words[i])>>>0;
      s0=(rotateRight(a,2)^rotateRight(a,13)^rotateRight(a,22))>>>0;
      majority=((a&b)^(a&c)^(b&c))>>>0;
      temp2=(s0+majority)>>>0;
      h=g; g=f; f=e; e=(d+temp1)>>>0; d=c; c=b; b=a; a=(temp1+temp2)>>>0;
    }
    hash[0]=(hash[0]+a)>>>0; hash[1]=(hash[1]+b)>>>0;
    hash[2]=(hash[2]+c)>>>0; hash[3]=(hash[3]+d)>>>0;
    hash[4]=(hash[4]+e)>>>0; hash[5]=(hash[5]+f)>>>0;
    hash[6]=(hash[6]+g)>>>0; hash[7]=(hash[7]+h)>>>0;
  }
  return hash.map(function(value){ return ('00000000'+value.toString(16)).slice(-8); }).join('');
}

function sha256Hex(text){ return sha256HexBytes(utf8Bytes(text)); }
function hashText(text){ return HASH_PREFIX+sha256Hex(text); }
function hashCanonical(value){ return hashText(canonicalize(value)); }
function isSha256(value){ return typeof value==='string'&&/^sha256:[0-9a-f]{64}$/.test(value); }
function isPlainObject(value){
  try{ assertPlainObject(value,'$'); return true; }
  catch(error){ return false; }
}

var api=deepFreeze({
  version:VERSION,
  schema:'meridian.canonical-json/1',
  encoding:'UTF-8',
  hashAlgorithm:'SHA-256',
  hashPrefix:HASH_PREFIX,
  deepCopy:deepCopy,
  deepFreeze:deepFreeze,
  copyAndFreeze:copyAndFreeze,
  canonicalize:canonicalize,
  stringify:canonicalize,
  utf8Bytes:utf8Bytes,
  sha256Hex:sha256Hex,
  hashText:hashText,
  hashCanonical:hashCanonical,
  isSha256:isSha256,
  isPlainObject:isPlainObject
});
global.MRDP78CanonicalJSON=api;
global.MRDP78CanonicalJson=api;
})(typeof globalThis!=='undefined'?globalThis:this);
