const tracks = [
  'Ну извини', 'Девочка моя', 'Музыка волн', 'Как на войне',
  'Инстаграм', 'Я так соскучился', 'Ходит дурачок', 'Калина',
  'Wicked Game', 'Сансара', 'Ангел', 'Спасибо за день',
  'Всё, что останется', 'Видели ночь', 'Постой, паровоз', 'Чижико'
];

const player = new Audio();
player.preload = 'none';
let current = 0;
let playing = false;
const file = index => `assets/songs/${String(index + 1).padStart(2, '0')}.mp3`;
const stamp = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';
const bars = Array.from({length: 27}, (_, index) => `<i style="--h:${18 + (index * 47 + index * index * 11) % 72}%"></i>`).join('');

export function renderSongs() {
  return `<section class="songs-page section">
    <header class="songs-heading"><p class="eyebrow">28 НОЯБРЯ · ЗВУЧИТ ЗДЕСЬ</p><h1>Песни <em>вечера.</em></h1><p>Включайте любимую. Этот вечер можно слушать снова.</p></header>
    <div class="songs-layout"><div class="songs-player" aria-label="Плеер песен">
      <div class="record-art"><div class="record-disc"><span>50<small>ПОВОДОВ<br>СКАЗАТЬ СПАСИБО</small></span></div></div>
      <div class="song-current"><span class="song-overline">СЕЙЧАС ЗВУЧИТ <b id="song-number">01 / 16</b></span><h2 id="song-title">${tracks[0]}</h2><div class="sound-bars" aria-hidden="true">${bars}</div></div>
      <div class="song-transport"><button type="button" id="song-prev" aria-label="Предыдущая песня">‹</button><button type="button" id="song-play" class="song-play" aria-label="Воспроизвести">▶</button><button type="button" id="song-next" aria-label="Следующая песня">›</button></div>
      <div class="song-timeline"><span id="song-elapsed">0:00</span><input id="song-seek" type="range" min="0" max="1000" value="0" aria-label="Перемотка песни"><span id="song-duration">0:00</span></div>
    </div><div class="songs-list-wrap"><div class="songs-list-head"><span>ПЛЕЙЛИСТ</span><span>16 ПЕСЕН</span></div><ol class="songs-list">${tracks.map((title, index) => `<li><button type="button" class="song-row${index === current ? ' selected' : ''}" data-song="${index}" aria-label="Воспроизвести: ${title}"><span class="song-index">${String(index + 1).padStart(2, '0')}</span><strong>${title}</strong><span class="song-row-icon" aria-hidden="true">↗</span></button></li>`).join('')}</ol></div></div>
  </section>`;
}

export function mountSongs(root) {
  const get = selector => root.querySelector(selector);
  const refresh = () => {
    if (!root.isConnected) return;
    get('#song-title').textContent = tracks[current];
    get('#song-number').textContent = `${String(current + 1).padStart(2, '0')} / ${tracks.length}`;
    get('#song-play').textContent = playing ? 'Ⅱ' : '▶';
    get('#song-play').setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
    root.querySelectorAll('[data-song]').forEach(button => {
      const selected = Number(button.dataset.song) === current;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-current', selected ? 'true' : 'false');
    });
    get('#song-elapsed').textContent = stamp(player.currentTime);
    get('#song-duration').textContent = stamp(player.duration);
    get('#song-seek').value = player.duration ? String(Math.round(player.currentTime / player.duration * 1000)) : '0';
    root.classList.toggle('is-playing', playing);
  };
  const select = async (index, autoplay = true) => {
    current = (index + tracks.length) % tracks.length;
    player.src = file(current);
    player.load();
    playing = false;
    refresh();
    if (autoplay) {
      try { await player.play(); playing = true; }
      catch { playing = false; }
      refresh();
    }
  };
  get('#song-play').onclick = async () => {
    if (!player.src) await select(current, false);
    if (player.paused) {
      try { await player.play(); playing = true; }
      catch { playing = false; }
    } else { player.pause(); playing = false; }
    refresh();
  };
  get('#song-prev').onclick = () => select(current - 1);
  get('#song-next').onclick = () => select(current + 1);
  root.querySelectorAll('[data-song]').forEach(button => button.onclick = () => select(Number(button.dataset.song)));
  get('#song-seek').oninput = event => { if (player.duration) player.currentTime = Number(event.target.value) / 1000 * player.duration; refresh(); };
  player.ontimeupdate = refresh;
  player.onloadedmetadata = refresh;
  player.onended = () => select(current + 1);
  player.onerror = () => { playing = false; refresh(); };
  refresh();
}

export function pauseSongs() { player.pause(); playing = false; }
