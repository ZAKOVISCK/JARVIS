'use client';
import {useCallback,useEffect,useState} from 'react';
import type {VehicleData} from '@/lib/fleet';
import {VehicleResource} from '@/lib/vehicle-resource';
const resource=new VehicleResource();
export function useVehicle(code:string){
 const [state,setState]=useState<{code:string;data:VehicleData|null;error:string}>({code:'',data:null,error:''}),[revision,setRevision]=useState(0);
 const retry=useCallback(()=>{resource.invalidate(code);setState({code,data:null,error:''});setRevision(n=>n+1)},[code]);
 useEffect(()=>{let active=true,release=()=>{};const timer=setTimeout(()=>{setState({code,data:null,error:''});try{const read=resource.acquire(code);release=read.release;void read.promise.then(data=>{if(active)setState({code,data,error:''})}).catch(error=>{if(active)setState({code,data:null,error:error instanceof Error?error.message:'Não foi possível carregar o veículo.'})})}catch(error){if(active)setState({code,data:null,error:error instanceof Error?error.message:'Prefixo inválido.'})}},0);return()=>{active=false;clearTimeout(timer);release()}},[code,revision]);
 return {...(state.code===code?state:{code,data:null,error:''}),retry};
}
