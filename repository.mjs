import {demoState,validatePair,validateGroup,text} from './domain.mjs?v=photo-31';
const cfg=window.EVENING_CONFIG||{};
export const live=cfg.mode==='live'&&!new URLSearchParams(location.search).has('demo');
let token=null,db=null,remember=false;
function saveToken(){sessionStorage.setItem("evening-auth",JSON.stringify(token));if(remember)localStorage.setItem("evening-auth",JSON.stringify(token))}
export function remembered(){return remember}
export function rememberSession(value){if(!live||identity.role!=="guest")throw Error("Доступно гостю после входа");remember=!!value;if(remember)saveToken();else localStorage.removeItem("evening-auth")}
export let identity={role:'guest',guestId:'anna'};
let state;
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('evening-complete-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function transaction(method,value){return new Promise((resolve,reject)=>{const tx=db.transaction('state',method==='get'?'readonly':'readwrite');const store=tx.objectStore('state');const req=method==='get'?store.get('main'):store.put(value,'main');tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
async function fetchTimeout(url,init){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{return await fetch(url,{...init,signal:controller.signal})}finally{clearTimeout(timer)}}
async function request(path,options={}){if(!cfg.supabaseUrl||!cfg.publishableKey)throw Error('Не настроено подключение к Supabase');const url=cfg.supabaseUrl+path,init={...options,headers:{apikey:cfg.publishableKey,...(token?.access_token?{Authorization:'Bearer '+token.access_token}:{}),'Content-Type':'application/json',...options.headers}};let response;try{response=await fetchTimeout(url,init)}catch(err){if(!/\/(public_program|bootstrap|join_event)$/.test(path))throw Error('Не удалось соединиться. Проверьте интернет и повторите.');await new Promise(resolve=>setTimeout(resolve,450));try{response=await fetchTimeout(url,init)}catch{throw Error('Не удалось соединиться. Проверьте интернет и повторите.')}};if(!response.ok){let err;try{err=await response.json()}catch{}throw Error(err?.message||err?.msg||err?.error_description||'Ошибка сервера: '+response.status)}return response.status===204?null:response.json()}
async function rpc(name,args={}){return request('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)})}
async function refreshToken(){if(!token)return;if(token.expires_at>Date.now()/1000+90)return;try{token=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:token.refresh_token})});saveToken()}catch{token=null;remember=false;localStorage.removeItem('evening-auth');sessionStorage.removeItem('evening-auth');throw Error('Сессия завершилась. Войдите снова.')}}
export async function init(inviteEntry=false){if(live){try{remember=!!localStorage.getItem('evening-auth');token=JSON.parse(sessionStorage.getItem('evening-auth')||localStorage.getItem('evening-auth'))}catch{}if(token&&!inviteEntry){await refreshToken();return reload()}state={settings:{},guests:[],teams:[],reviews:[],media:[],requests:[],program:[],questions:[],answers:[],votes:[]};identity={role:'anonymous',guestId:null};if(!inviteEntry)state.program=await rpc('public_program');return state}db=await openDB();state=await transaction('get')||demoState();try{identity=JSON.parse(sessionStorage.getItem('evening-demo-identity'))||identity}catch{}await persist();return state}
export async function reload(){if(!live)return state;await refreshToken();const result=await rpc('bootstrap');state=result.state;identity=result.identity;return state}
async function persist(){if(live)return;await transaction('put',state)}
export function getState(){return state}
export async function login(email,password){if(!live)throw Error('В демо используйте переключение ролей');token=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});remember=false;localStorage.removeItem('evening-auth');saveToken();return reload()}
export async function claimInvite(invite){if(!live)throw Error('Приглашения доступны после подключения Supabase');if(!token){token=await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({})});if(!token.access_token)throw Error('В Supabase нужно включить анонимный вход');saveToken()}await refreshToken();await rpc('claim_invite',{invite_token:invite});return reload()}
export async function logout(){if(live&&token){try{await request('/auth/v1/logout',{method:'POST'})}catch{}}token=null;remember=false;localStorage.removeItem('evening-auth');sessionStorage.removeItem('evening-auth');identity={role:'anonymous',guestId:null};return init()}
export function demoIdentity(role,guestId){if(live)throw Error('Недоступно');identity={role,guestId};sessionStorage.setItem('evening-demo-identity',JSON.stringify(identity))}
function admin(){if(identity.role!=='admin')throw Error('Нужны права организатора')}
function me(){const g=state.guests.find(g=>g.id===identity.guestId);if(!g)throw Error('Сначала войдите по приглашению');return g}
export async function mutate(action,p={}){
 if(live){await refreshToken();const result=await rpc('app_action',{action_name:action,payload:p});await reload();return result}
 const snapshot=structuredClone(state);let result;
 try{
 if(action==='photo_preference')me().photo_opt_out=!!p.value;
 else if(action==='review'){const g=me(),body=text(p.body);if(!body)throw Error('Напишите несколько слов');state.reviews=state.reviews.filter(r=>r.guest_id!==g.id);state.reviews.push({guest_id:g.id,body,rating:Math.min(5,Math.max(1,Number(p.rating)||5))})}
 else if(action==='request'){const g=me();if(!state.requests.some(r=>r.guest_id===g.id&&!r.done&&r.kind===p.kind))state.requests.push({id:crypto.randomUUID(),guest_id:g.id,kind:text(p.kind,80),done:false})}
 else if(action==='vote'){const g=me();state.votes=state.votes.filter(v=>v.guest_id!==g.id);state.votes.push({guest_id:g.id,choice:text(p.choice,80)})}
 else if(action==='answer'){const g=me(),q=state.questions.find(q=>q.id===p.question_id&&q.active);if(!q)throw Error('Вопрос закрыт');if(state.answers.some(a=>a.guest_id===g.id&&a.question_id===q.id))throw Error('Ответ уже принят');const correct=Number(p.choice)===q.correct_index;state.answers.push({guest_id:g.id,question_id:q.id,choice:p.choice,correct});if(correct){const team=state.teams.find(t=>t.id===g.team_id);if(team)team.score+=q.points}result={correct}}
 else{admin();switch(action){
 case 'settings':state.settings={...state.settings,...p};break;
 case 'guest_create':{const g={id:crypto.randomUUID(),name:text(p.name,80),team_id:p.team_id||state.teams[0]?.id,pair_id:null,photo_opt_out:false};if(!g.name)throw Error('Введите имя');state.guests.push(g);result={id:g.id};break}
 case 'guest_update':{const g=state.guests.find(g=>g.id===p.id);if(!g)throw Error('Гость не найден');g.name=text(p.name,80)||g.name;g.team_id=p.team_id||null;break}
 case 'group_create':{const members=validateGroup(state.guests,p.members),id=crypto.randomUUID();members.forEach(g=>g.pair_id=id);break}
 case 'pair':{const [a,b]=validatePair(state.guests,p.first,p.second);a.pair_id=b.pair_id=crypto.randomUUID();break}
 case 'unpair':state.guests.filter(g=>g.pair_id===p.id).forEach(g=>g.pair_id=null);state.media=state.media.filter(m=>m.pair_id!==p.id);break;
 case 'score':{const t=state.teams.find(t=>t.id===p.id);if(!t)throw Error('Команда не найдена');t.score=Math.max(0,Math.min(99999,Math.round(Number(p.score)||0)));break}
 case 'program':state.program=p.items.map((x,i)=>({...x,time:text(x.time,30),title:text(x.title,100),description:text(x.description,400),position:i}));break;
 case 'question':{const q={id:p.id||crypto.randomUUID(),prompt:text(p.prompt,250),options:p.options.map(x=>text(x,100)),correct_index:Number(p.correct_index),points:Number(p.points)||10,active:!!p.active};if(!q.prompt||q.options.length<2||q.options.some(x=>!x)||q.correct_index<0||q.correct_index>=q.options.length)throw Error('Проверьте вопрос и варианты');state.questions=state.questions.filter(x=>x.id!==q.id);state.questions.push(q);break}
 case 'request_done':state.requests.find(r=>r.id===p.id).done=true;break;
 case 'media_caption':state.media.find(m=>m.id===p.id).caption=text(p.caption,120);break;
 case 'media_delete':state.media=state.media.filter(m=>m.id!==p.id);break;
 case 'media_order':{const a=state.media.find(m=>m.id===p.id),b=state.media.find(m=>m.id===p.other);if(!a||!b)throw Error('Фотография не найдена');[a.position,b.position]=[b.position,a.position];break}
 case 'invite_rotate':result={token:'demo-'+p.id};break;
 default:throw Error('Неизвестное действие');}state.audit.unshift({at:new Date().toISOString(),action});state.audit=state.audit.slice(0,100)}
 await persist();return result;
 }catch(err){state=snapshot;throw err}
}
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Не удалось обработать снимок')),type,quality))}
export async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type))throw Error('Поддерживаются JPG, PNG, WebP и фото iPhone');
 if(file.size>50*1024*1024)throw Error('Исходное фото больше 50 МБ');
 let img;try{img=await createImageBitmap(file)}catch{throw Error('Не удалось открыть фото. На iPhone попробуйте отправить его как JPEG')}
 if(img.width*img.height>60000000){img.close();throw Error('Слишком большое разрешение снимка')}
 const c=document.createElement('canvas'),ctx=c.getContext('2d');if(!ctx){img.close();throw Error('Не удалось обработать снимок')}
 const scale=Math.min(1,3200/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));ctx.drawImage(img,0,0,c.width,c.height);img.close();
 // Safari can silently return PNG when WebP encoding is requested. JPEG is its reliable fallback.
 const target=4*1024*1024;let type='image/webp',blob;
 for(const quality of [.86,.76,.64,.5]){blob=await canvasBlob(c,type,quality);if(blob.type!==type){type='image/jpeg';blob=await canvasBlob(c,type,quality)}if(blob.size<=target)return blob}
 for(let i=0;i<3;i++){const reduced=document.createElement('canvas');reduced.width=Math.max(1,Math.round(c.width*.8));reduced.height=Math.max(1,Math.round(c.height*.8));reduced.getContext('2d').drawImage(c,0,0,reduced.width,reduced.height);c.width=reduced.width;c.height=reduced.height;ctx.drawImage(reduced,0,0);blob=await canvasBlob(c,type,.65);if(blob.size<=target)return blob}
 throw Error('Фото слишком большое после обработки. Попробуйте уменьшить его размер')
}
export async function upload(file,meta){admin();if(meta.kind==='cutout')throw Error('Декоративные портреты добавляются через разработчика');const blob=await preparePhoto(file),id=crypto.randomUUID(),path=id+({ 'image/webp':'.webp','image/jpeg':'.jpg','image/png':'.png'}[blob.type]||'.jpg'),position=Date.now();if(live){await refreshToken();await request('/storage/v1/object/event-photos/'+path,{method:'POST',headers:{'Content-Type':blob.type},body:blob});try{await rpc('app_action',{action_name:'media_add',payload:{id,path,bytes:blob.size,position,...meta}})}catch(err){try{await request('/storage/v1/object/event-photos',{method:'DELETE',body:JSON.stringify({prefixes:[path]})})}catch{}throw err}await reload()}else{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});if(meta.kind==='portrait'||meta.kind==='cover')state.media=state.media.filter(m=>!(m.kind===meta.kind&&m.guest_id===(meta.guest_id||null)&&m.pair_id===(meta.pair_id||null)));const item={id,position,bytes:blob.size,data,guest_id:null,pair_id:null,...meta};state.media.push(item);try{await persist()}catch(err){state.media=state.media.filter(m=>m.id!==id);throw err}}}
const urlCache=new Map();
export async function mediaURL(photo){if(!photo)return '';if(photo.data)return photo.data;const cached=urlCache.get(photo.path);if(cached&&cached.expires>Date.now())return cached.url;await refreshToken();const r=await request('/storage/v1/object/sign/event-photos/'+photo.path,{method:'POST',body:JSON.stringify({expiresIn:120})});const url=cfg.supabaseUrl+'/storage/v1'+r.signedURL;urlCache.set(photo.path,{url,expires:Date.now()+90000});return url}
export function clearMediaCache(){urlCache.clear()}
export async function driveStatus(){admin();if(!live)return {connected:false,exported:0,pending:state.media.filter(m=>m.kind==='event').length};await refreshToken();return rpc('drive_status')}
export async function removeMedia(photo){admin();if(live){await refreshToken();await request('/storage/v1/object/event-photos',{method:'DELETE',body:JSON.stringify({prefixes:[photo.path]})})}return mutate('media_delete',{id:photo.id})}

