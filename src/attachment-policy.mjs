import {extname,basename} from 'node:path';
const TYPES=Object.freeze({
 document:['.pdf','.doc','.docx','.txt','.md','.csv','.xls','.xlsx','.ppt','.pptx','.odt','.ods','.rtf','.json'],
 image:['.png','.jpg','.jpeg','.webp','.gif','.bmp','.svg'],
 video:['.mp4','.webm','.mov','.mkv','.avi'],
 archive:['.zip','.rar','.7z']
});
const MAX=Object.freeze({document:50*1024*1024,image:25*1024*1024,video:150*1024*1024,archive:100*1024*1024});
export const ATTACHMENT_FILTERS=Object.freeze([
 {name:'Documentos',extensions:TYPES.document.map(x=>x.slice(1))},
 {name:'Imagens',extensions:TYPES.image.map(x=>x.slice(1))},
 {name:'Vídeos',extensions:TYPES.video.map(x=>x.slice(1))},
 {name:'Arquivos compactados',extensions:TYPES.archive.map(x=>x.slice(1))}
]);
export function classifyAttachment(name,size){
 if(typeof name!=='string'||!name.trim()||/[\x00-\x1f]/.test(name))throw Error('Nome de arquivo inválido.');
 if(!Number.isSafeInteger(size)||size<0)throw Error('Tamanho de arquivo inválido.');
 const ext=extname(name).toLowerCase();
 const kind=Object.keys(TYPES).find(key=>TYPES[key].includes(ext));
 if(!kind)throw Error('Tipo de arquivo não permitido nesta seleção.');
 if(size>MAX[kind])throw Error('Arquivo acima do tamanho permitido para este tipo.');
 return Object.freeze({name:basename(name),kind,size,extension:ext});
}
