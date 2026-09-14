import {failure,sameOrigin,configured,token,rows,insert,update,json} from '@/lib/server';

export const dynamic='force-dynamic';

function validUuid(v:string){return /^[a-f0-9-]{36}$/i.test(v)}
function validEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254}

async function guestEvent(id:string,invite:string){
 if(!validUuid(id))throw new Error('Event not found.');
 const [e]=await rows('events',{id:'eq.'+id,limit:'1'});
 if(!e)throw new Error('Event not found.');
 if(e.access==='private'&&String(e.invite)!==invite)throw new Error('This invitation link is invalid.');
 return e;
}

export async function GET(r:Request){
 try{
  const q=new URL(r.url).searchParams;
  const e=await guestEvent(q.get('event')||'',q.get('invite')||'');
  return json({event:{id:e.id,title:e.title,description:e.description,start:e.start,mode:e.mode,status:e.status,access:e.access}});
 }catch(e){return failure(e)}
}

export async function POST(r:Request){
 try{
  sameOrigin(r);
  const b=await r.json();
  const id=String(b.event||'');
  const invite=String(b.invite||'');
  const name=String(b.name||'').trim().replace(/\s+/g,' ').slice(0,80);
  const email=String(b.email||'').trim().toLowerCase();

  if(name.length<2)throw new Error('Enter your name.');
  if(!validEmail(email))throw new Error('Enter a valid email address.');

  const e=await guestEvent(id,invite);

  if(b.action==='heartbeat'){
   const identity=String(b.identity||'');
   if(!validUuid(identity))throw new Error('Invalid participant session.');
   const [record]=await rows('attendance',{event:'eq.'+e.id,user:'eq.'+identity,limit:'1'});
   if(!record||record.banned)throw new Error('This participant session is no longer active.');
   const now=Math.floor(Date.now()/1000);
   await update('attendance',{event:'eq.'+e.id,user:'eq.'+identity},{
    seconds:Number(record.seconds||0)+30,
    last_seen:now
   });
   return json({ok:true});
  }

  if(b.action!=='join')throw new Error('Unknown guest action.');
  if(!configured())throw new Error('Live streaming is not connected yet.');
  if(e.status==='ended')throw new Error('This event has ended.');
  if(e.status!=='live')throw new Error('The host has not started this event yet.');

  const existing=await rows('attendance',{event:'eq.'+e.id,email:'eq.'+email,limit:'1'});
  const record=existing[0];
  if(record?.banned)throw new Error('The host has removed you from this event.');

  const identity=record?.user||crypto.randomUUID();
  const now=Math.floor(Date.now()/1000);

  if(record){
   await update('attendance',{event:'eq.'+e.id,user:'eq.'+identity},{name,email,last_seen:now});
  }else{
   await insert('attendance',{event:e.id,user:identity,name,email,joined:now,last_seen:now});
  }

  return json({
   url:process.env.LIVEKIT_URL,
   token:await token(e.id,identity,name,!!record?.speaker),
   identity,
   event:{id:e.id,title:e.title,mode:e.mode,status:e.status}
  });
 }catch(e){return failure(e)}
}
