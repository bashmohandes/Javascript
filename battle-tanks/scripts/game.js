(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.BattleTanksGame = api;
    root.BattleTanksCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const WIDTH = 960, HEIGHT = 540, GROUND = 488, GRAVITY = 210;
    const TANK_W = 58, TANK_H = 30, PROJECTILE_R = 6, STARTING_HEALTH = 100, DAMAGE = 50;
    const barrier = Object.freeze({ x: 448, y: 266, w: 64, h: GROUND - 266 });
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const validSide = side => Number.isInteger(side) && side >= 0 && side <= 1;
    function requireSide(side) { if (!validSide(side)) throw new Error('Invalid player side.'); }
    function finite(value, name) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${name}.`); return value; }
    function tankBounds(side) { requireSide(side); return side === 0 ? { min: 0, max: barrier.x - TANK_W } : { min: barrier.x + barrier.w, max: WIDTH - TANK_W }; }
    function createGame(options = {}) {
        const now = Number.isFinite(options.now) ? options.now : Date.now();
        return { phase: 'waiting', activePlayer: 0, matchId: 0, turnId: 0,
            tanks: [{ x: 115, y: GROUND-TANK_H, angle: 45, power: 60, health: STARTING_HEALTH, color: '#d76b45' }, { x: WIDTH-115-TANK_W, y: GROUND-TANK_H, angle: 45, power: 60, health: STARTING_HEALTH, color: '#396b75' }],
            projectile: null, winner: null, startedAt: now, endedAt: null, rematchNumber: 0,
            stats: [{ shots: 0, hits: 0, damageTaken: 0, turns: 0 }, { shots: 0, hits: 0, damageTaken: 0, turns: 0 }], announcement: 'Waiting for both players.' };
    }
    function startGame(game, options = {}) {
        if (!game || !['waiting','game-over'].includes(game.phase)) throw new Error('The match cannot be started now.');
        const nextMatch = game.matchId + 1, rematches = game.matchId ? game.rematchNumber + 1 : game.rematchNumber;
        const fresh = createGame(options); Object.assign(game, fresh, { matchId: nextMatch, turnId: 1, phase: 'aiming', rematchNumber: rematches, announcement: 'Player 1: adjust your shot.' }); return game;
    }
    function assertTurn(game, side) { requireSide(side); if (game.phase !== 'aiming') throw new Error('Gameplay input is locked in the current phase.'); if (game.activePlayer !== side) throw new Error('Wait for your turn.'); }
    function moveTank(game, side, directionOrPosition) {
        assertTurn(game, side); const tank=game.tanks[side], bounds=tankBounds(side); let target;
        if (directionOrPosition === 'forward') target=tank.x+(side ? -8 : 8);
        else if (directionOrPosition === 'backward') target=tank.x+(side ? 8 : -8);
        else if (typeof directionOrPosition === 'number' && Number.isFinite(directionOrPosition)) target=directionOrPosition;
        else if (directionOrPosition && Number.isFinite(directionOrPosition.position)) target=directionOrPosition.position;
        else throw new Error('Invalid movement direction or position.');
        tank.x=clamp(target,bounds.min,bounds.max); return tank.x;
    }
    function setAim(game, side, angle, power) { assertTurn(game,side); angle=finite(angle,'angle'); power=finite(power,'power'); if(angle<10||angle>80)throw new Error('Angle must be between 10 and 80.'); if(power<20||power>100)throw new Error('Power must be between 20 and 100.'); game.tanks[side].angle=angle; game.tanks[side].power=power; return true; }
    function fire(game, side) { assertTurn(game,side); if(game.projectile)throw new Error('A projectile is already in flight.'); const tank=game.tanks[side],direction=side?-1:1,radians=tank.angle*Math.PI/180,speed=170+tank.power*3.2; game.stats[side].shots++;game.stats[side].turns++;game.projectile={x:tank.x+TANK_W/2+direction*32,y:tank.y-7,vx:Math.cos(radians)*speed*direction,vy:-Math.sin(radians)*speed,owner:side};game.phase='projectile-flight';game.announcement=`Player ${side+1} fired.`;return true; }
    function circleRect(x,y,r,rect){return x+r>=rect.x&&x-r<=rect.x+rect.w&&y+r>=rect.y&&y-r<=rect.y+rect.h;}
    function collisionAt(game,x,y){if(circleRect(x,y,PROJECTILE_R,barrier))return{type:'barrier'};for(let i=0;i<2;i++){if(i===game.projectile?.owner)continue;const t=game.tanks[i];if(circleRect(x,y,PROJECTILE_R,{x:t.x,y:t.y,w:TANK_W,h:TANK_H}))return{type:'tank',index:i};}if(y+PROJECTILE_R>=GROUND)return{type:'terrain'};if(x+PROJECTILE_R<0||x-PROJECTILE_R>WIDTH||y-PROJECTILE_R>HEIGHT)return{type:'out-of-bounds'};return null;}
    function resolve(game, hit) { if(game.phase!=='resolving')return null; const owner=game.projectile.owner;game.projectile=null;if(hit.type==='tank'){game.stats[owner].hits++;const target=game.tanks[hit.index];target.health=Math.max(0,target.health-DAMAGE);game.stats[hit.index].damageTaken+=DAMAGE;if(!target.health){game.phase='game-over';game.winner=owner;game.endedAt=Date.now();game.announcement=`Player ${owner+1} wins!`;return hit;}}game.activePlayer=1-owner;game.turnId++;game.phase='aiming';game.announcement=`Player ${game.activePlayer+1}: adjust your shot.`;return hit;}
    function update(game, deltaSeconds) { if(game.phase!=='projectile-flight'||!game.projectile)return null;let remaining=clamp(finite(deltaSeconds,'delta time'),0,.1),hit=null;while(remaining>0&&game.phase==='projectile-flight'){const dt=Math.min(remaining,1/120),p=game.projectile,dx=p.vx*dt,dy=p.vy*dt+.5*GRAVITY*dt*dt,steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/2));for(let i=1;i<=steps;i++){hit=collisionAt(game,p.x+dx*i/steps,p.y+dy*i/steps);if(hit){p.x+=dx*i/steps;p.y+=dy*i/steps;game.phase='resolving';break;}}if(!hit){p.x+=dx;p.y+=dy;p.vy+=GRAVITY*dt;}remaining-=dt;}return hit?resolve(game,hit):null; }
    function snapshot(game) { return JSON.parse(JSON.stringify(game)); }
    function rematch(game, options={}) { if(game.phase!=='game-over')throw new Error('The match must be finished before starting a rematch.');return startGame(game,options); }
    // Compatibility names retained for the local game while all rules live here.
    const createInitialState=createGame, beginTurn=(game,side=game.activePlayer)=>{requireSide(side);game.activePlayer=side;game.phase='aiming';return true;};
    const adjustAim=(game,delta)=>setAim(game,game.activePlayer,clamp(game.tanks[game.activePlayer].angle+delta,10,80),game.tanks[game.activePlayer].power);
    const adjustPower=(game,delta)=>setAim(game,game.activePlayer,game.tanks[game.activePlayer].angle,clamp(game.tanks[game.activePlayer].power+delta,20,100));
    const fireProjectile=(game)=>fire(game,game.activePlayer), stepPhysics=update, resetMatch=game=>game.phase==='game-over'?rematch(game):startGame(game);
    return {WIDTH,HEIGHT,GROUND,GRAVITY,TANK_W,TANK_H,PROJECTILE_R,STARTING_HEALTH,DAMAGE,barrier,clamp,createGame,startGame,moveTank,setAim,fire,update,snapshot,rematch,createInitialState,beginTurn,tankBounds,adjustAim,adjustPower,fireProjectile,collisionAt,stepPhysics,resetMatch};
}));
