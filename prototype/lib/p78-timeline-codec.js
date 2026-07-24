(function(global){
'use strict';

var VERSION='1.0.0';
var PROVIDER_ID='pulse-codec';
var STRUCTURAL='STRUCTURAL';
var NOT_COMPUTED='NOT_COMPUTED';
var BIT_ORDER='msb0';
var UTF8='UTF-8';
var HASH_ALGORITHM='SHA-256';
var HASH_PREFIX='sha256:';
var DEFAULT_PROFILE_ID='international-itu-r-m1677-1';
var CYRILLIC_PROFILE_ID='cyrillic-ru-v1';

function freeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(key){ freeze(value[key]); });
  return Object.freeze(value);
}

var ERROR_CODES=freeze({
  INPUT_REQUIRED:'CODEC_INPUT_REQUIRED',
  INVALID_UNICODE:'CODEC_INVALID_UNICODE',
  INVALID_BINARY:'CODEC_INVALID_BINARY',
  INVALID_UTF8:'CODEC_INVALID_UTF8',
  HASH_MISMATCH:'CODEC_HASH_MISMATCH',
  ROUNDTRIP_MISMATCH:'CODEC_ROUNDTRIP_MISMATCH',
  NORMALIZATION_UNSUPPORTED:'CODEC_NORMALIZATION_UNSUPPORTED',
  PROFILE_UNAVAILABLE:'CODEC_PROFILE_UNAVAILABLE',
  UNSUPPORTED_SYMBOL:'CODEC_UNSUPPORTED_SYMBOL',
  EMPTY_INPUT:'CODEC_EMPTY_INPUT'
});

function outcome(kind,status,code,extra){
  var value={
    version:VERSION,
    providerId:PROVIDER_ID,
    providerVersion:VERSION,
    kind:kind,
    status:status,
    code:code||null,
    evidence:STRUCTURAL,
    evidenceLevel:STRUCTURAL,
    soundness:NOT_COMPUTED,
    semanticTruth:false
  };
  Object.keys(extra||{}).forEach(function(key){ value[key]=extra[key]; });
  return freeze(value);
}

function utf8Encode(text){
  var bytes=[], i, first, second, codePoint;
  for(i=0;i<text.length;i++){
    first=text.charCodeAt(i);
    if(first>=0xd800&&first<=0xdbff){
      if(i+1>=text.length) return {ok:false,index:i};
      second=text.charCodeAt(i+1);
      if(second<0xdc00||second>0xdfff) return {ok:false,index:i};
      codePoint=0x10000+((first-0xd800)<<10)+(second-0xdc00);
      i++;
    }else if(first>=0xdc00&&first<=0xdfff){
      return {ok:false,index:i};
    }else{
      codePoint=first;
    }
    if(codePoint<=0x7f){
      bytes.push(codePoint);
    }else if(codePoint<=0x7ff){
      bytes.push(0xc0|(codePoint>>>6),0x80|(codePoint&0x3f));
    }else if(codePoint<=0xffff){
      bytes.push(0xe0|(codePoint>>>12),0x80|((codePoint>>>6)&0x3f),0x80|(codePoint&0x3f));
    }else{
      bytes.push(0xf0|(codePoint>>>18),0x80|((codePoint>>>12)&0x3f),0x80|((codePoint>>>6)&0x3f),0x80|(codePoint&0x3f));
    }
  }
  return {ok:true,bytes:bytes};
}

function continuation(value){ return value>=0x80&&value<=0xbf; }

