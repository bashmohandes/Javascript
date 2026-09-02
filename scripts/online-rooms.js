(function(root,factory){
'use strict';
const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.OnlineRooms=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CONTRACT_VERSION=2;
const normalizeCode=value=>String(value||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,5);
function validateJoin(code){const normalized=normalizeCode(code);return normalized.length===5?{ok:true,code:normalized}:{ok:false,code:normalized,message:'Enter the five-character room code.'};}
function validateRoom(visibility,passcode){const secret=String(passcode||'').trim();return visibility!=='private'||(secret.length>=4&&secret.length<=32)?{ok:true,passcode:secret}:{ok:false,passcode:secret,message:'Choose a private room passcode between 4 and 32 characters.'};}
function parseMessage(raw){let message;try{message=JSON.parse(raw);}catch{throw new Error('Invalid server update.');}if(!message||typeof message!=='object'||Array.isArray(message))throw new Error('Invalid server update.');return message;}
function readSession(storage,key){let session;try{session=JSON.parse(storage.getItem(key));}catch{storage.removeItem(key);return null;}const roomCode=normalizeCode(session?.roomCode),playerToken=typeof session?.playerToken==='string'?session.playerToken:typeof session?.token==='string'?session.token:'';if(roomCode.length!==5||!/^[A-Za-z0-9_-]{32}$/.test(playerToken)){if(session!==null)storage.removeItem(key);return null;}return{roomCode,playerToken};}
function inviteUrl(code,href=location.href){const url=new URL(href);url.searchParams.set('room',normalizeCode(code));return url.href;}
function clearInvite(href=location.href){const url=new URL(href);url.searchParams.delete('room');return url.href;}
async function copyInvite(code,clipboard=navigator.clipboard,href=location.href){const url=inviteUrl(code,href);await clipboard.writeText(url);return url;}
function createCoalescedSender(send,intervalMs=50,timers={now:()=>Date.now(),set:(callback,delay)=>setTimeout(callback,delay),clear:timer=>clearTimeout(timer)}){let pending,hasPending=false,timer=null,lastSent=-Infinity;const flush=()=>{if(timer!==null){timers.clear(timer);timer=null;}if(!hasPending)return;const value=pending;pending=undefined;hasPending=false;lastSent=timers.now();send(value);};const schedule=value=>{pending=value;hasPending=true;const delay=Math.max(0,intervalMs-(timers.now()-lastSent));if(delay===0)flush();else if(timer===null)timer=timers.set(flush,delay);};schedule.flush=flush;schedule.clear=()=>{if(timer!==null)timers.clear(timer);timer=null;pending=undefined;hasPending=false;lastSent=-Infinity;};return schedule;}
function setConnection(element,label,state='offline'){element.textContent=label;element.dataset.state=state;}
function renderRooms(element,rooms,onJoin){element.replaceChildren(...rooms.map(room=>{const item=document.createElement('div');item.className='public-room';const details=document.createElement('div'),code=document.createElement('strong'),meta=document.createElement('span'),button=document.createElement('button');code.textContent=room.code;meta.textContent=room.host||`${room.players||1}/2 players`;details.append(code,meta);button.type='button';button.className='secondary-button';button.textContent='Join';button.addEventListener('click',()=>onJoin(room.code));item.append(details,button);return item;}));if(!rooms.length){const empty=document.createElement('p');empty.textContent='No public rooms yet.';element.append(empty);}}
return{CONTRACT_VERSION,normalizeCode,validateJoin,validateRoom,parseMessage,readSession,inviteUrl,clearInvite,copyInvite,createCoalescedSender,setConnection,renderRooms};
}));
