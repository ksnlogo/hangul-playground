import fs from 'node:fs';
import vm from 'node:vm';

const curriculumSource=fs.readFileSync(new URL('./curriculum.js',import.meta.url),'utf8');
const appSource=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');

function assert(condition,message){
  if(!condition) throw new Error(message);
}

function createClassList(){
  const values=new Set();
  return {
    add(...names){names.forEach(name=>values.add(name));},
    remove(...names){names.forEach(name=>values.delete(name));},
    toggle(name,force){
      const next=force===undefined?!values.has(name):Boolean(force);
      if(next) values.add(name); else values.delete(name);
      return next;
    },
    contains(name){return values.has(name);}
  };
}

function createContext2d(){
  return {
    setTransform(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},
    lineCap:'round',lineJoin:'round',globalCompositeOperation:'source-over',strokeStyle:'#000',fillStyle:'#000',lineWidth:1
  };
}

function createElement(tagName='div',id=''){
  const listeners={};
  const context=createContext2d();
  return {
    id,tagName:tagName.toUpperCase(),hidden:false,disabled:false,textContent:'',innerHTML:'',className:'',
    style:{},dataset:{},children:[],classList:createClassList(),width:0,height:0,
    appendChild(child){this.children.push(child);return child;},
    setAttribute(name,value){this[name]=String(value);},
    addEventListener(type,handler){(listeners[type] ||= []).push(handler);},
    getContext(){return context;},
    getBoundingClientRect(){return {x:0,y:0,left:0,top:0,width:694,height:414};},
    setPointerCapture(pointerId){this.capturedPointerId=pointerId;},
    hasPointerCapture(pointerId){return this.capturedPointerId===pointerId;},
    releasePointerCapture(pointerId){if(this.capturedPointerId===pointerId)this.capturedPointerId=null;},
    _listeners:listeners
  };
}

function createHarness(storageSeed={}){
  const elements=new Map();
  const storage=new Map(Object.entries(storageSeed));
  const document={
    getElementById(id){
      if(!elements.has(id)) elements.set(id,createElement(id==='writingCanvas'?'canvas':'div',id));
      return elements.get(id);
    },
    createElement(tagName){return createElement(tagName);},
    querySelectorAll(){return [];}
  };
  const localStorage={
    getItem(key){return storage.has(key)?storage.get(key):null;},
    setItem(key,value){storage.set(key,String(value));},
    removeItem(key){storage.delete(key);}
  };
  const sandbox={
    console,document,localStorage,navigator:{},location:{protocol:'file:',search:''},
    URLSearchParams,Date,Math,JSON,Map,Set,WeakMap,Array,Object,String,Number,Boolean,RegExp,
    Uint32Array,Error,Promise,parseInt,parseFloat,isNaN,Infinity,NaN,
    setTimeout,clearTimeout,requestAnimationFrame(callback){callback();return 1;},
    cancelAnimationFrame(){},devicePixelRatio:1,
    SpeechSynthesisUtterance:function(text){this.text=text;},
    speechSynthesis:{cancel(){},speak(){}},
    addEventListener(){},crypto:globalThis.crypto
  };
  sandbox.window=sandbox;
  sandbox.globalThis=sandbox;
  const context=vm.createContext(sandbox);
  vm.runInContext(curriculumSource,context,{filename:'curriculum.js'});
  vm.runInContext(appSource,context,{filename:'app.js'});
  return {context,elements,storage};
}

function evaluate(harness,source){
  return vm.runInContext(source,harness.context);
}

const base=createHarness();
const validation=evaluate(base,'validateCurriculumData()');
assert(validation.valid,'curriculum validator failed: '+validation.issues.join('\n'));

