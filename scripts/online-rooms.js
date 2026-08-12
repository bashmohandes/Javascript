(function(root,factory){
'use strict';
const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.OnlineRooms=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const normalizeCode=value=>String(value||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,5);
function validateJoin(code){const normalized=normalizeCode(code);return normalized.length===5?{ok:true,code:normalized}:{ok:false,code:normalized,message:'Enter the five-character room code.'};}
function validateRoom(visibility,passcode){const secret=String(passcode||'').trim();return visibility!=='private'||(secret.length>=4&&secret.length<=32)?{ok:true,passcode:secret}:{ok:false,passcode:secret,message:'Choose a private room passcode between 4 and 32 characters.'};}
function inviteUrl(code,href=location.href){const url=new URL(href);url.searchParams.set('room',normalizeCode(code));return url.href;}
function clearInvite(href=location.href){const url=new URL(href);url.searchParams.delete('room');return url.href;}
async function copyInvite(code,clipboard=navigator.clipboard,href=location.href){const url=inviteUrl(code,href);await clipboard.writeText(url);return url;}
function setConnection(element,label,state='offline'){element.textContent=label;element.dataset.state=state;}
function renderRooms(element,rooms,onJoin){element.replaceChildren(...rooms.map(room=>{const item=document.createElement('div');item.className='public-room';const details=document.createElement('div'),code=document.createElement('strong'),meta=document.createElement('span'),button=document.createElement('button');code.textContent=room.code;meta.textContent=room.host||`${room.players||1}/2 players`;details.append(code,meta);button.type='button';button.className='secondary-button';button.textContent='Join';button.addEventListener('click',()=>onJoin(room.code));item.append(details,button);return item;}));if(!rooms.length){const empty=document.createElement('p');empty.textContent='No public rooms yet.';element.append(empty);}}
return{normalizeCode,validateJoin,validateRoom,inviteUrl,clearInvite,copyInvite,setConnection,renderRooms};
}));
