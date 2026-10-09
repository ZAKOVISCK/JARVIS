import type {SystemId} from './cognitive.ts';

/** Coordinates on the conceptual illustration, never technical measurements. */
export const sceneSpace={width:1000,height:620};
export const sceneHotspots:Record<SystemId,{x:number;y:number;point:[number,number]}>= {
 motor:{x:6,y:36,point:[315,414]},
 eletrico:{x:82,y:12,point:[650,192]},
 arrefecimento:{x:29,y:92,point:[168,390]},
 transmissao:{x:68,y:92,point:[712,458]},
 freios:{x:94,y:76,point:[912,450]},
};
export type SceneRect={left:number;top:number;width:number;height:number};

/** Convert measured DOM label centers to the SVG coordinate system. */
export function sceneConnector(frame:SceneRect,label:SceneRect,system:SystemId){
 if(frame.width<=0||frame.height<=0)return null;
 const x=(label.left+label.width/2-frame.left)/frame.width*sceneSpace.width;
 const y=(label.top+label.height/2-frame.top)/frame.height*sceneSpace.height;
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 const [tx,ty]=sceneHotspots[system].point;
 const cx=x+(tx-x)*.76,cy=y+(ty-y)*.12;
 return {path:`M${x.toFixed(2)} ${y.toFixed(2)} Q${cx.toFixed(2)} ${cy.toFixed(2)} ${tx} ${ty}`,x,y,tx,ty};
}
