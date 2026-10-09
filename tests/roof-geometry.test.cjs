/* eslint-disable @typescript-eslint/no-require-imports */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const THREE = require('three');
const root = path.resolve(__dirname,'..');
const compile = source => ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function load(file) {
  const exports = {};
  new Function('exports','require',compile(fs.readFileSync(path.join(root,file),'utf8')))(exports,require);
  return exports;
}
const roof = load('src/lib/roofGeometry.ts');
const clipping = load('src/lib/profileClipping.ts');
const base = {width:300,length:500,height:210,roofType:'dual-slope'};
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('legacy rise and symmetric roof formulas round trip without rounding drift',()=>{
  assert.equal(roof.roofRiseCm(base),40);
  for (const angle of [1,15,20,45]) {
    const config = roof.withRoofAngle(base,angle);
    close(config.roofRiseCm,150*Math.tan(angle*Math.PI/180));
    close(roof.roofAngleDeg(config),angle);
    close(roof.totalHeightCm(config),210+config.roofRiseCm);
    close(roof.roofAngleDeg(roof.withRoofRise(base,config.roofRiseCm)),angle);
  }
});
test('roof orientation, integrated carport, 30m span and invalid values',()=>{
  for (const config of [base,{...base,roofType:'dual-slope-front-back'}, {...base,hasCarport:true,carportWidth:300}, {...base,width:3000,length:3000}]) {
    const half = roof.roofSpanCm(config)/2;
    close(roof.withRoofAngle(config,90).roofRiseCm,half);
    close(roof.withRoofRise(config,-50).roofRiseCm,half*Math.tan(Math.PI/180));
    assert.equal(roof.withRoofAngle(config,NaN),config);
    assert.equal(roof.withRoofRise(config,Infinity),config);
  }
  assert.equal(roof.roofSpanCm({...base,roofType:'dual-slope-front-back',hasCarport:true,carportWidth:300}),500);
  assert.equal(roof.roofRiseCm({...base,roofType:'slope-back',roofRiseCm:120}),40);
});
const model = fs.readFileSync(path.join(root,'src/components/GarageModel.tsx'),'utf8');
const ast = ts.createSourceFile('GarageModel.tsx',model,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names = ['getProfileReliefSpec','subtractRange','createProfileReliefGeometry'];
const helpers = ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(ast)).join('\n');
const {mergeGeometries} = require('three/examples/jsm/utils/BufferGeometryUtils.js');
const build = new Function('THREE','mergeGeometries','clipProfilePolygon','applyWallUV',compile(helpers)+'; return createProfileReliefGeometry;')(THREE,mergeGeometries,clipping.clipProfilePolygon,clipping.applyWallUV);
test('all six sheet profiles clip ribs to gable, align UV and exclude openings',()=>{
  const outline=[[-1.5,-1.05],[1.5,-1.05],[1.5,1.05],[0,2.05],[-1.5,1.05]];
  for (const orientation of ['pionowe','poziome']) for (const type of ['t7','t14','t17']) for (const direction of [-1,1]) {
    const geometry=build(3,2.1,`${orientation}-${type}`,[{x:0,y:-0.55,width:1,height:1}],direction,outline,[0,1.05]);
    const p=geometry.getAttribute('position'), uv=geometry.getAttribute('uv');
    let gableVertices=0;
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      assert.ok([x,y,z,uv.getX(i),uv.getY(i)].every(Number.isFinite));
      assert.ok(Math.abs(x)<=1.500001 && y>=-1.050001 && y<=2.05-Math.abs(x)/1.5+0.000001);
      assert.ok(!(Math.abs(x)<0.499 && y>-1.049 && y< -0.051),'rib crosses opening');
      assert.ok(z*direction>=-0.000001);
      assert.ok(Math.abs(uv.getX(i)-x)<0.000001);
      assert.ok(Math.abs(uv.getY(i)-(y+1.05))<0.000001);
      if(y>1.06) gableVertices++;
    }
    assert.ok(gableVertices>0);
    geometry.dispose();
  }
});
