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
const clipping = load('src/lib/profileClipping.ts');
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

test('roof T-7 runs down either slope axis, stays inside the roof and keeps normals upward',()=>{
  const {createRoofSheetGeometry}=load('src/lib/roofSheetGeometry.ts');
  for(const axis of ['x','z']) for(const [width,depth] of [[3.3,6.3],[30.3,30.3],[40.3,6.3]]) {
    const geometry=createRoofSheetGeometry(width,depth,axis);
    const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal');
    let raised=0;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      assert.ok([x,y,z,uv.getX(i),uv.getY(i)].every(Number.isFinite));
      assert.ok(Math.abs(x)<=width/2+0.00001 && Math.abs(z)<=depth/2+0.00001);
      assert.ok(y>=0 && y<=0.007001);
      assert.ok(normal.getY(i)>0);
      const along=axis==='x'?x:z,span=axis==='x'?width:depth;
      assert.ok(Math.abs(Math.abs(along)-span/2)<0.00001,'rib varies along the fall');
      if(y>0.006)raised++;
    }
    assert.ok(raised>0);
    assert.ok(p.count<8000,'roof mesh is unexpectedly dense');
    geometry.dispose();
  }
});

test('tile relief keeps finite geometry within desktop and phone detail budgets',()=>{
  const helper=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='createRoofTileReliefGeometry').getText(ast);
  const create=new Function('THREE',compile(helper)+';return createRoofTileReliefGeometry;')(THREE);
  for(const axis of ['x','z']) for(const budget of [32,64]){
    const geometry=create(30,30,axis,budget),p=geometry.getAttribute('position');
    assert.equal(p.count,(budget+1)**2);
    for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));
    geometry.dispose();
  }
});

// Exercise the actual roof renderer and its transforms, including asymmetric overhangs.
let renderRoofArrow;
function visitRoof(node) {
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='renderRoof')renderRoofArrow=node.initializer.getText(ast);
  ts.forEachChild(node,visitRoof);
}
visitRoof(ast);
const heightCode=model.slice(model.indexOf('  const rt = String(config.roofType'),model.indexOf('  const createGarageFrontShape'));
const roofCode=ts.transpileModule('const roofRender='+renderRoofArrow+'; return roofRender();',{fileName:'roof.tsx',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const roofRender=new Function('config','THREE','require',
  "const exports={};const sharedRoof=undefined,worldX=0;const w=config.width/100,l=config.length/100,h=config.height/100,t=0.1,slopeH=0.4,roofContactOverlap=0.005,minX=-w/2,maxX=w/2,totalW=w,centerX=0;const colors=[],materialTextures={},woodColor=undefined,woodNormal=undefined,roofTileTexture=undefined,isPir=true,isRoofTile=false,showRoofFlashings=false,showGutters=true;const RoofSheetRelief='sheet',PirPanelJoints='joints',RoofTileRelief='tiles';const resolveColor=()=>({hex:'#777777',isWood:false,textureUrl:''}),getColorAppearance=()=>({roughness:0.7}),getFrontCanopy=c=>Math.min(150,Math.max(0,c.frontCanopy||0));"+compile(heightCode)+roofCode);
function roofBounds(tree) {
  const bounds=new THREE.Box3();
  function walk(node,matrix) {
    if(!node)return;if(Array.isArray(node)){node.forEach(child=>walk(child,matrix));return;}
    const props=node.props || {};let next=matrix;
    if(node.type==='group'||node.type==='mesh') {
      next=matrix.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...(props.position || [0,0,0])),new THREE.Quaternion().setFromEuler(new THREE.Euler(...(props.rotation || [0,0,0]))),new THREE.Vector3(1,1,1)));
    }
    if(node.type==='boxGeometry') {
      const [w,h,l]=props.args;
      for(const x of [-w/2,w/2])for(const y of [-h/2,h/2])for(const z of [-l/2,l/2])bounds.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(matrix));
    }
    walk(props.children,next);
  }
  walk(tree,new THREE.Matrix4());return bounds;
}
test('PIR roof projection moves only the front edge for all six roof types and keeps geometry finite',()=>{
  for(const roofType of ['dual-slope','dual-slope-front-back','slope-front','slope-back','slope-left','slope-right'])for(const frontCanopy of [1,51,150]) {
    const base={width:301,length:501,height:211,buildingMaterial:'pir',roofType};
    const before=roofBounds(roofRender(base,THREE,require)),after=roofBounds(roofRender({...base,frontCanopy},THREE,require));
    for(const value of [...after.min.toArray(),...after.max.toArray()])assert.ok(Number.isFinite(value));
    assert.ok(Math.abs(after.min.z-before.min.z)<0.00001,roofType+' back edge moved');
    assert.ok(Math.abs(after.max.z-before.max.z-frontCanopy/100)<0.00001,roofType+' front projection wrong');
    assert.ok(Math.abs(after.min.x-before.min.x)<0.00001);assert.ok(Math.abs(after.max.x-before.max.x)<0.00001);
  }
});


test('garage wall outlines meet the shared roof at every top edge, including a ridge inside an asymmetric garage',()=>{
 const source=fs.readFileSync(path.join(root,'src/lib/garageAssembly.ts'),'utf8');
 const profileAst=ts.createSourceFile('assembly.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const helper=profileAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='sharedRoofHeightAt').getText(profileAst);
 const sample=new Function('const exports={};'+compile(helper)+';return sharedRoofHeightAt;')();
 const shapes=model.slice(model.indexOf('  const createGarageFrontShape'),model.indexOf('  const wallExtrude'));
 const render=new Function('config','sharedRoof','worldX','THREE','sharedRoofHeightAt',
   'const exports={};const w=config.width/100,l=config.length/100,h=config.height/100,slopeH=0.4,minX=-w/2,maxX=w/2,totalW=w,centerX=0,gableCenterX=((sharedRoof.minX+sharedRoof.maxX)/2-worldX)/100;'+compile(heightCode+shapes)+';return [createGarageFrontShape(),createGarageBackShape(),createGarageSideShape(true),createGarageSideShape(false)];');
 for(const roofType of ['dual-slope','slope-left','slope-right']) for(const [width,worldX] of [[600,-450],[600,450],[1100,-200],[300,600]]) {
   const profile={minX:-750,maxX:750,baseHeight:219,roofType};
   const outlines=render({width,length:601,height:219,roofType},profile,worldX,THREE,sample);
   outlines.forEach((shape,index)=>{
     const points=shape.getPoints().filter(p=>p.y>0);
     for(let i=0;i<points.length-1;i++) for(let step=0;step<=10;step++) {
       const alpha=step/10,x=points[i].x*(1-alpha)+points[i+1].x*alpha,y=points[i].y*(1-alpha)+points[i+1].y*alpha;
       const world=index===0?worldX+x*100:index===1?worldX-x*100:worldX+(index===2?width/2:-width/2);
       assert.ok(Math.abs(y-sample(profile,world)/100)<0.000001,roofType+' wall leaves the common roof');
     }
   });
 }
});