const placement=evaluate(base,`(()=>{
  const test=CURRICULUM.levelTests.younger;
  return {
    id:test.id,
    stageIds:test.stages.map(stage=>stage.id),
    bankSizes:test.stages.map(stage=>stage.questionBank.length),
    badKnownAnswers:test.stages.flatMap(stage=>stage.questionBank).filter(question=>
      (question.targetWord==='토끼' && question.answerWord==='코') ||
      (question.targetWord==='책' && question.answerWord==='자동차') ||
      (question.targetWord==='로봇' && question.answerWord==='다리')
    ).length
  };
})()`);
assert(placement.id==='jaeyoon-placement-v6','Jaeyoon placement test id was not bumped.');
assert(placement.stageIds.join('|')==='picture-to-word|sound-to-word|sound-to-first-syllable|same-initial-sound','Jaeyoon placement stage order is wrong.');
assert(placement.bankSizes.every(size=>size>=8 && size<=12),'Jaeyoon placement bank size is outside 8-12.');
assert(placement.badKnownAnswers===0,'Known incorrect same-initial answers remain.');

const placementRandom=evaluate(base,`(()=>{
  const profile=emptyProfile('younger');
  const test=CURRICULUM.levelTests.younger;
  const first=createPlacementAttempt(test,profile);
  profile.placement.attempts.push(first);
  const second=createPlacementAttempt(test,profile);
  const stageId=test.stages[0].id;
  const resumed=normalizeAttempt(clone(first),'younger');
  return {
    firstIds:first.selectedQuestionIds[stageId],
    secondIds:second.selectedQuestionIds[stageId],
    firstChoiceOrders:first.choiceOrders,
    secondChoiceOrders:second.choiceOrders,
    resumedIds:resumed.selectedQuestionIds[stageId],
    resumedChoiceOrders:resumed.choiceOrders
  };
})()`);
assert(placementRandom.firstIds.join('|')!==placementRandom.secondIds.join('|'),'new placement attempt reused the same question selection.');
assert(placementRandom.firstIds.join('|')===placementRandom.resumedIds.join('|'),'placement resume changed selected questions.');
assert(JSON.stringify(placementRandom.firstChoiceOrders)===JSON.stringify(placementRandom.resumedChoiceOrders),'placement resume changed choice order.');

const learning=evaluate(base,`(()=>{
  const supports=['picture-first','sound-link','initial-intro','initial-ready'];
  const course=courseFor('younger');
  const rows=[];
  course.weeks.forEach(week=>week.sessions.forEach(session=>supports.forEach(support=>{
    const items=buildYoungerItems(week,session,false,support,0);
    rows.push({
      week:week.number,support,count:items.length,
      skills:items.map(item=>item.skillId),
      writing:items.filter(item=>item.type==='drawing').map(item=>item.writingTarget)
    });
  })));
  return rows;
})()`);
assert(learning.every(row=>row.count===8 && row.writing.length===1),'Jaeyoon session must have 8 activities and one writing activity.');
assert(learning.every(row=>!row.skills.some(skill=>/sentence|combine|different-letter|same-letter/.test(skill))),'Jaeyoon contains forbidden sentence/composition/visual-match activities.');
assert(learning.filter(row=>row.week<=2).every(row=>row.writing.every(target=>Array.from(target).length===1)),'Weeks 1-2 writing is not one large consonant.');
assert(learning.filter(row=>row.week>=7).every(row=>row.writing.every(target=>Array.from(target).length===2)),'Weeks 7-8 writing is not a familiar two-syllable word.');
const supportSignatures=['picture-first','sound-link','initial-intro','initial-ready'].map(support=>
  learning.find(row=>row.week===6 && row.support===support).skills.join('|')
);
assert(new Set(supportSignatures).size===4,'supportLevel does not change the Week 6 activity composition.');
assert(learning.some(row=>row.week>=5 && row.skills.includes('word-completion')),'Weeks 5-8 lack word completion.');
assert(learning.some(row=>row.week>=7 && row.skills.includes('first-syllable-category')),'Weeks 7-8 lack first-syllable categorization.');

