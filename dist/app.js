import {DragonRenderer} from './dragon.js?v=0.4.0';
import {CloudField} from './clouds.js?v=0.4.0';
import {FlightWorld} from './flight.js?v=0.4.0';
import {CloudMotifs} from './motifs.js?v=0.4.0';
const canvas=document.getElementById('sky'),ctx=canvas.getContext('2d');
const world=new FlightWorld(28),clouds=new CloudField(37),motifs=new CloudMotifs(41);
const renderers=new Map();
const pointer={x:0,y:0,active:false};
let width=0,height=0,dpr=1,time=0,last=0,raf=0,visible=!document.hidden,paused=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const wake=[];let wakeTick=0;let cloudState=null;
const lightAt=(x,y)=>clouds.sample?.(x,y);
function resize(){
 width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 world.resize(width,height);for(const rig of world.dragons){if(!renderers.has(rig.id))renderers.set(rig.id,new DragonRenderer());}for(const renderer of renderers.values())renderer.resize(width,height,dpr);render();
}
function drawWake(){
 ctx.save();ctx.font=`${width<700?7:9}px monospace`;ctx.textAlign='center';
 for(const p of wake){const age=time-p.born;if(age>5)continue;ctx.globalAlpha=(1-age/5)*.10*p.opacity;ctx.fillStyle=p.theme==='black'?'#8197a4':p.theme==='red'?'#a36b54':p.theme==='azure'?'#659e8d':p.theme==='white'?'#aeb9ae':'#c1a772';ctx.fillText(p.glyph,p.x+age*7,p.y+Math.sin(age+p.phase)*age*2);}
 ctx.restore();
}
function render(){
 ctx.fillStyle='#05080a';ctx.fillRect(0,0,width,height);
 motifs.draw(ctx,{width,height,time,cell:width<700?6:8});
 cloudState={width,height,time:time*.62,density:.68};clouds.prepare?.(cloudState);
 clouds.draw(ctx,{width,height,time:time*.62,density:.68,front:false,cell:width<700?6:8});
 drawWake();
 const dragons=[...world.dragons].sort((a,b)=>a.depth-b.depth);
 for(const rig of dragons){
  const opacity=rig.opacity??1;if(opacity<.004)continue;const renderer=renderers.get(rig.id);renderer.setRig(rig,time);ctx.save();ctx.globalAlpha=opacity*(rig.depth<.65?.78:rig.depth<.85?.90:1);renderer.draw(ctx,rig.theme,lightAt);ctx.restore();
 }
 clouds.draw(ctx,{width,height,time:time*.62,density:.68,front:true,cell:width<700?6:8});
 const edge=ctx.createRadialGradient(width*.5,height*.5,Math.min(width,height)*.2,width*.5,height*.5,Math.max(width,height)*.72);edge.addColorStop(0,'rgba(5,8,10,0)');edge.addColorStop(1,'rgba(5,8,10,.32)');ctx.fillStyle=edge;ctx.fillRect(0,0,width,height);
}
function frame(now){
 raf=0;const dt=last?Math.min((now-last)/1000,.045):1/60;last=now;
 if(visible&&!paused){time+=dt;world.step(dt,time,pointer);wakeTick+=dt;if(wakeTick>.10){wakeTick=0;for(const rig of world.dragons){if((rig.opacity??1)<.03)continue;const n=rig.nodes[72];wake.push({x:n.x+n.nx*n.r,y:n.y+n.ny*n.r,born:time,phase:rig.id,glyph:rig.id%2?'~':'.',theme:rig.theme,opacity:rig.opacity??1});}}while(wake.length&&time-wake[0].born>5)wake.shift();render();}
 if(visible&&!paused)raf=requestAnimationFrame(frame);
}
function start(){if(!raf&&visible&&!paused){last=0;raf=requestAnimationFrame(frame);}}
function motion(){paused=reduced.matches;if(paused&&raf){cancelAnimationFrame(raf);raf=0;}else start();}
canvas.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=true;});
canvas.addEventListener('pointerdown',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=true;});
canvas.addEventListener('pointerleave',()=>{pointer.active=false;});
canvas.addEventListener('pointerup',e=>{if(e.pointerType==='touch')pointer.active=false;});
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}if(visible)start();});
reduced.addEventListener('change',motion);addEventListener('resize',resize);resize();motion();
