// Shared print/screen composition, on a 1600 × 1100 spread.
export function collagePages(photos){
 const sorted=[...photos].sort((a,b)=>(a.position||0)-(b.position||0));
 const count=Math.ceil(sorted.length/6),pages=[];let offset=0;
 for(let i=0;i<count;i++){const size=Math.ceil((sorted.length-offset)/(count-i));pages.push({type:'collage',photos:sorted.slice(offset,offset+size),variant:i%3});offset+=size}return pages;
}
export function collageFrames(count,variant=0){
 const left=count===1?1:Math.ceil(count/2),right=count-left;
 function side(n,x){if(n===1)return [[x+65,210,610,690,-2]];if(n===2)return [[x+60,150,610,390,-3],[x+100,585,575,365,2]];return [[x+65,130,600,355,-2],[x+55,540,285,350,-4],[x+365,550,320,365,3]]}
 const frames=[...side(left,0),...(right?side(right,800):[])];
 return frames.map(([x,y,w,h,r],i)=>({x,y,w,h,r:variant%2?-r:r}));
}