const taeyoon=evaluate(base,`(()=>courseFor('older').weeks.flatMap(week=>week.sessions.map(session=>{
  const items=buildTaeyoonItems(week,session,false,0);
  return {count:items.length,writings:items.filter(item=>item.type==='drawing').length};
})))()`);
assert(taeyoon.every(row=>row.count>=10 && row.writings===2),'Taeyoon activity or two-writing structure regressed.');

const canvas=evaluate(base,`(()=>{
  openDrawingDiagnostic('모자','younger');
  const element=document.getElementById('writingCanvas');
  const event=(type,pointerId,x,y,coalesced=[])=>({
    type,pointerId,clientX:x,clientY:y,currentTarget:element,isPrimary:true,preventDefault(){},
    getCoalescedEvents(){return coalesced;}
  });
  beginDrawing(event('pointerdown',1,40,50));
  const afterDown=drawingDiagnostics();
  moveDrawing(event('pointermove',1,130,150,[
    {clientX:70,clientY:85},{clientX:100,clientY:115},{clientX:130,clientY:150}
  ]));
  const afterMove=drawingDiagnostics();
  endDrawing(event('pointerup',1,130,150));
  const afterFirst=drawingDiagnostics();
  beginDrawing(event('pointerdown',2,220,60));
  moveDrawing(event('pointermove',2,310,165,[
    {clientX:250,clientY:95},{clientX:280,clientY:130},{clientX:310,clientY:165}
  ]));
  endDrawing(event('pointerup',2,310,165));
  const afterSecond=drawingDiagnostics();
  return {afterDown,afterMove,afterFirst,afterSecond};
})()`);
assert(canvas.afterDown.drawing,'pointerdown did not activate drawing.');
assert(canvas.afterMove.inkDistance>0 && canvas.afterMove.segmentCount>=3,'coalesced pointermove did not add ink segments.');
assert(canvas.afterFirst.strokeCount===1,'first completed stroke was not counted.');
assert(canvas.afterSecond.strokeCount===2 && canvas.afterSecond.checks.multipleStrokesPreserved,'multiple strokes were reset or lost.');
assert(canvas.afterSecond.checks.canvasRectNonZero,'Canvas bounding rect is zero.');
assert(canvas.afterSecond.metricsReady,'two-syllable Jaeyoon writing did not meet the gentle completion threshold after two full strokes.');

const invalidV05={version:5,children:{older:{},younger:{}}};
const v04={version:4,children:{older:{stars:17,completedLessons:2,records:{}},younger:{stars:9,completedLessons:1,records:{}}}};
const migration=createHarness({
  hangulPlaygroundV05:JSON.stringify(invalidV05),
  hangulPlaygroundV04:JSON.stringify(v04)
});
const migrated=JSON.parse(migration.storage.get('hangulPlaygroundV05'));
assert(migrated.children.older.stars===17 && migrated.children.older.legacyStars===17,'damaged V05 did not fall back to V04 older stars.');
assert(migrated.children.younger.stars===9 && migrated.children.younger.legacyStars===9,'damaged V05 did not fall back to V04 younger stars.');

const validProfile=(stars,legacyStars,courseId='jaeyoon-play-v1')=>({
  courseId,stars,legacyStars,
  placement:{status:'pending',testVersion:null,activeAttempt:null,result:null,attempts:[]},
  progress:{startWeek:null,currentWeek:null,currentSession:1,completedSessions:{},weeklyReviews:{},placedWeeks:[],courseCompleted:false},
  curriculumHistory:[],progressMigration:null,
  legacyV04:{completedLessons:0,records:{},weeklyReview:{completed:false,bestStars:0,completedAt:null}}
});
const protectedStars=createHarness({hangulPlaygroundV05:JSON.stringify({
  version:5,curriculumRevision:'0.5-D.1',migration:{sourceVersion:4},children:{
    older:validProfile('broken',13,'taeyoon-reading-v2'),younger:validProfile('broken',7)
  }
})});
const protectedData=JSON.parse(protectedStars.storage.get('hangulPlaygroundV05'));
assert(protectedData.children.older.stars===13 && protectedData.children.younger.stars===7,'legacyStars baseline decreased.');

