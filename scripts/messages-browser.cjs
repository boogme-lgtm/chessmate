// Run after building. All data is synthetic; external requests are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'dist/public');
const out = path.resolve(process.argv[2] || path.join(root, '../messages-browser-evidence'));
const longTitle = 'LongClassTitle'.repeat(19).slice(0,255);
const base = { coachId:42, coachName:'Synthetic Coach A', studentId:1, studentName:'Synthetic Student A', scheduledAt:'2026-09-30T12:00:00Z', durationMinutes:60, amountCents:5000, status:'completed', topic:null };
const initial = [
  ...Array.from({length:12},(_,i)=>({...base,id:101+i,topic:i===0?'Endgame practice':i===1?longTitle:null,status:i===1?'cancelled':'completed', unread:i===0?2:0})),
  {...base,id:201,coachId:99,coachName:'Synthetic Coach B',topic:'Tactics',unread:3},
  {...base,id:202,status:'subscription_dm',topic:'Subscription',unread:1},
  {...base,id:301,studentId:2,studentName:'Synthetic Student B',topic:'Second student class',unread:0},
];
const older = {...base,id:2,coachId:88,coachName:'Synthetic Older Coach',topic:'Older class',unread:4};
const material = '[Event "Synthetic"]\n\n1. e4 e5 2. Nf3 Nc6 *';
const messages = [{id:1,lessonId:101,senderId:42,content:'Practice these endgames',contentType:'text',createdAt:'2026-09-30T12:01:00Z'}, {id:2,lessonId:101,senderId:42,content:material,contentType:'pgn',createdAt:'2026-09-30T12:02:00Z'}];
const error = message => ({error:{json:{message,code:-32603,data:{code:'INTERNAL_SERVER_ERROR',httpStatus:500}}}});
async function main(){
 await fs.mkdir(out,{recursive:true});
 const server=http.createServer(async(req,res)=>{
  try {const url=new URL(req.url,'http://localhost');const file=path.resolve(publicDir,'.'+decodeURIComponent(url.pathname)); assert.ok(file.startsWith(publicDir+path.sep));const actual=path.extname(file)?file:path.join(publicDir,'index.html');const bytes=await fs.readFile(actual);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(actual)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://localhost:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
 const evidence={browser:await browser.version(),fixture:'Synthetic data only, external requests blocked',results:[]};
 try{
 for(const role of ['student','coach']) for(const width of [320,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  let lessons=structuredClone(initial),failTitle=false,failThread=false,holdSave,releaseSave;
  const calls=[],edits=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==origin)return route.abort('blockedbyclient');
   if(!url.pathname.startsWith('/api/trpc/'))return route.continue();
   const names=url.pathname.slice('/api/trpc/'.length).split(',');
   const input=JSON.parse(req.method()==='GET'?url.searchParams.get('input')||'{}':req.postData()||'{}');
   calls.push(...names);
   const body=names.map((name,i)=>{
    const arg=input[i]?.json||{};let value=[];
    if(name==='auth.me')value={id:role==='student'?1:42,name:'Synthetic Viewer',userType:role,role:'user',email:'synthetic@example.invalid'};
    if(name==='lesson.myLessons')value=lessons.filter(l=>l.studentId===1).slice(0,10);
    if(name==='lesson.coachLessons')value=lessons.filter(l=>l.coachId===42).slice(0,5);
    if(name==='messages.getClasses')value={items:arg.cursor?[older]:lessons.filter(l=>role==='student'?l.studentId===1:l.coachId===42),nextCursor:role==='student'&&!arg.cursor?{scheduledAt:'2026-09-01T12:00:00Z',id:50}:undefined};
    if(name==='messages.getSummaries')value=lessons.filter(l=>arg.lessonIds?.includes(l.id)).map(l=>({lessonId:l.id,topic:l.topic,messageCount:l.id===101?2:0,materialCount:l.id===101?1:0,latestContentType:l.id===101?'pgn':null,latestContent:l.id===101?material:null}));
    if(name==='messages.getPreviewForLesson')value=arg.lessonId===101?messages:[];
    if(name==='messages.getForLesson'){if(failThread)return error('Synthetic thread load failure');value=arg.lessonId===101?messages:[];lessons=lessons.map(l=>l.id===arg.lessonId?{...l,unread:0}:l);}
    if(name==='messages.getUnreadCounts')value=Object.fromEntries(lessons.map(l=>[l.id,l.unread]));
    if(name==='messages.setClassTitle'){
     edits.push(arg);if(failTitle)return error('Synthetic title save failure');
     lessons=lessons.map(l=>l.id===arg.lessonId?{...l,topic:arg.title.trim()}:l);value={success:true};
    }
    if(name==='notifications.unreadCount')value=0;
    if(name==='coach.getEarnings')value={stripeOnboarded:true};
    if(name==='student.getProfile')value=null;
    return {result:{data:{json:value}}};
   });
   if(names.includes('messages.setClassTitle')&&holdSave)await holdSave;
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  try{
   await page.goto(origin+'/dashboard');
   const module=page.locator(role==='student'?'section#messages':'section#inbox');
   const groupName=role==='student'?'Synthetic Coach A':'Synthetic Student A';
   const group=()=>module.getByRole('button',{name:new RegExp(groupName)});
   await group().waitFor();assert.ok((await group().textContent()).includes('3 unread'),'Coach aggregate includes class and direct-chat unread');
   assert.ok(!calls.includes('messages.getForLesson'),'Browsing groups must not mark read');
   await group().focus();await page.keyboard.press('Enter');
   const back=module.getByRole('button',{name:role==='student'?'Back to coaches':'Back to students'});
   await back.waitFor();assert.equal(await back.evaluate(el=>el===document.activeElement),true,'Focus moves into group');
   await module.getByRole('button',{name:/Class #112/}).waitFor();assert.equal(await module.getByText('2 unread',{exact:true}).count(),1,'Browsing preserves class unread');
   assert.equal(await module.getByText('No correspondence',{exact:true}).count(),12,'All empty classes visible');
   assert.equal(await module.getByText(longTitle,{exact:true}).count(),1,'Long cancelled class retained');
   assert.equal(await module.getByText('Direct chat',{exact:true}).count(),1);
   const geom=await module.evaluate(el=>{const r=el.getBoundingClientRect();return {width:innerWidth,document:document.documentElement.scrollWidth,moduleRight:r.right,moduleScroll:el.scrollWidth,moduleClient:el.clientWidth};});
   assert.ok(geom.moduleRight<=width+1&&geom.moduleScroll<=geom.moduleClient+1,'Messaging fits mobile viewport');await module.screenshot({path:path.join(out,`${role}-${width}-classes.png`)});
   assert.equal(await module.getByRole('button',{name:'Edit class title'}).count(),role==='coach'?12:0,'Student cannot mutate title');
   if(role==='coach'){
    const edit=module.getByRole('button',{name:'Edit class title'}).first();await edit.click();
    const title=module.getByLabel('Class title (255 characters maximum)').first();
    await title.fill('Cancelled local draft');await module.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(edits.length,0);assert.equal(await edit.evaluate(el=>el===document.activeElement),true,'Cancel restores edit focus');
    await edit.click();await title.fill('Escape draft');await title.press('Escape');assert.equal(edits.length,0);
    failTitle=true;await edit.click();await title.fill('Retry title');await module.getByRole('button',{name:'Save',exact:true}).click();
    await page.getByText('Synthetic title save failure',{exact:true}).waitFor();assert.equal(await title.inputValue(),'Retry title');
    failTitle=false;holdSave=new Promise(r=>releaseSave=r);await module.getByRole('button',{name:'Save',exact:true}).click();
    await module.getByRole('button',{name:/Saving/}).waitFor();assert.equal(await module.getByRole('button',{name:'Cancel',exact:true}).isDisabled(),true);
    releaseSave();holdSave=null;await module.getByRole('button',{name:/Retry title/}).waitFor();
    assert.equal(await edit.evaluate(el=>el===document.activeElement),true,'Save restores edit focus');
    assert.deepEqual(edits.map(e=>e.lessonId),[101,101]);
    await edit.click();await title.fill('Late title');holdSave=new Promise(r=>releaseSave=r);
    await module.getByRole('button',{name:'Save',exact:true}).click();await module.getByRole('button',{name:/Saving/}).waitFor();
    await back.click();await module.getByRole('button',{name:/Synthetic Student B/}).click();
    await module.getByRole('button',{name:/Second student class/}).waitFor();releaseSave();holdSave=null;
    await page.getByText('Class title saved',{exact:true}).last().waitFor();
    assert.equal(await module.getByText('Late title',{exact:true}).count(),0,'Late save cannot rename another class');
    await back.click();await group().click();await module.getByRole('button',{name:/Late title/}).waitFor();
    assert.deepEqual(edits.map(e=>e.lessonId),[101,101,101]);
   }
   await module.getByRole('button',{name:role==='coach'?/Late title/:/Endgame practice/}).click();
   const dialog=page.getByRole('dialog');await dialog.getByText('Practice these endgames',{exact:true}).waitFor();await module.getByText('2 unread',{exact:true}).waitFor({state:'hidden'});
   assert.equal(await dialog.getByText('PGN',{exact:true}).count()>=1,true,'Associated PGN material preserved');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   failThread=true;await module.getByRole('button',{name:/Class #103/}).click();await dialog.getByText('Could not load messages.').waitFor();failThread=false;await dialog.getByRole('button',{name:'Retry',exact:true}).click();await dialog.getByText('No messages yet. Start the conversation.').waitFor();
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   await back.click();assert.ok((await group().textContent()).includes('1 unread'),'Read-on-open updates coach aggregate');assert.equal(await group().evaluate(el=>el===document.activeElement),true,'Back restores coach focus');
   if(role==='student'){
    await module.getByRole('button',{name:'Load older classes'}).click();await module.getByRole('button',{name:/Synthetic Older Coach/}).waitFor();
    await module.getByRole('button',{name:/Synthetic Coach B/}).click();await module.getByRole('button',{name:/Tactics/}).waitFor();assert.equal(await module.getByText('Endgame practice',{exact:true}).count(),0);
   }
   assert.deepEqual(errors,[],'No browser runtime errors');
   await module.screenshot({path:path.join(out,`${role}-${width}.png`)});
   evidence.results.push({role,width,geometry:geom,calls,edits,checks:'multiple participants/classes, older history, cancelled/long titles, empty threads, messages/PGN, unread read-on-open, keyboard group/back/dialog, student edit absence, coach cancel/Escape/failure/pending/save'});
  }finally{if(releaseSave)releaseSave();await page.close();}
 }
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify(evidence,null,2));console.log(`Passed ${evidence.results.length} browser scenarios; evidence: ${out}`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
