import {Texture,type BufferGeometry,type Material,type Object3D,type Skeleton} from 'three';

/** Own both loaded models and setup resources, including models that finish after cleanup. */
export function createModelResources(){
 let closed=false;
 const roots=new Set<Object3D>(),cleanups:Array<()=>void>=[];
 const geometries=new WeakSet<BufferGeometry>(),materials=new WeakSet<Material>(),textures=new WeakSet<Texture>(),images=new WeakSet<object>(),skeletons=new WeakSet<Skeleton>();
 const disposeTexture=(texture:Texture)=>{
  if(textures.has(texture))return;textures.add(texture);texture.dispose();
  const data:unknown=texture.source.data;
  for(const image of Array.isArray(data)?data:[data]){
   if(image&&typeof image==='object'&&'close' in image&&typeof image.close==='function'&&!images.has(image)){
    images.add(image);image.close();
   }
  }
 };
 const disposeRoot=(root:Object3D)=>root.traverse(object=>{
  const drawable=object as Object3D&{geometry?:BufferGeometry;material?:Material|Material[];skeleton?:Skeleton};
  const geometry=drawable.geometry;
  if(geometry&&!geometries.has(geometry)){geometries.add(geometry);geometry.dispose()}
  for(const material of Array.isArray(drawable.material)?drawable.material:drawable.material?[drawable.material]:[]){
   if(materials.has(material))continue;materials.add(material);
   for(const value of Object.values(material))if(value instanceof Texture)disposeTexture(value);
   material.dispose();
  }
  if(drawable.skeleton&&!skeletons.has(drawable.skeleton)){skeletons.add(drawable.skeleton);drawable.skeleton.dispose()}
 });
 return {
  get closed(){return closed},
  own(root:Object3D){if(closed){disposeRoot(root);return false}roots.add(root);return true},
  addCleanup(cleanup:()=>void){if(closed)cleanup();else cleanups.push(cleanup)},
  dispose(){
   if(closed)return;closed=true;
   try{for(const root of roots)disposeRoot(root)}finally{
    roots.clear();
    for(const cleanup of cleanups.reverse()){
     try{cleanup()}catch{/* One failed cleanup must not retain the remaining resources. */}
    }
    cleanups.length=0;
   }
  },
 };
}
