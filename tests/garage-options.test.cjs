/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS entry point for the Node test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const compile = source => ts.transpileModule(source, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
}}).outputText;
function load(relative) {
  const exports = {};
  new Function('exports', 'require', compile(fs.readFileSync(path.join(root, relative), 'utf8')))(exports, name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(path.join(root, relative)), name + '.ts'))) : require(name));
  return exports;
}
const options = load('src/lib/garageOptions.ts');
const storage = load('src/lib/projectStorage.ts');
const material = load('src/lib/garageMaterial.ts');
const extras = load('src/lib/garageExtras.ts');
const collision = load('src/lib/collision.ts');
const joints = load('src/components/PirPanelJoints.tsx');
const actualPricing=load('src/lib/garagePricing.ts');
const assembly=load('src/lib/garageAssembly.ts');
const base = {width:300,length:500,height:210,roofType:'dual-slope',elements:[],extraOptions:[],gutters:false};
const pricing = {sqm_single_v:150,sqm_dual_v:200,gate_up_2x2:800,gutter_v:10,roof_tile_v:20,integrated_carport_m2_v:100};
const price = (config, rates=pricing, addons=[]) => actualPricing.calculateGaragePrice(config,{pricing:rates,addons,baseConfig:{h:210},colors:[]});

test('legacy configs remain sheet; standard roof prices are preserved', () => {
  assert.equal(material.isPirGarage(base),false);
  assert.equal(price(base),3000);
  assert.equal(price({...base,buildingMaterial:'sheet'}),3000);
  assert.equal(price({...base,roofType:'slope-back'}),2250);
});
test('PIR replaces the sheet base rate for every roof and defaults to 1300 PLN/m2', () => {
  for (const roofType of ['dual-slope','dual-slope-front-back','slope-front','slope-back','slope-left','slope-right']) {
    assert.equal(price({...base,roofType,buildingMaterial:'pir'}),19500);
  }
  assert.equal(price({...base,buildingMaterial:'pir'},{...pricing,sqm_pir_v:1400}),21000);
  for (const value of [undefined,null,'bad',0,-1,Infinity]) assert.equal(material.getPirPricePerM2(value),1300);
});
test('30 x 30 m uses 900 m2; equipment, height and perimeter surcharges still work', () => {
  const large = {...base,width:3000,length:3000,buildingMaterial:'pir'};
  assert.equal(price(large),1170000);
  assert.equal(price({...large,gutters:true}),1170000);
  assert.equal(price({...base,buildingMaterial:'pir',height:220}),21450);
  assert.equal(price({...base,buildingMaterial:'pir',elements:[{type:'gate',gateType:'up-and-over',width:200,height:200}]}),19500);
  assert.equal(price({...large,extraOptions:['perimeter']},pricing,[{id:'perimeter',type:'mb',price:2}]),1170240);
  assert.equal(price({...base,buildingMaterial:'pir',hasCarport:true,carportWidth:300}),21000);
});

test('PIR includes exactly one gate of any offered type; extra gates and equipment remain charged', () => {
  const rates={...pricing,gate_sec_3x2:2200,gate_double_3x2:1500,door_in_gate_v:250};
  const gates=[{type:'gate',gateType:'up-and-over',width:200,height:200},
    {type:'gate',gateType:'sectional',width:300,height:200},
    {type:'gate',gateType:'swing',width:300,height:200}];
  for(const gate of gates) {
    assert.equal(price({...base,buildingMaterial:'pir',gutters:true,elements:[gate]},rates),19500);
  }
  assert.equal(price({...base,buildingMaterial:'pir',elements:[{type:'window',width:80,height:60},...gates]},rates),23200);
  assert.equal(price({...base,buildingMaterial:'pir',elements:[{...gates[0],hasDoor:true},gates[0]]},rates),20550);
  assert.equal(price({...base,elements:[gates[0]],gutters:true},rates),3900);
  assert.equal(price({...base,buildingMaterial:'pir',elements:[gates[1]],extraOptions:['motor']},rates,[{id:'motor',label:'Automat',type:'fixed',price:500}]),20000);
});