const resumeData={version:5,curriculumRevision:'0.5-D.1',migration:{sourceVersion:5},children:{
  older:validProfile(3,3,'taeyoon-reading-v2'),younger:validProfile(4,4)
}};
resumeData.children.younger.placement={
  status:'in-progress',testVersion:'jaeyoon-placement-v5',result:null,attempts:[],
  activeAttempt:{id:'old',testId:'jaeyoon-placement-v5',seed:1,stageIndex:0,questionIndex:0,answers:[],selectedQuestionIds:{},choiceOrders:{}}
};
const oldResume=createHarness({hangulPlaygroundV05:JSON.stringify(resumeData)});
const normalizedResume=JSON.parse(oldResume.storage.get('hangulPlaygroundV05'));
assert(normalizedResume.children.younger.placement.status==='pending' && normalizedResume.children.younger.placement.activeAttempt===null,'old in-progress placement was not safely restarted.');

const completedPlacementData={version:5,curriculumRevision:'0.5-D.1',migration:{sourceVersion:5},children:{
  older:validProfile(3,3,'taeyoon-reading-v2'),younger:validProfile(12,12)
}};
completedPlacementData.children.younger.placement={
  status:'completed',testVersion:'jaeyoon-placement-v5',activeAttempt:null,attempts:[],
  result:{kind:'test',testId:'jaeyoon-placement-v5',completedAt:'2026-01-01T00:00:00.000Z',startWeek:1,supportLevel:'initial-ready',failedStageId:null,allPassed:true,stageScores:[]}
};
completedPlacementData.children.younger.progress={
  startWeek:1,currentWeek:6,currentSession:4,placedWeeks:[],courseCompleted:false,
  completedSessions:{'jaeyoon-play-v1:week-6:session-1':{completed:true,bestStars:5,completedAt:'2026-01-02T00:00:00.000Z',attempts:1}},
  weeklyReviews:{}
};
const completedPlacement=createHarness({hangulPlaygroundV05:JSON.stringify(completedPlacementData)});
const completedNormalized=JSON.parse(completedPlacement.storage.get('hangulPlaygroundV05'));
assert(completedNormalized.children.younger.placement.status==='completed','completed old placement result was deleted.');
assert(completedNormalized.children.younger.placement.result.supportLevel==='initial-ready','completed old placement supportLevel changed.');
assert(completedNormalized.children.younger.progress.currentWeek===6 && completedNormalized.children.younger.progress.currentSession===4,'existing Jaeyoon progress was reset.');
assert(completedNormalized.children.younger.stars===12,'existing Jaeyoon stars decreased.');

const duplicateStars=evaluate(base,`(()=>{
  const profile=emptyProfile('younger');
  profile.stars=5;profile.legacyStars=5;
  state.child='younger';state.mode='lesson';state.weekNumber=1;state.sessionNumber=1;
  state.activityId=sessionActivityId('younger',1,1);state.stars=3;
  const first=recordCurrentActivity(profile);
  state.stars=3;
  const second=recordCurrentActivity(profile);
  return {stars:profile.stars,firstAward:first.awarded,secondAward:second.awarded};
})()`);
assert(duplicateStars.stars===8 && duplicateStars.firstAward===3 && duplicateStars.secondAward===0,'duplicate-star prevention regressed.');

console.log(JSON.stringify({
  valid:true,
  placement,
  placementRandom:{firstIds:placementRandom.firstIds,secondIds:placementRandom.secondIds,resumeStable:true},
  learningRows:learning.length,
  supportSignatures,
  canvas:{
    coalescedSegments:canvas.afterMove.segmentCount,
    firstStroke:canvas.afterFirst.strokeCount,
    secondStroke:canvas.afterSecond.strokeCount,
    metricsReady:canvas.afterSecond.metricsReady
  },
  migration:{olderStars:migrated.children.older.stars,youngerStars:migrated.children.younger.stars},
  duplicateStars
},null,2));
