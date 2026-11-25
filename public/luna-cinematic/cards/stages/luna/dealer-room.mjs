/* Primary camera calibrated in meters from an independent close concept and the wide plate.
   A low-polygon PROJECTED SET (not a body model), with noncoplanar desk, room, foreground
   and mountain distances. Native WebGL orbits physical points; the print stays full-sized.
   No application/library WebGL dependency or speculative characters are necessary. */
export function createDealerRoom(holder, photo, data, repaint) {
 const el=holder.ownerDocument.createElement('canvas');
 let gl;
 try { gl=el.getContext('webgl2',{alpha:true,depth:true,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:false}); } catch {}
 if(!gl)return createCPURoom(holder,photo,data);
 try { return createGPURoom(holder,photo,data,el,gl,repaint); }
 catch {
  el.remove();
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return createCPURoom(holder,photo,data);
 }
}
function createGPURoom(holder,photo,data,el,gl,repaint) {
 const [N,M]=data.grid;
 el.dataset.dealerRoomCanvas='webgl';el.setAttribute('aria-hidden','true');
 const shader=(type,source)=>{let o=gl.createShader(type);gl.shaderSource(o,source);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
 const vert=shader(gl.VERTEX_SHADER,`#version 300 es
 in vec3 v;uniform vec4 area;uniform vec4 optics;uniform vec2 size;uniform vec2 orbit;out vec2 UV;
 void main(){UV=v.xy;float fx=optics.x,ar=optics.y,t=optics.z;vec3 x=vec3((v.x-.5)*v.z/fx,(.5-v.y)*v.z/fx/ar,-v.z+t);
 float c=cos(orbit.x),s=sin(orbit.x);x.xz=mat2(c,-s,s,c)*x.xz;float a=cos(orbit.y),b=sin(orbit.y);x.yz=mat2(a,-b,b,a)*x.yz;x.z-=t;float z=max(.1,-x.z);
 vec2 uv=vec2(.5+fx*x.x/z,.5-fx*ar*x.y/z),px=area.xy+uv*area.zw;vec2 ndc=px/size*2.-1.;gl_Position=vec4(ndc.x*z,-ndc.y*z,(z-.2)*.5,z);
 }`);
 const frag=shader(gl.FRAGMENT_SHADER,`#version 300 es
 precision mediump float;in vec2 UV;uniform sampler2D image;out vec4 color;
 void main(){color=texture(image,UV);}`);
 const pr=gl.createProgram();gl.attachShader(pr,vert);gl.attachShader(pr,frag);gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error('room pipeline');gl.useProgram(pr);
 const vs=[],ids=[];for(let y=0;y<=M;y++)for(let x=0;x<=N;x++){const i=y*(N+1)+x;vs.push(x/N,y/M,data.depthMetres[i]);if(x<N&&y<M)ids.push(i,i+N+1,i+1,i+1,i+N+1,i+N+2)}
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vs),gl.STATIC_DRAW);let attr=gl.getAttribLocation(pr,'v');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);const ix=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ix);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ids),gl.STATIC_DRAW);
 let tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,photo);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.disable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);
 const U={};for(const k of ['area','optics','size','orbit'])U[k]=gl.getUniformLocation(pr,k);gl.uniform4f(U.optics,data.focalWidth,data.aspect,data.orbitTarget,0);
 holder.insertBefore(el,holder.querySelector('[data-dealer-cards-canvas]'));
 let lost=false, fallback=null;
 const onLost=()=> {
  lost=true;
  el.hidden=true;
  try { fallback=createCPURoom(holder,photo,data); } catch {}
  holder.dataset.scenicRenderer=fallback?'perspective-set-software':'static-plate';
  holder.dataset.roomPaint='false';
  repaint?.();
 };
 el.addEventListener('webglcontextlost',onLost);
 holder.dataset.scenicRenderer='perspective-set-webgl2';
 return {draw(W,H,device,rect,yaw,pitch){if(lost||gl.isContextLost())return fallback?.draw(W,H,device,rect,yaw,pitch) ?? false;const w=Math.round(W*device),h=Math.round(H*device);if(el.width!==w||el.height!==h){el.width=w;el.height=h;gl.viewport(0,0,w,h)}gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform4f(U.area,rect.x,rect.y,rect.w,rect.h);gl.uniform2f(U.size,W,H);gl.uniform2f(U.orbit,yaw*Math.PI/180,pitch*Math.PI/180);gl.drawElements(gl.TRIANGLES,ids.length,gl.UNSIGNED_SHORT,0);return !gl.isContextLost()}, data, dispose(){
  el.removeEventListener('webglcontextlost',onLost);
  fallback?.dispose();
  if(!lost){gl.deleteTexture(tx);gl.deleteBuffer(b);gl.deleteBuffer(ix);gl.deleteProgram(pr);gl.deleteShader(vert);gl.deleteShader(frag);gl.getExtension('WEBGL_lose_context')?.loseContext();}
  el.remove();
 }};
}

