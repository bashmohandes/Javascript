const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreLeft = document.querySelector('#score-left');
const scoreRight = document.querySelector('#score-right');
const status = document.querySelector('#status');
const overlay = document.querySelector('#arena-message');
const overlayTitle = overlay.querySelector('strong');
const overlayHint = overlay.querySelector('span');

const game = { width:960, height:600, running:false, paused:false, over:false, mode:'solo', last:0, serve:1, score:[0,0], keys:new Set() };
const paddles = [{x:34,y:240,w:14,h:120,vy:0},{x:912,y:240,w:14,h:120,vy:0}];
const ball = {x:480,y:300,r:10,vx:0,vy:0};

function resize(){ const ratio=Math.min(window.devicePixelRatio||1,2); canvas.width=game.width*ratio; canvas.height=game.height*ratio; ctx.setTransform(ratio,0,0,ratio,0,0); draw(); }
function resetBall(direction=game.serve){ ball.x=game.width/2; ball.y=game.height/2; ball.vx=0; ball.vy=0; game.serve=direction; }
function launch(){ const angle=(Math.random()*.8)-.4; ball.vx=game.serve*410*Math.cos(angle); ball.vy=410*Math.sin(angle); game.serve*=-1; }
function newGame(){ game.score=[0,0]; game.over=false; scoreLeft.textContent='0'; scoreRight.textContent='0'; paddles[0].y=paddles[1].y=240; resetBall(Math.random()<.5?-1:1); game.running=true; game.paused=false; overlay.hidden=true; status.textContent=game.mode==='solo'?'First to 7. Keep the rally alive.':'First to 7. May the quickest paddle win.'; setTimeout(()=>{if(game.running&&!game.paused&&ball.vx===0)launch()},500); }
function showOverlay(title,hint){ overlayTitle.textContent=title; overlayHint.textContent=hint; overlay.hidden=false; }
function togglePause(){ if(game.over||!game.running){newGame();return} game.paused=!game.paused; game.paused?showOverlay('Game paused','Click or press Space to continue'):overlay.hidden=true; }
function point(side){ game.score[side]++; (side?scoreRight:scoreLeft).textContent=game.score[side]; if(game.score[side]===7){ game.over=true; game.running=false; const name=side===0?(game.mode==='solo'?'You':'Left player'):(game.mode==='solo'?'Computer':'Right player'); status.textContent=`${name} won ${game.score[side]}–${game.score[1-side]}.`; showOverlay(`${name} wins!`,'Click to play another match'); return; } resetBall(side===0?1:-1); setTimeout(()=>{if(game.running&&!game.paused&&ball.vx===0)launch()},650); }
function update(dt){
 const speed=500; paddles[0].vy=(game.keys.has('KeyS')?speed:0)-(game.keys.has('KeyW')?speed:0);
 if(game.mode==='duo') paddles[1].vy=(game.keys.has('ArrowDown')?speed:0)-(game.keys.has('ArrowUp')?speed:0);
 else { const target=ball.y-paddles[1].h/2; paddles[1].vy=Math.max(-370,Math.min(370,(target-paddles[1].y)*5)); }
 paddles.forEach(p=>p.y=Math.max(12,Math.min(game.height-p.h-12,p.y+p.vy*dt)));
 ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
 if(ball.y-ball.r<10&&ball.vy<0||ball.y+ball.r>game.height-10&&ball.vy>0) ball.vy*=-1;
 paddles.forEach((p,i)=>{ const toward=i===0?ball.vx<0:ball.vx>0; if(toward&&ball.x+ball.r>p.x&&ball.x-ball.r<p.x+p.w&&ball.y+ball.r>p.y&&ball.y-ball.r<p.y+p.h){ const offset=(ball.y-(p.y+p.h/2))/(p.h/2); ball.x=i===0?p.x+p.w+ball.r:p.x-ball.r; ball.vx=(i===0?1:-1)*Math.min(Math.abs(ball.vx)*1.055,720); ball.vy=offset*430; } });
 if(ball.x<-30)point(1); else if(ball.x>game.width+30)point(0);
}
function draw(){ ctx.clearRect(0,0,game.width,game.height); ctx.fillStyle='#20352f';ctx.fillRect(0,0,game.width,game.height); ctx.fillStyle='rgba(255,253,248,.12)';for(let y=18;y<game.height;y+=34)ctx.fillRect(game.width/2-2,y,4,18); ctx.strokeStyle='rgba(255,253,248,.16)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(game.width/2,game.height/2,82,0,Math.PI*2);ctx.stroke(); ctx.fillStyle='#fffdf8';paddles.forEach(p=>{ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,7);ctx.fill()});ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill(); }
function frame(time){ const dt=Math.min((time-game.last)/1000,.025)||0;game.last=time;if(game.running&&!game.paused)update(dt);draw();requestAnimationFrame(frame); }
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{game.mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b===button));newGame()}));
document.querySelector('#new-game').addEventListener('click',newGame);document.querySelector('#pause').addEventListener('click',togglePause);overlay.addEventListener('click',togglePause);
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();if(e.code==='Space'){togglePause();return}game.keys.add(e.code)});addEventListener('keyup',e=>game.keys.delete(e.code));
document.querySelectorAll('[data-key]').forEach(button=>{ const key=button.dataset.key; const on=e=>{e.preventDefault();game.keys.add(key)}; const off=e=>{e.preventDefault();game.keys.delete(key)};button.addEventListener('pointerdown',on);button.addEventListener('pointerup',off);button.addEventListener('pointercancel',off);button.addEventListener('pointerleave',off)});
addEventListener('resize',resize);resize();requestAnimationFrame(frame);
