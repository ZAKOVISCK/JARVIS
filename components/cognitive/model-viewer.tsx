'use client';
import {useEffect,useRef} from 'react';
import type {LicensedModel} from '@/lib/model-registry';
import {createModelResources} from '@/lib/model-resources';
export default function ModelViewer({model,onError}:{model:LicensedModel;onError:(s:string)=>void}){
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const host=container.current;if(!host)return;
  const resources=createModelResources();
  void (async()=>{
   try{
    const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{OrbitControls}=await import('three/addons/controls/OrbitControls.js');
    if(resources.closed)return;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    resources.addCleanup(()=>{try{renderer.dispose()}finally{try{renderer.forceContextLoss()}finally{renderer.domElement.remove()}}});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));host.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,100);resources.own(scene);
    const controls=new OrbitControls(camera,renderer.domElement);resources.addCleanup(()=>controls.dispose());
    camera.position.set(9,5,9);controls.enablePan=false;controls.minDistance=5;controls.maxDistance=20;controls.maxPolarAngle=Math.PI*.48;
    scene.add(new THREE.HemisphereLight(0xd5f5ff,0x14202e,3));
    const render=()=>{if(!resources.closed&&!document.hidden)renderer.render(scene,camera)};
    controls.addEventListener('change',render);
    resources.addCleanup(()=>controls.removeEventListener('change',render));
    const resize=()=>{if(resources.closed||host.clientWidth<1)return;renderer.setSize(host.clientWidth,300);camera.aspect=host.clientWidth/300;camera.updateProjectionMatrix();render()};
    if(typeof ResizeObserver==='undefined'){
     window.addEventListener('resize',resize);resources.addCleanup(()=>window.removeEventListener('resize',resize));
    }else{
     const observer=new ResizeObserver(resize);resources.addCleanup(()=>observer.disconnect());observer.observe(host);
    }
    resize();document.addEventListener('visibilitychange',render);resources.addCleanup(()=>document.removeEventListener('visibilitychange',render));
    const contextLost=(event:Event)=>{event.preventDefault();if(!resources.closed)onError('A visualização 3D perdeu o contexto gráfico. Use o mapa de sistemas.')};
    renderer.domElement.addEventListener('webglcontextlost',contextLost);
    resources.addCleanup(()=>renderer.domElement.removeEventListener('webglcontextlost',contextLost));
    const gltf=await new GLTFLoader().loadAsync(model.url);
    const retained=resources.own(gltf.scene);
    for(const root of gltf.scenes)if(root!==gltf.scene)resources.own(root);
    if(!retained)return;
    let triangles=0;gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){const position=o.geometry.getAttribute('position');if(!position)throw new Error('Modelo sem geometria válida.');triangles+=(o.geometry.index?.count??position.count)/3}});
    if(triangles>Math.min(model.maxTriangles,100000))throw new Error('Modelo acima do orçamento de performance.');
    const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()).length();if(!Number.isFinite(size)||size<=0)throw new Error('Modelo sem geometria válida.');scene.add(gltf.scene);gltf.scene.scale.setScalar(8/size);gltf.scene.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(8/size));render();
   }catch{const cancelled=resources.closed;resources.dispose();if(!cancelled)onError('Modelo 3D indisponível. Use o mapa de sistemas.')}
  })();return()=>resources.dispose();
 },[model,onError]);
 return <div ref={container} className="model-canvas" role="img" aria-label={`Modelo ${model.vehicleModel}; ${model.license}`}/>;
}
