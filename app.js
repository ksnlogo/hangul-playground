'use strict';

const CURRICULUM=window.HANGUL_CURRICULUM;
const weekLetters=['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ'];
const letterSpeech=CURRICULUM.letterSpeech;

let state={
  child:null,
  items:[],
  index:0,
  stars:0,
  answered:false,
  mode:'lesson',
  weekNumber:null,
  sessionNumber:null,
  activityId:null,
  replay:false
};

let placementUi={waiting:false,finished:false};
let drawingUi={
  tool:'pen',drawing:false,lastPoint:null,inkDistance:0,activeItemId:null
};

const STORAGE_KEY='hangulPlaygroundV05';
const V04_STORAGE_KEY='hangulPlaygroundV04';
const V02_STORAGE_KEY='hangulPlaygroundV02';

function clone(data){ return JSON.parse(JSON.stringify(data)); }
function safeCount(value,max=Number.MAX_SAFE_INTEGER){
  const number=Number(value);
  return Number.isFinite(number)?Math.min(max,Math.max(0,Math.floor(number))):0;
}
function safeString(value,fallback=''){
  return typeof value==='string'?value:fallback;
}
function safeObject(value,fallback=null){
  if(!value || typeof value!=='object' || Array.isArray(value)) return fallback;
  try{return clone(value);}catch(error){return fallback;}
}
function isPlainObject(value){
  return Boolean(value) && typeof value==='object' && !Array.isArray(value);
}
function hasValidV05Core(data){
  if(!isPlainObject(data) || data.version!==5 || !isPlainObject(data.children)) return false;
  return ['older','younger'].every(child=>{
    const profile=data.children[child];
    return isPlainObject(profile) &&
      isPlainObject(profile.placement) &&
      isPlainObject(profile.progress) &&
      isPlainObject(profile.legacyV04);
  });
}
function hasValidV04Core(data){
  return isPlainObject(data) && data.version===4 && isPlainObject(data.children) &&
    isPlainObject(data.children.older) && isPlainObject(data.children.younger);
}
function hasValidV02Core(data){
  return isPlainObject(data) && isPlainObject(data.older) && isPlainObject(data.younger);
}
function courseIdFor(child){ return CURRICULUM.courses[child].id; }
function childName(child){ return child==='older'?'태윤':'재윤'; }

function emptyLegacyProfile(){
  return {
    completedLessons:0,
    records:{},
    weeklyReview:{completed:false,bestStars:0,completedAt:null}
  };
}
function emptyPlacement(){
  return {
    status:'pending',
    testVersion:null,
    activeAttempt:null,
    result:null,
    attempts:[]
  };
}
function emptyProgress(){
  return {
    startWeek:null,
    currentWeek:null,
    currentSession:1,
    completedSessions:{},
    weeklyReviews:{},
    placedWeeks:[],
    courseCompleted:false
  };
}
function emptyProfile(child){
  return {
    courseId:courseIdFor(child),
    stars:0,
    legacyStars:0,
    placement:emptyPlacement(),
    progress:emptyProgress(),
    legacyV04:emptyLegacyProfile()
  };
}
function createDefaultData(sourceVersion='fresh'){
  return {
    version:5,
    updatedAt:new Date().toISOString(),
    migration:{sourceVersion,migratedAt:new Date().toISOString()},
    children:{older:emptyProfile('older'),younger:emptyProfile('younger')}
  };
}
function normalizeRecord(record){
  if(!record || typeof record!=='object') return null;
  return {
    completed:Boolean(record.completed),
    bestStars:safeCount(record.bestStars),
    completedAt:typeof record.completedAt==='string'?record.completedAt:null
  };
}
function normalizeLearningRecord(record){
  const clean=normalizeRecord(record);
  if(!clean) return null;
  clean.attempts=Math.max(1,safeCount(record.attempts));
  return clean;
}
function normalizeLegacyProfile(profile){
  const clean=emptyLegacyProfile();
  if(!profile || typeof profile!=='object') return clean;
  clean.completedLessons=safeCount(profile.completedLessons,weekLetters.length);
  if(profile.records && typeof profile.records==='object'){
    weekLetters.forEach((letter,index)=>{
      const key='lesson-'+index;
      const record=normalizeRecord(profile.records[key]);
      if(record){
        clean.records[key]=record;
        if(record.completed) clean.completedLessons=Math.max(clean.completedLessons,index+1);
      }
    });
  }
  const review=normalizeRecord(profile.weeklyReview);
  if(review) clean.weeklyReview=review;
  return clean;
}
function normalizeAnswer(answer){
  if(!answer || typeof answer!=='object') return null;
  const questionId=safeString(answer.questionId);
  const stageId=safeString(answer.stageId);
  if(!questionId || !stageId) return null;
  return {
    questionId,
    stageId,
    selectedId:safeString(answer.selectedId),
    correct:Boolean(answer.correct),
    answeredAt:typeof answer.answeredAt==='string'?answer.answeredAt:null
  };
}
function normalizeAttempt(attempt,child){
  if(!attempt || typeof attempt!=='object') return null;
  const test=CURRICULUM.levelTests[child];
  if(attempt.testId!==test.id) return null;
  const stageIndex=safeCount(attempt.stageIndex,test.stages.length-1);
  const stage=test.stages[stageIndex];
  const questionIndex=safeCount(attempt.questionIndex,stage.questions.length-1);
  const answers=Array.isArray(attempt.answers)
    ? attempt.answers.map(normalizeAnswer).filter(Boolean).slice(0,test.maxQuestions)
    : [];
  return {
    id:safeString(attempt.id,test.id+'-resume'),
    testId:test.id,
    startedAt:typeof attempt.startedAt==='string'?attempt.startedAt:new Date().toISOString(),
    stageIndex,
    questionIndex,
    answers
  };
}
function normalizePlacementResult(result,child){
  if(!isPlainObject(result)) return null;
  const kind=result.kind==='skipped'?'skipped':'test';
  const startWeek=child==='older'
    ? (result.allPassed?8:([1,4,6,7,8].includes(Number(result.startWeek))?Number(result.startWeek):1))
    : 1;
  const allowedSupportLevels=['picture-first','sound-link','initial-intro','initial-ready'];
  const supportLevel=child==='younger'
    ? (allowedSupportLevels.includes(result.supportLevel)?result.supportLevel:'picture-first')
    : null;
  const diagnostic=result.advancedDiagnostics && result.advancedDiagnostics.finalConsonant;
  const finalConsonant=child==='older' && isPlainObject(diagnostic)
    ? {
        correct:safeCount(diagnostic.correct,3),
        asked:safeCount(diagnostic.asked,3),
        passed:Boolean(diagnostic.passed)
      }
    : null;
  return {
    kind,
    testId:typeof result.testId==='string'?result.testId:null,
    completedAt:typeof result.completedAt==='string'?result.completedAt:null,
    startedAt:typeof result.startedAt==='string'?result.startedAt:null,
    startWeek,
    supportLevel,
    failedStageId:typeof result.failedStageId==='string'?result.failedStageId:null,
    allPassed:Boolean(result.allPassed),
    stageScores:Array.isArray(result.stageScores)
      ? result.stageScores.map(value=>safeObject(value)).filter(Boolean).slice(0,CURRICULUM.levelTests[child].stages.length)
      : [],
    advancedDiagnostics:{finalConsonant}
  };
}
function normalizePlacement(placement,child){
  const clean=emptyPlacement();
  if(!placement || typeof placement!=='object') return clean;
  const currentTestId=CURRICULUM.levelTests[child].id;
  const allowed=['pending','in-progress','completed','skipped'];
  clean.status=allowed.includes(placement.status)?placement.status:'pending';
  clean.testVersion=typeof placement.testVersion==='string'?placement.testVersion:null;
  clean.activeAttempt=normalizeAttempt(placement.activeAttempt,child);
  clean.result=normalizePlacementResult(placement.result,child);
  clean.attempts=Array.isArray(placement.attempts)
    ? placement.attempts.map(value=>safeObject(value)).filter(Boolean).slice(-5)
    : [];
  if(clean.status==='in-progress' && (clean.testVersion!==currentTestId || !clean.activeAttempt)){
    clean.status='pending';
    clean.testVersion=currentTestId;
    clean.activeAttempt=null;
  }
  if((clean.status==='completed' || clean.status==='skipped') && !clean.result) clean.status='pending';
  return clean;
}
function normalizeProgressRecords(records,courseId,kind){
  const clean={};
  if(!isPlainObject(records)) return clean;
  const pattern=kind==='review'
    ? new RegExp('^'+courseId+':week-[1-8]:review$')
    : new RegExp('^'+courseId+':week-[1-8]:session-[1-5]$');
  Object.keys(records).forEach(key=>{
    if(!pattern.test(key)) return;
    const record=normalizeLearningRecord(records[key]);
    if(record) clean[key]=record;
  });
  return clean;
}
function normalizeProgress(progress,child){
  const clean=emptyProgress();
  if(!progress || typeof progress!=='object') return clean;
  if(progress.startWeek!==null && progress.startWeek!==undefined) clean.startWeek=Math.max(1,safeCount(progress.startWeek,8));
  if(progress.currentWeek!==null && progress.currentWeek!==undefined) clean.currentWeek=Math.max(1,safeCount(progress.currentWeek,8));
  clean.currentSession=Math.max(1,safeCount(progress.currentSession,5));
  const courseId=courseIdFor(child);
  clean.completedSessions=normalizeProgressRecords(progress.completedSessions,courseId,'session');
  clean.weeklyReviews=normalizeProgressRecords(progress.weeklyReviews,courseId,'review');
  clean.placedWeeks=Array.isArray(progress.placedWeeks)
    ? [...new Set(progress.placedWeeks.map(value=>safeCount(value,8)).filter(value=>value>0))].sort((a,b)=>a-b)
    : [];
  if(clean.startWeek!==null){
    clean.placedWeeks=clean.placedWeeks.filter(weekNumber=>weekNumber<clean.startWeek);
    if(clean.currentWeek===null) clean.currentWeek=clean.startWeek;
  }
  clean.courseCompleted=Boolean(progress.courseCompleted);
  return clean;
}
function initializeProgressFromPlacement(profile,child){
  const progress=profile.progress;
  const placement=profile.placement;
  if(progress.startWeek!==null || !['completed','skipped'].includes(placement.status) || !placement.result) return;
  const startWeek=child==='older'?placement.result.startWeek:1;
  progress.startWeek=startWeek;
  progress.currentWeek=startWeek;
  progress.currentSession=1;
  progress.placedWeeks=startWeek>1
    ? Array.from({length:startWeek-1},(_,index)=>index+1)
    : [];
}
function normalizeProfile(profile,child){
  const clean=emptyProfile(child);
  if(!profile || typeof profile!=='object') return clean;
  clean.courseId=courseIdFor(child);
  clean.legacyStars=safeCount(profile.legacyStars);
  clean.stars=Math.max(safeCount(profile.stars),clean.legacyStars);
  clean.placement=normalizePlacement(profile.placement,child);
  clean.progress=normalizeProgress(profile.progress,child);
  clean.legacyV04=normalizeLegacyProfile(profile.legacyV04);
  initializeProgressFromPlacement(clean,child);
  return clean;
}
function normalizeData(data){
  const clean=createDefaultData('fresh');
  if(!data || typeof data!=='object') return clean;
  clean.updatedAt=typeof data.updatedAt==='string'?data.updatedAt:clean.updatedAt;
  if(data.migration && typeof data.migration==='object'){
    const sourceVersion=data.migration.sourceVersion;
    clean.migration={
      sourceVersion:(typeof sourceVersion==='string' || typeof sourceVersion==='number')?sourceVersion:'unknown',
      migratedAt:typeof data.migration.migratedAt==='string'?data.migration.migratedAt:clean.migration.migratedAt
    };
  }
  const children=data.children && typeof data.children==='object'?data.children:{};
  clean.children.older=normalizeProfile(children.older,'older');
  clean.children.younger=normalizeProfile(children.younger,'younger');
  return clean;
}
function migrateV04(data){
  const migrated=createDefaultData(4);
  const children=data && data.children && typeof data.children==='object'?data.children:{};
  ['older','younger'].forEach(child=>{
    const source=children[child] && typeof children[child]==='object'?children[child]:{};
    const stars=safeCount(source.stars);
    migrated.children[child].stars=stars;
    migrated.children[child].legacyStars=stars;
    migrated.children[child].legacyV04=normalizeLegacyProfile(source);
  });
  return migrated;
}
function migrateV02(data){
  const migrated=createDefaultData(2);
  ['older','younger'].forEach(child=>{
    const source=data && data[child] && typeof data[child]==='object'?data[child]:{};
    const stars=safeCount(source.stars);
    migrated.children[child].stars=stars;
    migrated.children[child].legacyStars=stars;
  });
  return migrated;
}

