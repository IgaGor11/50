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
 // A distant city silhouette with tiny lit windows, not foreground placeholder blocks.
 const city=new T.Shape();city.moveTo(-75,-1);let x=-75;const windows=[];
 while(x<75){const w=.65+rand()*1.1,h=.35+rand()*1.35;city.lineTo(x,0);city.lineTo(x,h);city.lineTo(x+w,h);city.lineTo(x+w,0);for(let y=.24;y<h-.08;y+=.24)for(let xx=x+.18;xx<x+w-.1;xx+=.24)if(rand()>.5)windows.push(xx,y,-34.9);x+=w+.15+rand()*.25;}
 city.lineTo(75,-1);city.closePath();add(new T.ShapeGeometry(city),new T.MeshBasicMaterial({color:0x2e2d3c,side:T.DoubleSide}),0,0,-35);
 const winGeo=new T.BufferGeometry();winGeo.setAttribute('position',new T.Float32BufferAttribute(windows,3));root.add(new T.Points(winGeo,new T.PointsMaterial({color:0xffc38c,size:.055,sizeAttenuation:true,transparent:true,opacity:.75})));
 // Curving trunks and individual narrow pinnate fronds replace pointed cone foliage.
 function palm(x,z,height,lean){
  const p=new T.Group();p.position.set(x,0,z);root.add(p);
  const path=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(lean*.12,height*.35,0),new T.Vector3(lean*.5,height*.72,.04),new T.Vector3(lean,height,0)]);
  add(new T.TubeGeometry(path,18,.105,7,false),bark,0,0,0,p);
  for(let j=0;j<10;j++){
   const a=j*Math.PI*2/10+.2,length=1.8+rand()*.8;const verts=[],indices=[];
   const point=(t,side=0)=>new T.Vector3(lean+Math.cos(a)*length*t+Math.sin(a)*side,height+.65*Math.sin(Math.PI*t)-.45*t*t,Math.sin(a)*length*t-Math.cos(a)*side);
   const stem=[];for(let k=0;k<=12;k++)stem.push(point(k/12));
   add(new T.TubeGeometry(new T.CatmullRomCurve3(stem),12,.018,3,false),foliage,0,0,0,p);
   for(let k=1;k<13;k++)for(const sign of [-1,1]){const t=k/14,w=.36*Math.sin(Math.PI*t);const start=point(t),tip=point(Math.min(1,t+.19),sign*w),end=point(t+.07);tip.y-=.13;
    const base=verts.length/3;for(const q of [start,tip,end])verts.push(q.x,q.y,q.z);indices.push(base,base+1,base+2);
   }
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();add(geo,foliage,0,0,0,p);
  }
 }
 [[-13,-8,5.6,.6],[-17,-13,6.4,-.5],[12,-9,5.2,-.4],[17,-15,6.7,.7],[-23,-20,5.8,.4],[23,-24,5.7,-.3]].forEach(a=>palm(...a));
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
