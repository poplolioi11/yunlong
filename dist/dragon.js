import {drawDragonHead} from './dragon-head.js?v=0.4.0';
// A new dragon rig and character renderer inspired by ascii-sharks' cell-grid approach.
// Geometry is attached to the moving leader-following spine supplied by FlightWorld.
const TAU = Math.PI * 2;
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const lerp = (a,b,t) => a+(b-a)*t;
const color = (rgb,k=1) => `rgb(${rgb.map(v=>Math.round(clamp(v*k,0,255))).join(',')})`;
export const PALETTES = {
  gold:{shadow:[67,45,22],base:[172,128,57],light:[236,194,111],rim:[255,232,181],mane:[197,141,62],eye:[255,252,219]},
  white:{shadow:[40,44,45],base:[132,143,141],light:[212,219,203],rim:[250,244,217],mane:[157,168,162],eye:[255,250,221]},
  black:{shadow:[29,37,43],base:[80,94,105],light:[145,165,176],rim:[218,229,230],mane:[113,135,148],eye:[233,248,247]},
  azure:{shadow:[16,43,43],base:[39,111,108],light:[111,177,159],rim:[205,230,198],mane:[67,137,122],eye:[235,249,213]},
  red:{shadow:[69,23,22],base:[173,54,38],light:[233,113,70],rim:[248,194,124],mane:[184,95,47],eye:[255,237,182]},
};
export class DragonRenderer {
 constructor(){
  this.mask=document.createElement('canvas');this.m=this.mask.getContext('2d',{willReadFrequently:true});
  this.ink=document.createElement('canvas');this.g=this.ink.getContext('2d');
  this.nodes=[];this.samples=0;this.ready=false;
 }
 setRig(rig,time){this.rig=rig;this.nodes=rig.nodes;this.time=time;this.scale=rig.radius/.022;this.frames=new Map();this.ready=true;}
 resize(w,h,dpr=1){
  this.width=w;this.height=h;this.dpr=dpr;this.whiskerChains=null;this.lastWhiskerTime=undefined;
  this.cw=w<700?3.3:4.6;this.ch=w<700?5.1:7.0;
  this.cols=Math.ceil(w/this.cw);this.rows=Math.ceil(h/this.ch);
  this.mask.width=this.cols;this.mask.height=this.rows;
  this.ink.width=Math.round(w*dpr);this.ink.height=Math.round(h*dpr);this.g.setTransform(dpr,0,0,dpr,0,0);
  this.ready=false;
 }
 draw(ctx,theme='gold',lightAt=null){
  if(!this.ready)return;
  const m=this.m,P=PALETTES[theme],nodes=this.nodes;
  m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,this.cols,this.rows);m.scale(1/this.cw,1/this.ch);
  this.pearlLight=null;
  const objects=[];
  for(let i=nodes.length-2;i>=0;i--)objects.push({z:(nodes[i].z+nodes[i+1].z)/2,type:'body',i});
  for(let i=7;i<194;i+=6)objects.push({z:nodes[i].z-.009,type:'spike',i});
  objects.push({z:nodes[209].z,type:'tail',i:209});
  for(const i of [28,124])for(const side of [-1,1])objects.push({z:nodes[i].z+(side>0?.17:-.035),type:'leg',i,side});
  objects.push({z:nodes[0].z+.04,type:'head',i:0});
  objects.sort((a,b)=>a.z-b.z);
  for(const o of objects){
   if(o.type==='body')this.body(m,o.i,P);
   else if(o.type==='spike')this.spike(m,o.i,P);
   else if(o.type==='head')this.head(m,P);
   else if(o.type==='leg')this.leg(m,o.i,o.side,P);
   else this.tail(m,P);
  }
  this.whiskers(m,P);
  m.setTransform(1,0,0,1,0,0);
  const pixels=m.getImageData(0,0,this.cols,this.rows).data,g=this.g;
  g.clearRect(0,0,this.width,this.height);
  g.textAlign='center';g.textBaseline='middle';g.font=`${this.ch*1.17}px "SFMono-Regular",Consolas,"Liberation Mono",monospace`;
  const glyphs=':;=+ox%#@',fine=".,':;";
  let count=0;
  for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){
   const j=(y*this.cols+x)*4,alpha=pixels[j+3]/255;if(alpha<.07)continue;
   let r=pixels[j],gr=pixels[j+1],b=pixels[j+2];
   if(lightAt){const cloud=lightAt((x+.5)*this.cw,(y+.5)*this.ch);if(cloud){const illumination=(1+cloud.light*.90)*(1-cloud.shade*.10),lift=Math.max(0,cloud.light)*26;r=clamp(r*illumination*cloud.tint[0]+lift,0,255);gr=clamp(gr*illumination*cloud.tint[1]+lift*.98,0,255);b=clamp(b*illumination*cloud.tint[2]+lift*.91,0,255);}}
   const brightness=(r*.27+gr*.60+b*.13)/255;
   const hash=((x*73856093)^(y*19349663))>>>0;
   let glyph=glyphs[(hash+Math.floor(brightness*5))%glyphs.length];
   if(alpha<.4)glyph=fine[hash%fine.length];
   else if(brightness>.86)glyph=hash%3===0?'*':'+';
   const band=(y+Math.floor(x*.4))%4===0?1.10:.94;
   if(alpha>.55){g.fillStyle=`rgba(${Math.round(r*.24)},${Math.round(gr*.24)},${Math.round(b*.24)},${alpha*.7})`;g.fillRect(x*this.cw+.3,y*this.ch+.3,this.cw-.6,this.ch-.6);}
   g.fillStyle=`rgba(${Math.min(255,Math.round(r*band))},${Math.min(255,Math.round(gr*band))},${Math.min(255,Math.round(b*band))},${Math.min(1,alpha*1.04)})`;
   g.fillText(glyph,(x+.5)*this.cw,(y+.5)*this.ch);count++;
  }
  // A restrained underglow keeps the thin glyph edges visible without neon bloom.
  const inheritedAlpha=ctx.globalAlpha;ctx.save();ctx.globalAlpha=inheritedAlpha*.14;ctx.filter='blur(3px)';ctx.drawImage(this.ink,0,0,this.width,this.height);ctx.filter='none';ctx.globalAlpha=inheritedAlpha;this.pearlAura(ctx);ctx.drawImage(this.ink,0,0,this.width,this.height);ctx.restore();this.samples=count;
 }
 body(m,i,P){
  const a=this.nodes[i],b=this.nodes[i+1],d=clamp(.71+a.z*.38,.64,1.08);
  const grad=m.createLinearGradient(a.x+a.nx*a.r,a.y+a.ny*a.r,a.x-a.nx*a.r,a.y-a.ny*a.r);
  grad.addColorStop(0,color(P.shadow,d));grad.addColorStop(.17,color(P.base,.7*d));grad.addColorStop(.48,color(P.light,.9*d));grad.addColorStop(.76,color(P.base,d));grad.addColorStop(.94,color(P.rim,.85*d));grad.addColorStop(1,color(P.shadow,d));
  m.fillStyle=grad;m.beginPath();
  m.moveTo(a.x+a.nx*a.r,a.y+a.ny*a.r);m.lineTo(b.x+b.nx*b.r,b.y+b.ny*b.r);m.lineTo(b.x-b.nx*b.r,b.y-b.ny*b.r);m.lineTo(a.x-a.nx*a.r,a.y-a.ny*a.r);m.closePath();m.fill();
  // Scale rows are body-anchored, staggered, and vary from dark bronze to rim light.
  if(i>5&&i<190&&i%4===0){
   const f=this.frame(i),r=f.r,offset=(i/4)%2?.18:-.18;
   for(const across of [-.57,-.08,.42]){
    const y=across+offset*.25,v=.70+.27*Math.sin(i*.73+across*4+this.rig.id);
    m.beginPath();m.moveTo(...f.at(.19,y-.19,-.24));m.quadraticCurveTo(...f.at(-.23,y-.20,-.40),...f.at(-.28,y+.03,-.34));m.quadraticCurveTo(...f.at(-.14,y+.22,-.27),...f.at(.15,y+.21,-.21));m.lineWidth=Math.max(1,r*.048);m.strokeStyle=color(P.rim,v*.65);m.stroke();
    m.beginPath();m.moveTo(...f.at(.14,y-.16,-.23));m.lineTo(...f.at(-.19,y+.02,-.35));m.lineWidth=Math.max(1,r*.046);m.strokeStyle=color(P.shadow,1.06);m.stroke();
   }
  }
  // Belly plates, attached to the spine rather than the screen grid.
  if(i%3===0 && i>9){m.strokeStyle=color(P.shadow,.95);m.lineWidth=this.scale*.0017;m.beginPath();m.moveTo(a.x+a.nx*a.r*.68,a.y+a.ny*a.r*.68);m.quadraticCurveTo(a.x+a.nx*a.r*.12,a.y+a.ny*a.r*.12,b.x-b.nx*b.r*.40,b.y-b.ny*b.r*.40);m.stroke();}
 }
 spike(m,i,P){
  const n=this.nodes[i],f=this.frame(i),reach=.69+.25*Math.sin(i*1.13-this.time*.58);
  m.fillStyle=color(P.mane,clamp(.8+n.z,.5,1));m.beginPath();m.moveTo(...f.at(.35,-.87,0));m.lineTo(...f.at(-.38,-1-reach,.04));m.lineTo(...f.at(-.40,-.84,0));m.closePath();m.fill();
 }
 frame(index){
  if(this.frames.has(index))return this.frames.get(index);
  const p=this.nodes[index],q=this.nodes[Math.min(209,index+2)],factor=index===0?1.22:1;
  let result;
  if(this.rig.worldFrame&&this.rig.project){
   const basis=this.rig.worldFrame(index),project=this.rig.project;
   const base=project(basis.origin),unit=p.r/Math.max(.05,base.scale)*factor;
   const projected=(x,y,z=0)=>{const O=basis.origin,F=basis.forward,D=basis.down,S=basis.side;return project({x:O.x+(F.x*x+D.x*y+S.x*z)*unit,y:O.y+(F.y*x+D.y*y+S.y*z)*unit,z:O.z+(F.z*x+D.z*y+S.z*z)*unit});};
   const at=(x,y,z=0)=>{const v=projected(x,y,z);return [v.x,v.y];},depthAt=(x,y,z=0)=>projected(x,y,z).depth;
   const center=at(0,0),forward=at(1,0),down=at(0,1),r=p.r*factor;
   result={p,at,depthAt,r,tx:(forward[0]-center[0])/r,ty:(forward[1]-center[1])/r,nx:(down[0]-center[0])/r,ny:(down[1]-center[1])/r};
  }else{
   const l=Math.hypot(p.x-q.x,p.y-q.y)||1,tx=(p.x-q.x)/l,ty=(p.y-q.y)/l;let nx=-ty,ny=tx;if(ny<0){nx=-nx;ny=-ny;}const r=p.r*factor;
   result={p,tx,ty,nx,ny,r,depthAt:()=>p.z,at:(x,y,z=0)=>[p.x+tx*x*r+nx*y*r,p.y+ty*x*r+ny*y*r]};
  }
  this.frames.set(index,result);return result;
 }
 head(m,P){drawDragonHead(m,this.frame(0),P,this.time);}
 whiskers(m,P){
  const {r,at}=this.frame(0),t=this.time;
  const gap=this.lastWhiskerTime===undefined?0:t-this.lastWhiskerTime;if(gap>.5)this.whiskerChains=null;const dt=gap>.5?0:clamp(gap,0,.06);this.lastWhiskerTime=t;
  const paths=[
   [[2.58,.06,-.70],[3.65,-.12,-1.32],[3.82,-1.28,-1.63],[3.05,-1.92,-1.33],[1.38,-2.55,-1.12],[-3.75,-2.30,-.94],[-6.60,-1.35,-.85]],
   [[2.58,.21,.70],[3.64,.72,1.22],[3.82,1.83,1.58],[2.86,2.23,1.35],[.12,3.24,1.00],[-3.74,3.71,.82],[-7.15,2.35,.69]],
  ];
  const cubic=(a,b,c,d,u)=>a.map((v,k)=>(1-u)**3*v+3*(1-u)**2*u*b[k]+3*(1-u)*u*u*c[k]+u**3*d[k]);
  if(!this.whiskerChains)this.whiskerChains=[[],[]];
  paths.forEach((path,j)=>{
   const chain=this.whiskerChains[j];
   for(let k=0;k<=38;k++){
    const u=k/38,p=u<.28?cubic(...path.slice(0,4),u/.28):cubic(...path.slice(3,7),(u-.28)/.72);
    const flutter=Math.sin(t*.81-u*8.6+j*1.7+this.rig.id)*(.025+.32*u*u),curl=Math.cos(t*.62-u*7.4+j)*.12*u*u;
    p[1]+=flutter;p[2]+=curl;const goal=at(...p),lag=1-Math.exp(-dt*(11-8.4*u));
    if(!chain[k]||dt===0)chain[k]={x:goal[0],y:goal[1]};else{chain[k].x=lerp(chain[k].x,goal[0],k===0?1:lag);chain[k].y=lerp(chain[k].y,goal[1],k===0?1:lag);}
   }
   for(let k=1;k<chain.length;k++){const u=k/(chain.length-1);m.beginPath();m.moveTo(chain[k-1].x,chain[k-1].y);m.lineTo(chain[k].x,chain[k].y);m.lineCap='round';m.lineWidth=Math.max(.65,r*(.093-.052*u));m.strokeStyle=color(P.rim,.98-.20*u);m.stroke();}
  });
 }
 pearlAura(ctx){
  if(!this.pearlLight)return;
  const {x,y,r}=this.pearlLight,baseAlpha=ctx.globalAlpha,t=this.time;
  if(x<-r*4||y<-r*4||x>this.width+r*4||y>this.height+r*4)return;
  ctx.save();
  const aura=ctx.createRadialGradient(x,y,r*.55,x,y,r*2.9);aura.addColorStop(0,'rgba(236,229,170,.12)');aura.addColorStop(.45,'rgba(178,204,153,.055)');aura.addColorStop(1,'rgba(112,151,128,0)');ctx.fillStyle=aura;ctx.fillRect(x-r*3,y-r*3,r*6,r*6);
  ctx.font=`${this.width<700?6:8}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
  for(let k=0;k<13;k++){const life=(t*.115+k*.173)%1,angle=k*2.399+.11*Math.sin(t*.3),distance=r*(1.02+life*2.2);ctx.globalAlpha=baseAlpha*Math.sin(life*Math.PI)*(1-life)*.37;ctx.fillStyle=k%3===0?'#e7d9a4':'#b6d1ae';ctx.fillText(k%4===0?'+':'.',x+Math.cos(angle)*distance,y+Math.sin(angle)*distance*.72-life*r*1.35);}
  ctx.restore();
 }
 leg(m,index,side,P){
  const f=this.frame(index),r=f.r,at=(x,y)=>f.at(x,y,side*.56),front=index<60,t=this.time;
  const reach=side>0?1:.87,sg=side,flap=Math.sin(t*.52+(front?0:2.3)+side*.55)*.22;
  const ex=front?.92:-.98,wx=front?.15:-1.81;
  const elbow=[ex,sg*(1.83+flap)*reach],wrist=[wx,sg*(2.88+flap)*reach];
  m.lineCap='round';m.lineJoin='round';
  const limb=()=>{m.beginPath();m.moveTo(...at(.04,sg*.53));m.quadraticCurveTo(...at(ex*.4,sg*1.48),...at(...elbow));m.lineTo(...at(...wrist));};
  limb();m.lineWidth=r*(side>0?.55:.42);m.strokeStyle=color(P.base,side>0?1.1:.86);m.stroke();
  limb();m.lineWidth=r*.16;m.strokeStyle=color(P.rim,side>0?.95:.77);m.stroke();
  const palm=[wx+.30,sg*(3.02+flap)*reach];
  m.beginPath();m.moveTo(...at(...wrist));m.lineTo(...at(...palm));m.lineWidth=r*.57;m.strokeStyle=color(P.light,side>0?1:.8);m.stroke();
  if(front&&side>0&&this.rig.hasPearl){
   const center=[wx+.95,palm[1]+.09],o=at(...center),pr=r*.77;
   const grad=m.createRadialGradient(o[0]-pr*.26,o[1]-pr*.30,pr*.05,o[0],o[1],pr);grad.addColorStop(0,'#fffbd8');grad.addColorStop(.35,'#dae4b8');grad.addColorStop(.72,'#9eae88');grad.addColorStop(1,'#566c64');
   m.beginPath();m.arc(o[0],o[1],pr,0,TAU);m.fillStyle=grad;m.fill();
   m.beginPath();m.arc(o[0]-pr*.10,o[1]-pr*.07,pr*.70,-2.2,.65);m.lineWidth=Math.max(1,r*.065);m.strokeStyle='#eff2c8';m.stroke();
   this.pearlLight={x:o[0],y:o[1],r:pr};
   m.save();m.beginPath();m.arc(o[0],o[1],pr*.94,0,TAU);m.clip();
   // Engraved cloud-scroll bands rotate slowly inside the pearl, before the fingers.
   for(let band=0;band<3;band++){
    const phase=t*.075+band*2.094;m.beginPath();
    for(let k=0;k<=28;k++){const v=-1.42+k/28*2.84,xx=o[0]+Math.sin(phase)*Math.cos(v)*pr*.84,yy=o[1]+Math.sin(v)*pr*.87;k?m.lineTo(xx,yy):m.moveTo(xx,yy);}
    m.lineWidth=Math.max(.8,r*.043);m.strokeStyle=band%2?'#6d8b72':'#8c9572';m.stroke();
   }
   for(let curl=0;curl<2;curl++){
    m.beginPath();for(let k=0;k<=30;k++){const u=k/30,angle=u*TAU*1.22+t*.08+curl*Math.PI,rr=pr*(.49-u*.36),xx=o[0]+Math.cos(angle)*rr,yy=o[1]+Math.sin(angle)*rr*.69+(curl-.5)*pr*.24;k?m.lineTo(xx,yy):m.moveTo(xx,yy);}m.lineWidth=Math.max(.8,r*.047);m.strokeStyle='#607c6a';m.stroke();
   }
   m.restore();
   // Four long digits and the opposed thumb visibly cup the same pearl.
   for(const angle of [-2.6,-1.63,-.62,.33,2.13]){
    const end=[center[0]+Math.cos(angle)*.60,center[1]+Math.sin(angle)*.60];
    const mid=[center[0]+Math.cos(angle)*.91,center[1]+Math.sin(angle)*.91];
    m.beginPath();m.moveTo(...at(...palm));m.quadraticCurveTo(...at(...mid),...at(...end));m.lineWidth=r*.12;m.strokeStyle=color(P.light,.96);m.stroke();
    m.beginPath();m.moveTo(...at(...end));m.lineTo(...at(end[0]-.15*Math.cos(angle),end[1]-.15*Math.sin(angle)));m.lineWidth=r*.085;m.strokeStyle=color(P.rim);m.stroke();
   }
   m.beginPath();m.arc(o[0]-pr*.25,o[1]-pr*.27,pr*.12,0,TAU);m.fillStyle='#fffadd';m.fill();
  }else{
   // Five-clawed dragon: four forward digits plus an opposed fifth thumb.
   for(let k=0;k<4;k++){
    const spread=(k-1.5)*.32,x=palm[0]+[.72,.99,.92,.69][k],y=palm[1]+sg*spread;
    m.beginPath();m.moveTo(...at(...palm));m.quadraticCurveTo(...at(palm[0]+.59,y),...at(x,y+sg*.15));m.lineWidth=r*.14;m.strokeStyle=color(P.light,side>0?1:.87);m.stroke();
    m.beginPath();m.moveTo(...at(x,y+sg*.15));m.quadraticCurveTo(...at(x+.32,y+sg*.31),...at(x+.16,y+sg*.52));m.lineWidth=r*.085;m.strokeStyle=color(P.rim,side>0?1:.9);m.stroke();
   }
   m.beginPath();m.moveTo(...at(...palm));m.quadraticCurveTo(...at(wx-.65,palm[1]+sg*.08),...at(wx-.32,palm[1]+sg*.65));m.lineWidth=r*.13;m.strokeStyle=color(P.rim,.93);m.stroke();
  }
 }
 tail(m,P){
  const f=this.frame(195),{at}=f,r=this.rig.radius*.40,t=this.time;
  for(let j=0;j<9;j++){
   const y=(j-4)*.49;m.beginPath();m.moveTo(...at(-.5,0));m.bezierCurveTo(...at(-2,y),...at(-4.8,y*1.4+Math.sin(t*.65-j)*.46),...at(-7.2+Math.abs(y)*.4,y*.9+Math.sin(t*.60-j*.5)*.60));m.lineWidth=r*(.30-Math.abs(j-4)*.036);m.strokeStyle=color(P.mane,.85+j*.018);m.lineCap='round';m.stroke();
  }
 }
}