let memoryFallback=createDefaultData('memory');

function readJson(key){
  try{
    const raw=localStorage.getItem(key);
    return raw?JSON.parse(raw):null;
  }catch(error){return null;}
}
function store(){
  let data=null;
  const current=readJson(STORAGE_KEY);
  if(hasValidV05Core(current)) data=normalizeData(current);
  if(!data){
    const v04=readJson(V04_STORAGE_KEY);
    if(hasValidV04Core(v04)) data=migrateV04(v04);
  }
  if(!data){
    const v02=readJson(V02_STORAGE_KEY);
    if(hasValidV02Core(v02)) data=migrateV02(v02);
  }
  if(!data) data=normalizeData(memoryFallback);
  memoryFallback=clone(data);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(error){}
  return clone(data);
}
function save(data){
  const draft=clone(data);
  draft.updatedAt=new Date().toISOString();
  const clean=normalizeData(draft);
  memoryFallback=clone(clean);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(clean));}catch(error){}
}

function show(id){
  document.querySelectorAll('.screen').forEach(element=>element.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function courseFor(child){return CURRICULUM.courses[child];}
function weekFor(child,weekNumber){return courseFor(child).weeks[weekNumber-1];}
function sessionActivityId(child,weekNumber,sessionNumber){
  const course=courseFor(child);
  const week=weekFor(child,weekNumber);
  const session=week.sessions[sessionNumber-1];
  return course.id+':'+week.id+':'+session.id;
}
function reviewActivityId(child,weekNumber){
  const course=courseFor(child);
  const week=weekFor(child,weekNumber);
  return course.id+':'+week.id+':'+week.weeklyReview.id;
}
function completedSessionCount(profile,child,weekNumber){
  let count=0;
  for(let sessionNumber=1;sessionNumber<=5;sessionNumber++){
    const record=profile.progress.completedSessions[sessionActivityId(child,weekNumber,sessionNumber)];
    if(record && record.completed) count++;
  }
  return count;
}
function reviewAvailable(profile,child,weekNumber=profile.progress.currentWeek){
  if(!weekNumber) return false;
  const review=profile.progress.weeklyReviews[reviewActivityId(child,weekNumber)];
  return completedSessionCount(profile,child,weekNumber)===5 && !(review && review.completed);
}
function courseProgressText(profile,child){
  if(profile.placement.status==='pending') return '레벨테스트 전';
  if(profile.placement.status==='in-progress') return '레벨테스트 이어하기';
  if(profile.progress.courseCompleted) return '8주 과정 완료';
  const weekNumber=profile.progress.currentWeek || 1;
  const completed=completedSessionCount(profile,child,weekNumber);
  return weekNumber+'주차 · '+completed+' / 5회'+(reviewAvailable(profile,child,weekNumber)?' · 복습 가능':'');
}
function renderProgressStrip(elementId,profile,child){
  const labels=['1회','2회','3회','4회','5회','복습'];
  const weekNumber=profile.progress.currentWeek;
  const completed=weekNumber?completedSessionCount(profile,child,weekNumber):0;
  const review=weekNumber?profile.progress.weeklyReviews[reviewActivityId(child,weekNumber)]:null;
  const element=document.getElementById(elementId);
  element.innerHTML='';
  labels.forEach((label,index)=>{
    const div=document.createElement('div');
    div.className='day';
    div.textContent=label;
    if(!weekNumber){
      div.classList.add('locked');
    }else if(index<5){
      if(index<completed) div.classList.add('done');
      else if(index===completed && completed<5) div.classList.add('active');
      else div.classList.add('locked');
    }else if(review && review.completed){
      div.classList.add('done');
    }else if(completed===5){
      div.classList.add('active');
    }else{
      div.classList.add('locked');
    }
    element.appendChild(div);
  });
}
function weekState(profile,child,weekNumber){
  if(profile.progress.placedWeeks.includes(weekNumber)) return 'placed';
  const review=profile.progress.weeklyReviews[reviewActivityId(child,weekNumber)];
  if(review && review.completed) return 'done';
  if(profile.progress.currentWeek===weekNumber) return 'active';
  return 'locked';
}
function renderWeekOverview(elementId,profile,child){
  const element=document.getElementById(elementId);
  element.innerHTML='';
  courseFor(child).weeks.forEach(week=>{
    const status=weekState(profile,child,week.number);
    const button=document.createElement('button');
    button.type='button';
    button.className='week-dot '+status;
    button.textContent=week.number;
    const labels={placed:'배치로 건너뜀',done:'완료',active:'현재',locked:'잠김'};
    button.title=week.number+'주차 · '+labels[status];
    button.setAttribute('aria-label',button.title);
    const canPractice=status==='done' || status==='active';
    button.disabled=!canPractice;
    if(canPractice) button.onclick=()=>startWeekPractice(child,week.number);
    element.appendChild(button);
  });
}
function placementHomeLabel(profile,child){
  const placement=profile.placement;
  if(placement.status==='in-progress') return '레벨테스트 이어하기';
  if(placement.status==='pending') return '레벨테스트 추천';
  if(placement.status==='skipped') return '1주차부터 시작';
  const result=placement.result || {};
  if(child==='older') return result.allPassed?'문장 단계 준비됨':(result.startWeek||1)+'주차 시작';
  return supportLevelLabel(result.supportLevel)+' · 1주차';
}
function updateProgressDisplay(){
  const data=store();
  ['older','younger'].forEach(child=>{
    const profile=data.children[child];
    const prefix=child==='older'?'Older':'Younger';
    const week=profile.progress.currentWeek?weekFor(child,profile.progress.currentWeek):null;
    document.getElementById('home'+prefix+'Progress').textContent=courseProgressText(profile,child);
    document.getElementById('home'+prefix+'Week').textContent=week
      ? profile.progress.currentWeek+'주차 · '+week.title
      : '시작 전';
    renderProgressStrip(child+'ProgressStrip',profile,child);
    renderWeekOverview(child+'WeekOverview',profile,child);
  });
  document.getElementById('olderPlacementBadge').textContent=courseProgressText(data.children.older,'older');
  document.getElementById('youngerPlacementBadge').textContent=courseProgressText(data.children.younger,'younger');
  updateReviewAction();
}
function updateReviewAction(){
  const action=document.getElementById('reviewAction');
  if(!state.child){action.hidden=true;return;}
  const profile=store().children[state.child];
  const who=childName(state.child);
  if(profile.progress.courseCompleted){
    action.hidden=false;
    document.getElementById('reviewActionTitle').textContent=who+' · 8주 한글 과정 완료!';
    document.getElementById('reviewActionText').textContent='원하면 완료한 주차를 다시 연습할 수 있어요.';
    document.getElementById('reviewActionButton').textContent='8주차 다시 연습';
    return;
  }
  const weekNumber=profile.progress.currentWeek;
  if(!reviewAvailable(profile,state.child,weekNumber)){action.hidden=true;return;}
  action.hidden=false;
  document.getElementById('reviewActionTitle').textContent=who+' · '+weekNumber+'주차 주간복습 가능';
  document.getElementById('reviewActionText').textContent='5회 학습을 모두 마쳤어요. 준비되면 복습을 시작하세요.';
  document.getElementById('reviewActionButton').textContent='주간복습 시작';
}
function chooseChild(child){
  state.child=child;
  const profile=store().children[child];
  if(profile.placement.status==='pending' || profile.placement.status==='in-progress'){
    showPlacementIntro(child,profile);
    return;
  }
  startExistingCourse(profile);
}
function startExistingCourse(profile){
  const progress=profile.progress;
  if(progress.courseCompleted || reviewAvailable(profile,state.child,progress.currentWeek)){
    show('home');
    updateProgressDisplay();
    return;
  }
  startCourseSession(state.child,progress.currentWeek,progress.currentSession);
}
function startSelectedWeeklyReview(){
  if(!state.child) return;
  const profile=store().children[state.child];
  if(profile.progress.courseCompleted){
    startCourseSession(state.child,8,1,true);
    return;
  }
  if(reviewAvailable(profile,state.child,profile.progress.currentWeek)) startWeeklyReview(state.child,profile.progress.currentWeek);
}

function showPlacementIntro(child,profile){
  const isOlder=child==='older';
  const inProgress=profile.placement.status==='in-progress';
  document.getElementById('placementIntroTitle').textContent=childName(child)+' 레벨테스트';
  document.getElementById('placementIntroText').textContent=isOlder
    ? '자음부터 짧은 문장까지 차례로 확인하고, 마지막에는 받침 낱말을 심화 진단해요. 받침 결과는 기본 8주 배치에 영향을 주지 않아요.'
    : '그림과 소리를 이용한 놀이로 어떤 도움이 편한지 확인해요. 글자를 읽어야 풀 수 있는 문제는 없어요.';
  document.getElementById('placementResumeNote').hidden=!inProgress;
  document.getElementById('placementStartButton').textContent=inProgress?'이어서 하기':'레벨테스트 시작';
  show('placementIntro');
}
function startOrResumePlacement(){
  if(!state.child) return;
  const data=store();
  const profile=data.children[state.child];
  if(profile.placement.status!=='in-progress' || !profile.placement.activeAttempt){
    const test=CURRICULUM.levelTests[state.child];
    profile.placement.status='in-progress';
    profile.placement.testVersion=test.id;
    profile.placement.activeAttempt={
      id:test.id+'-'+Date.now(),
      testId:test.id,
      startedAt:new Date().toISOString(),
      stageIndex:0,
      questionIndex:0,
      answers:[]
    };
    save(data);
  }
  placementUi={waiting:false,finished:false};
  show('placementTest');
  renderPlacementQuestion();
}
function currentPlacementContext(){
  const data=store();
  const profile=data.children[state.child];
  const attempt=profile.placement.activeAttempt;
  if(!attempt) return null;
  const test=CURRICULUM.levelTests[state.child];
  const stage=test.stages[attempt.stageIndex];
  const question=stage && stage.questions[attempt.questionIndex];
  return {data,profile,attempt,test,stage,question};
}
function renderPlacementQuestion(){
  const context=currentPlacementContext();
  if(!context || !context.question){goHome();return;}
  const {attempt,test,stage,question}=context;
  placementUi.waiting=false;
  placementUi.finished=false;
  document.getElementById('placementTestTitle').textContent=test.title;
  document.getElementById('placementStage').textContent=stage.label;
  document.getElementById('placementProgressText').textContent=(attempt.answers.length+1)+' / 최대 '+test.maxQuestions;
  document.getElementById('placementProgressBar').style.width=Math.min(100,((attempt.answers.length+1)/test.maxQuestions)*100)+'%';
  document.getElementById('placementDisplay').textContent=question.display;
  document.getElementById('placementPrompt').textContent=question.prompt;
  document.getElementById('placementFeedback').textContent='';
  const nextButton=document.getElementById('placementNextButton');
  nextButton.disabled=true;
  nextButton.textContent='다음 ▶';
  const choices=document.getElementById('placementChoices');
  choices.innerHTML='';
  question.choices.forEach(option=>{
    const button=document.createElement('button');
    button.className='placement-choice';
    button.textContent=option.label;
    button.onclick=()=>answerPlacement(option.id,button);
    choices.appendChild(button);
  });
  speak(question.speech);
}
function answersForStage(attempt,stageId){
  return attempt.answers.filter(answer=>answer.stageId===stageId);
}
function stageScores(test,attempt){
  return test.stages.map(stage=>{
    const answers=answersForStage(attempt,stage.id);
    return {
      stageId:stage.id,
      label:stage.label,
      correct:answers.filter(answer=>answer.correct).length,
      asked:answers.length,
      passed:state.child==='older'
        ? answers.filter(answer=>answer.correct).length>=2
        : answers.length===3 && answers.filter(answer=>answer.correct).length>=2
    };
  }).filter(score=>score.asked>0);
}
function finishPlacement(profile,attempt,test,details){
  const now=new Date().toISOString();
  const result={
    kind:'test',
    testId:test.id,
    completedAt:now,
    startedAt:attempt.startedAt,
    startWeek:details.startWeek,
    supportLevel:details.supportLevel || null,
    failedStageId:details.failedStageId || null,
    allPassed:Boolean(details.allPassed),
    stageScores:stageScores(test,attempt),
    advancedDiagnostics:details.advancedDiagnostics || {finalConsonant:null}
  };
  profile.placement.status='completed';
  profile.placement.testVersion=test.id;
  profile.placement.result=result;
  profile.placement.activeAttempt=null;
  profile.placement.attempts.push({...clone(result),answers:clone(attempt.answers)});
  profile.placement.attempts=profile.placement.attempts.slice(-5);
  initializeProgressFromPlacement(profile,state.child);
  return result;
}
function advanceOlderPlacement(context){
  const {profile,attempt,test,stage}=context;
  const stageAnswers=answersForStage(attempt,stage.id);
  const correct=stageAnswers.filter(answer=>answer.correct).length;
  if(stageAnswers.length===1){attempt.questionIndex=1;return null;}
  if(stageAnswers.length===2 && correct===1){attempt.questionIndex=2;return null;}
  const passed=correct>=2;
  if(stage.diagnosticOnly){
    return finishPlacement(profile,attempt,test,{
      startWeek:8,
      allPassed:true,
      advancedDiagnostics:{
        finalConsonant:{correct,asked:stageAnswers.length,passed}
      }
    });
  }
  if(!passed){
    return finishPlacement(profile,attempt,test,{
      startWeek:stage.startWeek,
      failedStageId:stage.id,
      allPassed:false
    });
  }
  attempt.stageIndex++;
  attempt.questionIndex=0;
  return null;
}
function advanceYoungerPlacement(context){
  const {profile,attempt,test,stage}=context;
  const stageAnswers=answersForStage(attempt,stage.id);
  if(stageAnswers.length<3){attempt.questionIndex=stageAnswers.length;return null;}
  const passed=stageAnswers.filter(answer=>answer.correct).length>=2;
  if(!passed){
    return finishPlacement(profile,attempt,test,{
      startWeek:1,
      supportLevel:stage.supportLevelOnFail,
      failedStageId:stage.id,
      allPassed:false
    });
  }
  if(attempt.stageIndex===test.stages.length-1){
    return finishPlacement(profile,attempt,test,{
      startWeek:1,
      supportLevel:'initial-ready',
      allPassed:true
    });
  }
  attempt.stageIndex++;
  attempt.questionIndex=0;
  return null;
}
function answerPlacement(selectedId,button){
  if(placementUi.waiting) return;
  const context=currentPlacementContext();
  if(!context || !context.question) return;
  const {data,attempt,stage,question}=context;
  const correct=selectedId===question.answer;
  attempt.answers.push({
    questionId:question.id,
    stageId:stage.id,
    selectedId,
    correct,
    answeredAt:new Date().toISOString()
  });
  const result=state.child==='older'
    ? advanceOlderPlacement(context)
    : advanceYoungerPlacement(context);
  save(data);
  placementUi.waiting=true;
  placementUi.finished=Boolean(result);
  const choices=document.getElementById('placementChoices');
  [...choices.children].forEach(element=>{
    element.disabled=true;
    const option=question.choices.find(item=>item.label===element.textContent);
    if(option && option.id===question.answer) element.classList.add('correct');
  });
  if(!correct) button.classList.add('wrong');
  document.getElementById('placementFeedback').textContent=correct
    ? '🎉 잘했어요!'
    : '괜찮아요. 정답을 같이 볼까요?';
  const answerChoice=question.choices.find(option=>option.id===question.answer);
  speak(correct?'잘했어요!':'정답은 '+answerChoice.speech+'예요.');
  const nextButton=document.getElementById('placementNextButton');
  nextButton.disabled=false;
  nextButton.textContent=result?'결과 보기':'다음 ▶';
}
function nextPlacementQuestion(){
  if(!placementUi.waiting) return;
  if(placementUi.finished){
    const result=store().children[state.child].placement.result;
    showPlacementResult(result);
    return;
  }
  renderPlacementQuestion();
}
function speakPlacementCurrent(){
  const context=currentPlacementContext();
  if(context && context.question) speak(context.question.speech);
}
function skipPlacement(){
  if(!state.child) return;
  const data=store();
  const profile=data.children[state.child];
  const supportLevel=state.child==='younger'?'picture-first':null;
  const result={
    kind:'skipped',
    testId:null,
    completedAt:new Date().toISOString(),
    startWeek:1,
    supportLevel,
    failedStageId:null,
    allPassed:false,
    stageScores:[]
  };
  profile.placement.status='skipped';
  profile.placement.activeAttempt=null;
  profile.placement.result=result;
  initializeProgressFromPlacement(profile,state.child);
  save(data);
  showPlacementResult(result);
}
function supportLevelLabel(level){
  const labels={
    'picture-first':'그림 중심 도움',
    'sound-link':'그림·소리 연결 도움',
    'initial-intro':'첫 글자 천천히',
    'initial-ready':'첫 글자 놀이 준비됨'
  };
  return labels[level] || '지원 수준 확인 전';
}
function showPlacementResult(result){
  if(!result){goHome();return;}
  const skipped=result.kind==='skipped';
  document.getElementById('placementResultTitle').textContent=skipped
    ? childName(state.child)+'은 1주차부터 시작해요'
    : childName(state.child)+' 레벨테스트 완료!';
  let headline='1주차부터 시작';
  let detail='레벨테스트 없이 첫 주차부터 차근차근 시작합니다.';
  if(!skipped && state.child==='older'){
    headline=result.allPassed?'문장 단계 준비됨':result.startWeek+'주차부터 시작';
    detail=result.allPassed
      ? '모든 단계를 통과했어요. 8주차 짧은 문장 단계에서 시작합니다.'
      : '처음 통과하지 못한 단계에 맞춰 '+result.startWeek+'주차를 추천합니다.';
    const diagnostic=result.advancedDiagnostics && result.advancedDiagnostics.finalConsonant;
    if(diagnostic && diagnostic.asked){
      detail+=' 받침 낱말 심화 진단은 '+diagnostic.correct+' / '+diagnostic.asked+'개를 맞혔으며, 기본 8주 배치에는 영향을 주지 않아요.';
    }
  }else if(!skipped){
    headline=supportLevelLabel(result.supportLevel);
    detail='재윤은 테스트 결과와 관계없이 1주차부터 시작합니다.';
  }
  document.getElementById('placementResultHeadline').textContent=headline;
  document.getElementById('placementResultText').textContent=detail;
  show('placementResult');
  updateProgressDisplay();
}

const consonantOrder=['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const vowelOrder=['ㅏ','ㅑ','ㅓ','ㅕ','ㅗ','ㅛ','ㅜ','ㅠ','ㅡ','ㅣ'];
const pictureBank={
  '엄마':'👩','아빠':'👨','태윤':'👦🏻','재윤':'🧒🏻','아기':'👶','할머니':'👵','할아버지':'👴',
  '강아지':'🐶','고양이':'🐱','토끼':'🐰','사자':'🦁','원숭이':'🐵','나비':'🦋','오리':'🦆',
  '자동차':'🚗','버스':'🚌','기차':'🚂','비행기':'✈️','배':'🚢',
  '밥':'🍚','사과':'🍎','바나나':'🍌','우유':'🥛','빵':'🍞','오이':'🥒','멜론':'🍈',
  '눈':'👁️','코':'👃','입':'👄','손':'✋','발':'🦶','다리':'🦵',
  '공':'⚽','로봇':'🤖','책':'📚','가방':'🎒','모자':'👒','문':'🚪','물':'💧','달':'🌙','비누':'🧼','나무':'🌳','바다':'🌊','포도':'🍇','하마':'🦛',
  '가족':'👨‍👩‍👦','동물':'🐾','탈것':'🚙','음식':'🍽️','몸':'🙋','생활물건':'🎒','장난감':'🧸','첫 글자':'🔤'
};
const sentencePictures={
  '아기가 자요.':'👶😴','나비가 와요.':'🦋👋','기차가 가요.':'🚂💨','우유를 마셔요.':'🥛😋','사자가 와요.':'🦁👋'
};
const consonantExamples={
  'ㄱ':'기차','ㄴ':'나비','ㄷ':'다리','ㄹ':'로봇','ㅁ':'모자','ㅂ':'바나나','ㅅ':'사자',
  'ㅇ':'오리','ㅈ':'자동차','ㅊ':'책','ㅋ':'코','ㅌ':'토끼','ㅍ':'포도','ㅎ':'할머니'
};
function stableChoices(answer,pool,count){
  const unique=[answer,...pool.filter(value=>value!==answer)].filter((value,index,array)=>array.indexOf(value)===index);
  const selected=unique.slice(0,count);
  const offset=[...String(answer)].reduce((sum,char)=>sum+char.codePointAt(0),0)%selected.length;
  return selected.slice(offset).concat(selected.slice(0,offset));
}
function initialOf(word){
  const code=String(word).charCodeAt(0)-0xAC00;
  if(code<0 || code>11171) return '';
  return ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'][Math.floor(code/588)];
}
function entryFor(raw){
  const value=String(raw);
  const space=value.indexOf(' ');
  if(space>0 && /[^가-힣ㄱ-ㅎㅏ-ㅣ]/.test(value.slice(0,space))){
    const word=value.slice(space+1);
    return {word,emoji:value.slice(0,space),initial:initialOf(word)};
  }
  const word=value.replace(/[.?!]$/,'');
  return {word:value,emoji:pictureBank[word] || sentencePictures[value] || '🌱',initial:initialOf(word)};
}
function itemChoice(id,label,speech=label){return {id,label,speech};}
function learningItem(config){
  return Object.assign({
    type:'question',phase:'new',skillId:'practice',targetId:'',emoji:'',display:'',word:'',prompt:'',speech:'',choices:[],answer:null,answerSpeech:''
  },config);
}
function infoItem(config){
  return learningItem(Object.assign({type:'info',choices:[itemChoice('continue','알겠어요 👍','알겠어요')]},config));
}
function speakItem(config){
  return learningItem(Object.assign({type:'speak'},config));
}
function writingItem(target,mode,phase){
  const isTrace=mode==='trace';
  return learningItem({
    type:'drawing',phase,skillId:isTrace?'trace-writing':'copy-writing',targetId:target,
    writingTarget:target,writingMode:mode,display:'',word:isTrace?'따라쓰기':'보고쓰기',
    prompt:isTrace?'연한 글자를 따라 천천히 써보세요.':'위 글자를 보고 빈 곳에 써보세요.',
    speech:target+'. '+(isTrace?'연한 글자를 따라 써보세요.':'글자를 보고 써보세요.')
  });
}
function taeyoonConsonantItem(target,variant,phase,choiceCount=3){
  const example=entryFor(consonantExamples[target] || '기차');
  const choices=stableChoices(target,consonantOrder,choiceCount).map(value=>itemChoice(value,value,spokenLetter(value)));
  if(variant===0){
    const note=target==='ㅇ'?'이응은 첫소리가 없는 낱말의 첫 글자에도 와요.':spokenLetter(target)+'을 만나봐요.';
    return infoItem({phase,skillId:'consonant-recognize',targetId:target,display:target,word:spokenLetter(target),prompt:note,speech:spokenLetter(target)+'. '+note});
  }
  if(variant===2){
    return learningItem({phase,skillId:'initial-letter',targetId:target,emoji:example.emoji,display:'?',word:example.word,prompt:example.word+'의 첫 글자를 찾아보세요.',speech:example.word+'의 첫 글자를 찾아보세요.',choices,answer:target,answerSpeech:example.word+'의 첫 글자는 '+spokenLetter(target)+'이에요.'});
  }
  if(variant===3){
    return learningItem({phase,skillId:'same-letter',targetId:target,display:target,prompt:'화면과 같은 글자를 찾아보세요.',speech:'화면과 같은 글자를 찾아보세요.',choices,answer:target,answerSpeech:'같은 글자는 '+spokenLetter(target)+'이에요.'});
  }
  if(variant===4){
    return speakItem({phase,skillId:'read-consonant',targetId:target,display:target,word:'소리 내어 말하기',prompt:'글자 이름을 소리 내어 말해보세요.',speech:'글자 이름을 말해보세요.'});
  }
  return learningItem({phase,skillId:variant===5?'consonant-discriminate':'consonant-recognize',targetId:target,display:variant===1?'🔊':target,word:'',prompt:spokenLetter(target)+'을 찾아보세요.',speech:spokenLetter(target)+'을 찾아보세요.',choices,answer:target,answerSpeech:'정답은 '+spokenLetter(target)+'이에요.'});
}
function taeyoonVowelItem(target,variant,phase,choiceCount=3){
  const choices=stableChoices(target,vowelOrder,choiceCount).map(value=>itemChoice(value,value,spokenLetter(value)));
  if(variant===0) return infoItem({phase,skillId:'vowel-recognize',targetId:target,display:target,word:spokenLetter(target),prompt:spokenLetter(target)+' 소리의 모음을 만나봐요.',speech:spokenLetter(target)+'. 모음 '+target});
  if(variant===2) return learningItem({phase,skillId:'same-letter',targetId:target,display:target,prompt:'화면과 같은 모음을 찾아보세요.',speech:'화면과 같은 모음을 찾아보세요.',choices,answer:target,answerSpeech:'같은 모음은 '+spokenLetter(target)+'예요.'});
  if(variant===3) return learningItem({phase,skillId:'vowel-discriminate',targetId:target,display:target,prompt:'다른 모음과 구별해 찾아보세요.',speech:'화면의 모음을 찾아보세요.',choices,answer:target,answerSpeech:'정답은 '+spokenLetter(target)+'예요.'});
  if(variant===4) return speakItem({phase,skillId:'read-vowel',targetId:target,display:target,word:'소리 내어 말하기',prompt:'모음 소리를 내어 말해보세요.',speech:'모음 소리를 말해보세요.'});
  return learningItem({phase,skillId:'vowel-sound-match',targetId:target,display:'🔊',prompt:spokenLetter(target)+' 소리의 모음을 찾아보세요.',speech:spokenLetter(target)+' 소리의 모음을 찾아보세요.',choices,answer:target,answerSpeech:'정답은 '+spokenLetter(target)+'예요.'});
}
function syllableParts(syllable){
  const code=String(syllable).charCodeAt(0)-0xAC00;
  if(code<0 || code>11171) return null;
  const initials=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const vowels=['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  return {initial:initials[Math.floor(code/588)],vowel:vowels[Math.floor((code%588)/28)]};
}
function syllableChoicePool(pool){
  return [...new Set(pool.filter(value=>syllableParts(value)))];
}
function taeyoonSyllableItem(target,pool,variant,phase,choiceCount=3){
  const parts=syllableParts(target);
  const choices=stableChoices(target,syllableChoicePool(pool),choiceCount).map(value=>itemChoice(value,value,value));
  const display=parts?parts.initial+' + '+parts.vowel:'글자 만들기';
  if(variant===0) return infoItem({phase,skillId:'combine-exposure',targetId:target,display,word:target,prompt:'두 글자 조각을 합쳐 보세요.',speech:spokenLetter(parts.initial)+'과 '+spokenLetter(parts.vowel)+'가 만나서 '+target});
  if(variant===2){
    const partChoices=stableChoices(target,pool,choiceCount).map(value=>{
      const valueParts=syllableParts(value);
      return itemChoice(value,(valueParts?valueParts.initial+' + '+valueParts.vowel:value),value);
    });
    return learningItem({phase,skillId:'split-syllable',targetId:target,display:target,word:'어떻게 만든 글자일까요?',prompt:'글자를 만든 자음과 모음을 골라보세요.',speech:'글자를 보고 알맞은 자음과 모음을 골라보세요.',choices:partChoices,answer:target,answerSpeech:target+'는 '+spokenLetter(parts.initial)+'과 '+spokenLetter(parts.vowel)+'로 만들어요.'});
  }
  if(variant===3){
    const vowelChoices=stableChoices(parts.vowel,vowelOrder,choiceCount).map(value=>itemChoice(value,value,spokenLetter(value)));
    return learningItem({phase,skillId:'fill-vowel',targetId:target,display:parts.initial+' + □ = '+target,word:'빈 모음은?',prompt:'빈칸에 들어갈 모음을 찾아보세요.',speech:'빈칸에 들어갈 모음을 찾아보세요.',choices:vowelChoices,answer:parts.vowel,answerSpeech:'빈칸에는 '+spokenLetter(parts.vowel)+'가 들어가요.'});
  }
  if(variant===4) return learningItem({phase,skillId:'same-syllable',targetId:target,display:target,word:'같은 글자는?',prompt:'같은 음절을 찾아보세요.',speech:'화면과 같은 글자를 찾아보세요.',choices,answer:target,answerSpeech:'같은 글자는 '+target+'예요.'});
  if(variant===5) return learningItem({phase,skillId:'sound-syllable',targetId:target,display:'🔊',word:'들은 글자는?',prompt:'소리를 듣고 음절을 찾아보세요.',speech:target+'. 들은 글자를 찾아보세요.',choices,answer:target,answerSpeech:'정답은 '+target+'예요.'});
  return learningItem({phase,skillId:'combine',targetId:target,display,word:'무슨 글자가 될까요?',prompt:'자음과 모음을 합쳐 보세요.',speech:spokenLetter(parts.initial)+'과 '+spokenLetter(parts.vowel)+'를 합쳐 보세요.',choices,answer:target,answerSpeech:spokenLetter(parts.initial)+'과 '+spokenLetter(parts.vowel)+'가 만나서 '+target});
}
function wordSyllables(word){return Array.from(String(word).replace(/[.?!]/g,''));}
function wordSyllablePool(pool){
  return [...new Set(pool.flatMap(wordSyllables).concat(['가','나','다','라','마','바','사','아','자']))];
}
function taeyoonWordItem(target,pool,variant,phase,choiceCount=3){
  const entry=entryFor(target);
  const choices=stableChoices(target,pool,choiceCount);
  if(variant===0) return infoItem({phase,skillId:'read-word',targetId:target,emoji:entry.emoji,display:'',word:target,prompt:'그림과 낱말을 함께 읽어보세요.',speech:target});
  if(variant===1){
    return learningItem({phase,skillId:'picture-word',targetId:target,display:target,word:'어떤 그림일까요?',prompt:'낱말에 맞는 그림을 골라보세요.',speech:'낱말을 읽고 알맞은 그림을 골라보세요.',choices:choices.map(value=>itemChoice(value,entryFor(value).emoji,value)),answer:target,answerSpeech:target+'이에요.'});
  }
  if(variant===2) return learningItem({phase,skillId:'picture-to-word',targetId:target,emoji:entry.emoji,display:'',word:'알맞은 낱말은?',prompt:'그림에 맞는 낱말을 골라보세요.',speech:'그림에 맞는 낱말을 골라보세요.',choices:choices.map(value=>itemChoice(value,value,value)),answer:target,answerSpeech:'정답은 '+target+'예요.'});
  const syllables=wordSyllables(target);
  const syllablePool=wordSyllablePool(pool);
  if(variant===3 || variant===4){
    const position=variant===3?0:Math.floor((syllables.length-1)/2);
    const answer=syllables[position];
    return learningItem({phase,skillId:variant===3?'word-first-syllable':'word-middle-syllable',targetId:target,display:target,word:variant===3?'첫 글자는?':'가운데 글자는?',prompt:'낱말을 읽고 알맞은 글자를 찾아보세요.',speech:'낱말을 읽고 알맞은 글자를 찾아보세요.',choices:stableChoices(answer,syllablePool,choiceCount).map(value=>itemChoice(value,value,value)),answer,answerSpeech:target+'에서 찾은 글자는 '+answer+'예요.'});
  }
  if(variant===5){
    const position=syllables.length>2?1:syllables.length-1;
    const answer=syllables[position];
    const display=syllables.map((value,index)=>index===position?'□':value).join('');
    return learningItem({phase,skillId:'fill-word-syllable',targetId:target,display,word:'빈 글자는?',prompt:'빈칸에 들어갈 글자를 찾아보세요.',speech:'낱말의 빈칸에 들어갈 글자를 찾아보세요.',choices:stableChoices(answer,syllablePool,choiceCount).map(value=>itemChoice(value,value,value)),answer,answerSpeech:'빈칸에는 '+answer+'. '+target+'이에요.'});
  }
  if(variant===6){
    const answer=syllables[Math.min(1,syllables.length-1)];
    return learningItem({phase,skillId:'find-word-syllable',targetId:target,display:target,word:'낱말 속 글자는?',prompt:'이 낱말에 들어 있는 글자를 찾아보세요.',speech:'낱말을 읽고 들어 있는 글자를 찾아보세요.',choices:stableChoices(answer,syllablePool,choiceCount).map(value=>itemChoice(value,value,value)),answer,answerSpeech:target+'에는 '+answer+'가 들어 있어요.'});
  }
  return speakItem({phase,skillId:'read-word-no-picture',targetId:target,display:target,word:'그림 없이 읽기',prompt:'그림 도움 없이 낱말을 소리 내어 읽어보세요.',speech:'화면의 낱말을 소리 내어 읽어보세요.'});
}
function sentenceWords(sentence){return String(sentence).replace(/[.?!]/g,'').split(/\s+/).filter(Boolean);}
function taeyoonSentenceItem(target,pool,variant,phase,choiceCount=3){
  const choices=stableChoices(target,pool,choiceCount);
  if(variant===0) return infoItem({phase,skillId:'read-sentence',targetId:target,emoji:sentencePictures[target],display:'',word:target,prompt:'문장을 천천히 읽어보세요.',speech:target});
  if(variant===1) return learningItem({phase,skillId:'sentence-to-picture',targetId:target,display:target,word:'어떤 그림일까요?',prompt:'문장의 뜻에 맞는 그림을 골라보세요.',speech:'문장을 읽고 알맞은 그림을 골라보세요.',choices:choices.map(value=>itemChoice(value,sentencePictures[value],value)),answer:target,answerSpeech:target});
  if(variant===2) return learningItem({phase,skillId:'picture-to-sentence',targetId:target,emoji:sentencePictures[target],display:'',word:'어떤 문장일까요?',prompt:'그림의 뜻에 맞는 문장을 골라보세요.',speech:'그림을 보고 알맞은 문장을 골라보세요.',choices:choices.map(value=>itemChoice(value,value,value)),answer:target,answerSpeech:target});
  const words=sentenceWords(target);
  const wordPool=[...new Set(pool.flatMap(sentenceWords))];
  if(variant===3){
    const answer=words[0];
    const display=target.replace(answer,'□');
    return learningItem({phase,skillId:'fill-sentence-word',targetId:target,display,word:'빈 낱말은?',prompt:'문장을 읽고 빈칸에 들어갈 낱말을 찾아보세요.',speech:'문장을 읽고 빈칸에 들어갈 낱말을 찾아보세요.',choices:stableChoices(answer,wordPool,choiceCount).map(value=>itemChoice(value,value,value)),answer,answerSpeech:'빈칸에는 '+answer+'. '+target});
  }
  if(variant===4){
    const answer=words[0];
    return learningItem({phase,skillId:'sentence-word-meaning',targetId:target,display:target,word:'문장 속 낱말은?',prompt:'문장에 들어 있는 낱말을 찾아보세요.',speech:'문장을 읽고 문장에 들어 있는 낱말을 찾아보세요.',choices:stableChoices(answer,wordPool,choiceCount).map(value=>itemChoice(value,value,value)),answer,answerSpeech:answer+'가 들어 있어요. '+target});
  }
  return speakItem({phase,skillId:'read-sentence-no-tts',targetId:target,display:target,word:'혼자 문장 읽기',prompt:'그림과 소리 도움 없이 문장을 읽어보세요.',speech:'화면의 문장을 혼자 읽어보세요.'});
}
function evenlySpacedTargets(targets,count){
  if(targets.length<=count) return [...targets];
  return Array.from({length:count},(_,index)=>{
    const targetIndex=Math.round(index*(targets.length-1)/(count-1));
    return targets[targetIndex];
  });
}
function buildTaeyoonItems(week,session,isReview){
  const targets=isReview?evenlySpacedTargets(week.weeklyReview.targets,5):session.targets;
  const stagePool=week.weeklyReview.targets;
  const items=[];
  const phase=isReview?'weekreview':'new';
  if(week.stage==='consonant' || week.stage==='vowel'){
    const maker=week.stage==='consonant'?taeyoonConsonantItem:taeyoonVowelItem;
    const order=week.stage==='consonant'?consonantOrder:vowelOrder;
    const primary=targets[0];
    if(!isReview){
      const sessionIndex=week.sessions.indexOf(session);
      if(sessionIndex>0){
        const previous=week.sessions[sessionIndex-1];
        items.push(maker(previous.targets[previous.targets.length-1],2,'review',3));
      }
      items.push(maker(primary,0,phase,3));
    }
    const variants=isReview?[1,2,3,5,1,3,4]:[1,2,3,5,1,4];
    variants.forEach((variant,index)=>{
      const target=targets[index%targets.length] || primary;
      items.push(maker(target,variant,phase,index===3?4:3));
    });
    while(items.length<8) items.push(maker(primary,items.length%2?2:5,phase,4));
    items.push(writingItem(primary,'trace',phase));
  }else if(week.stage==='syllable'){
    const selected=Array.from({length:6},(_,index)=>targets[index%targets.length]);
    if(!isReview) items.push(taeyoonSyllableItem(selected[0],stagePool,0,phase));
    items.push(taeyoonSyllableItem(selected[0],stagePool,1,phase,3));
    items.push(taeyoonSyllableItem(selected[1],stagePool,2,phase,3));
    items.push(taeyoonSyllableItem(selected[2],stagePool,3,phase,4));
    items.push(taeyoonSyllableItem(selected[3],stagePool,4,phase,4));
    items.push(taeyoonSyllableItem(selected[4],stagePool,5,phase,3));
    items.push(taeyoonSyllableItem(selected[5],stagePool,1,phase,4));
    items.push(speakItem({phase,skillId:'read-syllable-no-help',targetId:selected[0],display:selected[0],word:'혼자 음절 읽기',prompt:'글자를 보고 소리 내어 읽어보세요.',speech:'화면의 글자를 소리 내어 읽어보세요.'}));
    items.push(writingItem(selected[0],'trace',phase));
    items.push(writingItem(selected[1],'copy',phase));
  }else if(week.stage==='word'){
    const selected=Array.from({length:8},(_,index)=>targets[index%targets.length]);
    items.push(taeyoonWordItem(selected[0],stagePool,7,phase));
    items.push(taeyoonWordItem(selected[1],stagePool,1,phase,3));
    items.push(taeyoonWordItem(selected[2],stagePool,2,phase,4));
    items.push(taeyoonWordItem(selected[3],stagePool,3,phase,4));
    items.push(taeyoonWordItem(selected[4],stagePool,4,phase,4));
    items.push(taeyoonWordItem(selected[5],stagePool,5,phase,4));
    items.push(taeyoonWordItem(selected[6],stagePool,6,phase,4));
    items.push(taeyoonWordItem(selected[7],stagePool,7,phase));
    items.push(writingItem(selected[0],'copy',phase));
  }else{
    const selected=Array.from({length:8},(_,index)=>targets[index%targets.length]);
    items.push(taeyoonSentenceItem(selected[0],stagePool,5,phase));
    items.push(taeyoonSentenceItem(selected[1],stagePool,1,phase,3));
    items.push(taeyoonSentenceItem(selected[2],stagePool,2,phase,3));
    items.push(taeyoonSentenceItem(selected[3],stagePool,3,phase,4));
    items.push(taeyoonSentenceItem(selected[4],stagePool,4,phase,4));
    items.push(taeyoonSentenceItem(selected[5],stagePool,1,phase,4));
    items.push(taeyoonSentenceItem(selected[6],stagePool,3,phase,3));
    items.push(taeyoonSentenceItem(selected[7],stagePool,5,phase));
    const phrase=sentenceWords(selected[0])[0] || selected[0];
    items.push(writingItem(phrase,'copy',phase));
  }
  return items.map((item,index)=>Object.assign(item,{itemId:(isReview?'review':session.id)+':item-'+(index+1)}));
}
function allYoungerEntries(){
  return Object.keys(pictureBank).map(entryFor).filter(entry=>entry.initial);
}
function youngerEntriesFor(targets){
  return targets.map(target=>{
    if(consonantOrder.includes(target)) return entryFor(consonantExamples[target] || '기차');
    return entryFor(target);
  });
}
function youngerChoiceEntries(answer,count,requireDifferentInitial=false){
  const pool=allYoungerEntries().filter(entry=>entry.word!==answer.word && (!requireDifferentInitial || entry.initial!==answer.initial));
  const words=stableChoices(answer.word,pool.map(entry=>entry.word),count);
  return words.map(word=>word===answer.word?answer:pool.find(entry=>entry.word===word)).filter(Boolean);
}
function youngerPictureFind(entry,phase,count){
  const options=youngerChoiceEntries(entry,count,true);
  return learningItem({phase,skillId:'sound-picture',targetId:entry.word,display:'🔊',word:'들은 낱말은?',prompt:'소리를 듣고 알맞은 그림을 찾아보세요.',speech:entry.word+'. 알맞은 그림을 찾아보세요.',choices:options.map(value=>itemChoice(value.word,value.emoji,value.word)),answer:entry.word,answerSpeech:entry.word+'를 찾았어요!'});
}
function youngerPictureWord(entry,phase){
  return infoItem({phase,skillId:'picture-word',targetId:entry.word,emoji:entry.emoji,display:'',word:entry.word,prompt:'그림, 소리, 낱말 모양을 함께 만나봐요.',speech:entry.word+'. 같이 말해볼까요?'});
}
function youngerInitialExposure(entry,phase){
  const initial=entry.initial || 'ㄱ';
  return infoItem({phase,skillId:'initial-exposure',targetId:entry.word,emoji:entry.emoji,display:initial,word:entry.word,prompt:entry.word+'는 '+spokenLetter(initial)+'으로 시작해요.',speech:entry.word+'는 '+spokenLetter(initial)+'으로 시작해요.'});
}
function youngerInitialChoice(entry,phase,count,audioOnly=false){
  const initial=entry.initial || 'ㄱ';
  return learningItem({phase,skillId:audioOnly?'sound-to-initial':'picture-to-initial',targetId:entry.word,emoji:audioOnly?'':entry.emoji,display:audioOnly?'🔊':'?',word:'첫 글자는?',prompt:audioOnly?'소리를 듣고 첫 글자를 찾아보세요.':'그림 이름의 첫 글자를 찾아보세요.',speech:audioOnly?entry.word+'. 첫 글자를 찾아보세요.':'그림 이름의 첫 글자를 찾아보세요.',choices:stableChoices(initial,consonantOrder,count).map(value=>itemChoice(value,value,spokenLetter(value))),answer:initial,answerSpeech:entry.word+'는 '+spokenLetter(initial)+'으로 시작해요.'});
}
function youngerSameInitial(entry,entries,phase,count){
  const match=entries.find(value=>value.word!==entry.word && value.initial===entry.initial) || allYoungerEntries().find(value=>value.word!==entry.word && value.initial===entry.initial) || entry;
  const options=youngerChoiceEntries(match,count,true);
  return learningItem({phase,skillId:'same-initial',targetId:entry.initial,emoji:entry.emoji,display:entry.initial,word:entry.word,prompt:entry.word+'와 같은 첫 글자로 시작하는 그림을 찾아보세요.',speech:entry.word+'와 같은 첫 글자로 시작하는 그림을 찾아보세요.',choices:options.map(value=>itemChoice(value.word,value.emoji,value.word)),answer:match.word,answerSpeech:entry.word+'와 '+match.word+'는 같은 첫 글자로 시작해요.'});
}
function youngerDifferentLetter(entry,phase,count){
  const initial=entry.initial || 'ㄱ';
  const other=consonantOrder.find(value=>value!==initial) || 'ㄴ';
  const choices=[
    itemChoice('same-a',initial+'  '+initial,initial+' 두 개'),
    itemChoice('different',initial+'  '+other,initial+'과 '+other),
    itemChoice('same-b',initial+'  '+initial,initial+' 두 개')
  ].slice(0,count);
  return learningItem({phase,skillId:'different-letter',targetId:initial,display:initial,word:'서로 다른 글자는?',prompt:'서로 다른 글자 두 개가 있는 카드를 찾아보세요.',speech:'서로 다른 글자 두 개가 있는 카드를 찾아보세요.',choices,answer:'different',answerSpeech:spokenLetter(initial)+'과 '+spokenLetter(other)+'가 서로 달라요.'});
}
function buildYoungerItems(week,session,isReview,supportLevel){
  const targets=isReview?week.weeklyReview.targets:session.targets;
  const entries=youngerEntriesFor(targets);
  const phase=isReview?'weekreview':'new';
  const choiceCount=supportLevel==='picture-first'?2:3;
  const selected=Array.from({length:7},(_,index)=>entries[index%entries.length]);
  const items=[
    youngerPictureWord(selected[0],phase),
    youngerPictureFind(selected[1],phase,choiceCount),
    youngerInitialChoice(selected[2],phase,choiceCount,false),
    youngerSameInitial(selected[3],entries,phase,choiceCount),
    youngerDifferentLetter(selected[4],phase,choiceCount),
    youngerPictureFind(selected[5],phase,choiceCount),
    supportLevel==='initial-ready'
      ? youngerInitialChoice(selected[6],phase,3,true)
      : supportLevel==='initial-intro'
        ? youngerInitialChoice(selected[6],phase,3,false)
        : supportLevel==='sound-link'
          ? youngerPictureFind(selected[6],phase,3)
          : youngerInitialExposure(selected[6],phase),
    writingItem(selected[0].initial || 'ㄱ','trace',phase)
  ];
  return items.map((item,index)=>Object.assign(item,{itemId:(isReview?'review':session.id)+':item-'+(index+1)}));
}
function supportLevelFor(profile){
  return profile.placement.result && profile.placement.result.supportLevel || 'picture-first';
}
function buildCourseItems(child,week,session,isReview,profile){
  return child==='older'
    ? buildTaeyoonItems(week,session,isReview)
    : buildYoungerItems(week,session,isReview,supportLevelFor(profile));
}
function startCourseSession(child,weekNumber,sessionNumber,replay=false){
  const data=store();
  const profile=data.children[child];
  if(!weekNumber || !sessionNumber) return;
  const week=weekFor(child,weekNumber);
  const session=week && week.sessions[sessionNumber-1];
  if(!session) return;
  state.child=child;
  state.mode='lesson';
  state.weekNumber=weekNumber;
  state.sessionNumber=sessionNumber;
  state.activityId=sessionActivityId(child,weekNumber,sessionNumber);
  state.replay=Boolean(replay || weekNumber!==profile.progress.currentWeek || sessionNumber!==profile.progress.currentSession);
  state.items=buildCourseItems(child,week,session,false,profile);
  begin();
}
function startWeekPractice(child,weekNumber){
  const profile=store().children[child];
  const status=weekState(profile,child,weekNumber);
  if(!['done','active'].includes(status)) return;
  const sessionNumber=status==='active'?profile.progress.currentSession:1;
  startCourseSession(child,weekNumber,sessionNumber,status==='done');
}
function startWeeklyReview(child=state.child,weekNumber){
  const data=store();
  const profile=data.children[child];
  if(!weekNumber || (!reviewAvailable(profile,child,weekNumber) && !(profile.progress.weeklyReviews[reviewActivityId(child,weekNumber)] || {}).completed)) return;
  const week=weekFor(child,weekNumber);
  state.child=child;
  state.mode='weekreview';
  state.weekNumber=weekNumber;
  state.sessionNumber=null;
  state.activityId=reviewActivityId(child,weekNumber);
  state.replay=Boolean((profile.progress.weeklyReviews[state.activityId] || {}).completed);
  state.items=buildCourseItems(child,week,week.weeklyReview,true,profile);
  begin();
}
function begin(){
  state.index=0;
  state.stars=0;
  state.answered=false;
  show('lesson');
  render();
}
function drawingContext(){
  const canvas=document.getElementById('writingCanvas');
  return canvas?canvas.getContext('2d'):null;
}
function resizeDrawingCanvas(){
  const canvas=document.getElementById('writingCanvas');
  if(!canvas || canvas.hidden) return;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width || !rect.height) return;
  const scale=Math.min(window.devicePixelRatio || 1,2);
  canvas.width=Math.round(rect.width*scale);
  canvas.height=Math.round(rect.height*scale);
  const context=drawingContext();
  context.setTransform(scale,0,0,scale,0,0);
  context.lineCap='round';
  context.lineJoin='round';
}
function setDrawingTool(tool){
  drawingUi.tool=tool==='eraser'?'eraser':'pen';
  ['pen','eraser'].forEach(name=>{
    const button=document.getElementById(name+'Tool');
    const active=name===drawingUi.tool;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
}
function prepareDrawing(item){
  const guide=document.getElementById('writingGuide');
  guide.textContent=item.writingTarget || item.targetId;
  guide.classList.toggle('copy',item.writingMode==='copy');
  if((item.writingTarget || '').length>=4) guide.style.fontSize=item.writingMode==='copy'?'clamp(32px,7vw,58px)':'clamp(64px,14vw,116px)';
  else guide.style.fontSize='';
  document.getElementById('writingStatus').textContent=item.writingMode==='copy'
    ? '위 글자를 보고 아래 빈 곳에 써보세요.'
    : '연한 가이드 위를 따라 써보세요.';
  drawingUi.activeItemId=item.itemId;
  drawingUi.inkDistance=0;
  drawingUi.drawing=false;
  drawingUi.lastPoint=null;
  state.answered=false;
  setDrawingTool('pen');
  resizeDrawingCanvas();
}
function resetDrawing(){
  const item=state.items[state.index];
  if(!item || item.type!=='drawing') return;
  prepareDrawing(item);
  document.getElementById('nextBtn').disabled=true;
}
function drawingPoint(event){
  const canvas=document.getElementById('writingCanvas');
  const rect=canvas.getBoundingClientRect();
  return {x:event.clientX-rect.left,y:event.clientY-rect.top};
}
function beginDrawing(event){
  const item=state.items[state.index];
  if(!item || item.type!=='drawing') return;
  event.preventDefault();
  const canvas=event.currentTarget;
  try{canvas.setPointerCapture(event.pointerId);}catch(error){}
  drawingUi.drawing=true;
  drawingUi.lastPoint=drawingPoint(event);
}
function moveDrawing(event){
  if(!drawingUi.drawing || !drawingUi.lastPoint) return;
  event.preventDefault();
  const point=drawingPoint(event);
  const context=drawingContext();
  const previous=drawingUi.lastPoint;
  context.globalCompositeOperation=drawingUi.tool==='eraser'?'destination-out':'source-over';
  context.strokeStyle='#2F2F33';
  context.lineWidth=drawingUi.tool==='eraser'?34:16;
  context.beginPath();
  context.moveTo(previous.x,previous.y);
  context.lineTo(point.x,point.y);
  context.stroke();
  const distance=Math.hypot(point.x-previous.x,point.y-previous.y);
  if(drawingUi.tool==='pen') drawingUi.inkDistance+=distance;
  drawingUi.lastPoint=point;
  if(!state.answered && drawingUi.inkDistance>=24){
    state.answered=true;
    document.getElementById('nextBtn').disabled=false;
    document.getElementById('writingStatus').textContent='좋아요! 더 써보거나 다음으로 넘어가세요. ✨';
  }
}
function endDrawing(event){
  if(!drawingUi.drawing) return;
  drawingUi.drawing=false;
  drawingUi.lastPoint=null;
  try{event.currentTarget.releasePointerCapture(event.pointerId);}catch(error){}
}
function initializeDrawingCanvas(){
  const canvas=document.getElementById('writingCanvas');
  canvas.addEventListener('pointerdown',beginDrawing);
  canvas.addEventListener('pointermove',moveDrawing);
  canvas.addEventListener('pointerup',endDrawing);
  canvas.addEventListener('pointercancel',endDrawing);
  window.addEventListener('resize',()=>{
    const item=state.items[state.index];
    if(item && item.type==='drawing') resetDrawing();
  });
}
function render(){
  if(state.index>=state.items.length){finish();return;}
  const item=state.items[state.index];
  state.answered=false;
  const nextButton=document.getElementById('nextBtn');
  nextButton.disabled=true;
  nextButton.textContent=state.index===state.items.length-1?'마치기':'다음 ▶';
  document.getElementById('feedback').textContent='';
  const choices=document.getElementById('choices');
  choices.innerHTML='';
  choices.hidden=false;
  choices.classList.toggle('two-choice',item.choices.length===2);
  const writingPanel=document.getElementById('writingPanel');
  writingPanel.hidden=true;
  document.getElementById('progressText').textContent=(state.index+1)+' / '+state.items.length;
  document.getElementById('progressBar').style.width=(((state.index+1)/state.items.length)*100)+'%';
  document.getElementById('stars').textContent=state.stars;
  document.getElementById('phaseBadge').textContent=item.phase==='review'
    ? '🔁 이전 개념 복습'
    : item.phase==='weekreview'?'🧩 '+state.weekNumber+'주차 복습':'🌱 새 학습';
  document.getElementById('timeText').textContent=state.mode==='weekreview'
    ? '주간복습'
    : (state.child==='older'?'약 10~12분':'약 8~10분');
  const week=weekFor(state.child,state.weekNumber);
  document.getElementById('lessonTitle').textContent=childName(state.child)+' · '+state.weekNumber+'주차 '+(state.mode==='weekreview'?'주간복습':state.sessionNumber+'회');
  document.getElementById('bigEmoji').textContent=item.emoji || '';
  document.getElementById('bigLetter').textContent=item.display || '';
  document.getElementById('word').textContent=item.word || week.title;
  document.getElementById('hint').textContent=item.prompt;
  if(item.type==='drawing'){
    choices.hidden=true;
    writingPanel.hidden=false;
    requestAnimationFrame(()=>prepareDrawing(item));
  }else if(item.type==='info'){
    const button=document.createElement('button');
    button.className='choice correct';
    button.textContent='알겠어요 👍';
    button.onclick=()=>{
      if(state.answered) return;
      state.answered=true;
      button.disabled=true;
      nextButton.disabled=false;
      speak(item.speech);
    };
    choices.appendChild(button);
  }else if(item.type==='speak'){
    const button=document.createElement('button');
    button.className='choice';
    button.textContent='소리 내어 읽었어요 🗣️';
    button.onclick=()=>{
      if(state.answered) return;
      state.answered=true;
      button.classList.add('correct');
      button.disabled=true;
      nextButton.disabled=false;
      document.getElementById('feedback').textContent='천천히 읽어보았어요!';
      speak(item.targetId);
    };
    choices.appendChild(button);
  }else{
    renderChoices(item);
  }
  speak(item.speech);
}
function renderChoices(item){
  const wrap=document.getElementById('choices');
  item.choices.forEach(option=>{
    const button=document.createElement('button');
    button.className='choice';
    button.textContent=option.label;
    button.dataset.choiceId=option.id;
    button.onclick=()=>{
      if(state.answered) return;
      state.answered=true;
      [...wrap.children].forEach(element=>element.disabled=true);
      const correct=option.id===item.answer;
      if(correct){
        button.classList.add('correct');
        state.stars++;
        document.getElementById('stars').textContent=state.stars;
        document.getElementById('feedback').textContent='🎉 잘했어요!';
        speak('잘했어요! '+item.answerSpeech);
      }else{
        button.classList.add('wrong');
        [...wrap.children].forEach(element=>{
          if(element.dataset.choiceId===String(item.answer)) element.classList.add('correct');
        });
        document.getElementById('feedback').textContent=state.child==='younger'
          ? '정답을 같이 볼까요? 🌱'
          : '괜찮아요. 정답을 같이 볼까요?';
        speak(item.answerSpeech+' 같이 볼까요?');
      }
      document.getElementById('nextBtn').disabled=false;
    };
    wrap.appendChild(button);
  });
}
function spokenLetter(letter){return letterSpeech[letter] || letter;}
function speak(text){
  if(!text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='ko-KR';
  utterance.rate=state.child==='younger'?0.78:0.85;
  utterance.pitch=1.05;
  speechSynthesis.speak(utterance);
}
function speakCurrent(){
  const item=state.items[state.index];
  if(item) speak(item.speech);
}
function nextStep(){state.index++;render();}
function recordCurrentActivity(profile){
  const now=new Date().toISOString();
  const records=state.mode==='weekreview'?profile.progress.weeklyReviews:profile.progress.completedSessions;
  const previous=records[state.activityId] || {completed:false,bestStars:0,completedAt:null,attempts:0};
  const firstCompletion=!previous.completed;
  const awarded=firstCompletion?state.stars:0;
  profile.stars=Math.max(profile.stars,profile.legacyStars)+awarded;
  records[state.activityId]={
    completed:true,
    bestStars:Math.max(safeCount(previous.bestStars),state.stars),
    completedAt:previous.completedAt || now,
    attempts:safeCount(previous.attempts)+1
  };
  if(firstCompletion && state.mode==='lesson' && state.weekNumber===profile.progress.currentWeek && state.sessionNumber===profile.progress.currentSession){
    if(state.sessionNumber<5) profile.progress.currentSession=state.sessionNumber+1;
  }
  if(firstCompletion && state.mode==='weekreview' && state.weekNumber===profile.progress.currentWeek){
    if(state.weekNumber<8){
      profile.progress.currentWeek=state.weekNumber+1;
      profile.progress.currentSession=1;
    }else{
      profile.progress.courseCompleted=true;
      profile.progress.currentSession=5;
    }
  }
  return {awarded,firstCompletion};
}
function finish(){
  document.getElementById('progressBar').style.width='100%';
  const data=store();
  const profile=data.children[state.child];
  const result=recordCurrentActivity(profile);
  save(data);
  const who=state.child==='older'?'태윤이가':'재윤이가';
  const isReview=state.mode==='weekreview';
  const completedCourse=store().children[state.child].progress.courseCompleted;
  document.getElementById('doneTitle').textContent=completedCourse
    ? '8주 한글 과정 완료!'
    : isReview?'주간복습 완료!':'오늘 학습 완료!';
  const rewardText=result.awarded>0
    ? '누적 별에 <b>⭐ '+result.awarded+'개</b>가 반영되었어요.'
    : '다시 연습해도 누적 별은 중복해서 늘어나지 않아요.';
  const nextText=completedCourse
    ? '8주 동안 즐겁게 한글을 만났어요!'
    : isReview?'다음 주차가 열렸어요. 준비되면 이어가요.':'다음 학습도 지금 속도로 천천히 이어가요.';
  document.getElementById('doneText').innerHTML=who+' 오늘 한글 놀이를 마쳤어요!<br>'+rewardText+'<br>'+nextText;
  show('done');
  updateProgressDisplay();
  speak(who+' 오늘 한글 놀이를 마쳤어요! 정말 잘했어요!');
}
function repeatToday(){
  if(state.mode==='weekreview') startWeeklyReview(state.child,state.weekNumber);
  else startCourseSession(state.child,state.weekNumber,state.sessionNumber,true);
}
function goHome(){show('home');updateProgressDisplay();}
function reviewStatus(profile,child){
  if(profile.progress.courseCompleted) return '8주 과정 완료';
  const weekNumber=profile.progress.currentWeek;
  return reviewAvailable(profile,child,weekNumber)?'주간복습 가능':'복습 잠김';
}
function parentPlacementStatus(profile,child){
  const placement=profile.placement;
  if(placement.status==='pending') return '레벨테스트 전';
  if(placement.status==='in-progress') return '레벨테스트 진행 중';
  if(placement.status==='skipped') return '테스트 건너뜀 · 1주차 시작';
  const result=placement.result || {};
  if(child==='older'){
    const diagnostic=result.advancedDiagnostics && result.advancedDiagnostics.finalConsonant;
    const diagnosticText=diagnostic && diagnostic.asked
      ? ' · 받침 진단 '+diagnostic.correct+'/'+diagnostic.asked
      : '';
    return (result.allPassed?'문장 단계 준비됨 · 8주차':'테스트 결과 · '+(result.startWeek||1)+'주차 시작')+diagnosticText;
  }
  return '테스트 결과 · '+supportLevelLabel(result.supportLevel)+' · 1주차';
}
function completedWeekNumbers(profile,child){
  return courseFor(child).weeks
    .filter(week=>{
      const record=profile.progress.weeklyReviews[reviewActivityId(child,week.number)];
      return record && record.completed;
    })
    .map(week=>week.number);
}
function renderParentWeeks(elementId,profile,child){
  const element=document.getElementById(elementId);
  element.innerHTML='';
  courseFor(child).weeks.forEach(week=>{
    const status=weekState(profile,child,week.number);
    const span=document.createElement('span');
    span.className='week-dot '+status;
    span.textContent=week.number;
    span.title=week.number+'주차 · '+({placed:'배치로 건너뜀',done:'완료',active:'현재',locked:'잠김'})[status];
    element.appendChild(span);
  });
}
function parentCourseStatus(profile,child){
  if(profile.placement.status==='pending' || profile.placement.status==='in-progress') return '학습 시작 전';
  if(profile.progress.courseCompleted) return '8주 과정 완료';
  const weekNumber=profile.progress.currentWeek || 1;
  return weekNumber+'주차 · '+profile.progress.currentSession+'회';
}
function openParent(){
  const data=store();
  const older=data.children.older;
  const younger=data.children.younger;
  document.getElementById('pOlderStars').textContent=older.stars+'개';
  document.getElementById('pOlderProgress').textContent=parentCourseStatus(older,'older');
  document.getElementById('pOlderReview').textContent=reviewStatus(older,'older');
  document.getElementById('pOlderPlacement').textContent=parentPlacementStatus(older,'older');
  document.getElementById('pOlderCompleted').textContent='완료 주차 · '+(completedWeekNumbers(older,'older').join(', ') || '없음');
  document.getElementById('pOlderPlaced').textContent='배치로 건너뜀 · '+(older.progress.placedWeeks.join(', ') || '없음');
  renderParentWeeks('pOlderWeeks',older,'older');
  document.getElementById('pYoungerStars').textContent=younger.stars+'개';
  document.getElementById('pYoungerProgress').textContent=parentCourseStatus(younger,'younger');
  document.getElementById('pYoungerReview').textContent=reviewStatus(younger,'younger');
  document.getElementById('pYoungerPlacement').textContent=parentPlacementStatus(younger,'younger');
  document.getElementById('pYoungerCompleted').textContent='완료 주차 · '+(completedWeekNumbers(younger,'younger').join(', ') || '없음');
  document.getElementById('pYoungerPlaced').textContent='배치로 건너뜀 · '+(younger.progress.placedWeeks.join(', ') || '없음');
  renderParentWeeks('pYoungerWeeks',younger,'younger');
  document.getElementById('parentModal').classList.add('show');
}
function closeParent(event){
  if(event.target.id==='parentModal') event.currentTarget.classList.remove('show');
}

initializeDrawingCanvas();
updateProgressDisplay();

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}