export async function privateRunbook(command,version,step){await refreshToken();return command?rpc("runbook_control",{command,expected_version:version,step_id:step??null}):rpc("runbook_read")}

export async function gameAction(command,p={}){if(live){await refreshToken();await rpc('game_action',{command,payload:p});return reload()}state.game||={title:'Музыкальная игра · демо',phase:'off',instructions:{teams:'Собираемся с командой.',guess:'Обсудите подсказку и отправьте ответ.',perform:'Подготовьте совместное выступление.',toasts:'Время поздравлений.',complete:'Спасибо за участие!'},tasks:[]};const game=state.game;
 if(command==='submit'){const g=me(),t=game.tasks.find(t=>t.team_id===g.team_id);if(game.phase!=='guess'||!t||t.status!=='assigned')throw Error('Ответы закрыты');t.submission=text(p.answer,300);if(!t.submission)throw Error('Введите ответ');t.status='answered'}else{admin();if(command==='phase'){if(p.phase==='guess'&&state.guests.some(g=>g.team_id&&!game.tasks.some(t=>t.team_id===g.team_id&&t.clue)))throw Error('Добавьте задания всем командам');game.phase=p.phase}else if(command==='shuffle'){if(Number(p.count)!==4)throw Error('На вечере 4 команды');if(!['off','teams'].includes(game.phase)||game.tasks.some(t=>t.status!=='assigned'))throw Error('Игра уже началась');while(state.teams.length<p.count)state.teams.push({id:crypto.randomUUID(),name:'Команда '+(state.teams.length+1),score:0,artifacts:0});const guests=[...state.guests];for(let i=guests.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[guests[i],guests[j]]=[guests[j],guests[i]]}guests.forEach((g,i)=>g.team_id=state.teams[i%p.count].id)}else{let t=game.tasks.find(t=>t.team_id===p.team_id);if(command==='task'){if(t&&t.status!=='assigned')throw Error('Ответ уже получен');if(!t){t={team_id:p.team_id,status:'assigned',awarded:false,submission:''};game.tasks.push(t)}t.clue=text(p.clue,1500);t.solution=text(p.solution,300)}else if(!t)throw Error('Задание не найдено');else if(command==='approve'&&t.status==='answered')t.status='approved';else if(command==='retry'&&!t.awarded){t.status='assigned';t.submission=''}else if(command==='award'){if(t.awarded||t.status!=='approved')throw Error('Нельзя выдать повторно');t.awarded=true;t.status='performed';const team=state.teams.find(x=>x.id===p.team_id);team.artifacts=(team.artifacts||0)+1}}}await persist();return state}

export async function eventPass(){admin();if(!live)return {key:'demo',enabled:true};await refreshToken();return rpc('event_pass')}
export async function enterEvent(key,name=null){if(!live){if(!name)return {needs_name:true};const g={id:crypto.randomUUID(),name:text(name,80),team_id:state.teams[0]?.id||null,pair_id:null,photo_opt_out:false};state.guests.push(g);demoIdentity('guest',g.id);await persist();return {ready:true}}if(!token){token=await request('/auth/v1/signup',{method:'POST',body:'{}'});if(!token.access_token)throw Error('Не удалось открыть вход. Обратитесь к организатору.');saveToken()}await refreshToken();const result=await rpc('join_event',{event_key:key,display_name:name});if(result.ready){await reload();if(identity.role==='guest')rememberSession(true)}return result}

export async function eveningAdmin(command,guestKey=null){admin();if(!live){if(command==='intro')state.settings.intro_epoch=Date.now();if(command==='publish_all')state.settings.album_published=true;if(command==='publish_one')state.guests.find(g=>g.id===guestKey).album_published=true;if(command==='guest_delete')state.guests=state.guests.filter(g=>g.id!==guestKey);await persist();return state}await refreshToken();await rpc('evening_admin',{command,guest_key:guestKey});return reload()}

