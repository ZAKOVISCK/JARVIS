import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Group,Line,Mesh,MeshBasicMaterial,Points,Texture} from 'three';
import {createModelResources} from '../lib/model-resources.ts';

function counted(resource){
 let calls=0;resource.addEventListener('dispose',()=>calls++);
 return ()=>calls;
}

test('3D cleanup releases shared geometry, material, textures and their bitmap exactly once',()=>{
 const resources=createModelResources(),root=new Group(),geometry=new BufferGeometry();
 let closes=0;const bitmap={close(){closes++}},texture=new Texture(bitmap),alpha=new Texture(bitmap);
 const material=new MeshBasicMaterial({map:texture,alphaMap:alpha});
 const disposed=[geometry,material,texture,alpha].map(counted);
 root.add(new Mesh(geometry,material),new Line(geometry,material),new Points(geometry,material));
 const scene=new Group();scene.add(root);resources.own(scene);resources.own(root);
 resources.dispose();resources.dispose();
 assert.deepEqual(disposed.map(count=>count()),[1,1,1,1]);assert.equal(closes,1);
});

test('3D cleanup releases line and point resources even when no meshes are present',()=>{
 const resources=createModelResources(),root=new Group();
 const geometry=new BufferGeometry(),material=new MeshBasicMaterial();
 const disposed=[geometry,material].map(counted);
 root.add(new Line(geometry,material),new Points(geometry,material));resources.own(root);resources.dispose();
 assert.deepEqual(disposed.map(count=>count()),[1,1]);
});

test('a model that finishes loading after unmount is discarded immediately',async()=>{
 const resources=createModelResources(),geometry=new BufferGeometry(),material=new MeshBasicMaterial();
 const disposed=[geometry,material].map(counted);
 let finish;const load=new Promise(resolve=>{finish=resolve});
 const loading=load.then(root=>resources.own(root));
 resources.dispose();finish(new Mesh(geometry,material));
 assert.equal(await loading,false);assert.equal(resources.closed,true);
 assert.deepEqual(disposed.map(count=>count()),[1,1]);
});

test('partial setup cleanup is idempotent, reverses acquisition and continues after a cleanup failure',()=>{
 const resources=createModelResources(),released=[];
 resources.addCleanup(()=>released.push('renderer'));
 resources.addCleanup(()=>{released.push('controls');throw new Error('simulated cleanup failure')});
 resources.addCleanup(()=>released.push('observer'));
 resources.dispose();resources.dispose();resources.addCleanup(()=>released.push('late resource'));
 assert.deepEqual(released,['observer','controls','renderer','late resource']);
});
