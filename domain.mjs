import {collagePages} from './collage.mjs';
export const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function text(v,max=600){return String(v??'').trim().slice(0,max)}
export function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'&&['drive.google.com','disk.yandex.ru','disk.yandex.com','yadi.sk'].includes(u.hostname)?u.href:''}catch{return ''}}
export function albumFor(state,guestId){
 const guest=state.guests.find(g=>g.id===guestId);if(!guest)return [];
 const common=state.media.filter(m=>m.kind==='event').sort((a,b)=>a.position-b.position);
 // Opt-out guests deliberately receive only common pages, without a personal cover.
 if(guest.photo_opt_out)return collagePages(common);
 const partner=guest.pair_id?state.guests.find(g=>g.pair_id===guest.pair_id&&g.id!==guest.id):null;
 const pairAllowed=partner&&!partner.photo_opt_out;
 const members=pairAllowed?[guest,partner].sort((a,b)=>a.id.localeCompare(b.id)):[guest];
 const pairPortrait=pairAllowed?state.media.find(m=>m.kind==='portrait'&&m.pair_id===guest.pair_id):null;
 const portrait=pairPortrait||state.media.find(m=>m.kind==='portrait'&&m.guest_id===guest.id);
 const shared=!!pairPortrait,owners=shared?members:[guest];
 const quotes=owners.map(g=>({name:g.name,text:state.reviews.find(r=>r.guest_id===g.id)?.body||''})).filter(q=>q.text.trim());
 const cover=state.media.find(m=>m.kind==='cover')||state.media.find(m=>m.kind==='eugene');
 const pages=[{type:'cover',title:'50 поводов сказать спасибо',photo:cover}];
 // Never substitute somebody else's portrait. Missing portrait gets an honest typographic page.
 pages.push({type:'personal',title:owners.map(g=>g.name).join(' и '),photo:portrait,quotes,shared});
 return pages.concat(collagePages(common));
}
export function validatePair(guests,a,b){if(a===b)throw Error('Нельзя объединить гостя с самим собой');const x=guests.find(g=>g.id===a),y=guests.find(g=>g.id===b);if(!x||!y)throw Error('Гость не найден');if(x.pair_id||y.pair_id)throw Error('Сначала разъедините существующую пару');return [x,y]}
export function demoState(){return {settings:{activity:'Викторина',announcement:'Собирайтесь с командой. Этот вечер создаём мы.',album_published:true,originals_url:''},guests:[{id:'anna',name:'Анна',team_id:'spark',pair_id:'pair-1',photo_opt_out:false},{id:'mikhail',name:'Михаил',team_id:'spark',pair_id:'pair-1',photo_opt_out:false},{id:'elena',name:'Елена',team_id:'orbit',pair_id:null,photo_opt_out:false},{id:'sergey',name:'Сергей',team_id:'rhythm',pair_id:null,photo_opt_out:true}],teams:[{id:'spark',name:'Искра',score:120},{id:'orbit',name:'Орбита',score:95},{id:'rhythm',name:'Ритм',score:80}],reviews:[{guest_id:'anna',body:'За людей, рядом с которыми можно быть собой.',rating:5},{guest_id:'mikhail',body:'Спасибо за истории, которые хочется рассказывать снова.',rating:5}],media:[],requests:[],votes:[],answers:[],program:[{id:'1',time:'Начало',title:'Собираемся вместе',description:'Объятия, знакомые лица и первые истории.',position:0},{id:'2',time:'За столом',title:'За тех, кто рядом',description:'Тёплые слова и поводы сказать спасибо.',position:1},{id:'3',time:'Играем',title:'А вы знали Женю таким?',description:'Командная викторина о юбиляре.',position:2},{id:'4',time:'Финал',title:'Ваш выход',description:'Музыка, танцы и Женя у микрофона.',position:3}],questions:[{id:'q1',prompt:'Когда мы собираемся праздновать?',options:['27 ноября','28 ноября','Весь ноябрь'],correct_index:1,points:10,active:true}],audit:[]}}
