import {OpenCodeAdapter} from '@w1capital/predictbot-opencode';
import {OpenCodeRuntime,detectOpenCode} from '@w1capital/predictbot-opencode/runtime';
export class OpenCodeController {
 #runtime=new OpenCodeRuntime();#adapter;#connecting=false;#stateDirectory;
 constructor({stateDirectory}={}){this.#stateDirectory=stateDirectory;}
 getRelayAdapter(){if(!this.#adapter)throw Error('Conecte o OpenCode primeiro.');return this.#adapter;}
 detect(executable){return detectOpenCode({executable:executable||undefined});}
 async connect(input){
  if(this.#connecting)throw Error('Uma conexão já está em andamento.');this.#connecting=true;
  try{
   this.disconnect();
   const {directory,userId,companyId}=input;
   const principal={userId,companyId};
   const adapter=input.mode==='local'?(await this.#runtime.start({directory,principal,stateDirectory:this.#stateDirectory,executable:input.executable||undefined,localAI:input.localAI})).adapter:new OpenCodeAdapter({url:input.url,password:input.password,directory,principal,stateDirectory:this.#stateDirectory});
   const health=await adapter.health();this.#adapter=adapter;
   return {connected:true,...health,sessions:await adapter.listSessions()};
  }catch(error){this.#runtime.stop();throw error;}finally{this.#connecting=false;}
 }
 disconnect(){this.#adapter=undefined;this.#runtime.stop();return {connected:false};}
 async act(action,input={}){
  if(!this.#adapter)throw Error('Conecte o OpenCode primeiro.');
  switch(action){
   case 'health':return this.#adapter.health();
   case 'sessions':return this.#adapter.listSessions();
   case 'create':return this.#adapter.createSession({title:input.title,mode:input.mode});
   case 'prompt':return this.#adapter.sendPrompt(input.sessionId,input.text);
   case 'messages':return this.#adapter.getMessages(input.sessionId);
   case 'diff':return this.#adapter.getDiff(input.sessionId);
   case 'abort':return this.#adapter.abortSession(input.sessionId);
   case 'mcp':return this.#adapter.listMcpServers();
   case 'mcpSave':return this.#adapter.configureMcp(input.name,input.config,{allowLocal:true});
   case 'mcpConnect':case 'mcpDisconnect':case 'mcpRemove':return this.#adapter.manageMcp(input.name,action);
   default:throw Error('Operação OpenCode não autorizada.');
  }
 }
}
