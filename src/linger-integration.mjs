// Linger is a separate app with its own runtime and license. The W1 store
// may offer its official download, but does not embed it or install it on
// low-resource computers. PolyStrata large-model mode requires a dedicated GPU.
export function evaluateLingerCompatibility({platform,arch,totalMemory}={}){
 if(platform!=='win32'||arch!=='x64'){
  return Object.freeze({
   mode:'unsupported',canAutoInstall:false,
   message:'O atalho do Linger na Central está disponível para Windows x64. Não instala nada neste dispositivo.'
  });
 }
 if(!Number.isFinite(totalMemory)||totalMemory<=0){
  return Object.freeze({
   mode:'unknown',canAutoInstall:false,
   message:'Memória indisponível para análise. Verifique os requisitos do Linger antes de instalar.'
  });
 }
 const gib=totalMemory/(1024**3);
 if(gib<12){
  return Object.freeze({
   mode:'lightweight',canAutoInstall:false,
   message:'Este PC tem aproximadamente '+Math.round(gib)+' GB de RAM. Para 8 GB, mantenha o Qwen3 local da W1. Linger e PolyStrata adicionam serviços e podem sobrecarregar o computador.'
  });
 }
 if(gib<32){
  return Object.freeze({
   mode:'optional',canAutoInstall:false,
   message:'O Linger pode ser avaliado como aplicativo separado. Os modelos grandes de PolyStrata exigem mais RAM e uma GPU dedicada; a instalação não será automática.'
  });
 }
 return Object.freeze({
  mode:'manual-gpu-review',canAutoInstall:false,
  message:'Memória disponível para avaliar o Linger. Confira a GPU dedicada, a VRAM, o disco e os requisitos do modelo antes de instalar: a Central não verifica sua GPU automaticamente.'
 });
}
