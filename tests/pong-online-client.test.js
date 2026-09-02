'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {create,SESSION_KEY}=require('../pong/scripts/online-client');

class FakeSocket{
 static OPEN=1;static CLOSING=2;static sockets=[];
 constructor(url){this.url=url;this.readyState=0;this.sent=[];this.listeners={};FakeSocket.sockets.push(this);}
 addEventListener(type,listener){(this.listeners[type]||=[]).push(listener);}
 emit(type,event={}){for(const listener of this.listeners[type]||[])listener(event);}
 open(){this.readyState=1;this.emit('open');}
 message(value){this.emit('message',{data:typeof value==='string'?value:JSON.stringify(value)});}
 close(){this.readyState=3;this.emit('close');}
 send(body){this.sent.push(JSON.parse(body));}
}
function environment(){
 FakeSocket.sockets=[];const stored=new Map(),messages=[],connections=[],invalid=[];let queued;
 const storage={setItem:(key,value)=>stored.set(key,value),getItem:key=>stored.get(key)||null,removeItem:key=>stored.delete(key)};
 const rooms={parseMessage:JSON.parse,createCoalescedSender(send){const sender=message=>send(message);sender.clear=()=>{};return sender;}};
 const client=create({rooms,WebSocketCtor:FakeSocket,location:{protocol:'http:',host:'localhost:8080'},storage,onMessage:message=>messages.push(message),onConnection:(...state)=>connections.push(state),onInvalidMessage:()=>invalid.push(true),setTimer:callback=>(queued=callback,1),clearTimer:()=>{}});
 return{client,stored,messages,connections,invalid,reconnect:()=>queued?.()};
}

test('connects, persists sessions, and rejects stale snapshots',()=>{
 const env=environment(),socket=env.client.connect({type:'create-room',visibility:'public'});assert.equal(socket.url,'ws://localhost:8080/ws');socket.open();assert.deepEqual(socket.sent,[{type:'create-room',visibility:'public'}]);
 socket.message({type:'session',roomCode:'ABCDE',playerToken:'secret-token',side:1,gamertags:['Host','Guest']});
 assert.deepEqual(JSON.parse(env.stored.get(SESSION_KEY)),{roomCode:'ABCDE',playerToken:'secret-token'});assert.equal(env.client.state.side,1);
 socket.message({type:'state',sequence:4,state:{}});socket.message({type:'state',sequence:3,state:{}});assert.deepEqual(env.messages.map(message=>message.type),['session','state']);
 socket.message('{');assert.equal(env.invalid.length,1);
});

test('reconnects with the saved opaque token and clears it on leave',()=>{
 const env=environment(),socket=env.client.connect({type:'join-room',roomCode:'ABCDE'});socket.open();socket.message({type:'session',roomCode:'ABCDE',playerToken:'resume-token',side:0});socket.close();env.reconnect();
 const resumed=FakeSocket.sockets.at(-1);resumed.open();assert.deepEqual(resumed.sent,[{type:'resume',roomCode:'ABCDE',playerToken:'resume-token'}]);
 env.client.leave();assert.deepEqual(resumed.sent.at(-1),{type:'leave'});assert.equal(env.stored.has(SESSION_KEY),false);assert.equal(env.client.state.socket,null);
});

test('a new room accepts sequences lower than the previous room',()=>{
 const env=environment(),first=env.client.connect({type:'join-room',roomCode:'FIRST'});first.open();first.message({type:'state',sequence:20,state:{}});const second=env.client.connect({type:'join-room',roomCode:'SECOND'});second.open();second.message({type:'state',sequence:1,state:{}});assert.deepEqual(env.messages.map(message=>message.sequence),[20,1]);
});

test('loads the lifecycle adapter before the Pong controller',()=>{
 const page=fs.readFileSync('pong/index.html','utf8');assert.ok(page.indexOf('scripts/online-client.js')<page.indexOf('scripts/app.js'));
});
