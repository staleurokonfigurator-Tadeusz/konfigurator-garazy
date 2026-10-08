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
const collision = load('src/lib/collision.ts');
const joints = load('src/components/PirPanelJoints.tsx');
const panelSource = fs.readFileSync(path.join(root, 'src/components/ConfigPanel.tsx'), 'utf8');
const parsed = ts.createSourceFile('ConfigPanel.tsx', panelSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let priceCallback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'calculatedPrice') {
    priceCallback = node.initializer.arguments[0].getText(parsed);
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(priceCallback);
// Execute the callback used by the UI itself, rather than duplicating the price formula.
const calculate = new Function('config','pricing','customAddons','appData','dbColors','isPirGarage','getPirPricePerM2','isAddonAvailable',
  compile('const safeNum = (val: unknown) => { const num = Number(val); return isNaN(num) ? 0 : num; }; return ('+priceCallback+')();'));
const base = {width:300,length:500,height:210,roofType:'dual-slope',elements:[],extraOptions:[],gutters:false};
const pricing = {sqm_single_v:150,sqm_dual_v:200,gate_up_2x2:800,gutter_v:10,roof_tile_v:20,integrated_carport_m2_v:100};
const price = (config, rates=pricing, addons=[]) => calculate(config,rates,addons,{baseConfig:{h:210}},[],material.isPirGarage,material.getPirPricePerM2,options.isAddonAvailable);

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
  assert.equal(price({...large,gutters:true}),1170600);
  assert.equal(price({...base,buildingMaterial:'pir',height:220}),21450);
  assert.equal(price({...base,buildingMaterial:'pir',elements:[{type:'gate',gateType:'up-and-over',width:200,height:200}]}),20300);
  assert.equal(price({...large,extraOptions:['perimeter']},pricing,[{id:'perimeter',type:'mb',price:2}]),1170240);
  assert.equal(price({...base,buildingMaterial:'pir',hasCarport:true,carportWidth:300}),21000);
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