function utf8Decode(bytes){
  var chars=[], i=0, first, second, third, fourth, codePoint;
  while(i<bytes.length){
    first=bytes[i];
    if(first<=0x7f){
      codePoint=first; i++;
    }else if(first>=0xc2&&first<=0xdf){
      if(i+1>=bytes.length||!continuation(bytes[i+1])) return {ok:false,index:i};
      second=bytes[i+1];
      codePoint=((first&0x1f)<<6)|(second&0x3f); i+=2;
    }else if(first>=0xe0&&first<=0xef){
      if(i+2>=bytes.length||!continuation(bytes[i+1])||!continuation(bytes[i+2])) return {ok:false,index:i};
      second=bytes[i+1]; third=bytes[i+2];
      if((first===0xe0&&second<0xa0)||(first===0xed&&second>0x9f)) return {ok:false,index:i};
      codePoint=((first&0x0f)<<12)|((second&0x3f)<<6)|(third&0x3f); i+=3;
    }else if(first>=0xf0&&first<=0xf4){
      if(i+3>=bytes.length||!continuation(bytes[i+1])||!continuation(bytes[i+2])||!continuation(bytes[i+3])) return {ok:false,index:i};
      second=bytes[i+1]; third=bytes[i+2]; fourth=bytes[i+3];
      if((first===0xf0&&second<0x90)||(first===0xf4&&second>0x8f)) return {ok:false,index:i};
      codePoint=((first&0x07)<<18)|((second&0x3f)<<12)|((third&0x3f)<<6)|(fourth&0x3f); i+=4;
    }else{
      return {ok:false,index:i};
    }
    if(codePoint<=0xffff){
      chars.push(String.fromCharCode(codePoint));
    }else{
      codePoint-=0x10000;
      chars.push(String.fromCharCode(0xd800+(codePoint>>>10),0xdc00+(codePoint&0x3ff)));
    }
  }
  return {ok:true,text:chars.join('')};
}

