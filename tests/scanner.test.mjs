import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createBarcodeScanner} from '../lib/barcode-scanner.ts';

const require=createRequire(import.meta.url);
const {BrowserCodeReader,BrowserMultiFormatReader}=require('@zxing/browser');
// Resolve the same installed peer dependency that the real browser reader uses.
const {NotFoundException,ChecksumException,FormatException}=createRequire(require.resolve('@zxing/browser'))('@zxing/library');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fakeDecoder({pending}={}){
 const attempts=[];
 class BrowserMultiFormatReader{
  async decodeFromVideoDevice(device,video,callback){
   assert.equal(device,undefined);assert(video);
   const controls={stops:0,stop(){this.stops++}};
   const attempt={controls,read(code){callback({getText:()=>code},undefined,controls)},fail(error){callback(undefined,error,controls)},miss(){callback(undefined,new NotFoundException(),controls)}};
   attempts.push(attempt);
   if(pending)await pending.promise;
   return controls;
  }
 }
 return {attempts,load:async()=>({BrowserMultiFormatReader})};
}

function realDecoder(decode){
 const originals={canvas:BrowserCodeReader.createCaptureCanvas,draw:BrowserCodeReader.drawImageOnCanvas,attach:BrowserCodeReader.attachStreamToVideo,clean:BrowserCodeReader.cleanVideoSource,media:BrowserMultiFormatReader.prototype.getUserMedia,decode:BrowserMultiFormatReader.prototype.decodeFromCanvas};
 const streams=[];
 BrowserCodeReader.createCaptureCanvas=()=>({getContext:()=>({})});
 BrowserCodeReader.drawImageOnCanvas=()=>{};
 BrowserCodeReader.attachStreamToVideo=async()=>({});
 BrowserCodeReader.cleanVideoSource=()=>{};
 BrowserMultiFormatReader.prototype.getUserMedia=async()=>{
  const track={stops:0,stop(){this.stops++},getCapabilities:()=>({})};
  streams.push(track);return {getTracks:()=>[track],getVideoTracks:()=>[track]};
 };
 BrowserMultiFormatReader.prototype.decodeFromCanvas=decode;
 class FastReader extends BrowserMultiFormatReader{constructor(){super(undefined,{delayBetweenScanAttempts:0,delayBetweenScanSuccess:0})}}
 return {streams,load:async()=>({BrowserMultiFormatReader:FastReader}),restore(){
  BrowserCodeReader.createCaptureCanvas=originals.canvas;BrowserCodeReader.drawImageOnCanvas=originals.draw;BrowserCodeReader.attachStreamToVideo=originals.attach;BrowserCodeReader.cleanVideoSource=originals.clean;BrowserMultiFormatReader.prototype.getUserMedia=originals.media;BrowserMultiFormatReader.prototype.decodeFromCanvas=originals.decode;
 }};
}

test('a fatal installed ZXing frame failure is exposed once and allows an explicit retry',async()=>{
 const fatal=new Error('Fatal canvas read failure'),errors=[],codes=[];let frames=0;
 const decoder=realDecoder(()=>{frames++;if(frames===1)throw fatal;return {getText:()=> '5901234123457'}});
 const scanner=createBarcodeScanner({video:()=>({}),load:decoder.load,onError:error=>errors.push(error),onCode:code=>{codes.push(code)}});
 try{
  await scanner.start();await flush();
  assert.deepEqual(errors,[fatal]);assert.deepEqual(codes,[]);assert.equal(frames,1);assert.equal(decoder.streams.length,1);assert.ok(decoder.streams[0].stops>0,'Fatal decoding releases the camera stream');
  await scanner.retry();await flush();
  assert.equal(decoder.streams.length,2);assert.deepEqual(codes,['5901234123457']);assert.deepEqual(errors,[fatal]);assert.equal(decoder.streams[1].stops,1,'Callback and returned wrapper controls stop the successful stream once');
 }finally{scanner.stop();decoder.restore()}
});

