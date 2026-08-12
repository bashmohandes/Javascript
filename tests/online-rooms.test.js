'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
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