test('restored PIR projects include gutters and ignore withdrawn roof settings', () => {
  const normalized=options.cleanUnavailableOptions({...base,buildingMaterial:'pir',roofRiseCm:120},[]);
  assert.equal(normalized.gutters,true);
  assert.equal('roofRiseCm' in normalized,false);
  assert.equal(options.cleanUnavailableOptions(base,[]),base);
});
test('incompatible roof tile option in restored PIR configs is not charged', () => {
  assert.equal(price({...base,buildingMaterial:'pir',extraOptions:['roofTile']}),19500);
  assert.equal(price({...base,extraOptions:['roofTile']}),3300);
});
test('camera fits 30 m walls at desktop and narrow mobile aspect ratios', () => {
  for (const aspect of [2,1,0.4]) {
    for (const wall of ['front','back','left','right']) {
      const config = {...base,width:3000,length:3000,hasCarport:true,carportWidth:500};
      const distance = material.getGarageCameraDistance(config,wall,aspect);
      const visibleSpan = 2*distance*Math.tan(50*Math.PI/360)*aspect;
      assert.ok(visibleSpan >= (wall === 'front' || wall === 'back' ? 36 : 31));
      assert.ok(Math.max(25,distance*1.5)>distance);
    }
  }
  assert.equal(material.getGarageCameraDistance(base,'front',1),9);
});
test('element positions use full 3000 cm walls and reject crossing edges', () => {
  const element = {id:'gate',wall:'front',width:200,height:200,x:1390,y:0};
  assert.deepEqual(collision.findValidPosition(element,[],3000,210),{x:1390,y:0});
  assert.equal(collision.checkWallBounds(collision.getElementRect({...element,x:1500}),3000,210),false);
});
test('PIR joint geometry remains finite and skips door/window openings', () => {
  for (const width of [2,3,8,30,35]) {
    const geometry = joints.createPirJointGeometry(width,3.5,[]);
    assert.ok([...geometry.getAttribute('position').array].every(Number.isFinite));
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox.min.x > -width/2);
    assert.ok(geometry.boundingBox.max.x < width/2);
    geometry.dispose();
  }
  const geometry = joints.createPirJointGeometry(3,3,[{x:-0.5,y:0,width:0.8,height:1}]);
  const positions = geometry.getAttribute('position');
  for (let i=0;i<positions.count;i++) {
    if (Math.abs(positions.getX(i)+0.5)<0.02) assert.ok(Math.abs(positions.getY(i))>=0.5);
  }
  geometry.dispose();
  assert.equal(material.MAX_GARAGE_WIDTH_CM,3000);
  assert.equal(material.MAX_GARAGE_LENGTH_CM,3000);
});

