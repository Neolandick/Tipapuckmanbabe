(function() {
 let tilesImage = new Image();
 tilesImage.src = "tiles1.png";
 let heroesImage = new Image();
 heroesImage.src = "heroes1.png"; //Картинки для стен и героев
 let map = { tileWidth: 50, tileHeight: 30 }, //Размеры карты в ячейках
  tileSize = 32, //Размер ячейки в пикселях
  defaultGravity  = 9.81 * 5, //Гравитация по умолчанию
  defaultDx    = 15, //Максимальная горизонтальная скорость по умолчанию (тайлов в сек.)
  defaultDy    = 60, //Максимальная вертикальная скорость по умолчанию (тайлов в сек.)
  defaultAcceleration  = 0.5, //Ускорение по умолчанию (сек. на достижение defaultDx)
  defaultFriction = 0.2, //Трение по умолчанию (сек. на остановку от defaultDx)
  defaultImpulse  = 1250, //Импульс (коэффициент) для прыжка игрока
  COLOR = { RED: '#800000', GOLD: 'gold', LIVES1: 'red', LIVES2: 'yellow', MSG: '#3f3' }, 
   //Служебные цвета
  KEY = { SPACE: 32, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40 }; //Клавиши
 let fps      = 60, //Кадров в секунду
  step = 1/fps, //Шаг
  canvas = document.getElementById('canvas'),
  ctx  = canvas.getContext('2d'), //Канва и контекст
  width = canvas.width  = map.tileWidth * tileSize,
  height = canvas.height = map.tileHeight * tileSize, //Пиксельные размеры мира
  player   = {},
  monsters = [],
  treasures = [],
  cells    = []; //Игрок, монстры, сокровища, ячейки - контейнеры
 let cell2pos = function (c) { return c*tileSize; },
  pos2cell = function (p) { return Math.floor(p/tileSize); },
   //Позиция в номер ячейки и обратно
  cellValue = function(cx, cy) { return cells[cx + (cy*map.tileWidth)]; };
   //Значение в ячейке
 
 if (!window.requestAnimationFrame) { //Плавная анимация
  window.requestAnimationFrame = window.webkitRequestAnimationFrame || 
   window.mozRequestAnimationFrame || 
   window.oRequestAnimationFrame   || 
   window.msRequestAnimationFrame  || 
   function(callback, element) {
    window.setTimeout(callback, 1000 / 60);
   }
 }
 function timestamp() { //Метка времени
  return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
 }
 function limits (x, min, max) { //Загнать x в [min; max]
  return Math.max(min, Math.min(max, x));
 }
 function crossing(x1, y1, w1, h1, x2, y2, w2, h2) { //Перекрываются ли 2 бара
  return !(
   ((x1 + w1 - 1) < x2) ||
   ((x2 + w2 - 1) < x1) ||
   ((y1 + h1 - 1) < y2) ||
   ((y2 + h2 - 1) < y1)
  );
 }
 function openURL(url, onsuccess) { //Выполнить запрос AJAX и функцию onsuccess
  let request = new XMLHttpRequest();
  request.onreadystatechange = function() {
   if ((request.readyState == 4) && (request.status == 200)) onsuccess (request);
  }
  request.open("GET", url, true);
  request.send();
 }

 function onkey(ev, key, down) { //Реакция на нажатия клавиш
  switch(key) {
   case KEY.LEFT:  
    player.left  = down; player.lastMoveKey = KEY.LEFT; ev.preventDefault(); 
   return false;
   case KEY.RIGHT: 
    player.right = down; player.lastMoveKey = KEY.RIGHT; ev.preventDefault(); 
   return false;
   case KEY.SPACE: 
    player.jump  = down; ev.preventDefault(); 
   return false;
  }
 }
  
 function update(dt) { //Апдейт объектов
  updateEntity (player, dt); //Апдейтим игрока
  let max = monsters.length; //Апдейтим монстров
  for (let n = 0; n < max ; n++) updateMonster(monsters[n], dt);
  max = treasures.length; //Апдейтим сокровища
  for (let n = 0; n < max ; n++) {
   let t = treasures[n];
   if (!t.collected && crossing (player.x, player.y, tileSize, tileSize, t.x, t.y, tileSize, tileSize))
    collectTreasure (t);
  }
 }

 function updateMonster(monster, dt) { //Апдейт одного монстра
  if (!monster.dead) {
   updateEntity(monster, dt);
   if (crossing(player.x, player.y, tileSize, tileSize, monster.x, monster.y, tileSize, tileSize)) {
    if ((player.dy > 0) && (monster.y - player.y > tileSize/2)) killMonster(monster);
    else killPlayer(player); //Если не затоптал монстра...
   }
  }
 }

 function killMonster(monster) { //Удаление монстра
  if (player.endOfGame) return;
  player.killed++;
  monster.dead = true;
 }

 function killPlayer(player) { //Удаление игрока
  if (player.endOfGame) return;
  player.x = player.start.x;
  player.y = player.start.y;
  player.dx = player.dy = 0;
  if (player.lives > 1) player.lives--;
  else { player.lives = 0; player.endOfGame = true; }
 }

 function collectTreasure(t) { //Забрать сокровище
  if (player.endOfGame) return;
  player.collected++;
  t.collected = true;
 }

 function updateEntity(entity, dt) { //Апдейтить объект на сетке
  let wasleft = entity.dx  < 0,
   wasright = entity.dx  > 0,
   falling = entity.falling,
   friction = entity.friction * (falling ? 0.5 : 1),
   acceleration = entity.acceleration    * (falling ? 0.5 : 1);
   entity.startDx = 0;
   entity.startDy = entity.gravity;
  if (entity.left) entity.startDx = entity.startDx - acceleration;
  else if (wasleft) entity.startDx = entity.startDx + friction;
  if (entity.right) entity.startDx = entity.startDx + acceleration;
  else if (wasright) entity.startDx = entity.startDx - friction;
  if (entity.jump && !entity.jumping && !falling) {
   entity.startDy = entity.startDy - entity.impulse; //Начальный большой прыжок 
   entity.jumping = true;
  }
  entity.x  = entity.x  + (dt * entity.dx);
  entity.y  = entity.y  + (dt * entity.dy);
  entity.dx = limits(entity.dx + (dt * entity.startDx), -entity.maxdx, entity.maxdx);
  entity.dy = limits(entity.dy + (dt * entity.startDy), -entity.maxdy, entity.maxdy);
  if ((wasleft  && (entity.dx > 0)) ||
      (wasright && (entity.dx < 0))) {
   entity.dx = 0; //Чтобы трение не вело к "раскачке" взад-вперёд
  }
  let tx = pos2cell (entity.x),
   ty = pos2cell (entity.y),
   nx = entity.x%tileSize,
   ny = entity.y%tileSize,
   cellhere  = cellValue(tx, ty),
   cellright = cellValue(tx + 1, ty),
   celldown  = cellValue(tx,     ty + 1),
   celldiag  = cellValue(tx + 1, ty + 1);
  if (entity.dy > 0) {
   if ((celldown && !cellhere) ||
       (celldiag && !cellright && nx)) {
    entity.y = cell2pos(ty);
    entity.dy = 0;
    entity.falling = false;
    entity.jumping = false;
    ny = 0;
   }
  }
  else if (entity.dy < 0) {
   if ((cellhere      && !celldown) ||
       (cellright && !celldiag && nx)) {
    entity.y = cell2pos(ty + 1);
    entity.dy = 0;
    cellhere = celldown;
    cellright = celldiag;
    ny = 0;
   }
  }
  if (entity.dx > 0) {
   if ((cellright && !cellhere) ||
       (celldiag  && !celldown && ny)) {
    entity.x = cell2pos(tx);
    entity.dx = 0;
   }
  }
  else if (entity.dx < 0) {
   if ((cellhere && !cellright) ||
       (celldown && !celldiag && ny)) {
    entity.x = cell2pos(tx + 1);
    entity.dx = 0;
   }
  }
  if (entity.monster) {
   if (entity.left && (cellhere || !celldown)) {
    entity.left = false;
    entity.right = true;
   }      
   else if (entity.right && (cellright || !celldiag)) {
    entity.right = false;
    entity.left  = true;
   }
  }
  entity.falling = ! (celldown || (nx && celldiag));
 }

 function render (ctx, mainFrame, dt) { //Отрисовка всего
  ctx.clearRect(0, 0, width, height);
  renderMap (ctx);
  let treasureCnt = renderTreasure(ctx, mainFrame);
  renderPlayer (ctx, dt);
  let monstersCnt = renderMonsters(ctx, dt);
  let win = false;
  if (!treasureCnt && !monstersCnt) {
   player.endOfGame = true; win = true;
  }
  if (player.endOfGame) {
   ctx.font = tileSize + "px Arial";
   ctx.textAlign = "left";
   ctx.textBaseline="top";
   ctx.fillStyle = COLOR.MSG;
   if (win) {
    ctx.fillText("You are WIN!", cell2pos(2), cell2pos(1));
   }
   else {
    ctx.fillText("You are LOSE!", cell2pos(2), cell2pos(1));
   }
  }
 }

 function renderMap (ctx) { //Отрисовка карты
  let x, y, cellhere;
  for (y = 0 ; y < map.tileHeight ; y++) {
   for (x = 0 ; x < map.tileWidth ; x++) {
    cellhere = cellValue(x, y);
    if (cellhere) {
     ctx.drawImage(tilesImage, (cellhere - 1) * tileSize, 0, tileSize, tileSize, 
      x * tileSize, y * tileSize, tileSize, tileSize);
    }
   }
  }
 }

 function renderPlayer(ctx, dt) { //Отрисовка игрока
  ctx.drawImage(heroesImage, (player.lastMoveKey == KEY.RIGHT ? 0 : 1) * tileSize, 0, 
   tileSize, tileSize, 
   player.x + (player.dx * dt), player.y + (player.dy * dt), tileSize, tileSize);
  ctx.fillStyle = COLOR.GOLD;
  let max = player.collected;
  for (let n = 0; n < max ; n++)
   ctx.fillRect(cell2pos(2 + n), cell2pos(2), tileSize/2, tileSize/2);
  ctx.fillStyle = COLOR.RED;
  max = player.killed;
  for (let n = 0; n < max ; n++)
   ctx.fillRect(cell2pos(2 + n), cell2pos(3), tileSize/2, tileSize/2);
  max = player.lives;
  for (let n = 0; n < max ; n++)
   drawStar (ctx,COLOR.LIVES1,COLOR.LIVES2,
    cell2pos(2 + n), cell2pos(1), 5, tileSize/3, tileSize/5);
 }
 
 function drawStar(ctx,color1,color2,cx,cy,spikes,outerRadius,innerRadius) { 
  //Звездочка - жизнь
  let rot=Math.PI/2*3, x = cx, y = cy, step = Math.PI/spikes;
  ctx.beginPath();
  ctx.moveTo (cx,cy-outerRadius);
  for (let i=0;i<spikes;i++){
   x = cx+Math.cos(rot)*outerRadius;
   y = cy+Math.sin(rot)*outerRadius;
   ctx.lineTo(x,y);
   rot+=step;
   x = cx + Math.cos(rot)*innerRadius;
   y = cy + Math.sin(rot)*innerRadius;
   ctx.lineTo(x,y);
   rot += step;
  }
  ctx.lineTo(cx,cy-outerRadius);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle=color1;
  ctx.stroke();
  ctx.fillStyle = color2;
  ctx.fill();
 }

 function renderMonsters (ctx, dt) { //Отрисовать монстров
  ctx.fillStyle = COLOR.RED;
  let max = monsters.length, monster, cnt = 0;
  for (let n = 0; n < max ; n++) {
   monster = monsters[n];
   if (!monster.dead) {
    cnt++;
    ctx.drawImage(heroesImage, (2 + (monster.right ? 0 : 1)) * tileSize, 0, tileSize, tileSize, 
     monster.x + (monster.dx * dt), monster.y + (monster.dy * dt), tileSize, tileSize);   
   }
  }
  return cnt;
 }

 function renderTreasure (ctx, mainFrame) { //Отрисовка сокровищ
  ctx.fillStyle   = COLOR.GOLD;
  ctx.globalAlpha = 0.25 + pulseTreasure (mainFrame, 60);
  let max = treasures.length, t, cnt = 0;
  for (let n = 0; n < max ; n++) {
   t = treasures[n];
   if (!t.collected) {
    cnt++;
    ctx.drawImage(heroesImage, 4 * tileSize, 0, tileSize, tileSize, 
     t.x, t.y + tileSize/3, tileSize, tileSize*2/3);
   }
  }
  ctx.globalAlpha = 1;
  return cnt;
 }

 function pulseTreasure (mainFrame, duration) { //Мерцание сокровищ
  let half  = duration/2, pulse = mainFrame%duration;
  return pulse < half ? (pulse/half) : 1-(pulse-half)/half;
 }

 function setup (map) { //Начальная установка карты
  let data    = map.layers[0].data,
   objects = map.layers[1].objects, obj, entity;
  for (let n = 0 ; n < objects.length ; n++) {
   obj = objects[n];
   entity = setupEntity(obj);
   switch(obj.type) {
    case "player"   : 
     entity.lives = 3;
     entity.endOfGame = false;
     entity.lastMoveKey = KEY.RIGHT; //Последнее направление игрока, для выбора спрайта
     player = entity; 
    break;
    case "monster"  : monsters.push(entity); break;
    case "treasure" : treasures.push(entity); break;
   }
  }
  cells = data;
 }

 function setupEntity (obj) { //Установка объекта
  let entity = {};
  entity.x = obj.x;
  entity.y = obj.y;
  entity.dx = 0;
  entity.dy = 0;
  if (!(obj.properties)) obj.properties = [];
  entity.gravity  = tileSize * defaultGravity;
  //Как искать нужные свойства в наборе (maxdx):
  let maxdx = obj.properties.find(x => x.name === 'defaultDx'); 
  if (maxdx) entity.maxdx = tileSize * parseFloat(maxdx.value);
  else entity.maxdx = tileSize * defaultDx;
  entity.maxdy    = tileSize * defaultDy;
  entity.impulse  = tileSize * defaultImpulse;
  entity.acceleration    = entity.maxdx / defaultAcceleration;
  entity.friction = entity.maxdx / defaultFriction;
  let left = obj.properties.find(x => x.name === 'left');
  if (left) { entity.left = true; entity.right = false; }
  let right = obj.properties.find(x => x.name === 'right');
  if (right) { entity.left = false; entity.right = true; }
  entity.monster  = obj.type == "monster";
  entity.player   = obj.type == "player";
  entity.treasure = obj.type == "treasure";
  entity.start    = { x: obj.x, y: obj.y }
  entity.killed = entity.collected = 0;
  return entity;
 }

 let counter = 0, dt = 0, now, last = timestamp();
  
 function mainFrame() { //Основной игровой цикл
  now = timestamp();
  dt = dt + Math.min(1, (now - last) / 1000);
  while(dt > step) {
   dt = dt - step;
   update (step);
  }
  render (ctx, counter, dt);
  last = now;
  counter++;
  requestAnimationFrame(mainFrame, canvas);
 }

 //Обработчики событий:
 document.addEventListener('keydown', function(ev) { return onkey(ev, ev.keyCode, true); }, false);
 document.addEventListener('keyup',   function(ev) { return onkey(ev, ev.keyCode, false); }, false);
 
 openURL("level1.json", function(req) { //Загрузить уровень из файла .json
  let txt = JSON.parse(req.responseText);
  setup(txt);
  mainFrame();
 });
})();