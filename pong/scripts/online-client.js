(function(root,factory){
'use strict';
const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PongOnlineClient=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const SESSION_KEY='pong-online-session';

function create({rooms,WebSocketCtor,location,storage,onMessage=()=>{},onConnection=()=>{},onInvalidMessage=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,reconnectDelay=1000}){
 if(!rooms||!WebSocketCtor||!location||!storage)throw new TypeError('Online client dependencies are required.');
 const state={socket:null,roomCode:'',token:'',side:0,gamertags:[null,null],connected:false,lastSequence:0,reconnectTimer:null,intentionalClose:false,awaitingResumeState:false};
 function send(message){if(state.socket?.readyState===(WebSocketCtor.OPEN??1))state.socket.send(JSON.stringify(message));}
 const sendInput=rooms.createCoalescedSender(message=>send(message),50);
 function saveSession(){storage.setItem(SESSION_KEY,JSON.stringify({roomCode:state.roomCode,playerToken:state.token}));}
 function clearSession(){storage.removeItem(SESSION_KEY);state.roomCode='';state.token='';state.lastSequence=0;}
 function accept(message){
  if(message.type==='session'){state.roomCode=message.roomCode;state.token=message.playerToken;state.side=message.side;state.gamertags=message.gamertags||[null,null];saveSession();}
  if(message.type==='state'){if(message.sequence<=state.lastSequence)return false;state.lastSequence=message.sequence;}
  onMessage(message);return true;
 }
 function connect(action){
  clearTimer(state.reconnectTimer);sendInput.clear();
  const previous=state.socket;state.socket=null;if(previous&&previous.readyState<WebSocketCtor.CLOSING)previous.close();
  state.intentionalClose=false;state.awaitingResumeState=action.type==='resume';if(!state.awaitingResumeState)state.lastSequence=0;onConnection('Connecting…','connecting');
  const scheme=location.protocol==='https:'?'wss:':'ws:',socket=new WebSocketCtor(`${scheme}//${location.host}/ws`);state.socket=socket;
  socket.addEventListener('open',()=>{if(socket!==state.socket)return;state.connected=true;send(action);});
  socket.addEventListener('message',event=>{if(socket!==state.socket)return;try{accept(rooms.parseMessage(event.data));}catch{onInvalidMessage();}});
  socket.addEventListener('close',()=>{if(socket!==state.socket)return;state.connected=false;if(state.intentionalClose){onConnection('Offline','offline');return;}onConnection('Reconnecting…','connecting');if(state.roomCode&&state.token)state.reconnectTimer=setTimer(()=>connect({type:'resume',roomCode:state.roomCode,playerToken:state.token}),reconnectDelay);else onConnection('Offline','offline');});
  return socket;
 }
 function leave(notify=true){clearTimer(state.reconnectTimer);sendInput.clear();if(notify)send({type:'leave'});state.intentionalClose=true;const socket=state.socket;state.socket=null;socket?.close();state.connected=false;state.awaitingResumeState=false;clearSession();onConnection('Offline','offline');}
 return{state,connect,leave,send,sendInput,clearInput:()=>sendInput.clear()};
}

return{SESSION_KEY,create};
}));
