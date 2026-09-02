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
 const app=fs.readFileSync('pong/scripts/app.js','utf8');
 assert.match(app,/createCoalescedSender\(message => sendOnline\(message\), 50\)/);
 assert.match(app,/onlinePointerInput\(\{ type: 'input', up: false, down: false, targetY: pointerY \}\)/);
 assert.match(app,/releasePointer[\s\S]*onlinePointerInput\.flush\(\)/);
 assert.ok((app.match(/onlinePointerInput\.clear\(\)/g)||[]).length>=3);
});