const gate = (id,width,x,type='up-and-over') => ({id,type:'gate',wall:'front',width,height:200,x,y:0,gateType:type});
test('second gate can become sectional when centred first gate must move', () => {
  const original={...base,width:860,elements:[gate('first',300,0,'sectional'),gate('second',200,-320,'swing')]};
  const next=options.updateGarageElement(original,'second',{gateType:'sectional',width:300});
  assert.ok(next);
  assert.equal(next.elements[1].gateType,'sectional');
  assert.equal(next.elements[1].width,300);
  assert.ok(next.elements.every(el=>collision.checkWallBounds(collision.getElementRect(el),860,210)));
  assert.equal(collision.checkCollision(...next.elements.map(collision.getElementRect)),false);
  assert.equal(original.elements[1].gateType,'swing');
});
test('resize commits found position; impossible fit and colliding manual drag are rejected', () => {
  const original={...base,width:500,elements:[gate('first',200,-140)]};
  const next=options.updateGarageElement(original,'first',{width:300});
  assert.ok(next && next.elements[0].x!==-140);
  assert.ok(collision.checkWallBounds(collision.getElementRect(next.elements[0]),500,210));
  const two={...base,width:500,elements:[gate('first',300,0),gate('second',200,-200)]};
  assert.equal(options.updateGarageElement(two,'second',{width:300,gateType:'sectional'}),null);
  assert.equal(options.updateGarageElement({...two,width:860},'second',{x:0}),null);
});
test('sectional motors depend on any sectional gate and inactive selections are removed', () => {
  const motor={id:'motor',label:'Napęd do bramy segmentowej CAME',price:1350,type:'fixed'};
  const anchor={id:'anchor',label:'Kotwiczenie',price:250,type:'fixed'};
  const generic={id:'generic',label:'Automat do bramy',price:100,type:'fixed'};
  const addons=[motor,anchor,generic];
  const config={...base,extraOptions:['motor','anchor','generic']};
  assert.equal(price(config,pricing,addons),3350);
  assert.deepEqual(options.cleanUnavailableOptions(config,addons).extraOptions,['anchor','generic']);
  const withGate={...config,elements:[gate('first',200,0,'swing'),{...gate('second',300,0,'sectional'),wall:'back'}]};
  assert.equal(options.isAddonAvailable(withGate,motor),true);
  assert.equal(price(withGate,pricing,addons)-price({...withGate,extraOptions:['anchor','generic']},pricing,addons),1350);
  assert.equal(options.isAddonAvailable(base,generic),true);
  assert.equal(options.requiresSectionalGate({id:'naped-do-bramy-segmentowej-hato_970'}),true);
  assert.deepEqual(options.cleanUnavailableOptions({...withGate,elements:[]},addons).extraOptions,['anchor','generic']);
});
const fullConfig={...base,buildingMaterial:'pir',width:3000,length:3000,applyColorToAll:false,removeFoil:false,
  ...Object.fromEntries(['wallColor','roofColor','gateColor','doorColor','windowColor','cornerFlashingColor','roofFlashingColor','gutterColor'].map(k=>[k,'zloty-dab'])),
  ...Object.fromEntries(['wallProfile','roofProfile','gateProfile','doorProfile'].map(k=>[k,'pionowe-t7'])),
  elements:[{id:'light',type:'skylight',wall:'front',x:0,y:200,width:2800,height:30}]};
test('draft and project files round trip 30m PIR, wood and wide skylights', () => {
  const entries=new Map();const local={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};
  const key=storage.projectStorageKey('https://konfigurator.staleuro.pl/konfigurator',false);
  storage.writeDraft(local,key,fullConfig);
  assert.deepEqual(storage.readDraft(local,key),fullConfig);
  const project={version:1,id:'saved',name:'Garaż domu',savedAt:'2026-10-08',config:fullConfig};
  assert.deepEqual(storage.parseProjectFile(JSON.stringify(project)),project);
  local.setItem(key+':saved',JSON.stringify([project,{version:1,config:{width:9999}}]));
  assert.deepEqual(storage.readSavedProjects(local,key),[project]);
  assert.notEqual(key,storage.projectStorageKey('https://gard-house.pl',false));
  assert.notEqual(key,storage.projectStorageKey('https://konfigurator.staleuro.pl',true));
  local.setItem(key+':draft','broken'); assert.equal(storage.readDraft(local,key),null);
  for(const config of [{...fullConfig,width:3001},{...fullConfig,height:351},{...fullConfig,elements:[...fullConfig.elements,...fullConfig.elements]}]) {
    assert.throws(()=>storage.parseProjectFile(JSON.stringify({...project,config})));
  }
});

test('anchoring price covers exact and fractional area boundaries, independent of addon stored price', () => {
  const addon={id:'kotwiczenie_998',label:'Kotwiczenie',type:'fixed',price:0};
  for(const [width,length,cost] of [[600,600,250],[610,600,350],[1000,500,350],[1000,510,450],[3000,3000,450]]) {
    const config={...base,width,length};
    assert.equal(extras.getAnchoringPrice(config),cost);
    assert.equal(price({...config,extraOptions:[addon.id]},pricing,[addon])-price(config),cost);
  }
});

