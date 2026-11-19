/**
 * Qwen3 opera com duas saídas independentes: reasoning_content e content.
 * A interface só pode exibir a resposta final em content.
 */
export function extractAnswerText(payload){
 const choice=payload?.choices?.[0];
 const value=choice?.message?.content??choice?.text;
 const text=typeof value==='string'?value:
  Array.isArray(value)?value.filter(part=>part?.type==='text'&&typeof part.text==='string').map(part=>part.text).join(''):'';
 const visible=text.replace(new RegExp('<think>.*?</think>','gis'),'').trim();
 if(visible&&!visible.includes('<think>'))return visible;
 if(choice?.finish_reason==='length'||typeof choice?.message?.reasoning_content==='string')
  throw Error('O modelo atingiu o limite antes de produzir a resposta. A mensagem foi salva. Tente gerar novamente com uma pergunta mais curta.');
 throw Error('A IA local não retornou texto. A mensagem foi salva; nenhum envio foi repetido automaticamente.');
}

export function buildLocalCompletion(messages,{small=false}={}){
 const safeMessages=messages.map(message=>({...message}));
 const last=[...safeMessages].reverse().find(x=>x.role==='user');
 if(last&&typeof last.content==='string')
  last.content=last.content.trim()+'\n/no_think';
 return {
  model:'w1-qwen3-1.7b',
  messages:safeMessages,
  stream:false,
  max_tokens:small?256:384,
  chat_template_kwargs:{enable_thinking:false}
 };
}