var SHA256_K=freeze([
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

function sha256Hex(bytes){
  var data=bytes.slice(), bitHigh=Math.floor(bytes.length/0x20000000), bitLow=(bytes.length<<3)>>>0;
  var hash=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var words=new Array(64), offset, i, a, b, c, d, e, f, g, h, s0, s1, choice, majority, temp1, temp2;
  data.push(0x80);
  while(data.length%64!==56) data.push(0);
  data.push((bitHigh>>>24)&255,(bitHigh>>>16)&255,(bitHigh>>>8)&255,bitHigh&255);
  data.push((bitLow>>>24)&255,(bitLow>>>16)&255,(bitLow>>>8)&255,bitLow&255);
  for(offset=0;offset<data.length;offset+=64){
    for(i=0;i<16;i++){
      words[i]=((data[offset+i*4]<<24)|(data[offset+i*4+1]<<16)|(data[offset+i*4+2]<<8)|data[offset+i*4+3])>>>0;
    }
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

function hashBytes(bytes){ return HASH_PREFIX+sha256Hex(bytes); }

function encodeTextForHash(text){
  var encoded=utf8Encode(text);
  return encoded.ok?hashBytes(encoded.bytes):null;
}

function byteGroup(value){ return ('00000000'+value.toString(2)).slice(-8); }

var NORMALIZATION_PROFILE=freeze({
  id:'unicode-snapshot-none',
  version:'1.0.0',
  normalization:'NONE'
});

function normalizationAllowed(options){
  if(!options||typeof options!=='object') return true;
  if(options.normalization!==undefined&&options.normalization!=='NONE') return false;
  if(options.normalizationProfile!==undefined&&options.normalizationProfile!==NORMALIZATION_PROFILE.id) return false;
  return true;
}

function binaryFields(bytes,text){
  var groups=bytes.map(byteGroup), contentHash=hashBytes(bytes);
  return {
    encoding:UTF8,
    bitOrder:BIT_ORDER,
    order:BIT_ORDER,
    normalizationProfile:NORMALIZATION_PROFILE,
    originalText:text,
    text:text,
    snapshot:{text:text,contentHash:contentHash},
    bytes:bytes.slice(),
    groups:groups,
    byteGroups:groups,
    bitString:groups.join(''),
    displayBits:groups.join(' '),
    byteLength:bytes.length,
    bitLength:bytes.length*8,
    hashAlgorithm:HASH_ALGORITHM,
    contentHash:contentHash
  };
}

function encodeBinary(text,options){
  if(typeof text!=='string') return outcome('P78TimelineBinary','INVALID',ERROR_CODES.INPUT_REQUIRED,{bytes:[],groups:[]});
  if(!normalizationAllowed(options)) return outcome('P78TimelineBinary','INVALID',ERROR_CODES.NORMALIZATION_UNSUPPORTED,{bytes:[],groups:[]});
  var encoded=utf8Encode(text);
  if(!encoded.ok) return outcome('P78TimelineBinary','INVALID',ERROR_CODES.INVALID_UNICODE,{index:encoded.index,bytes:[],groups:[]});
  var decoded=utf8Decode(encoded.bytes), fields=binaryFields(encoded.bytes,text);
  fields.roundtripExact=!!(decoded.ok&&decoded.text===text);
  fields.contract={
    pre:{ok:true,encoding:UTF8,normalization:'NONE'},
    inv:{ok:fields.roundtripExact,bitOrder:BIT_ORDER,groupWidth:8},
    post:{ok:fields.roundtripExact,contentHash:fields.contentHash}
  };
  return outcome('P78TimelineBinary',fields.roundtripExact?'READY':'INVALID',fields.roundtripExact?null:ERROR_CODES.ROUNDTRIP_MISMATCH,fields);
}

function validByteArray(value){
  if(!Array.isArray(value)) return null;
  var bytes=[];
  for(var i=0;i<value.length;i++){
    if(!Number.isInteger(value[i])||value[i]<0||value[i]>255) return null;
    bytes.push(value[i]);
  }
  return bytes;
}

function groupsToBytes(groups){
  if(!Array.isArray(groups)) return null;
  var bytes=[];
  for(var i=0;i<groups.length;i++){
    if(typeof groups[i]!=='string'||!/^[01]{8}$/.test(groups[i])) return null;
    bytes.push(parseInt(groups[i],2));
  }
  return bytes;
}

function bitStringToBytes(bits){
  if(typeof bits!=='string'||bits.length%8!==0||!/^[01]*$/.test(bits)) return null;
  var groups=[];
  for(var i=0;i<bits.length;i+=8) groups.push(bits.slice(i,i+8));
  return groupsToBytes(groups);
}

function sameBytes(left,right){
  if(!left||!right||left.length!==right.length) return false;
  for(var i=0;i<left.length;i++) if(left[i]!==right[i]) return false;
  return true;
}

function binaryInput(input){
  var candidates=[], bytes, bits;
  if(Array.isArray(input)){
    bytes=validByteArray(input);
    if(!bytes) bytes=groupsToBytes(input);
    return bytes?{ok:true,bytes:bytes,source:null}:{ok:false};
  }
  if(!input||typeof input!=='object') return {ok:false};
  if(input.encoding!==undefined&&input.encoding!==UTF8) return {ok:false};
  if(input.bitOrder!==undefined&&input.bitOrder!==BIT_ORDER) return {ok:false};
  if(input.order!==undefined&&input.order!==BIT_ORDER) return {ok:false};
  if(input.hashAlgorithm!==undefined&&input.hashAlgorithm!==HASH_ALGORITHM) return {ok:false};
  if(input.bytes!==undefined){ bytes=validByteArray(input.bytes); if(!bytes) return {ok:false}; candidates.push(bytes); }
  if(input.groups!==undefined){ bytes=groupsToBytes(input.groups); if(!bytes) return {ok:false}; candidates.push(bytes); }
  if(input.byteGroups!==undefined){ bytes=groupsToBytes(input.byteGroups); if(!bytes) return {ok:false}; candidates.push(bytes); }
  bits=input.bitString;
  if(bits!==undefined){ bytes=bitStringToBytes(bits); if(!bytes) return {ok:false}; candidates.push(bytes); }
  if(!candidates.length) return {ok:false};
  for(var i=1;i<candidates.length;i++) if(!sameBytes(candidates[0],candidates[i])) return {ok:false};
  if(input.byteLength!==undefined&&input.byteLength!==candidates[0].length) return {ok:false};
  if(input.bitLength!==undefined&&input.bitLength!==candidates[0].length*8) return {ok:false};
  return {ok:true,bytes:candidates[0],source:input};
}

function decodeBinary(input){
  var parsed=binaryInput(input);
  if(!parsed.ok) return outcome('P78TimelineBinaryDecode','INVALID',ERROR_CODES.INVALID_BINARY,{text:null,bytes:[]});
  var decoded=utf8Decode(parsed.bytes);
  if(!decoded.ok) return outcome('P78TimelineBinaryDecode','INVALID',ERROR_CODES.INVALID_UTF8,{text:null,index:decoded.index,bytes:parsed.bytes});
  var contentHash=hashBytes(parsed.bytes), source=parsed.source||{}, snapshot=source.snapshot||null;
  if(source.contentHash!==undefined&&source.contentHash!==contentHash){
    return outcome('P78TimelineBinaryDecode','INVALID',ERROR_CODES.HASH_MISMATCH,{text:null,bytes:parsed.bytes,expectedHash:source.contentHash,contentHash:contentHash});
  }
  if(snapshot&&snapshot.contentHash!==undefined&&snapshot.contentHash!==contentHash){
    return outcome('P78TimelineBinaryDecode','INVALID',ERROR_CODES.HASH_MISMATCH,{text:null,bytes:parsed.bytes,expectedHash:snapshot.contentHash,contentHash:contentHash});
  }
  if(snapshot&&snapshot.text!==undefined&&snapshot.text!==decoded.text){
    return outcome('P78TimelineBinaryDecode','INVALID',ERROR_CODES.ROUNDTRIP_MISMATCH,{text:decoded.text,bytes:parsed.bytes,contentHash:contentHash});
  }
  if(source.originalText!==undefined&&source.originalText!==decoded.text){
    return outcome('P78TimelineBinaryDecode','INVALID',ERROR_CODES.ROUNDTRIP_MISMATCH,{text:decoded.text,bytes:parsed.bytes,contentHash:contentHash});
  }
  if(source.text!==undefined&&source.text!==decoded.text){
    return outcome('P78TimelineBinaryDecode','INVALID',ERROR_CODES.ROUNDTRIP_MISMATCH,{text:decoded.text,bytes:parsed.bytes,contentHash:contentHash});
  }
  var fields=binaryFields(parsed.bytes,decoded.text);
  fields.roundtripExact=true;
  fields.contract={
    pre:{ok:true,encoding:UTF8,bitOrder:BIT_ORDER},
    inv:{ok:true,contentHash:contentHash},
    post:{ok:true,exact:true}
  };
  return outcome('P78TimelineBinaryDecode','READY',null,fields);
}

var TIMING=freeze({
  id:'international-morse-timing-1-3-7',
  version:'1.0.0',
  dot:1,
  dash:3,
  intraCharacterGap:1,
  characterGap:3,
  wordGap:7
});

var COMMON_MORSE={
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.',
  '.':'.-.-.-',',':'--..--','?':'..--..',"'":'.----.','!':'-.-.--','/':'-..-.','(':'-.--.',')':'-.--.-',
  '&':'.-...',':':'---...',';':'-.-.-.','=':'-...-','+':'.-.-.','-':'-....-','_':'..--.-','"':'.-..-.','$':'...-..-','@':'.--.-.'
};

var INTERNATIONAL_TABLE={
  A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',
  N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..'
};

var CYRILLIC_TABLE={
  'А':'.-','Б':'-...','В':'.--','Г':'--.','Д':'-..','Е':'.','Ё':'.','Ж':'...-','З':'--..','И':'..','Й':'.---',
  'К':'-.-','Л':'.-..','М':'--','Н':'-.','О':'---','П':'.--.','Р':'.-.','С':'...','Т':'-','У':'..-','Ф':'..-.',
  'Х':'....','Ц':'-.-.','Ч':'---.','Ш':'----','Щ':'--.-','Ъ':'--.--','Ы':'-.--','Ь':'-..-','Э':'..-..','Ю':'..--','Я':'.-.-'
};

Object.keys(COMMON_MORSE).forEach(function(key){
  INTERNATIONAL_TABLE[key]=COMMON_MORSE[key];
  CYRILLIC_TABLE[key]=COMMON_MORSE[key];
});

function canonicalTable(table){
  return Object.keys(table).sort().map(function(key){ return JSON.stringify(key)+':'+table[key]; }).join('\n');
}

function makeProfile(id,alphabetId,table,source,casePolicy){
  var frozenTable=freeze(table), canonical=canonicalTable(frozenTable), encoded=utf8Encode(canonical);
  return freeze({
    id:id,
    profileId:id,
    version:'1.0.0',
    alphabetId:alphabetId,
    alphabetVersion:'1.0.0',
    tableVersion:'1.0.0',
    tableHash:hashBytes(encoded.bytes),
    hashAlgorithm:HASH_ALGORITHM,
    timing:TIMING,
    source:source,
    casePolicy:casePolicy,
    table:frozenTable
  });
}

var INTERNATIONAL_PROFILE=makeProfile(
  DEFAULT_PROFILE_ID,
  'international-latin-morse',
  INTERNATIONAL_TABLE,
  'ITU-R M.1677-1 timing; explicit project table v1',
  'ASCII_LOWER_TO_UPPER'
);
var CYRILLIC_PROFILE=makeProfile(
  CYRILLIC_PROFILE_ID,
  'russian-cyrillic-morse',
  CYRILLIC_TABLE,
  'ITU-R M.1677-1 timing; explicit Russian Cyrillic project table v1',
  'RUSSIAN_LOWER_TO_UPPER'
);

var PROFILES={};
PROFILES[INTERNATIONAL_PROFILE.id]=INTERNATIONAL_PROFILE;
PROFILES[CYRILLIC_PROFILE.id]=CYRILLIC_PROFILE;
freeze(PROFILES);

var PROFILE_ALIASES=freeze({
  'international':'international-itu-r-m1677-1',
  'itu-r-m1677-1':'international-itu-r-m1677-1',
  'cyrillic':'cyrillic-ru-v1',
  'ru-cyrillic':'cyrillic-ru-v1'
});

function profileSummary(profile){
  return freeze({
    id:profile.id,
    profileId:profile.profileId,
    version:profile.version,
    alphabetId:profile.alphabetId,
    alphabetVersion:profile.alphabetVersion,
    tableVersion:profile.tableVersion,
    tableHash:profile.tableHash,
    hashAlgorithm:profile.hashAlgorithm,
    timing:profile.timing,
    source:profile.source,
    casePolicy:profile.casePolicy
  });
}

var PROFILE_SUMMARIES=freeze([
  profileSummary(INTERNATIONAL_PROFILE),
  profileSummary(CYRILLIC_PROFILE)
]);

function requestedProfileId(options){
  if(typeof options==='string') return options;
  if(options&&typeof options==='object') return options.profileId||options.profile||null;
  return null;
}

function resolveProfile(options){
  var requested=requestedProfileId(options), id=requested||DEFAULT_PROFILE_ID;
  id=PROFILE_ALIASES[id]||id;
  return {profile:PROFILES[id]||null,explicit:requested!==null,requested:id};
}

function asciiUpper(symbol){
  var value=symbol.charCodeAt(0);
  return value>=97&&value<=122?String.fromCharCode(value-32):symbol;
}

var CYRILLIC_LOWER='абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
var CYRILLIC_UPPER='АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';

function cyrillicUpper(symbol){
  var index=CYRILLIC_LOWER.indexOf(symbol);
  return index>=0?CYRILLIC_UPPER.charAt(index):symbol;
}

function profileSymbol(symbol,profile){
  return profile.id===CYRILLIC_PROFILE_ID?cyrillicUpper(symbol):asciiUpper(symbol);
}

function codePointAt(text,index){
  var first=text.charCodeAt(index), second, value;
  if(first>=0xd800&&first<=0xdbff){
    second=text.charCodeAt(index+1);
    value=0x10000+((first-0xd800)<<10)+(second-0xdc00);
    return {value:value,width:2,symbol:text.slice(index,index+2)};
  }
  return {value:first,width:1,symbol:text.charAt(index)};
}

function codePointLabel(value){ return 'U+'+('000000'+value.toString(16).toUpperCase()).slice(-Math.max(4,value.toString(16).length)); }

function whitespaceCodePoint(value){
  return (value>=0x09&&value<=0x0d)||value===0x20||value===0xa0||value===0x1680||
    (value>=0x2000&&value<=0x200a)||value===0x2028||value===0x2029||value===0x202f||
    value===0x205f||value===0x3000||value===0xfeff;
}

function markEvent(mark,tokenIndex,symbol){
  return freeze({
    type:'MARK',
    mark:mark==='.'?'DOT':'DASH',
    signal:1,
    units:mark==='.'?TIMING.dot:TIMING.dash,
    tokenIndex:tokenIndex,
    symbol:symbol
  });
}

function gapEvent(kind,units){ return freeze({type:'GAP',gap:kind,signal:0,units:units}); }

function encodeMorse(text,options){
  if(typeof text!=='string') return outcome('P78TimelineMorse','INVALID',ERROR_CODES.INPUT_REQUIRED,{tokens:[],timeline:[],unsupported:[]});
  var utf8=utf8Encode(text);
  if(!utf8.ok) return outcome('P78TimelineMorse','INVALID',ERROR_CODES.INVALID_UNICODE,{index:utf8.index,tokens:[],timeline:[],unsupported:[]});
  var resolved=resolveProfile(options);
  if(!resolved.profile){
    return outcome('P78TimelineMorse','ABSTAIN',ERROR_CODES.PROFILE_UNAVAILABLE,{
      requestedProfileId:resolved.requested,
      tokens:[],timeline:[],unsupported:[],contentHash:hashBytes(utf8.bytes)
    });
  }
  var profile=resolved.profile, tokens=[], unsupported=[], timeline=[], notation=[];
  var encodedCount=0, pendingWord=false, hasEncoded=false, i=0, point, symbol, normalized, pattern, token, j;
  while(i<text.length){
    point=codePointAt(text,i); symbol=point.symbol;
    if(whitespaceCodePoint(point.value)){
      token=freeze({kind:'WHITESPACE',index:i,symbol:symbol,codePoint:codePointLabel(point.value)});
      tokens.push(token);
      if(hasEncoded) pendingWord=true;
      i+=point.width;
      continue;
    }
    normalized=profileSymbol(symbol,profile);
    pattern=Object.prototype.hasOwnProperty.call(profile.table,normalized)?profile.table[normalized]:null;
    if(!pattern){
      token=freeze({kind:'UNSUPPORTED',index:i,symbol:symbol,codePoint:codePointLabel(point.value),code:ERROR_CODES.UNSUPPORTED_SYMBOL});
      tokens.push(token); unsupported.push(token); notation.push('['+token.codePoint+']');
      i+=point.width;
      continue;
    }
    token=freeze({kind:'ENCODED',index:i,symbol:symbol,normalizedSymbol:normalized,codePoint:codePointLabel(point.value),pattern:pattern});
    tokens.push(token);
    if(hasEncoded){
      if(pendingWord){ timeline.push(gapEvent('WORD',TIMING.wordGap)); notation.push('/'); }
      else timeline.push(gapEvent('CHARACTER',TIMING.characterGap));
    }
    for(j=0;j<pattern.length;j++){
      if(j) timeline.push(gapEvent('INTRA_CHARACTER',TIMING.intraCharacterGap));
      timeline.push(markEvent(pattern.charAt(j),tokens.length-1,normalized));
    }
    notation.push(pattern);
    encodedCount++; hasEncoded=true; pendingWord=false; i+=point.width;
  }
  var status=unsupported.length?(encodedCount?'PARTIAL':'ABSTAIN'):(encodedCount?'READY':'ABSTAIN');
  var code=unsupported.length?ERROR_CODES.UNSUPPORTED_SYMBOL:(encodedCount?null:ERROR_CODES.EMPTY_INPUT);
  var totalUnits=timeline.reduce(function(sum,event){ return sum+event.units; },0);
  var profileData=profileSummary(profile), reconstructed=tokens.map(function(item){ return item.symbol; }).join('');
  return outcome('P78TimelineMorse',status,code,{
    originalText:text,
    text:text,
    contentHash:hashBytes(utf8.bytes),
    profileId:profile.id,
    profileVersion:profile.version,
    alphabetId:profile.alphabetId,
    alphabetVersion:profile.alphabetVersion,
    tableVersion:profile.tableVersion,
    tableHash:profile.tableHash,
    timing:TIMING,
    profile:profileData,
    profileExplicit:resolved.explicit,
    tokens:tokens,
    unsupported:unsupported,
    encodedCount:encodedCount,
    unsupportedCount:unsupported.length,
    timeline:timeline,
    pulses:timeline,
    notation:notation.join(' '),
    totalUnits:totalUnits,
    contract:{
      pre:{ok:true,profileKnown:true},
      inv:{ok:reconstructed===text,inputAccounted:true,timingProfile:TIMING.id},
      post:{ok:status==='READY',unsupportedCount:unsupported.length}
    }
  });
}

function encode(text,options){
  var binary=encodeBinary(text,options);
  if(binary.status!=='READY') return outcome('P78TimelineSequenceReport','INVALID',binary.code,{binary:binary,morse:null});
  var morse=encodeMorse(text,options), status=morse.status, code=morse.code;
  return outcome('P78TimelineSequenceReport',status,code,{
    originalText:text,
    contentHash:binary.contentHash,
    binary:binary,
    morse:morse,
    contract:{
      pre:{ok:true,inputSnapshot:true},
      inv:{ok:binary.roundtripExact&&morse.contract.inv.ok,binaryRoundtripExact:binary.roundtripExact,inputAccounted:morse.contract.inv.inputAccounted},
      post:{ok:status==='READY',morseStatus:status}
    }
  });
}

function getProfile(id){
  var resolved=resolveProfile(id);
  return resolved.profile||null;
}

function listProfiles(){ return PROFILE_SUMMARIES; }

global.MRDP78TimelineCodec=freeze({
  version:VERSION,
  providerId:PROVIDER_ID,
  providerVersion:VERSION,
  evidence:STRUCTURAL,
  evidenceLevel:STRUCTURAL,
  soundness:NOT_COMPUTED,
  bitOrder:BIT_ORDER,
  encoding:UTF8,
  hashAlgorithm:HASH_ALGORITHM,
  defaultProfileId:DEFAULT_PROFILE_ID,
  cyrillicProfileId:CYRILLIC_PROFILE_ID,
  errorCodes:ERROR_CODES,
  timing:TIMING,
  normalizationProfile:NORMALIZATION_PROFILE,
  profiles:PROFILES,
  listProfiles:listProfiles,
  getProfile:getProfile,
  contentHash:encodeTextForHash,
  encodeBinary:encodeBinary,
  decodeBinary:decodeBinary,
  encodeMorse:encodeMorse,
  encode:encode,
  createReport:encode
});
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