// A full-viewport software camera for environments without WebGL. Uses the same measured
// shell points and focal length, not a fallback lens-shift or a pre-rendered pan.
function createCPURoom(holder,photo,data){
 const el=holder.ownerDocument.createElement('canvas');el.dataset.dealerRoomCanvas='software';el.setAttribute('aria-hidden','true');const c=el.getContext('2d');if(!c)return null;holder.insertBefore(el,holder.querySelector('[data-dealer-cards-canvas]'));holder.dataset.scenicRenderer='perspective-set-software';const [N,M]=data.grid,fx=data.focalWidth,ar=data.aspect,T=data.orbitTarget;
 const X=Array.from(new Set([...Array.from({length:11},(_,i)=>Math.round(N*i/10)),N])),Y=Array.from(new Set([...Array.from({length:8},(_,i)=>Math.round(M*i/7)),M]));let last='';
 function patch(S,D){
  const [s0,s1,s2]=S,[d0,d1,d2]=D;const a=s1[0]-s0[0],b=s1[1]-s0[1],c0=s2[0]-s0[0],d=s2[1]-s0[1],den=a*d-b*c0;if(Math.abs(den)<.00001)return;
  const e=d1[0]-d0[0],f=d1[1]-d0[1],g=d2[0]-d0[0],h=d2[1]-d0[1],aa=(e*d-g*b)/den,cc=(a*g-c0*e)/den,bb=(f*d-h*b)/den,dd=(a*h-c0*f)/den;
  const xx=(d0[0]+d1[0]+d2[0])/3,yy=(d0[1]+d1[1]+d2[1])/3;c.save();c.beginPath();D.forEach((q,i)=>{let dx=q[0]-xx,dy=q[1]-yy,l=Math.hypot(dx,dy)||1;const a=q[0]+dx/l*.65,b=q[1]+dy/l*.65;i?c.lineTo(a,b):c.moveTo(a,b)});c.closePath();c.clip();c.transform(aa,bb,cc,dd,d0[0]-aa*s0[0]-cc*s0[1],d0[1]-bb*s0[0]-dd*s0[1]);c.drawImage(photo,0,0);c.restore();
 }
 return {data,dispose:()=>el.remove(),draw(W,H,device,r,az,elv){
  const K=Math.min(1.25,device,1050/W),w=Math.round(W*K),h=Math.round(H*K);if(el.width!==w||el.height!==h){el.width=w;el.height=h;last=''}const key=[az.toFixed(2),elv.toFixed(2),r.w.toFixed(1),r.x.toFixed(1),r.y.toFixed(1)].join(',');if(key===last)return Math.abs(az)+Math.abs(elv)>=.12;last=key;c.setTransform(K,0,0,K,0,0);c.clearRect(0,0,W,H);if(Math.abs(az)+Math.abs(elv)<.12)return false;
  const a=az*Math.PI/180,b=elv*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
  const mesh=Y.map(v=>X.map(u=>{const U=u/N,V=v/M,z=data.depthMetres[v*(N+1)+u],xx=(U-.5)*z/fx,yy=(.5-V)*z/fx/ar,zz=T-z,x1=ca*xx+sa*zz,z1=-sa*xx+ca*zz,y2=cb*yy+sb*z1,z2=-sb*yy+cb*z1-T;return [[U*photo.naturalWidth,V*photo.naturalHeight],[r.x+r.w*(.5+fx*x1/-z2),r.y+r.h*(.5-fx*ar*y2/-z2)]]}));
  for(let v=0;v<Y.length-1;v++)for(let u=0;u<X.length-1;u++){const [p,q,s,t]=[mesh[v][u],mesh[v][u+1],mesh[v+1][u],mesh[v+1][u+1]];patch([p[0],s[0],q[0]],[p[1],s[1],q[1]]);patch([q[0],s[0],t[0]],[q[1],s[1],t[1]])}return true;
 }};
}
