import { surfaces, loadApprovedTexture } from './textures.mjs?art=final-comparison-3';
export async function applyGrandMaterials(materials,T,renderer){
 const hardware=renderer.capabilities.maxTextureSize;
 const limit=Math.min(hardware,2048);
 const staged=await Promise.all(Object.entries(surfaces).map(async ([name,source])=>{
  const mat=materials.find(m=>m.name===name),orig=mat?.map;
  if(!orig?.image||limit<780)throw new Error('Missing native folio material: '+name);
  const art=await loadApprovedTexture(source,url=>new Promise((ok,fail)=>{const im=new Image();im.decoding='async';im.onload=()=>ok(im);im.onerror=fail;im.src=url;}));
  if(art.naturalWidth!==source.width||art.naturalHeight!==source.height)throw new Error('Unexpected '+source.id+' size');
  const scale=Math.min(source.width/389,source.height/585,limit/780);
  const atlas=document.createElement('canvas'); atlas.width=Math.round(499*scale);atlas.height=Math.round(780*scale);
  const ctx=atlas.getContext('2d',{alpha:false});if(!ctx)throw new Error('No folio atlas');
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  // The old print also has antialiased ink just outside its nominal cutout. Build
  // the page from clean paper, then restore its original unprinted margins.
  for(let y=0;y<780;y+=64){
   const height=Math.min(64,780-y);
   ctx.drawImage(orig.image,0,16,499,height,0,y*scale,atlas.width,height*scale+1);
  }
  for(const [x,y,w,h] of [[0,0,499,90],[0,690,499,90],[0,89,48,602],[452,89,47,602]]){
   ctx.drawImage(orig.image,x,y,w,h,x*scale,y*scale,w*scale,h*scale);
  }
  ctx.save();ctx.translate(55*scale,97*scale);
  if(name.startsWith('Printed verso')){ctx.translate(389*scale,0);ctx.scale(-1,1);}
  ctx.drawImage(art,0,0,389*scale,585*scale);ctx.restore();
  const tex=new T.CanvasTexture(atlas);tex.flipY=orig.flipY;tex.colorSpace=orig.colorSpace;
  tex.wrapS=orig.wrapS;tex.wrapT=orig.wrapT;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;
  return {mat,tex};
 }));
 for(const {mat,tex} of staged){
  // The GLB pairs the original print with an emissive copy. Replacing only
  // base color lets the previous character and lettering bleed through.
  mat.map=tex;
  mat.emissiveMap=tex;
  mat.needsUpdate=true;
 }
}
