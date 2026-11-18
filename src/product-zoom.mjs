/**
 * Zoom do aplicativo Windows. Limites impedem interface ilegível.
 * Preferências são específicas do produto e persistidas no perfil local.
 */
export const VALID_ZOOM_ACTIONS=Object.freeze(['in','out','reset']);
export function zoomFactorForAction(current,action){
 if(!VALID_ZOOM_ACTIONS.includes(action))throw Error('Ação de zoom inválida.');
 if(action==='reset')return 1;
 const normalized=Number.isFinite(current)?Math.max(.5,Math.min(2,current)):1;
 const next=Math.round((normalized+(action==='in'?.1:-.1))*10)/10;
 return Math.max(.5,Math.min(2,next));
}
export function zoomPercent(factor){
 return Math.round(100*Math.max(.5,Math.min(2,Number(factor)||1)))+'%';
}
