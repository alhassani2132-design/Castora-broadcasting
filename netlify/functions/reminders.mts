export default async ()=>{
  const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY, resend=process.env.RESEND_API_KEY, from=process.env.CASTORA_FROM_EMAIL;
  if(!base||!service||!resend||!from)return new Response('Reminder integration not configured',{status:200});
  const h={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const due=await fetch(base+`/rest/v1/castora_invites?reminder_sent=eq.false&status=eq.sent&remind_at=lte.${encodeURIComponent(new Date().toISOString())}&select=id,event,email&limit=100`,{headers:h,cache:'no-store'}).then(r=>r.json());
  for(const x of Array.isArray(due)?due:[]){
    const ev=await fetch(base+`/rest/v1/castora_events?id=eq.${x.event}&select=id,title,start,access,invite&limit=1`,{headers:h,cache:'no-store'}).then(r=>r.json());const e=ev?.[0];if(!e)continue;
    const site=process.env.URL||process.env.DEPLOY_PRIME_URL||'';const join=new URL(site);join.searchParams.set('event',e.id);if(e.access==='private')join.searchParams.set('invite',e.invite);
    const mailed=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+resend,'Content-Type':'application/json'},body:JSON.stringify({from,to:[x.email],subject:`Reminder: ${e.title}`,html:`<h2>${e.title}</h2><p>Your Castora event starts soon.</p><p><a href="${join.toString()}">Join event</a></p>`})});
    if(mailed.ok)await fetch(base+`/rest/v1/castora_invites?id=eq.${x.id}`,{method:'PATCH',headers:{...h,Prefer:'return=minimal'},body:JSON.stringify({reminder_sent:true})});
  }
  return new Response('ok');
};
export const config={schedule:'*/5 * * * *'};
