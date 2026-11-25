// Project a tabletop relief from world coordinates. Its three lights are also hit targets.
type Point = [number, number, number];
type ScreenPoint = [number, number];
export const chartBearings = [[-.98, .1], [0, -.38], [.94, .17]] as const;

function height(x:number, z:number) {
  const ridge = (a:number,b:number,sx:number,sz:number,angle:number,gain:number) => {
    const dx=x-a, dz=z-b, c=Math.cos(angle),s=Math.sin(angle);
    return gain*Math.exp(-(((dx*c+dz*s)/sx)**2+((dz*c-dx*s)/sz)**2));
  };
  const coast = ridge(-.91,-.11,.88,.27,-.63,1) + ridge(-1.2,.28,.33,.32,.17,.7)
    + ridge(.13,-.41,.67,.24,.37,.98) + ridge(.7,-.22,.40,.17,-.5,.59)
    + ridge(.95,.2,.56,.35,-.5,1.1) + ridge(1.36,.34,.3,.13,.4,.5);
  const shelf = Math.sin(14*x+3*z)*.11 + Math.sin(21*z-7*x)*.08 + Math.cos(14*x-18*z)*.06;
  return Math.max(0, coast*(1+shelf)*.22-.038);
}

// Hand-built maquettes of the watergate, the tent market and the round treasury.
const masonry: {p:Point[]; fill:string}[]=[];
function block(x:number,z:number,w:number,d:number,y:number,h:number,light:string,side:string){
  const a:Point=[x,y,z], b:Point=[x+w,y,z], c:Point=[x+w,y,z+d], e:Point=[x,y,z+d];
  const top=(p:Point):Point=>[p[0],p[1]+h,p[2]];
  masonry.push({p:[a,b,top(b),top(a)],fill:side},{p:[b,c,top(c),top(b)],fill:side},{p:[c,e,top(e),top(c)],fill:side},{p:[e,a,top(a),top(e)],fill:side},{p:[top(a),top(b),top(c),top(e)],fill:light});
}
function buildPortModels(){
  const y=height(-.98,.1);
  for(const x of [-1.20,-.91]) {
    block(x,.01,.1,.16,y,.19,'#af8161','#644637');
    block(x-.016,-.005,.132,.19,y+.18,.028,'#d7ac82','#76503b');
  }
  for(let i=0;i<9;i++){
    const a=Math.PI*(i+.5)/9;
    block(-1.005+.142*Math.cos(a)-.027,.017,.055,.145,y+.18+Math.sin(a)*.11,.032,'#ebc599','#966d51');
  }
  for(let i=0;i<7;i++){
    const x=-.29+i%4*.125, z=-.53+Math.floor(i/4)*.19, floor=height(x,z)+.013;
    block(x-.044,z-.045,.088,.09,floor,.052,'#ae866f','#624b43');
    const roof:Point=[x,floor+.127,z];
    const e:Point[]=[[x-.066,floor+.054,z-.067],[x+.066,floor+.054,z-.067],[x+.066,floor+.054,z+.067],[x-.066,floor+.054,z+.067]];
    e.forEach((v,j)=>masonry.push({p:[v,e[(j+1)%4],roof],fill:['#a16f63','#d2a282','#805557','#bc8671'][j]}));
  }
  const cx=.92,cz=.16,base=height(cx,cz),ring:Point[]=[],upper:Point[]=[];
  for(let i=0;i<14;i++){const a=i*Math.PI/7;ring.push([cx+Math.cos(a)*.165,base+.025,cz+Math.sin(a)*.142]);upper.push([ring[i][0],base+.19,ring[i][2]]);}
  ring.forEach((v,i)=>{const j=(i+1)%14;masonry.push({p:[v,ring[j],upper[j],upper[i]],fill:i<7?'#73534c':'#a98470'},{p:[upper[i],upper[j],[cx,base+.26,cz]],fill:i<7?'#bc9b80':'#d7b998'});});
  for(let i=0;i<3;i++)block(.75,.32+i*.044,.29,.045,base+.04-i*.018,.018,'#c6ab8c','#796454');
}
buildPortModels();

const facets: { p:Point[]; tone:number; depth:number }[] = [];
const isolines: Point[][] = [];
for (let zi=0;zi<23;zi++) for(let xi=0;xi<53;xi++) {
  const x=-1.61+xi*.061, z=-.82+zi*.072;
  const corner=(dx:number,dz:number):Point=>[x+dx,height(x+dx,z+dz),z+dz];
  const a=corner(0,0), b=corner(.061,0), c=corner(.061,.072), d=corner(0,.072);
  for (const tri of [[a,b,c],[a,c,d]]) {
    if(tri.every(p=>p[1] <= .006)) continue;
    const value=tri.reduce((sum,p)=>sum+p[1],0)/3;
    facets.push({p:tri,tone:Math.max(0,Math.min(1,.18+value*1.65+(tri[0][1]-tri[1][1])*4)),depth:z});
    for(let level=.018;level<.4;level+=.031) {
      const hits:Point[]=[];
      for(let i=0;i<3;i++) {
        const u=tri[i],v=tri[(i+1)%3];
        if((u[1]<level)===(v[1]<level)) continue;
        const t=(level-u[1])/(v[1]-u[1]);
        hits.push([u[0]+(v[0]-u[0])*t,level+.001,u[2]+(v[2]-u[2])*t]);
      }
      if(hits.length===2) isolines.push(hits);
    }
  }
}
facets.sort((a,b)=>a.depth-b.depth);
const terrainCache = new WeakMap<CanvasRenderingContext2D,{image:HTMLCanvasElement;key:string;markers:ScreenPoint[]}>();

