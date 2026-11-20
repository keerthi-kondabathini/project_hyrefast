require('dotenv').config({path:'.env.test'});
const {request}=require('@playwright/test');
(async()=>{
 const base='https://staging-api.hyrefast.ai/client/';
 const anon=await request.newContext({baseURL:base,extraHTTPHeaders:{'Content-Type':'application/json'}});
 const login=await anon.post('auth/send_otp_2fa',{data:{username:process.env.USER_EMAIL,password:process.env.USER_PASSWORD}});const lb=await login.json();
 const api=await request.newContext({baseURL:base,extraHTTPHeaders:{'Content-Type':'application/json',Authorization:`Bearer ${lb.data.token}`}});
 const me=(await(await api.get('api/v1/user/me')).json()).data;
 const ws=(await(await api.post('api/v1/workspace/list',{data:{query:{_id:me.workspace},options:{populate:[{path:'default_company'}]}}})).json()).data?.data?.[0];
 const comp=ws?.default_company;const companyId=typeof comp==='string'?comp:(comp?.id||comp?._id);const name=`API_Template_${Date.now()}`;let templateId;
 try{
  const res=await api.post('api/v1/reports/templates',{data:{companyId,name,setDefault:false,columns:[{header:'email',field:'candidate.email',category:'Candidate'}]}});const body=await res.json().catch(()=>({}));
  const t=body?.data?.template||body?.data;templateId=t?.id||t?._id;
  if(res.ok()&&!templateId){const list=await api.get(`api/v1/reports/templates?companyId=${encodeURIComponent(companyId)}`);const all=await list.json().catch(()=>({}));const stack=[all];while(stack.length&&!templateId){const item=stack.pop();if(Array.isArray(item))stack.push(...item);else if(item&&typeof item==='object'){if(item.name===name)templateId=item.id||item._id;else stack.push(...Object.values(item));}}}
  console.log(JSON.stringify({status:res.status(),message:body?.message,keys:Object.keys(body||{}),dataKeys:body?.data&&typeof body.data==='object'?Object.keys(body.data).sort():[],foundId:Boolean(templateId)}));
  if(templateId){const del=await api.delete(`api/v1/reports/templates/${templateId}`);console.log(JSON.stringify({deleteStatus:del.status(),deleteOk:del.ok()}));}
 }finally{if(templateId&&!name)console.log('cleanup check');await api.dispose();await anon.dispose();}
})().catch(e=>{console.error(e.message);process.exit(1)});
