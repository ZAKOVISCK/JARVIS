import {formatPrefix,normalize,type VehicleProfile} from './fleet.ts';

export type VehiclePhoto={id:string;src:string;prefix:string;brand:string;model:string;plate:string;provenance:string};
export type VehicleVisual={kind:'exact'|'model-reference'|'unavailable';photo:VehiclePhoto|null;label:string;description:string};

// Only user-supplied, identifiable photographs enter this registry. A chassis
// match is a reference, not proof of bodywork or mechanical compatibility.
// Real photos and fleet identities stay in the private production project.
// Tests can supply their own explicit registry through resolveVehicleVisual(..., photos).
export const vehiclePhotos:readonly VehiclePhoto[]=[];

export function resolveVehicleVisual(vehicle:VehicleProfile|null,photos:readonly VehiclePhoto[]=vehiclePhotos):VehicleVisual{
 if(!vehicle)return {kind:'unavailable',photo:null,label:'Nenhum veículo selecionado',description:'Informe um prefixo para consultar sua identidade e imagem.'};
 const prefix=formatPrefix(vehicle.code),brand=normalize(vehicle.brand||''),model=normalize(vehicle.model||'');
 const exact=photos.find(p=>p.prefix===prefix&&(!vehicle.plate||normalize(p.plate)===normalize(vehicle.plate)));
 if(exact)return {kind:'exact',photo:exact,label:`Foto do veículo ${prefix}`,description:'Prefixo e placa conferidos com o cadastro. A foto não informa o estado atual do veículo.'};
 const reference=brand&&model?photos.find(p=>p.prefix!==prefix&&normalize(p.brand)===brand&&normalize(p.model)===model):undefined;
 if(reference)return {kind:'model-reference',photo:reference,label:`Referência cadastral · ${reference.prefix}`,description:`Foto do ${reference.prefix}, com a mesma marca e modelo cadastral. A carroceria deste prefixo não foi verificada.`};
 return {kind:'unavailable',photo:null,label:'Foto correspondente não disponível',description:'O cadastro foi localizado, mas ainda não há imagem vinculada a este veículo ou modelo. Nenhum outro ônibus é apresentado como sendo o correto.'};
}
