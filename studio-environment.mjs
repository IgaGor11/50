import * as T from './vendor/three.module.js';

export function buildStudioSurroundings(scene){
 const root=new T.Group();scene.add(root);
 const bronze=new T.MeshStandardMaterial({color:0x81623f,metalness:.35,roughness:.55});
 const foliage=new T.MeshStandardMaterial({color:0x172421,roughness:1,side:T.DoubleSide});
 const bark=new T.MeshStandardMaterial({color:0x42392c,roughness:.95});
 const warm=new T.MeshBasicMaterial({color:0xffd49a});
 scene.fog=new T.FogExp2(0x493d50,.008);
 const add=(geometry,material,x=0,y=0,z=0,parent=root)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m};
 // Fine stone grain and expansion joints keep the foreground from reading as a blank plane.
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle='#393735';ctx.fillRect(0,0,512,512);
 let seed=57;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<22000;i++){const v=40+Math.floor(rand()*40);ctx.fillStyle=`rgba(${v},${v-2},${v-5},.24)`;ctx.fillRect(rand()*512,rand()*512,1+rand()*2,1);}
 ctx.strokeStyle='#202326';ctx.lineWidth=2;for(let i=0;i<=512;i+=128){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}
 const paving=new T.CanvasTexture(c);paving.wrapS=paving.wrapT=T.RepeatWrapping;paving.repeat.set(22,22);paving.colorSpace=T.SRGBColorSpace;
 const ground=add(new T.PlaneGeometry(180,180),new T.MeshStandardMaterial({map:paving,color:0x8c8290,roughness:.76}),0,-.13,0);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
 // Wide semicircular terrace steps join the central monument and projector towers.
 for(let i=0;i<3;i++){
  const step=add(new T.CylinderGeometry(11.7-i*.28,11.7-i*.28,.12,80,1,false,-Math.PI/2,Math.PI),bronze,0,-.07+i*.065,-1.8);step.scale.z=.62;step.receiveShadow=true;
 }
 // Overlapping continuous ridgelines fade naturally into the sunset.
 for(let layer=0;layer<3;layer++){
  const points=[];for(let i=0;i<=140;i++){const x=-100+i*200/140;const y=1.5+layer*.55+Math.sin(x*.068+layer)*1.3+Math.sin(x*.17+layer*2)*.55+Math.sin(x*.31)*.2;points.push(new T.Vector2(x,y));}
  const shape=new T.Shape();shape.moveTo(-100,-4);for(const p of points)shape.lineTo(p.x,p.y);shape.lineTo(100,-4);shape.closePath();
  add(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:[0x514356,0x655064,0x805d71][layer],side:T.DoubleSide}),0,0,-40-layer*19);
 }
 // Layered miniature skyline: each tower has a front, sides, roof and warm windows.
 const cityNear=new T.MeshStandardMaterial({color:0x34313e,roughness:.92});
 const cityFar=new T.MeshStandardMaterial({color:0x4d4055,roughness:.95});
 const roofMat=new T.MeshStandardMaterial({color:0x675468,roughness:.85});
 const windowMat=new T.MeshBasicMaterial({color:0xe8a876,transparent:true,opacity:.72});
 for(let layer=0;layer<2;layer++){
  let cursor=-76;const z=layer?-53:-34;
  while(cursor<76){
   const w=.75+rand()*1.55,h=.8+rand()*(layer?2:3.6),depth=.6+rand()*1.25;
   const x=cursor+w/2;cursor+=w+.2+rand()*.65;
   if(Math.abs(x)<12&& !layer)continue;
   const building=add(new T.BoxGeometry(w,h,depth),layer?cityFar:cityNear,x,h/2,z);
   if(rand()>.55){const cap=add(new T.BoxGeometry(w*1.12,.1,depth*1.12),roofMat,x,h+.06,z);cap.castShadow=false;}
   if(rand()>.84){add(new T.CylinderGeometry(.02,.02,.5,4),roofMat,x,h+.3,z);}
   const front=z+depth/2+.008;
   for(let yy=.24;yy<h-.13;yy+=.27)for(let xx=-w/2+.16;xx<w/2-.09;xx+=.25){
    if(rand()<.56)continue;
    const pane=add(new T.PlaneGeometry(.065,.12),windowMat,x+xx,yy,front);pane.castShadow=false;
   }
  }
 }
 // Curving trunks and individual narrow pinnate fronds replace pointed cone foliage.
 function palm(x,z,height,lean,spread=1){
  const p=new T.Group();p.position.set(x,0,z);root.add(p);
  const path=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(lean*.12,height*.35,0),new T.Vector3(lean*.5,height*.72,.04),new T.Vector3(lean,height,0)]);
  add(new T.TubeGeometry(path,22,height*.017,9,false),bark,0,0,0,p);
  for(let j=0;j<14;j++){
   const a=j*Math.PI*2/14+.2,length=(2.2+rand()*1.25)*spread;const verts=[],indices=[];
   const point=(t,side=0)=>new T.Vector3(lean+Math.cos(a)*length*t+Math.sin(a)*side,height+1.1*spread*Math.sin(Math.PI*t)-.9*spread*t*t,Math.sin(a)*length*t-Math.cos(a)*side);
   const stem=[];for(let k=0;k<=12;k++)stem.push(point(k/12));
   add(new T.TubeGeometry(new T.CatmullRomCurve3(stem),12,.018,3,false),foliage,0,0,0,p);
   for(let k=1;k<13;k++)for(const sign of [-1,1]){const t=k/14,w=.5*spread*Math.sin(Math.PI*t);const start=point(t),tip=point(Math.min(1,t+.19),sign*w),end=point(t+.07);tip.y-=.13;
    const base=verts.length/3;for(const q of [start,tip,end])verts.push(q.x,q.y,q.z);indices.push(base,base+1,base+2);
   }
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();add(geo,foliage,0,0,0,p);
  }
 }
 // Three hero palms rise behind the plinth; crowns frame the title from both sides.
 [[-9.2,-9,14.5,.8,1.55],[9.4,-10,15,-.7,1.6],[-13,-18,17,2.8,1.65],
  [-21,-17,8,.5,.9],[23,-25,8,-.6,.9],[-29,-31,9,.8,1],[29,-36,9,-.7,1],
  [-37,-44,7,.5,.7],[36,-48,7,-.5,.7]].forEach(a=>palm(...a));
 // Low garden beds and restrained amber walkway lamps frame the foreground.
 for(const side of [-1,1]){
  for(let i=0;i<5;i++){
   const x=side*(13.2+i*.7),z=-5-i*2.2;
   const shrub=add(new T.SphereGeometry(.72,12,8),foliage,x,.28,z);shrub.scale.set(1,.55,.75);
  }
  for(let i=0;i<4;i++){
   const x=side*(11.5+i*.3),z=4-i*3;
   add(new T.CylinderGeometry(.07,.11,.9,10),bronze,x,.35,z);
   add(new T.CylinderGeometry(.17,.17,.12,16),warm,x,.85,z);
   add(new T.ConeGeometry(.23,.12,16),bronze,x,.97,z);
  }
 }
 return root;
}