test('independent carports change footprint, camera and price without changing inactive sides', () => {
  const config={...base,width:600,hasCarport:true,carportSide:'both',carportLeft:{width:150,postColor:'#112233',walls:{front:true,side:false,back:false}},carportRight:{width:350,postColor:'#445566',walls:{front:false,side:true,back:true}}};
  assert.deepEqual(extras.getCarportLayout(config),{left:150,right:350,extraWidth:500,totalWidth:1100,centerX:100});
  assert.equal(price(config),8500);
  const updated=extras.withCarportSettings(config,'left',{width:200,postColor:'#abcdef'});
  assert.equal(updated.carportRight,config.carportRight);
  assert.equal(extras.getCarportSettings(updated,'left').walls.front,true);
  assert.equal(price({...config,carportSide:'right'}),7750);
  assert.deepEqual(extras.getCarportSides({...config,hasCarport:false}),[]);
  assert.equal(extras.getCarportLayout({...base,hasCarport:true}).extraWidth,300);
  assert.ok(material.getGarageCameraDistance(config,'front',0.4)>material.getGarageCameraDistance({...config,hasCarport:false},'front',0.4));
  const phoneDistance = material.getGarageCameraDistance(config,'front',1.65);
  assert.ok(phoneDistance < 15);
  assert.ok(2*phoneDistance*Math.tan(50*Math.PI/360)*1.65 >= 12);
});

test('dimension editing rejects empty and invalid values and keeps existing limits and 1cm increments', () => {
  for(const text of ['', ' ', 'wrong', 'Infinity']) assert.equal(extras.normalizeDimension(text,200,3000),null);
  assert.equal(extras.normalizeDimension('390,0',200,3000),390);
  assert.equal(extras.normalizeDimension('305',200,3000),305);
  assert.equal(extras.normalizeDimension('10',200,3000),200);
  assert.equal(extras.normalizeDimension('9999',200,3000),3000);
  assert.equal(extras.normalizeDimension('9999',100,500),500);
});

test('independent carport configurations persist with validation; invalid settings are rejected', () => {
  const config={...fullConfig,hasCarport:true,carportSide:'both',carportLeft:{width:150,postColor:'#112233',walls:{front:true,back:false,side:true}},carportRight:{width:350,postColor:'zloty-dab'}};
  assert.equal(storage.isGarageProjectConfig(config),true);
  const project={version:1,id:'dual',name:'Dwie wiaty',savedAt:'2026-10-12',config};
  assert.deepEqual(storage.parseProjectFile(JSON.stringify(project)).config,config);
  for(const invalid of [null, [], {width:501}, {postColor:'a'.repeat(101)}, {walls:{front:'yes'}}]) assert.equal(storage.isGarageProjectConfig({...config,carportLeft:invalid}),false);
});