for(const Exception of [NotFoundException,ChecksumException,FormatException]){
 test(`installed ZXing ${Exception.kind} frame failures keep scanning without errors or restarting the camera`,async()=>{
  const errors=[],codes=[],decoded=deferred();let frames=0;
  const decoder=realDecoder(()=>{if(++frames<=3)throw new Exception();return {getText:()=> '5901234123457'}});
  const scanner=createBarcodeScanner({video:()=>({}),load:decoder.load,onError:error=>errors.push(error),onCode:code=>{codes.push(code);decoded.resolve()}});
  try{
   await scanner.start();assert.deepEqual(errors,[]);assert.equal(decoder.streams[0].stops,0);
   await decoded.promise;await flush();
   assert.deepEqual(errors,[]);assert.deepEqual(codes,['5901234123457']);assert.equal(frames,4);assert.equal(decoder.streams.length,1);assert.equal(decoder.streams[0].stops,1);
  }finally{scanner.stop();decoder.restore()}
 });
}

test('fatal callback errors stop one attempt, ignore later callbacks, and do not restart automatically',async()=>{
 const decoder=fakeDecoder(),errors=[],codes=[],fatal=new Error('Camera frame failure');
 const scanner=createBarcodeScanner({video:()=>({}),load:decoder.load,onError:error=>errors.push(error),onCode:code=>{codes.push(code)}});
 await scanner.start();decoder.attempts[0].fail(fatal);decoder.attempts[0].fail(fatal);decoder.attempts[0].read('5901234123457');await flush();
 assert.deepEqual(errors,[fatal]);assert.deepEqual(codes,[]);assert.equal(decoder.attempts[0].controls.stops,1);assert.equal(decoder.attempts.length,1);
 await scanner.retry();decoder.attempts[0].fail(new Error('Old fatal failure'));decoder.attempts[1].read('5901234123457');await flush();
 assert.deepEqual(errors,[fatal]);assert.deepEqual(codes,['5901234123457']);scanner.stop();
});

test('fatal Error names do not masquerade as retryable ZXing frame exceptions',async()=>{
 const decoder=fakeDecoder(),errors=[],fatal=new Error('Not found');fatal.name='NotFoundException';
 const scanner=createBarcodeScanner({video:()=>({}),load:decoder.load,onCode:()=>{},onError:error=>errors.push(error)});
 await scanner.start();decoder.attempts[0].fail(fatal);
 assert.deepEqual(errors,[fatal]);assert.equal(decoder.attempts[0].controls.stops,1);scanner.stop();
});

for(const failure of ['HTTP 404: nepoznat proizvod','HTTP 422: nema nutritivnih vrijednosti','network unavailable','Barkod nije valjan']){
 test(`scanner can explicitly retry after ${failure} without looping lookups`,async()=>{
  const decoder=fakeDecoder(),errors=[],codes=[];
  const scanner=createBarcodeScanner({video:()=>({}),load:decoder.load,onError:error=>errors.push(error.message),onCode:async code=>{codes.push(code);if(codes.length===1)throw new Error(failure)}});
  await scanner.start();assert.equal(decoder.attempts.length,1);
  decoder.attempts[0].miss();assert.deepEqual(errors,[]);
  decoder.attempts[0].read('5901234123457');await flush();
  assert.deepEqual(errors,[failure]);assert.equal(decoder.attempts[0].controls.stops,1);
  decoder.attempts[0].read('5901234123457');await flush();
  assert.equal(codes.length,1);assert.equal(decoder.attempts.length,1,'Failure does not automatically start a request loop');
  await scanner.retry();assert.equal(decoder.attempts.length,2);
  decoder.attempts[1].read('5901234123457');await flush();
  assert.equal(codes.length,2);assert.equal(decoder.attempts[1].controls.stops,1);
  scanner.stop();assert.equal(decoder.attempts[1].controls.stops,1);
 });
}

