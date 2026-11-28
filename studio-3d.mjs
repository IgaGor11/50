import {buildStudioSurroundings} from './studio-environment.mjs?v=winter-boot-29';
import * as T from './vendor/three.module.js';
import {SVGLoader} from './vendor/SVGLoader.js';
import rows from './monument-text.mjs';

export function mountStudio(host,{still=null}={}){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,180);
 const gold=new T.MeshStandardMaterial({color:0xc69544,metalness:.6,roughness:.32});
 const edge=new T.MeshStandardMaterial({color:0x86602f,metalness:.45,roughness:.42});
 const trim=new T.MeshStandardMaterial({color:0xe7b75f,metalness:.65,roughness:.28});
 const stone=new T.MeshStandardMaterial({color:0x737b80,roughness:.7});
 const frost=new T.MeshStandardMaterial({color:0xe8f0f6,roughness:.9});
 const dark=new T.MeshStandardMaterial({color:0x251f22,roughness:.9});
 const group=new T.Group();scene.add(group);
 function box(w,h,d,x,y,z,mat=gold,parent=group){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 // A single architectural base, with adjoining stepped cornices and relief panels.
 box(12,2.6,6,0,1.3,-1.6);box(13,.28,6.8,0,2.7,-1.6,frost);
 box(11.1,.32,5.8,0,3,-1.4);box(10,.2,4.4,0,3.26,-.8,frost);
 for(let i=-5;i<=5;i++){box(.52,1.85,.14,i,1.45,1.47,i%2?edge:gold);box(.72,.16,.32,i,2.42,1.57,frost);}
 for(const sign of [-1,1]){
  box(1.25,2.1,1.5,sign*5.5,1.05,2.1,stone);
  for(let j=0;j<5;j++)box(1.65-j*.13,.22,1.8,sign*5.5,2.05+j*.18,2.1,j%2?gold:trim);
  box(2.1,4.7,3,sign*8,2.35,-1.6,stone);
  box(2.5,.25,3.4,sign*8,4.8,-1.6,frost);
  for(let k=0;k<3;k++)box(.22,2.7,.1,sign*8-.65+k*.65,2.6,-.05,dark);
 }
 // Deep solid glyphs rest directly on cornices, rather than on text cards.
 const loader=new SVGLoader();let bottom=3.38;
 for(let n=rows.length-1;n>=0;n--){const row=rows[n];
  const shapes=loader.parse(row.svg).paths.flatMap(p=>SVGLoader.createShapes(p));
  const geo=new T.ExtrudeGeometry(shapes,{depth:1.35,bevelEnabled:true,bevelThickness:.035,bevelSize:.025,bevelSegments:2,curveSegments:8,steps:1});
  const mesh=new T.Mesh(geo,[gold,edge]);mesh.position.set(0,bottom,-.95);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  bottom+=row.height;
  if(n>0){box(n===1?9.4:9.8,.13,2.25,0,bottom+.08,-.35,frost);box(n===1?9.2:9.5,.1,2.05,0,bottom+.18,-.35,gold);bottom+=.24;}
 }
 // Warm directional lighting, a cool sky fill, and broad illuminated gold faces.
 scene.add(new T.HemisphereLight(0xd8e7ff,0x6a7a8e,1.15));
 const key=new T.DirectionalLight(0xffd795,4.8);key.position.set(-9,13,16);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-16,right:16,top:18,bottom:-10,near:.5,far:60});key.shadow.bias=-.001;key.shadow.normalBias=.04;scene.add(key);
 const rim=new T.DirectionalLight(0xa9d3f4,2.8);rim.position.set(8,7,-8);scene.add(rim);
 const fill=new T.DirectionalLight(0xbedaff,1.1);fill.position.set(5,9,12);scene.add(fill);
 buildStudioSurroundings(scene);
 // Procedural sunset and drifting clouds surround the actual 3D camera.
 const sky=new T.Mesh(new T.SphereGeometry(130,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 v;uniform float time;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 void main(){vec3 n=normalize(v);float h=n.y;vec3 low=vec3(.58,.70,.79),mid=vec3(.20,.32,.48),top=vec3(.025,.055,.14);vec3 c=mix(low,mid,smoothstep(-.04,.25,h));c=mix(c,top,smoothstep(.2,.8,h));vec2 p=n.xz/(abs(h)+.3)*3.+vec2(time*.005,0);float cloud=noise(p*2.)*.55+noise(p*5.)*.28+noise(p*11.)*.17;float band=smoothstep(.48,.72,cloud)*(1.-smoothstep(.15,.65,h))*smoothstep(-.08,.08,h);c=mix(c,vec3(.64,.74,.86),band*.6);gl_FragColor=vec4(c,1.);}`}));scene.add(sky);
 const count=2400,snowPos=new Float32Array(count*3),fall=new Float32Array(count);let seed=23487;
 const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<count;i++){snowPos[i*3]=(rnd()-.5)*90;snowPos[i*3+1]=rnd()*40;snowPos[i*3+2]=(rnd()-.5)*70;fall[i]=.5+rnd();}
 const snowGeo=new T.BufferGeometry();snowGeo.setAttribute('position',new T.BufferAttribute(snowPos,3));
 scene.add(new T.Points(snowGeo,new T.PointsMaterial({color:0xf8fcff,size:.13,transparent:true,opacity:.96,depthWrite:false})));
 // Volumetric cones, actual spotlights, and articulated projector heads.
 const lights=[];
 const beamMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{strength:{value:.34}},vertexShader:'varying vec2 p;varying vec3 n;varying vec3 eye;void main(){p=uv;n=normalMatrix*normal;vec4 mv=modelViewMatrix*vec4(position,1.);eye=-mv.xyz;gl_Position=projectionMatrix*mv;}',fragmentShader:'varying vec2 p;varying vec3 n;varying vec3 eye;uniform float strength;void main(){float edge=pow(abs(dot(normalize(n),normalize(eye))),2.);float a=pow(1.-p.y,1.6)*strength*edge;gl_FragColor=vec4(.72,.83,1.,a);}'});
 [[-8,5,-1.6],[8,5,-1.6],[-10,.4,7],[10,.4,7],[-6,1,-8],[6,1,-8]].forEach((xyz,i)=>{
  const stand=new T.Mesh(new T.CylinderGeometry(.48,.62,.2,24),stone);stand.position.set(xyz[0],xyz[1]-.35,xyz[2]);scene.add(stand);
  const pivot=new T.Group();pivot.position.set(...xyz);scene.add(pivot);
  const ring=new T.Mesh(new T.TorusGeometry(.34,.045,8,32),trim);ring.rotation.x=Math.PI/2;ring.position.y=.28;pivot.add(ring);
  for(const side of [-1,1]){const arm=new T.Mesh(new T.BoxGeometry(.07,.5,.12),edge);arm.position.set(side*.4,-.08,0);pivot.add(arm);}
  const shaft=new T.Mesh(new T.CylinderGeometry(2.8,.07,38,24,1,true),beamMat);shaft.position.y=19;pivot.add(shaft);
  const lamp=new T.Mesh(new T.CylinderGeometry(.38,.3,.55,16),edge);pivot.add(lamp);
  const disk=new T.Mesh(new T.CircleGeometry(.29,24),new T.MeshBasicMaterial({color:0xfff4d2}));disk.rotation.x=-Math.PI/2;disk.position.y=.29;pivot.add(disk);
  const spot=new T.SpotLight(0xc9ddff,50,55,.13,.8,1);spot.position.copy(pivot.position);scene.add(spot,spot.target);lights.push({pivot,spot,i});
 });
 function resize(){const w=host.clientWidth||innerWidth,h=host.clientHeight||innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=camera.aspect<1?48:40;camera.updateProjectionMatrix();}
 resize();window.addEventListener('resize',resize);host.append(renderer.domElement);host.classList.add('has-webgl');
 renderer.domElement.setAttribute('aria-label','50 способов сказать спасибо — кинематографическая заставка');
 const start=performance.now();let frame=0,disposed=false;
 function render(now){if(disposed)return;const elapsed=still===null?(now-start)/1000:still;const t=Math.min(elapsed/10,1),ease=t*t*(3-2*t);
  const aspect=camera.aspect,portrait=aspect<1,dist=portrait?Math.max(26,19/aspect):25;
  const angle=T.MathUtils.lerp(-.95,-.25,ease),radius=T.MathUtils.lerp(dist*.64,dist,ease);
  camera.position.set(Math.sin(angle)*radius,T.MathUtils.lerp(13.3,4.8,ease),Math.cos(angle)*radius);
  camera.lookAt(0,T.MathUtils.lerp(6.1,5.25,ease),0);
  for(const {pivot,spot,i} of lights){const a=elapsed*.33+i*1.7;pivot.rotation.z=Math.sin(a)*.43;pivot.rotation.x=Math.cos(a*.73)*.32;const end=new T.Vector3(0,35,0).applyQuaternion(pivot.quaternion).add(pivot.position);spot.target.position.copy(end);}
  sky.material.uniforms.time.value=elapsed;
  if(still===null){for(let i=0;i<count;i++){snowPos[i*3+1]-=.04*fall[i];snowPos[i*3]+=.004*fall[i];if(snowPos[i*3+1]<0)snowPos[i*3+1]=39;}snowGeo.attributes.position.needsUpdate=true;}
  renderer.render(scene,camera);if(still===null)frame=requestAnimationFrame(render);
 }
 render(start);
 return ()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);window.removeEventListener('resize',resize);const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>{for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose()});renderer.dispose();renderer.domElement.remove();host.classList.remove('has-webgl');};
}
