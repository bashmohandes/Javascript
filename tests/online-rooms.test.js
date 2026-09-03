'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const rooms=require('../scripts/online-rooms');
test('online room codes are normalized and validated consistently',()=>{
 assert.equal(rooms.normalizeCode(' ab-i2z '),'ABI2Z');
 assert.deepEqual(rooms.validateJoin('abc'),{ok:false,code:'ABC',message:'Enter the five-character room code.'});
 assert.deepEqual(rooms.validateJoin('ab-i2z'),{ok:true,code:'ABI2Z'});
});
test('private room passcodes share the same validation rules',()=>{
 assert.equal(rooms.validateRoom('public','').ok,true);
 assert.equal(rooms.validateRoom('private','abc').ok,false);
 assert.deepEqual(rooms.validateRoom('private','  secret  '),{ok:true,passcode:'secret'});
});
test('server messages must be JSON objects',()=>{
 assert.deepEqual(rooms.parseMessage('{"type":"state"}'),{type:'state'});
 for(const raw of ['invalid','null','[]','"state"'])assert.throws(()=>rooms.parseMessage(raw),/Invalid server update/);
});
test('stored online sessions are validated, normalized, and migrate legacy tokens',()=>{
 const values=new Map(),removed=[];const storage={getItem:key=>values.get(key)??null,removeItem:key=>{removed.push(key);values.delete(key);}};
 const currentToken='a'.repeat(32),legacyToken='B'.repeat(32);
 values.set('current',JSON.stringify({roomCode:'ab-c2d',playerToken:currentToken}));
 assert.deepEqual(rooms.readSession(storage,'current'),{roomCode:'ABC2D',playerToken:currentToken});
 values.set('legacy',JSON.stringify({roomCode:'abc2d',token:legacyToken}));
 assert.deepEqual(rooms.readSession(storage,'legacy'),{roomCode:'ABC2D',playerToken:legacyToken});
 for(const [key,value] of [['broken','{'],['primitive','true'],['missing-token','{"roomCode":"ABC2D"}'],['bad-token','{"roomCode":"ABC2D","playerToken":"token"}'],['short-code',`{"roomCode":"ABC","playerToken":"${currentToken}"}`]]){values.set(key,value);assert.equal(rooms.readSession(storage,key),null);assert.ok(removed.includes(key));}
});
test('invite links preserve other parameters and can be cleared',()=>{
 const invite=rooms.inviteUrl('abc2d','https://arcade.test/pong/?theme=dark');
 assert.equal(invite,'https://arcade.test/pong/?theme=dark&room=ABC2D');
 assert.equal(rooms.clearInvite(invite),'https://arcade.test/pong/?theme=dark');
});
test('coalesced senders immediately send the first value and trail with the latest value',()=>{
 let now=0,timer=null,cleared=0;const sent=[];
 const sender=rooms.createCoalescedSender(value=>sent.push(value),50,{now:()=>now,set:callback=>(timer=callback,1),clear:()=>{timer=null;cleared++;}});
 sender('first');now=10;sender('stale');now=20;sender('latest');
 assert.deepEqual(sent,['first']);assert.equal(typeof timer,'function');
 now=50;const run=timer;timer=null;run();assert.deepEqual(sent,['first','latest']);
 now=60;sender('final');sender.flush();assert.deepEqual(sent,['first','latest','final']);assert.equal(timer,null);assert.ok(cleared>=1);
 now=70;sender('discarded');sender.clear();assert.equal(timer,null);assert.deepEqual(sent,['first','latest','final']);
});
test('online Pong bounds pointer messages and clears queued targets across sessions',()=>{
 const app=fs.readFileSync('pong/scripts/app.js','utf8'),client=fs.readFileSync('pong/scripts/online-client.js','utf8');
 assert.match(client,/createCoalescedSender\(message=>send\(message\),50\)/);
 assert.match(app,/onlinePointerInput\(\{ type: 'input', up: false, down: false, targetY: pointerY \}\)/);
 assert.match(app,/releasePointer[\s\S]*onlinePointerInput\.flush\(\)/);
 assert.ok((client.match(/sendInput\.clear\(\)/g)||[]).length>=2);
});
test('online clients share message and stored-session validation',()=>{
 const pongClient=fs.readFileSync('pong/scripts/online-client.js','utf8'),pongApp=fs.readFileSync('pong/scripts/app.js','utf8');
 assert.match(pongClient,/rooms\.parseMessage\(/,'Pong online client must validate server messages through the shared contract');
 assert.match(pongApp,/OnlineRooms\.readSession\(sessionStorage,/,'Pong app must validate stored room credentials');
 for(const file of ['tictactoe/scripts/app.js','battle-tanks/scripts/app.js']){
  const app=fs.readFileSync(file,'utf8');
  assert.match(app,/OnlineRooms\.parseMessage\(/,`${file} must validate server messages through the shared contract`);
  assert.match(app,/OnlineRooms\.readSession\(sessionStorage,/,`${file} must validate stored room credentials`);
  assert.doesNotMatch(app,/JSON\.parse\((?:event|e)\.data/,`${file} must not bypass shared message validation`);
 }
});
test('online pages cache-bust shared contract changes',()=>{
 assert.equal(rooms.CONTRACT_VERSION,2);
 for(const file of ['pong/index.html','tictactoe/index.html','battle-tanks/index.html']){
  const page=fs.readFileSync(file,'utf8');
  assert.match(page,new RegExp(`scripts/online-rooms\\.js\\?v=${rooms.CONTRACT_VERSION}`),`${file} must request the current shared contract`);
 }
 const worker=fs.readFileSync('service-worker.js','utf8');
 assert.match(worker,/CACHE_NAME = 'js-playground-v12'/);
});
test('Battle Tanks ignores obsolete sockets and owns one reconnect timer',()=>{
 const app=fs.readFileSync('battle-tanks/scripts/app.js','utf8');
 assert.match(app,/if\(nextSocket!==socket\)return/);
 assert.match(app,/onlineReconnectTimer=setTimeout\(\(\)=>openSocket/);
 assert.match(app,/function leaveRoom\([^\r\n]+clearTimeout\(onlineReconnectTimer\)/);
 assert.match(app,/const activeSocket=socket;socket=null;activeSocket\?\.close\(\)/);
});
