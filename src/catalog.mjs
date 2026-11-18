export const APPS=Object.freeze({
 predictbot:Object.freeze({
  id:'predictbot',name:'PredictBot',subtitle:'OpenCode e MCP',
  description:'Sessões, tarefas, respostas e ponte remota com aprovação local.',
  localEntry:'predictbot.html',runtime:'desktop',color:'#9b7195',badge:'AUTOMAÇÃO',
  source:'https://github.com/W1CAPITAL/PredictBot'
 }),
 lexispredict:Object.freeze({
  id:'lexispredict',name:'LexisPredict',subtitle:'Gabinete jurídico digital',
  description:'Processos, prazos, publicações, DJEN, DataJud e atendimento.',
  localHealth:'/api/desktop/health',localEntry:'/',
  color:'#aa537e',badge:'JURÍDICO',
  source:'https://github.com/W1CAPITAL/LexisPredict'
 }),
 infinitum:Object.freeze({
  id:'infinitum',name:'INFINITUM',subtitle:'CRM operacional com Killa AI',
  description:'Atendimentos, processos, agenda, automações e agentes.',
  localHealth:'/api/desktop/health',localEntry:'/',
  color:'#9b7195',badge:'CRM + IA',
  source:'https://github.com/W1CAPITAL/Infinitum'
 })
});
export function resolveApp(id){
 if(typeof id!=='string'||!Object.prototype.hasOwnProperty.call(APPS,id))
  throw Error('Aplicativo não autorizado na Central W1.');
 return APPS[id];
}