test('PDF diagrams draw separate unequal carports and keep every roof orientation finite', () => {
  const pdfSource=fs.readFileSync(path.join(root,'src/lib/offerPdf.ts'),'utf8');
  const pdfAst=ts.createSourceFile('offerPdf.ts',pdfSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const names=['getCarportWidthCm','getPdfCarports','drawDimensionPlan','drawElevationPlan'];
  const funcs=pdfAst.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)).map(node=>node.getText(pdfAst)).join('\n');
  const drawings=new Function('getCarportLayout','getCarportSides','getCarportSettings','getFrontCanopy',compile("const PDF_FONT='helvetica', PDF_INK='#333333', PDF_MUTED='#64748b', faceNames={front:'front',back:'back',left:'left',right:'right'};"+funcs+'; return {drawDimensionPlan,drawElevationPlan};'))(extras.getCarportLayout,extras.getCarportSides,extras.getCarportSettings,assembly.getFrontCanopy);
  const {jsPDF}=require('jspdf');
  const config={...base,width:600,hasCarport:true,carportSide:'both',carportLeft:{width:150},carportRight:{width:350}};
  const doc=new jsPDF();const rectangles=[];const original=doc.rect.bind(doc);
  doc.rect=(...args)=>{assert.ok(args.slice(0,4).every(Number.isFinite));rectangles.push(args);return original(...args);};
  drawings.drawDimensionPlan(doc,config,10,20,142,75);
  const bodies=rectangles.filter(rect=>rect[2]>2&&rect[3]>2);
  assert.equal(bodies.length,3);
  const scale=142/1100;
  assert.ok(Math.abs(bodies[0][0]-(10+150*scale))<1e-6);
  assert.ok(Math.abs(bodies[1][2]-150*scale)<1e-6);
  assert.ok(Math.abs(bodies[2][2]-350*scale)<1e-6);
  for(const roofType of ['dual-slope','dual-slope-front-back','slope-front','slope-back','slope-left','slope-right']) for(const wall of ['front','back','left','right']) {
    drawings.drawElevationPlan(doc,{...config,roofType},wall,wall,20,130,160,42);
  }
  assert.ok(doc.output('arraybuffer').byteLength>1000);
});

test('two garages price independently, include one gate per PIR garage and count only outer side carports',()=>{
  const first={...base,buildingMaterial:'pir',elements:[gate('a',300,0,'sectional')],hasCarport:true,carportSide:'both',carportLeft:{width:111},carportRight:{width:222}};
  const second={...base,width:401,length:603,buildingMaterial:'pir',elements:[gate('b',300,0,'sectional')],hasCarport:true,carportSide:'both',carportLeft:{width:333},carportRight:{width:121}};
  const config={...first,assembly:{second,gapWidth:301}};
  const layout=assembly.getAssemblyLayout(config);
  assert.equal(layout.width,300+401+301+111+121);
  assert.equal(layout.middleLength,500);
  assert.equal(layout.firstZ+first.length/2,layout.secondZ+second.length/2);
  const expected=price({...first,carportSide:'left'})+price({...second,carportSide:'right'})+301*500/10000*100;
  assert.equal(price(config),expected);
  assert.ok(material.getGarageCameraDistance(config,'front',0.5)>material.getGarageCameraDistance(first,'front',0.5));
});
test('canopy and its side walls are included in PIR; client-supplied canopy prices are ignored',()=>{
  const config={...base,buildingMaterial:'pir',frontCanopy:51,frontCanopyWalls:true,frontCanopyPrice:123.45};
  assert.equal(assembly.getFrontCanopy(config),51);assert.equal(price(config),19500);
  assert.equal(price({...config,frontCanopyPrice:1000000}),19500);
  assert.equal(price({...config,frontCanopyWalls:false}),19500);
  assert.equal(assembly.getFrontCanopy({...config,buildingMaterial:'sheet'}),0);
});
test('reinforced 60x40 frame is included in every PIR garage but charged normally for sheet',()=>{
  for(const type of ['fixed','pct_base','pct_total','m2','mb']) {
    const addon={id:'profil-wzmocniony-60x40_181',label:'Profil wzmocniony 60×40',price:10,type};
    const config={...base,extraOptions:[addon.id]};
    assert.equal(price({...config,buildingMaterial:'pir'},pricing,[addon]),19500);
    assert.ok(price(config,pricing,[addon])>3000);
    assert.equal(price({...config,buildingMaterial:'pir',assembly:{second:{...config,buildingMaterial:'pir'},gapWidth:300}},pricing,[addon]),40500);
  }
});
test('composition files retain both units and reject nesting, invalid bounds and invalid side-wall settings',()=>{
  const first={...fullConfig,width:301,length:501,height:211,frontCanopy:51,frontCanopyPrice:123.45};
  const config={...first,assembly:{second:{...first,width:401,length:601,height:221},gapWidth:301}};
  const file={version:1,id:'assembly',name:'Dwa garaże',config};
  assert.deepEqual(storage.parseProjectFile(JSON.stringify(file)).config,config);
  for(const invalid of [null,{gapWidth:601,second:first},{gapWidth:199,second:first},{gapWidth:301,second:{...first,assembly:{gapWidth:301,second:first}}}]) assert.equal(storage.isGarageProjectConfig({...first,assembly:invalid}),false);
  assert.equal(storage.isGarageProjectConfig({...first,frontCanopy:151}),false);
  assert.equal(storage.isGarageProjectConfig({...first,frontCanopyWalls:'yes'}),false);
  assert.equal(extras.normalizeDimension('211',200,350),211);
  assert.equal(extras.normalizeDimension('501',300,3000),501);
});

