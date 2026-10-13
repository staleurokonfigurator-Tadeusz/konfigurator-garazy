/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
test('offer bridge sends an override only when checked and returns the WordPress final price',async()=>{
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/wordpressBridge.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};new Function('exports',source)(exports);
 const previous=global.window;
 try {
  for(const enabled of [false,true]) {
   let handler,packet;
   const parent={postMessage:message=>{packet=message;}};
   global.window={parent,setTimeout:()=>1,clearTimeout:()=>{},addEventListener:(_,callback)=>{handler=callback;},removeEventListener:()=>{}};
   const promise=exports.createOfferInWordPress({config:{},customer:{},estimatedPrice:12000.5,useManualPrice:enabled,manualPrice:23456.78,storeUrl:'https://konfigurator.staleuro.pl',arModel:new Blob(['glTF'])});
   assert.equal(packet.useManualPrice,enabled);assert.equal(packet.manualPrice,enabled?23456.78:undefined);
   handler({origin:'https://konfigurator.staleuro.pl',source:parent,data:{action:'konfigurator_offer_created',requestId:packet.requestId,ok:true,offer:{id:123,offerNumber:'SE-TEST',verifiedPrice:enabled?23456.78:12000.5,priceSource:enabled?'manual':'catalogue',publicUrl:'https://example.test/ar'}}});
   const result=await promise;assert.equal(result.verifiedPrice,enabled?23456.78:12000.5);assert.equal(result.priceSource,enabled?'manual':'catalogue');
  }
 } finally {if(previous===undefined)delete global.window;else global.window=previous;}
});
