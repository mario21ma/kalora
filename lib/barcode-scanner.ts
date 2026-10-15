type ScannerControls={stop:()=>void};
type ScannerResult={getText:()=>string};
type ScannerReader={decodeFromVideoDevice:(deviceId:undefined,video:HTMLVideoElement,callback:(result:ScannerResult|undefined,error:unknown,controls:ScannerControls)=>void)=>Promise<ScannerControls>};
type ScannerModule={BrowserMultiFormatReader:new()=>ScannerReader};

type ScannerOptions={
 video:()=>HTMLVideoElement|null;
 onCode:(code:string,isCurrent:()=>boolean)=>void|Promise<void>;
 onError:(error:unknown)=>void;
 load?:()=>Promise<ScannerModule>;
};

function isFrameDecodeError(error:unknown){
 // ZXing's public kind survives minification; ordinary Error names/messages
 // do not reliably identify its three retryable frame decoding exceptions.
 if(!error||typeof error!=='object'||!('getKind' in error)||typeof error.getKind!=='function')return false;
 const kind:unknown=error.getKind();
 return kind==='NotFoundException'||kind==='ChecksumException'||kind==='FormatException';
}

// One decode per attempt. Failed product lookups stay stopped until the user
// explicitly retries, so a barcode held in view cannot loop network requests.
export function createBarcodeScanner({video,onCode,onError,load=()=>import('@zxing/browser')}:ScannerOptions){
 let generation=0,current:(()=>void)|null=null;
 const stopped=new WeakSet<ScannerControls>();
 const halt=(controls:ScannerControls)=>{if(!stopped.has(controls)){stopped.add(controls);controls.stop()}};
 function stop(){generation++;if(current){current();current=null}}
 async function start(){
  stop();const attempt=generation;let handled=false,halted=false;
  // ZXing can return wrapper controls after a synchronous scan callback. Both
  // control objects stop the same stream, so halt an attempt only once.
  const haltAttempt=(controls:ScannerControls)=>{if(!halted){halted=true;halt(controls)}};
  try{
   const {BrowserMultiFormatReader}=await load();
   if(attempt!==generation)return;
   const element=video();if(!element)return;
   const reader=new BrowserMultiFormatReader();
   const controls=await reader.decodeFromVideoDevice(undefined,element,(result,error,controls)=>{
    if(attempt!==generation){haltAttempt(controls);return}
    if(handled)return;
    if(!result){
     if(!error||isFrameDecodeError(error))return;
     handled=true;haltAttempt(controls);current=null;onError(error);return;
    }
    handled=true;haltAttempt(controls);current=null;
    try{
     void Promise.resolve(onCode(result.getText(),()=>attempt===generation)).catch(error=>{if(attempt===generation)onError(error)});
    }catch(error){if(attempt===generation)onError(error)}
   });
   if(attempt!==generation||handled)haltAttempt(controls);else current=()=>haltAttempt(controls);
  }catch(error){if(attempt===generation&&!handled){handled=true;onError(error)}}
 }
 return {start,retry:start,stop};
}