test('one crosswise roof spans both garages and the carport with one ridge or one continuous slope',()=>{
  for(const roofType of ['dual-slope','slope-left','slope-right']) {
    const config={...fullConfig,width:301,length:501,height:211,roofType,hasCarport:true,carportSide:'left',carportLeft:{width:111},assembly:{gapWidth:301,second:{...fullConfig,width:401,length:601,height:221,hasCarport:true,carportSide:'right',carportRight:{width:123}}}};
    const layout=assembly.getAssemblyLayout(config),profile=assembly.getSharedRoofProfile(config);
    assert.equal(layout.first.height,221);assert.equal(layout.second.height,221);
    assert.equal(profile.maxX-profile.minX,301+401+301+111+123);
    const center=(profile.minX+profile.maxX)/2;
    if(roofType==='dual-slope') {
      assert.equal(assembly.sharedRoofHeightAt(profile,center),261);
      assert.equal(assembly.sharedRoofHeightAt(profile,profile.minX),221);
      assert.equal(assembly.sharedRoofHeightAt(profile,profile.maxX),221);
    } else {
      assert.equal(assembly.sharedRoofHeightAt(profile,center),241);
      assert.equal(Math.abs(assembly.sharedRoofHeightAt(profile,profile.minX)-assembly.sharedRoofHeightAt(profile,profile.maxX)),40);
    }
    for(const boundary of [layout.firstX+layout.first.width/2,layout.secondX-layout.second.width/2]) {
      const fromLeft=assembly.sharedRoofHeightAt(profile,boundary-0.00001),fromRight=assembly.sharedRoofHeightAt(profile,boundary+0.00001);
      assert.ok(Math.abs(fromLeft-fromRight)<0.00001);
    }
    const normalized=options.cleanUnavailableOptions(config,[]);
    assert.equal(normalized.height,normalized.assembly.second.height);
    assert.deepEqual(assembly.normalizeSharedRoof(normalized),normalized);
    const expected=price({...layout.first,hasCarport:true})+price({...layout.second,hasCarport:true})+301*501/10000*100;
    assert.equal(price(config),Math.round(expected*100)/100);
  }
});
test('front/back roofs and single garages keep their existing geometry and independent heights',()=>{
  for(const roofType of ['slope-front','slope-back','dual-slope-front-back']) {
    const config={...fullConfig,width:301,length:501,height:211,roofType,assembly:{gapWidth:300,second:{...fullConfig,width:401,length:601,height:231}}};
    assert.equal(assembly.getSharedRoofProfile(config),null);
    assert.equal(assembly.getAssemblyLayout(config).first.height,211);assert.equal(assembly.getAssemblyLayout(config).second.height,231);
    assert.equal(assembly.normalizeSharedRoof(config),config);
  }
  assert.equal(assembly.getSharedRoofProfile(fullConfig),null);
});


