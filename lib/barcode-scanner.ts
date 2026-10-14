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

// One decode per attempt. Failed product lookups stay stopped until the user
// explicitly retries, so a barcode held in view cannot loop network requests.
export function createBarcodeScanner({video,onCode,onError,load=()=>import('@zxing/browser')}:ScannerOptions){
 let generation=0,current:ScannerControls|null=null;
 const stopped=new WeakSet<ScannerControls>();
 const halt=(controls:ScannerControls)=>{if(!stopped.has(controls)){stopped.add(controls);controls.stop()}};
 function stop(){generation++;if(current){halt(current);current=null}}
 async function start(){
  stop();const attempt=generation;let handled=false;
  try{
   const {BrowserMultiFormatReader}=await load();
   if(attempt!==generation)return;
   const element=video();if(!element)return;
   const reader=new BrowserMultiFormatReader();
   const controls=await reader.decodeFromVideoDevice(undefined,element,(result,_error,controls)=>{
    if(attempt!==generation){halt(controls);return}
    if(!result||handled)return;
    handled=true;halt(controls);current=null;
    try{
     void Promise.resolve(onCode(result.getText(),()=>attempt===generation)).catch(error=>{if(attempt===generation)onError(error)});
    }catch(error){if(attempt===generation)onError(error)}
   });
   if(attempt!==generation||handled)halt(controls);else current=controls;
  }catch(error){if(attempt===generation)onError(error)}
 }
 return {start,retry:start,stop};
}
