let active=null;
export function closeAlbumScreen(){
 const session=active;if(!session)return;active=null;
 session.marker.replaceWith(session.root);session.dialog.close();session.dialog.remove();
 document.body.classList.remove('album-screen-open');
 try{screen.orientation?.unlock?.()}catch{}
 if(session.fullscreen&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 session.focus?.focus({preventScroll:true});
}
export async function openAlbumScreen(root){
 if(active||!root?.querySelector('#book'))return;
 const marker=document.createComment('album position'),dialog=document.createElement('dialog');
 dialog.className='album-screen';dialog.setAttribute('aria-label','Альбом на весь экран');
 dialog.innerHTML='<div class="album-screen-header"><span>Ваш альбом</span><button type="button" class="album-screen-close" aria-label="Закрыть альбом">×</button></div><p class="album-rotate-note">Поверните телефон горизонтально — так фотографии будут крупнее.</p><div class="album-screen-stage"></div>';
 const session={root,marker,dialog,focus:document.activeElement,fullscreen:false};active=session;
 root.before(marker);dialog.querySelector('.album-screen-stage').append(root);document.body.append(dialog);
 document.body.classList.add('album-screen-open');dialog.showModal();
 dialog.querySelector('button').onclick=closeAlbumScreen;
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeAlbumScreen()});
 try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen({navigationUI:'hide'});session.fullscreen=true}}catch{}
 if(active!==session){if(session.fullscreen&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});return}
 try{await screen.orientation?.lock?.('landscape')}catch{}
 if(active!==session){try{screen.orientation?.unlock?.()}catch{}}
}
document.addEventListener('fullscreenchange',()=>{if(active?.fullscreen&&!document.fullscreenElement)closeAlbumScreen()});
window.addEventListener('hashchange',closeAlbumScreen);