test('manual quote prices accept Polish decimals and reject missing, invalid or silently rounded amounts',()=>{
 const {parseManualOfferPrice}=load('src/lib/offerPrice.ts');
 for(const [input,expected] of [['25 000,50',25000.5],['25000.50',25000.5],['0,01',0.01],['100000000',100000000]])assert.equal(parseManualOfferPrice(input),expected);
 for(const input of ['',' ','0','-1','Infinity','NaN','1e5','12.345','1,2,3','100000000.01','+123'])assert.equal(parseManualOfferPrice(input),null,input);
});
test('recess configurations persist, retain catalogue pricing and reject unknown middle-space types',()=>{
 const config={...fullConfig,assembly:{second:{...fullConfig},gapWidth:300,middleType:'recess'}};
 assert.equal(storage.parseProjectFile(JSON.stringify({version:1,id:'recess',name:'Wnęka',config})).config.assembly.middleType,'recess');
 assert.equal(price(config),price({...config,assembly:{...config.assembly,middleType:'carport'}}));
 assert.equal(storage.isGarageProjectConfig({...config,assembly:{...config.assembly,middleType:'invalid'}}),false);
});

test('two 290cm up-and-over gates fit a 6m front while two 300cm gates do not', () => {
  const initial={...base,width:600,elements:[gate('first',290,0),gate('second',200,0)]};
  const next=options.updateGarageElement(initial,'second',{width:290});
  assert.ok(next);
  assert.ok(next.elements.every(el=>collision.checkWallBounds(collision.getElementRect(el),600,210)));
  assert.equal(collision.checkCollision(...next.elements.map(collision.getElementRect)),false);
  assert.deepEqual(next.elements.map(el=>el.width),[290,290]);
  assert.equal(options.updateGarageElement({...initial,elements:[gate('first',300,0),gate('second',200,0)]},'second',{width:300}),null);
  assert.equal(initial.elements[0].x,0);
});
test('adding a second gate repacks a centred neighbour and keeps fixed openings intact', () => {
  const door={id:'door',type:'door',wall:'back',width:100,height:200,x:0,y:0};
  const candidate={...base,width:600,elements:[gate('first',290,0),door,gate('new',200,0)]};
  const next=options.updateGarageElement(candidate,'new',{width:200,height:200});
  assert.ok(next);
  assert.equal(next.elements[1],door);
  const gates=next.elements.filter(el=>el.type==='gate');
  assert.equal(collision.checkCollision(...gates.map(collision.getElementRect)),false);
  assert.ok(gates.every(el=>collision.checkWallBounds(collision.getElementRect(el),600,210)));
});
test('290cm up-and-over gate keeps the 3m tariff and PIR includes exactly one', () => {
  const rates={...pricing,gate_up_3x2:1234};
  const gates=[gate('a',290,-147.5),gate('b',290,147.5)];
  const config={...base,width:600,elements:gates};
  assert.equal(price(config,rates)-price({...config,elements:[]},rates),2468);
  assert.equal(price({...config,buildingMaterial:'pir'},rates)-price({...config,buildingMaterial:'pir',elements:[]},rates),1234);
  assert.equal(price({...config,elements:[gate('old',300,0)]},rates)-price({...config,elements:[]},rates),1234);
});

test('windows and skylights find horizontal space without dropping below the middle of the wall', () => {
  const wallGate=gate('first',250,0);
  for (const [type,height,width] of [['window',60,80],['pvc-window',60,80],['skylight',30,100]]) {
    const opening={id:'new',type,wall:'front',width,height,x:0,y:(210-height)/2};
    const next=options.updateGarageElement({...base,width:600,elements:[wallGate,opening]},'new',{width,height});
    assert.ok(next);
    const placed=next.elements[1];
    assert.equal(placed.y+placed.height/2,105);
    assert.equal(collision.checkCollision(collision.getElementRect(placed),collision.getElementRect(wallGate)),false);
    assert.ok(collision.checkWallBounds(collision.getElementRect(placed),600,210));
  }
});
test('a fully occupied centre row rejects new windows and skylights instead of placing them on the floor', () => {
  const obstruction={id:'existing',type:'window',wall:'front',width:590,height:60,x:0,y:75};
  for (const type of ['window','skylight']) {
    const opening={id:'new',type,wall:'front',width:80,height:30,x:0,y:90};
    assert.equal(collision.findValidPosition(opening,[obstruction],600,210),null);
  }
});

