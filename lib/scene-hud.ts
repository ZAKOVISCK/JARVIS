import type {SystemId} from './cognitive.ts';

/** Coordinates on the conceptual illustration, never technical measurements. */
export const sceneSpace={width:1000,height:620};
export const sceneHotspots:Record<SystemId,{x:number;y:number;point:[number,number]}>= {
 motor:{x:23,y:7,point:[355,385]},
 eletrico:{x:88,y:15,point:[815,315]},
 arrefecimento:{x:30,y:91,point:[295,435]},
 transmissao:{x:64,y:10,point:[570,395]},
 freios:{x:73,y:87,point:[535,472]},
};
export type SceneRect={left:number;top:number;width:number;height:number};

/** Convert measured DOM label centers to the SVG coordinate system. */
export function sceneConnector(frame:SceneRect,label:SceneRect,system:SystemId){
 if(frame.width<=0||frame.height<=0)return null;
 const x=(label.left+label.width/2-frame.left)/frame.width*sceneSpace.width;
 const y=(label.top+label.height/2-frame.top)/frame.height*sceneSpace.height;
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 const [tx,ty]=sceneHotspots[system].point;
 const cx=x+(tx-x)*.45,cy=y+(ty-y)*.7;
 return {path:`M${x.toFixed(2)} ${y.toFixed(2)} L${cx.toFixed(2)} ${cy.toFixed(2)} L${tx} ${ty}`,x,y,tx,ty};
}
