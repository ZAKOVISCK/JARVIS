'use client';
import {Component,type ReactNode} from 'react';

/** A failed route bundle must not take the navigation or preserved data down. */
export class WorkspaceBoundary extends Component<{children:ReactNode;resetKey:string},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:Error){console.error('Jarvis workspace unavailable',error.name)}
 componentDidUpdate(previous:{resetKey:string}){if(previous.resetKey!==this.props.resetKey&&this.state.failed)this.setState({failed:false})}
 render(){
  if(this.state.failed)return <section className="workspace-unavailable surface" role="alert"><span className="eyebrow">Contexto indisponível</span><h2>Não foi possível abrir esta área.</h2><p>Você pode acessar outra área pela navegação ou recarregar o aplicativo. Consultas já registradas permanecem preservadas na memória.</p><button className="action-secondary" onClick={()=>window.location.reload()}>Recarregar aplicativo</button></section>;
  return this.props.children;
 }
}