test('changing window dimensions retains its vertical centre and does not block tall window presets', () => {
  const opening={id:'window',type:'window',wall:'back',width:80,height:60,x:0,y:75};
  const next=options.updateGarageElement({...base,height:210,elements:[opening]},'window',{width:40,height:180});
  assert.ok(next);
  assert.equal(next.elements[0].y,15);
  assert.ok(collision.checkWallBounds(collision.getElementRect(next.elements[0]),300,210));
});

const camera = load('src/lib/garageCamera.ts');
test('right garage left wall is viewed through the recess instead of from the left outer wall', () => {
  const config={...base,width:600,length:600,assembly:{second:{...base,width:600,length:600},gapWidth:300,middleType:'recess'}};
  const view=camera.getGarageCameraView(config,'left',1.6,1);
  assert.equal(view.target[0],1.5);
  assert.equal(view.position[0],0);
  assert.ok(view.position[2]>3);
  const crossing=(3-view.position[2])/(view.target[2]-view.position[2]);
  const entryX=view.position[0]+crossing*(view.target[0]-view.position[0]);
  const entryY=view.position[1]+crossing*(view.target[1]-view.position[1]);
  assert.ok(entryX>-1.5 && entryX<1.5);
  assert.ok(entryY<2);
  assert.deepEqual(camera.getGarageCameraView(config,'left',1.6,0),camera.getGarageCameraView(config,'left',1.6,0,null,true));
});
test('left garage right wall uses the mirrored recess view for all roof and middle-space types', () => {
  for(const roofType of ['dual-slope','dual-slope-front-back','slope-front','slope-back','slope-left','slope-right']) {
    for(const middleType of ['carport','recess']) {
      const config={...base,width:600,length:600,roofType,assembly:{second:{...base,width:600,length:600,roofType},gapWidth:200,middleType}};
      const right=camera.getGarageCameraView(config,'left',0.4,1),left=camera.getGarageCameraView(config,'right',0.4,0);
      assert.equal(left.position[0],right.position[0]);
      assert.equal(left.position[2],right.position[2]);
      assert.equal(left.target[0],-right.target[0]);
      assert.ok([...left.position,...left.target,...right.position,...right.target].every(Number.isFinite));
    }
  }
});
test('inner-wall focus uses the edited garage offsets and the selected door, including unequal units', () => {
  const door={id:'right-door',type:'door',wall:'left',width:100,height:200,x:50,y:0};
  const config={...base,width:600,length:600,assembly:{second:{...base,width:400,length:400,elements:[door]},gapWidth:300,middleType:'recess'}};
  const view=camera.getGarageCameraView(config,'left',1.6,1,door.id);
  assert.deepEqual(view.target,[2.5,1,1.5]);
  assert.equal(view.position[0],1);
  assert.ok(view.position[2]>3);
  assert.notDeepEqual(view.target,camera.getGarageCameraView(config,'left',1.6,0,door.id).target);
});
test('single-garage and PDF overview views retain their existing scene framing', () => {
  const config={...base,width:600,length:600,assembly:{second:{...base,width:600,length:600},gapWidth:300,middleType:'recess'}};
  for(const wall of ['front','back','left','right']) {
    assert.deepEqual(camera.getGarageCameraView(base,wall,1.6,1),camera.getGarageCameraView(base,wall,1.6,0,null,true));
    assert.deepEqual(camera.getGarageCameraView(config,wall,1.6,0,null,true),camera.getGarageCameraView(config,wall,1.6,1,null,true));
  }
  assert.equal(camera.getGarageCameraView(config,'left',1.6,1,null,true).target[0],-7.5);
  assert.equal(camera.getGarageCameraView(config,'right',1.6,0,null,true).target[0],7.5);
});
