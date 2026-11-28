import * as T from './vendor/three.module.js';

export function buildStudioSurroundings(scene){
 const root=new T.Group();scene.add(root);
 const bronze=new T.MeshStandardMaterial({color:0x81623f,metalness:.35,roughness:.55});
 const foliage=new T.MeshStandardMaterial({color:0x18362f,roughness:1,side:T.DoubleSide});
 const snow=new T.MeshStandardMaterial({color:0xeaf0f4,roughness:.9,flatShading:true});
 const bark=new T.MeshStandardMaterial({color:0x42392c,roughness:.95});
 const warm=new T.MeshBasicMaterial({color:0xffd49a});
 scene.fog=new T.FogExp2(0x9daec0,.009);
 const add=(geometry,material,x=0,y=0,z=0,parent=root)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m};
 // Fine stone grain and expansion joints keep the foreground from reading as a blank plane.
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle='#d7e2ea';ctx.fillRect(0,0,512,512);
 let seed=57;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<16000;i++){const v=220+Math.floor(rand()*34);ctx.fillStyle='rgba('+v+','+v+',255,.28)';ctx.fillRect(rand()*512,rand()*512,1+rand()*2,1);}
 const paving=new T.CanvasTexture(c);paving.wrapS=paving.wrapT=T.RepeatWrapping;paving.repeat.set(22,22);paving.colorSpace=T.SRGBColorSpace;
 const ground=add(new T.PlaneGeometry(180,180),new T.MeshStandardMaterial({map:paving,color:0xe9f2f8,roughness:.9}),0,-.13,0);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
 for(let i=0;i<58;i++){const a=i*2.4,r=10+rand()*32;const bank=add(new T.SphereGeometry(1,12,8),snow,Math.sin(a)*r,-.3,Math.cos(a)*r);bank.scale.set(1.7+rand()*3.1,.4+rand()*.9,1.5+rand()*2.8);}
 // Wide semicircular terrace steps join the central monument and projector towers.
 for(let i=0;i<3;i++){
  const step=add(new T.CylinderGeometry(11.7-i*.28,11.7-i*.28,.12,80,1,false,-Math.PI/2,Math.PI),snow,0,-.07+i*.065,-1.8);step.scale.z=.62;step.receiveShadow=true;
 }
 // Overlapping continuous ridgelines fade naturally into the sunset.
 for(let layer=0;layer<3;layer++){
  const points=[];for(let i=0;i<=140;i++){const x=-100+i*200/140;const y=1.5+layer*.55+Math.sin(x*.068+layer)*1.3+Math.sin(x*.17+layer*2)*.55+Math.sin(x*.31)*.2;points.push(new T.Vector2(x,y));}
  const shape=new T.Shape();shape.moveTo(-100,-4);for(const p of points)shape.lineTo(p.x,p.y);shape.lineTo(100,-4);shape.closePath();
  add(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:[0x514356,0x655064,0x805d71][layer],side:T.DoubleSide}),0,0,-40-layer*19);
 }
 // Layered miniature skyline: each tower has a front, sides, roof and warm windows.
 // A Russian winter forest replaces the skyline and palm trees.
 const pine=new T.MeshStandardMaterial({color:0x18352e,roughness:1,flatShading:true});
 const pineDark=new T.MeshStandardMaterial({color:0x102a26,roughness:1,flatShading:true});
 function spruce(x,z,height,wide=1){
  const tree=new T.Group();tree.position.set(x,0,z);root.add(tree);
  add(new T.CylinderGeometry(.08*wide,.16*wide,height*.6,7),bark,0,height*.3,0,tree);
  for(let tier=0;tier<6;tier++){
   const y=.5+tier*height*.11,r=(1.4-tier*.16)*wide;
   const cone=add(new T.ConeGeometry(r,height*.43,9),tier%2?pine:pineDark,0,y+height*.17,0,tree);cone.castShadow=true;
   const cap=add(new T.ConeGeometry(r*.72,height*.075,9),snow,0,y+height*.34,0,tree);cap.castShadow=true;
   for(let k=0;k<(wide>1?6:0);k++){const angle=k*Math.PI/3+tier*.2;const clump=add(new T.SphereGeometry(.16*wide,6,4),snow,Math.cos(angle)*r*.8,y+height*.13,Math.sin(angle)*r*.8,tree);clump.scale.set(1.2,.45,1.1);}
  }
  add(new T.ConeGeometry(.33*wide,height*.13,9),snow,0,height*.93,0,tree);
 }
 [[-11,-9,14,1.45],[11,-10,15,1.5],[-17,-17,16,1.5]].forEach(a=>spruce(...a));
 for(let i=0;i<62;i++){const x=-70+i*2.3+(rand()-.5)*1.4,z=-22-rand()*38;if(Math.abs(x)<10&&z>-30)continue;spruce(x,z,3.2+rand()*5.5,.65+rand()*.4);}
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
