'use client';
import {useEffect,useRef} from 'react';
import type {LicensedModel} from '@/lib/model-registry';
export default function ModelViewer({model,onError}:{model:LicensedModel;onError:(s:string)=>void}){
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const host=container.current;if(!host)return;
  let teardown=()=>{},cancelled=false;
  void (async()=>{
   try{
    const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{OrbitControls}=await import('three/addons/controls/OrbitControls.js');
    if(cancelled)return;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));host.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,100),controls=new OrbitControls(camera,renderer.domElement);
    camera.position.set(9,5,9);controls.enablePan=false;controls.minDistance=5;controls.maxDistance=20;controls.maxPolarAngle=Math.PI*.48;
    scene.add(new THREE.HemisphereLight(0xd5f5ff,0x14202e,3));
    const render=()=>{if(!cancelled&&!document.hidden)renderer.render(scene,camera)};
    controls.addEventListener('change',render);
    const resize=new ResizeObserver(()=>{if(host.clientWidth<1)return;renderer.setSize(host.clientWidth,300);camera.aspect=host.clientWidth/300;camera.updateProjectionMatrix();render()});
    resize.observe(host);document.addEventListener('visibilitychange',render);
    const contextLost=(event:Event)=>{event.preventDefault();if(!cancelled)onError('A visualização 3D perdeu o contexto gráfico. Use o mapa de sistemas.')};
    renderer.domElement.addEventListener('webglcontextlost',contextLost);
    const dispose=(object:import('three').Object3D)=>object.traverse(o=>{
     if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof THREE.Texture)value.dispose();m.dispose()}}
    });
    teardown=()=>{resize.disconnect();document.removeEventListener('visibilitychange',render);renderer.domElement.removeEventListener('webglcontextlost',contextLost);controls.dispose();dispose(scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()};
    const gltf=await new GLTFLoader().loadAsync(model.url);
    if(cancelled){dispose(gltf.scene);return}
    let triangles=0;gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3});
    if(triangles>Math.min(model.maxTriangles,100000)){dispose(gltf.scene);throw new Error('Modelo acima do orçamento de performance.')}
    const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()).length();if(!Number.isFinite(size)||size<=0){dispose(gltf.scene);throw new Error('Modelo sem geometria válida.')}scene.add(gltf.scene);gltf.scene.scale.setScalar(8/size);gltf.scene.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(8/size));render();
   }catch{teardown();if(!cancelled)onError('Modelo 3D indisponível. Use o mapa de sistemas.')}
  })();return()=>{cancelled=true;teardown()};
 },[model,onError]);
 return <div ref={container} className="model-canvas" role="img" aria-label={`Modelo ${model.vehicleModel}; ${model.license}`}/>;
}
