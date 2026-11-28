export function studioScene(){
 const lines=['50','СПОСОБОВ','СКАЗАТЬ','СПАСИБО'];
 const letters=lines.map((t,i)=>`<div class="studio-word word-${i}">${Array.from({length:16},(_,j)=>`<span aria-hidden="true" class="word-depth" style="--depth:${j+1}">${t}</span>`).join('')}<span class="word-face">${t}</span></div>`).join('');
 const beams=Array.from({length:6},(_,i)=>`<div class="studio-light light-${i}"><i class="light-cone"></i><b class="light-lamp"></b></div>`).join('');
 return `<div class="studio-heavens"><div class="studio-clouds"></div><div class="studio-stars"></div></div><div class="studio-horizon"></div><div class="studio-world"><div class="studio-building"><div class="studio-words">${letters}</div><div class="studio-terraces"><i></i><i></i><i></i><i></i></div><div class="studio-tower tower-left"></div><div class="studio-tower tower-right"></div></div></div>${beams}<div class="studio-lens"></div><div class="studio-shade"></div>`;
}
