// Screen and PDF share one dense, frameless spread layout.
const openings=['Этот вечер хочется помнить.','Хорошо, когда свои рядом.','Мы умеем быть счастливыми.','Пусть таких встреч будет больше.','Здесь живёт наше тепло.','Время стало чуть медленнее.','У этого дня особенный свет.','Самое ценное попало в кадр.','Нам есть что вспомнить.','Счастье складывается из встреч.','Тёплые люди делают тёплый вечер.','Всё важное оказалось рядом.','Эти минуты — наша история.','Сюда захочется вернуться.','Ради таких дней и собираемся.','Улыбки не требуют повода.','У каждого кадра свой голос.','Мы сохранили немного радости.','Праздник продолжается в памяти.','Как много в одном объятии.','Знакомые лица — целый мир.','Этот день нам к лицу.','Спасибо за каждый взгляд.','Обыкновенное чудо — быть вместе.'];
const endings=['И никому не хочется уходить.','Пусть это чувство останется с нами.','Такие истории берегут.','Здесь можно быть собой.','Маленький момент, большое счастье.','Память сохранит самое нежное.','Встречаемся чаще.','Пусть впереди будут новые поводы.','Обнимаем этот день.','Светлое всегда остаётся.','Сколько ещё хорошего впереди.','Согреемся этим воспоминанием зимой.','Как здорово, что мы здесь.','До следующего общего вечера.','Берём это тепло с собой.','Ничего лишнего — только жизнь.','Эту страницу хочется перечитать.','Сохраним и смех, и тишину.','Спасибо каждому, кто был рядом.','Оставим здесь кусочек сердца.','Пусть годы добавляют историй.','И всё получилось по-настоящему.','Кажется, это и есть любовь.','Продолжение обязательно будет.'];
function hash(seed){let n=0;for(const c of String(seed))n=(Math.imul(n,31)+c.charCodeAt(0))>>>0;return n}
export function albumPhrase(index,seed=''){const size=openings.length*endings.length,n=(index+hash(seed))%size;return openings[n%openings.length]+' '+endings[(Math.floor(n/openings.length)+n%openings.length)%endings.length]+(index>=size?' Наша история, глава '+(Math.floor(index/size)+1)+'.':'')}
export function collagePages(photos,seed=''){
 const sorted=[...photos].sort((a,b)=>(a.position||0)-(b.position||0));const count=Math.ceil(sorted.length/4),pages=[];let offset=0;
 for(let i=0;i<count;i++){const size=Math.ceil((sorted.length-offset)/(count-i));pages.push({type:'collage',photos:sorted.slice(offset,offset+size),variant:i,phrases:[albumPhrase(i*2,seed),albumPhrase(i*2+1,seed)]});offset+=size}return pages;
}
export function collageFrames(count,variant=0){
 if(count===1)return [{x:830,y:70,w:740,h:850,r:0}];
 const left=Math.ceil(count/2),right=count-left;
 function side(n,x){if(n===1)return [[x+30,70,740,850]];if(n===2)return [[x+30,70,740,415],[x+30,505,740,415]];return [[x+30,70,740,400],[x+30,490,360,430],[x+410,490,360,430]]}
 return [...side(left,0),...side(right,800)].map(([x,y,w,h])=>({x,y,w,h,r:0}));
}