export function drawHarbourChart(ctx:CanvasRenderingContext2D, width:number, h:number, yaw:number, selected:number, time:number) {
  const scale=Math.min(width/3.8,h/1.12);
  const ct=Math.cos(yaw),st=Math.sin(yaw);
  const project=([x,y,z]:Point):ScreenPoint=>{
    const u=x*ct-z*st, v=x*st+z*ct;
    const lens=5/(5-v*.37);
    return [width*.5+u*scale*lens,h*.59+(v*.49-y*.95)*scale*lens];
  };
  const cacheKey=[ctx.canvas.width,ctx.canvas.height,yaw.toFixed(3),selected].join('/');
  const previous=terrainCache.get(ctx);
  function sailingLight(){
    const u=(time*.000021)%1;
    const [x,y]=project([-1.4+u*2.85,.012,.44+Math.sin(u*Math.PI*2+.3)*.10]);
    ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fillStyle='#ffe5b8';ctx.fill();
  }
  if(previous?.key===cacheKey){
    ctx.clearRect(0,0,width,h);ctx.drawImage(previous.image,0,0,width,h);sailingLight();return previous.markers;
  }
  function line(points:Point[],colour:string,stroke=1,closed=false) {
    ctx.beginPath();points.forEach((p,i)=>{const [x,y]=project(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
    if(closed)ctx.closePath();ctx.strokeStyle=colour;ctx.lineWidth=stroke;ctx.stroke();
  }
  ctx.clearRect(0,0,width,h);
  const ink=(v:number)=>'rgb('+Math.round(39+v*84)+','+Math.round(30+v*54)+','+Math.round(34+v*47)+')';
  for(let x=-1.65;x<1.7;x+=.16)line([[x,0,-.8],[x,0,.81]],'rgba(205,163,144,.11)',.65);
  for(let z=-.8;z<.83;z+=.16)line([[-1.64,0,z],[1.64,0,z]],'rgba(205,163,144,.13)',.65);
  for(const face of facets) {
    ctx.beginPath();
    face.p.forEach((p,i)=>{const [x,y]=project(p); if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
    ctx.closePath();ctx.fillStyle=ink(face.tone);ctx.fill();
  }
  ctx.beginPath();
  for(const edge of isolines) {const [x,y]=project(edge[0]),[u,v]=project(edge[1]);ctx.moveTo(x,y);ctx.lineTo(u,v);}
  ctx.strokeStyle='rgba(235,181,139,.65)';ctx.lineWidth=.77;ctx.stroke();
  const faces=masonry.map(face=>({face,depth:face.p.reduce((sum,p)=>sum+p[0]*st+p[2]*ct+p[1]*.28,0)/face.p.length})).sort((a,b)=>a.depth-b.depth);
  for(const {face} of faces){
    ctx.beginPath();face.p.forEach((p,i)=>{const [x,y]=project(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
    ctx.closePath();ctx.fillStyle=face.fill;ctx.fill();ctx.lineWidth=.46;ctx.strokeStyle='#d6aa7e';ctx.stroke();
  }
  // The shipping lane lies on the water, beneath each illuminated quay.
  const path:Point[]=[];
  for(let i=0;i<=70;i++){const t=i/70;path.push([-1.4+t*2.85,.012,.44+Math.sin(t*Math.PI*2+.3)*.10]);}
  ctx.setLineDash([2.3,5]);line(path,'rgba(240,193,147,.67)',1);ctx.setLineDash([]);
  const markers=chartBearings.map(([x,z],index)=>{
    const floor=height(x,z),top=floor+[.36,.22,.34][index];
    const [px,py]=project([x,top,z]); const isCurrent=index===selected;
    line([[x,floor,z],[x,top,z]],isCurrent?'#ffe0ad':'#d99f77',1.25);
    if(isCurrent) {
      const glow=ctx.createRadialGradient(px,py,1,px,py,15);glow.addColorStop(0,'rgba(255,211,151,.65)');glow.addColorStop(1,'rgba(255,179,113,0)');
      ctx.fillStyle=glow;ctx.fillRect(px-15,py-15,30,30);
    }
    ctx.beginPath();ctx.arc(px,py,isCurrent?4:3,0,Math.PI*2);ctx.fillStyle=isCurrent?'#fff2cc':'#d9a377';ctx.fill();
    return [px,py] as ScreenPoint;
  });
  const image=previous?.image??document.createElement('canvas');
  if(image.width!==ctx.canvas.width||image.height!==ctx.canvas.height){image.width=ctx.canvas.width;image.height=ctx.canvas.height;}
  const backing=image.getContext('2d');
  if(backing){backing.clearRect(0,0,image.width,image.height);backing.drawImage(ctx.canvas,0,0);terrainCache.set(ctx,{image,key:cacheKey,markers});}
  sailingLight();return markers;
}
