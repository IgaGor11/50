import qrcode from './qr-vendor.mjs';
import {escapeHTML as h} from './domain.mjs?v=clean-12';
export function qrSVG(link){const q=qrcode(0,'M');q.addData(link);q.make();return q.createSvgTag({cellSize:6,margin:24,scalable:true});}
export function qrCard(name,link){return `<article class="qr-card"><p>50 ПОВОДОВ СКАЗАТЬ СПАСИБО</p><h2>${h(name)}</h2>${qrSVG(link)}<h3>Наведите камеру телефона</h3><p>Нажмите на появившуюся ссылку.<br>Вы сразу попадёте на свой праздник.</p><small>Это ваше личное приглашение.<br>Передавайте его только этому гостю.</small></article>`}
export function printQR(){window.print()}
