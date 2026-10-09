import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneConnector,sceneHotspots,sceneSpace} from '../lib/scene-hud.ts';

test('as conexões acompanham o centro real do rótulo após redimensionamento e deslocamento da cena',()=>{
 for(const width of [540,680,900,1100]){
  const frame={left:280,top:110,width,height:width*sceneSpace.height/sceneSpace.width};
  const label={left:frame.left+width*.29-70,top:frame.top+frame.height*.92-22,width:140,height:44};
  const c=sceneConnector(frame,label,'arrefecimento');
  assert.ok(c);assert.ok(Math.abs(c.x-290)<.00001);assert.ok(Math.abs(c.y-sceneSpace.height*.92)<.00001);
  assert.deepEqual([c.tx,c.ty],sceneHotspots.arrefecimento.point);
  const moved=sceneConnector({...frame,left:520,top:220},{...label,left:label.left+240,top:label.top+110},'arrefecimento');
  assert.equal(moved.path,c.path);
 }
});
test('tamanho real do botão é considerado; cada linha termina no sistema correspondente',()=>{
 const frame={left:0,top:0,width:1000,height:620};
 for(const system of Object.keys(sceneHotspots)){
  const small=sceneConnector(frame,{left:12,top:100,width:100,height:44},system);
  const large=sceneConnector(frame,{left:12,top:100,width:170,height:60},system);
  assert.equal(large.x-small.x,35);assert.equal(large.y-small.y,8);
  assert.ok(large.tx>=0&&large.tx<=sceneSpace.width&&large.ty>=0&&large.ty<=sceneSpace.height);
  assert.ok(!large.path.includes('NaN'));
 }
});
test('cena sem área mensurável não produz conexões inválidas',()=>{
 const label={left:0,top:0,width:100,height:44};
 assert.equal(sceneConnector({left:0,top:0,width:0,height:620},label,'motor'),null);
 assert.equal(sceneConnector({left:0,top:0,width:1000,height:0},label,'motor'),null);
 assert.equal(sceneConnector({left:0,top:0,width:1000,height:620},{...label,left:NaN},'motor'),null);
});