test('closing the modal stops active controls and ignores late results',async()=>{
 const decoder=fakeDecoder(),codes=[],errors=[];
 const scanner=createBarcodeScanner({video:()=>({}),load:decoder.load,onCode:code=>{codes.push(code)},onError:error=>errors.push(error)});
 await scanner.start();scanner.stop();decoder.attempts[0].read('5901234123457');await flush();
 assert.equal(decoder.attempts[0].controls.stops,1);assert.deepEqual(codes,[]);assert.deepEqual(errors,[]);
});

test('closing while camera setup is pending stops the eventual stream',async()=>{
 const pending=deferred(),decoder=fakeDecoder({pending}),codes=[],errors=[];
 const scanner=createBarcodeScanner({video:()=>({}),load:decoder.load,onCode:code=>{codes.push(code)},onError:error=>errors.push(error)});
 const starting=scanner.start();await flush();assert.equal(decoder.attempts.length,1);
 scanner.stop();decoder.attempts[0].read('5901234123457');pending.resolve();await starting;
 assert.equal(decoder.attempts[0].controls.stops,1);assert.deepEqual(codes,[]);assert.deepEqual(errors,[]);
});

test('a cancelled lazy module import never opens the camera',async()=>{
 const pending=deferred(),decoder=fakeDecoder(),errors=[];
 const scanner=createBarcodeScanner({video:()=>({}),load:()=>pending.promise,onCode:()=>{},onError:error=>errors.push(error)});
 const starting=scanner.start();scanner.stop();pending.resolve(await decoder.load());await starting;
 assert.equal(decoder.attempts.length,0);assert.deepEqual(errors,[]);
});

test('retry supersedes a pending previous attempt and ignores its failures',async()=>{
 const first=deferred(),decoder=fakeDecoder(),errors=[],codes=[];let calls=0;
 const scanner=createBarcodeScanner({video:()=>({}),load:()=>++calls===1?first.promise:decoder.load(),onCode:code=>{codes.push(code)},onError:error=>errors.push(error)});
 const old=scanner.start();await scanner.retry();first.reject(new Error('Old camera failure'));await old;
 assert.equal(decoder.attempts.length,1);decoder.attempts[0].read('5901234123457');await flush();
 assert.deepEqual(codes,['5901234123457']);assert.deepEqual(errors,[]);scanner.stop();
});

test('a failed lookup completing after modal close cannot display stale errors',async()=>{
 const lookup=deferred(),decoder=fakeDecoder(),errors=[];
 const scanner=createBarcodeScanner({video:()=>({}),load:decoder.load,onCode:()=>lookup.promise,onError:error=>errors.push(error)});
 await scanner.start();decoder.attempts[0].read('5901234123457');scanner.stop();lookup.reject(new Error('Late lookup failure'));await flush();
 assert.deepEqual(errors,[]);assert.equal(decoder.attempts[0].controls.stops,1);
});

for(const cancellation of ['close','retry']){
 test(`a successful product response after ${cancellation} cannot reopen a stale preview`,async()=>{
  const lookup=deferred(),decoder=fakeDecoder(),previews=[],errors=[];
  const scanner=createBarcodeScanner({video:()=>({}),load:decoder.load,onError:error=>errors.push(error),onCode:async(code,isCurrent)=>{
   assert.equal(isCurrent(),true);
   await lookup.promise;
   if(isCurrent())previews.push(code);
  }});
  await scanner.start();decoder.attempts[0].read('5901234123457');
  if(cancellation==='close')scanner.stop();else await scanner.retry();
  lookup.resolve();await flush();
  assert.deepEqual(previews,[]);assert.deepEqual(errors,[]);
  if(cancellation==='retry'){
   decoder.attempts[1].read('3017620422003');await flush();
   assert.deepEqual(previews,['3017620422003']);
  }
  scanner.stop();
 });
}
