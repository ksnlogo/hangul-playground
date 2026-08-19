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
  replay:false,
  variantIndex:0
};

let placementUi={waiting:false,finished:false};
let drawingUi={
  tool:'pen',drawing:false,lastPoint:null,inkDistance:0,strokeDistance:0,strokeCount:0,
  bounds:null,metricsReady:false,answerRevealed:false,activeItemId:null
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
    curriculumHistory:[],
    progressMigration:null,
    legacyV04:emptyLegacyProfile()
  };
}
function createDefaultData(sourceVersion='fresh'){
  return {
    version:5,
    curriculumRevision:CURRICULUM.version,
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
function questionsForStage(stage){
  return Array.isArray(stage.questionBank)?stage.questionBank:(Array.isArray(stage.questions)?stage.questions:[]);
}
function normalizeAttempt(attempt,child){
  if(!attempt || typeof attempt!=='object') return null;
  const test=CURRICULUM.levelTests[child];
  if(attempt.testId!==test.id) return null;
  const selectedQuestionIds={};
  const choiceOrders={};
  if(!isPlainObject(attempt.selectedQuestionIds) || !isPlainObject(attempt.choiceOrders)) return null;
  for(const stage of test.stages){
    const bank=questionsForStage(stage);
    const bankIds=new Set(bank.map(question=>question.id));
    const wanted=Math.min(safeCount(stage.sampleCount,bank.length),bank.length);
    const selected=Array.isArray(attempt.selectedQuestionIds[stage.id])
      ? attempt.selectedQuestionIds[stage.id].filter(id=>typeof id==='string' && bankIds.has(id))
      : [];
    const unique=[...new Set(selected)].slice(0,wanted);
    if(unique.length!==wanted) return null;
    selectedQuestionIds[stage.id]=unique;
    for(const questionId of unique){
      const question=bank.find(item=>item.id===questionId);
      const validChoiceIds=question.choices.map(option=>option.id);
      const order=Array.isArray(attempt.choiceOrders[questionId])
        ? attempt.choiceOrders[questionId].filter(id=>validChoiceIds.includes(id))
        : [];
      if(order.length!==validChoiceIds.length || new Set(order).size!==validChoiceIds.length) return null;
      choiceOrders[questionId]=order;
    }
  }
  const stageIndex=safeCount(attempt.stageIndex,test.stages.length-1);
  const stage=test.stages[stageIndex];
  const questionIndex=safeCount(attempt.questionIndex,selectedQuestionIds[stage.id].length-1);
  const selectedIds=new Set(Object.values(selectedQuestionIds).flat());
  const answers=Array.isArray(attempt.answers)
    ? attempt.answers.map(normalizeAnswer).filter(answer=>answer && selectedIds.has(answer.questionId)).slice(0,test.maxQuestions)
    : [];
  return {
    id:safeString(attempt.id,test.id+'-resume'),
    testId:test.id,
    seed:safeCount(attempt.seed,0xFFFFFFFF),
    startedAt:typeof attempt.startedAt==='string'?attempt.startedAt:new Date().toISOString(),
    stageIndex,
    questionIndex,
    answers,
    selectedQuestionIds,
    choiceOrders
  };
}
function normalizePlacementResult(result,child){
  if(!isPlainObject(result)) return null;
  const kind=result.kind==='skipped'?'skipped':'test';
  const startWeek=child==='older'
    ? (result.allPassed?8:([1,2,3,4,5,6,7,8].includes(Number(result.startWeek))?Number(result.startWeek):1))
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
  const fallback=result.fallbackDiagnostics;
  const foundation=child==='older' && isPlainObject(fallback)
    ? {correct:safeCount(fallback.correct,3),asked:safeCount(fallback.asked,3),passed:Boolean(fallback.passed)}
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
    advancedDiagnostics:{finalConsonant},
    fallbackDiagnostics:foundation
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
function normalizeProgress(progress,child,courseId=courseIdFor(child)){
  const clean=emptyProgress();
  if(!progress || typeof progress!=='object') return clean;
  if(progress.startWeek!==null && progress.startWeek!==undefined) clean.startWeek=Math.max(1,safeCount(progress.startWeek,8));
  if(progress.currentWeek!==null && progress.currentWeek!==undefined) clean.currentWeek=Math.max(1,safeCount(progress.currentWeek,8));
  clean.currentSession=Math.max(1,safeCount(progress.currentSession,5));
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
function hasMeaningfulProgress(progress){
  return Boolean(progress && (
    progress.startWeek!==null || progress.currentWeek!==null || progress.courseCompleted ||
    Object.keys(progress.completedSessions || {}).length || Object.keys(progress.weeklyReviews || {}).length
  ));
}
function normalizeCurriculumHistory(history,child){
  if(!Array.isArray(history)) return [];
  return history.map(entry=>{
    if(!isPlainObject(entry) || typeof entry.courseId!=='string' || !isPlainObject(entry.progress)) return null;
    return {
      courseId:entry.courseId,
      archivedAt:typeof entry.archivedAt==='string'?entry.archivedAt:null,
      progress:normalizeProgress(entry.progress,child,entry.courseId)
    };
  }).filter(Boolean).slice(-3);
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
  clean.curriculumHistory=normalizeCurriculumHistory(profile.curriculumHistory,child);
  const currentCourseId=courseIdFor(child);
  const sourceCourseId=safeString(profile.courseId,currentCourseId);
  const sourceProgress=normalizeProgress(profile.progress,child,sourceCourseId);
  if(child==='older' && sourceCourseId!==currentCourseId && hasMeaningfulProgress(sourceProgress)){
    if(!clean.curriculumHistory.some(entry=>entry.courseId===sourceCourseId)){
      clean.curriculumHistory.push({courseId:sourceCourseId,archivedAt:new Date().toISOString(),progress:sourceProgress});
      clean.curriculumHistory=clean.curriculumHistory.slice(-3);
    }
    const anchorWeek=Math.max(1,Math.min(8,sourceProgress.currentWeek || sourceProgress.startWeek || 1));
    clean.progress=emptyProgress();
    clean.progress.startWeek=anchorWeek;
    clean.progress.currentWeek=anchorWeek;
    clean.progress.currentSession=1;
    clean.progress.placedWeeks=Array.from({length:anchorWeek-1},(_,index)=>index+1);
    clean.progressMigration={
      fromCourseId:sourceCourseId,
      toCourseId:currentCourseId,
      anchorWeek,
      migratedAt:new Date().toISOString()
    };
  }else{
    clean.progress=normalizeProgress(profile.progress,child,currentCourseId);
    if(isPlainObject(profile.progressMigration)){
      clean.progressMigration={
        fromCourseId:safeString(profile.progressMigration.fromCourseId),
        toCourseId:safeString(profile.progressMigration.toCourseId,currentCourseId),
        anchorWeek:Math.max(1,safeCount(profile.progressMigration.anchorWeek,8)),
        migratedAt:typeof profile.progressMigration.migratedAt==='string'?profile.progressMigration.migratedAt:null
      };
    }
  }
  clean.legacyV04=normalizeLegacyProfile(profile.legacyV04);
  initializeProgressFromPlacement(clean,child);
  return clean;
}
function normalizeData(data){
  const clean=createDefaultData('fresh');
  if(!data || typeof data!=='object') return clean;
  clean.curriculumRevision=CURRICULUM.version;
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
    ? '받침 없는 낱말부터 다양한 받침, 낱말 완성, 문장과 짧은 글 이해까지 확인해요. 첫 낱말 단계가 어려울 때만 음절과 자모를 보충 진단합니다.'
    : '그림과 소리를 이용한 놀이로 어떤 도움이 편한지 확인해요. 글자를 읽어야 풀 수 있는 문제는 없어요.';
  document.getElementById('placementResumeNote').hidden=!inProgress;
  document.getElementById('placementStartButton').textContent=inProgress?'이어서 하기':'레벨테스트 시작';
  show('placementIntro');
}
function hashSeed(value){
  let hash=2166136261;
  for(const char of String(value)){
    hash^=char.codePointAt(0);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}
function seededRandom(seed){
  let value=seed>>>0;
  return ()=>{
    value+=0x6D2B79F5;
    let result=value;
    result=Math.imul(result^(result>>>15),result|1);
    result^=result+Math.imul(result^(result>>>7),result|61);
    return ((result^(result>>>14))>>>0)/4294967296;
  };
}
function shuffledWithSeed(values,seed){
  const result=[...values];
  const random=seededRandom(seed);
  for(let index=result.length-1;index>0;index--){
    const swapIndex=Math.floor(random()*(index+1));
    [result[index],result[swapIndex]]=[result[swapIndex],result[index]];
  }
  return result;
}
function recentPlacementQuestionIds(profile,stageId){
  const recent=profile.placement.attempts.slice(-2);
  return new Set(recent.flatMap(attempt=>{
    const selected=attempt && attempt.selectedQuestionIds;
    return selected && Array.isArray(selected[stageId])?selected[stageId]:[];
  }));
}
function createPlacementAttempt(test,profile){
  let entropy=Date.now()>>>0;
  if(globalThis.crypto && typeof globalThis.crypto.getRandomValues==='function'){
    const values=new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    entropy^=values[0];
  }
  const id=test.id+'-'+Date.now()+'-'+profile.placement.attempts.length;
  const seed=hashSeed(id+'|'+entropy);
  const selectedQuestionIds={};
  const choiceOrders={};
  test.stages.forEach((stage,stageIndex)=>{
    const bank=questionsForStage(stage);
    const recentIds=recentPlacementQuestionIds(profile,stage.id);
    const fresh=bank.filter(question=>!recentIds.has(question.id));
    const recent=bank.filter(question=>recentIds.has(question.id));
    const ordered=[
      ...shuffledWithSeed(fresh,seed+stageIndex*101),
      ...shuffledWithSeed(recent,seed+stageIndex*101+1)
    ];
    const count=Math.min(stage.sampleCount || 3,bank.length);
    const selected=ordered.slice(0,count);
    selectedQuestionIds[stage.id]=selected.map(question=>question.id);
    selected.forEach((question,questionIndex)=>{
      choiceOrders[question.id]=shuffledWithSeed(
        question.choices.map(option=>option.id),
        seed+stageIndex*1009+questionIndex*97
      );
    });
  });
  return {
    id,testId:test.id,seed,startedAt:new Date().toISOString(),stageIndex:0,questionIndex:0,answers:[],
    selectedQuestionIds,choiceOrders
  };
}
function startOrResumePlacement(){
  if(!state.child) return;
  const data=store();
  const profile=data.children[state.child];
  if(profile.placement.status!=='in-progress' || !profile.placement.activeAttempt){
    const test=CURRICULUM.levelTests[state.child];
    profile.placement.status='in-progress';
    profile.placement.testVersion=test.id;
    profile.placement.activeAttempt=createPlacementAttempt(test,profile);
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
  const questionId=stage && attempt.selectedQuestionIds[stage.id][attempt.questionIndex];
  const sourceQuestion=stage && questionsForStage(stage).find(question=>question.id===questionId);
  let question=null;
  if(sourceQuestion){
    question=clone(sourceQuestion);
    const order=attempt.choiceOrders[sourceQuestion.id];
    question.choices=order.map(choiceId=>sourceQuestion.choices.find(option=>option.id===choiceId)).filter(Boolean);
  }
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
      passed:answers.length===(stage.sampleCount || 3) && answers.filter(answer=>answer.correct).length>=2
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
    advancedDiagnostics:details.advancedDiagnostics || {finalConsonant:null},
    fallbackDiagnostics:details.fallbackDiagnostics || null
  };
  profile.placement.status='completed';
  profile.placement.testVersion=test.id;
  profile.placement.result=result;
  profile.placement.activeAttempt=null;
  profile.placement.attempts.push({
    ...clone(result),seed:attempt.seed,
    selectedQuestionIds:clone(attempt.selectedQuestionIds),
    choiceOrders:clone(attempt.choiceOrders),
    answers:clone(attempt.answers)
  });
  profile.placement.attempts=profile.placement.attempts.slice(-5);
  initializeProgressFromPlacement(profile,state.child);
  return result;
}
function advanceOlderPlacement(context){
  const {profile,attempt,test,stage}=context;
  const stageAnswers=answersForStage(attempt,stage.id);
  const correct=stageAnswers.filter(answer=>answer.correct).length;
  const required=stage.sampleCount || 3;
  if(stageAnswers.length<required){attempt.questionIndex=stageAnswers.length;return null;}
  const passed=correct>=2;
  if(stage.fallbackOnly){
    return finishPlacement(profile,attempt,test,{
      startWeek:1,
      failedStageId:'word-basic',
      allPassed:false,
      fallbackDiagnostics:{correct,asked:stageAnswers.length,passed}
    });
  }
  if(!passed){
    if(stage.fallbackStageId){
      const fallbackIndex=test.stages.findIndex(item=>item.id===stage.fallbackStageId);
      if(fallbackIndex>=0){
        attempt.stageIndex=fallbackIndex;
        attempt.questionIndex=0;
        return null;
      }
    }
    return finishPlacement(profile,attempt,test,{
      startWeek:stage.startWeek,
      failedStageId:stage.id,
      allPassed:false
    });
  }
  const mainStages=test.stages.filter(item=>!item.fallbackOnly);
  if(stage.id===mainStages[mainStages.length-1].id){
    return finishPlacement(profile,attempt,test,{startWeek:8,allPassed:true});
  }
  attempt.stageIndex++;
  attempt.questionIndex=0;
  return null;
}
function advanceYoungerPlacement(context){
  const {profile,attempt,test,stage}=context;
  const stageAnswers=answersForStage(attempt,stage.id);
  if(stageAnswers.length<(stage.sampleCount || 3)){attempt.questionIndex=stageAnswers.length;return null;}
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
    headline=result.allPassed?'짧은 글 이해 단계 준비됨':result.startWeek+'주차부터 시작';
    detail=result.allPassed
      ? '모든 단계를 통과했어요. 8주차 읽기·이해·쓰기 종합 단계에서 시작합니다.'
      : '처음 통과하지 못한 단계에 맞춰 '+result.startWeek+'주차를 추천합니다.';
    if(result.fallbackDiagnostics && result.failedStageId==='word-basic'){
      detail+=' 낱말 읽기가 어려워 음절·자모 보충 진단도 함께 확인했어요.';
    }
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
  '집':'🏠','옷':'👕','꽃':'🌼','산':'⛰️','밤':'🌙','별':'⭐','빛':'💡','약':'💊','눈물':'💧',
  '가족':'👨‍👩‍👦','동물':'🐾','탈것':'🚙','음식':'🍽️','몸':'🙋','생활물건':'🎒','장난감':'🧸','첫 글자':'🔤'
};
const sentencePictures={
  '아기가 자요.':'👶😴','나비가 와요.':'🦋👋','기차가 가요.':'🚂💨','우유를 마셔요.':'🥛😋','사자가 와요.':'🦁👋',
  '오리가 가요.':'🦆➡️','공이 굴러가요.':'⚽💨','달이 떠요.':'🌙✨','나비가 꽃에 앉아요.':'🦋🌼',
  '기차가 역에 와요.':'🚂🏫','아기가 우유를 마셔요.':'👶🥛','사자가 산에 가요.':'🦁⛰️',
  '오리가 물에서 놀아요.':'🦆💦','태윤이가 책을 봐요.':'👦🏻📚','재윤이가 방에서 자요.':'🧒🏻🛏️'
};
const sentenceUnderstanding={
  '기차가 가요.':{prompt:'무엇이 가나요?',answer:'기차',options:['기차','나비','우유']},
  '나비가 와요.':{prompt:'무엇이 오나요?',answer:'나비',options:['사자','나비','기차']},
  '아기가 자요.':{prompt:'누가 자나요?',answer:'아기',options:['아기','오리','태윤']},
  '사자가 와요.':{prompt:'무엇이 오나요?',answer:'사자',options:['우유','사자','공']},
  '우유를 마셔요.':{prompt:'무엇을 마시나요?',answer:'우유',options:['책','우유','꽃']},
  '오리가 가요.':{prompt:'무엇이 가나요?',answer:'오리',options:['오리','기차','나비']},
  '공이 굴러가요.':{prompt:'무엇이 굴러가나요?',answer:'공',options:['달','공','책']},
  '달이 떠요.':{prompt:'무엇이 떠 있나요?',answer:'달',options:['달','문','꽃']},
  '나비가 꽃에 앉아요.':{prompt:'나비는 어디에 앉았나요?',answer:'꽃',options:['꽃','기차','우유']},
  '기차가 역에 와요.':{prompt:'기차는 어디에 왔나요?',answer:'역',options:['산','역','방']},
  '아기가 우유를 마셔요.':{prompt:'아기는 무엇을 마시나요?',answer:'우유',options:['우유','책','공']},
  '사자가 산에 가요.':{prompt:'사자는 어디에 가나요?',answer:'산',options:['바다','산','방']},
  '오리가 물에서 놀아요.':{prompt:'누가 물에서 노나요?',answer:'오리',options:['나비','오리','태윤']},
  '태윤이가 책을 봐요.':{prompt:'태윤이는 무엇을 보나요?',answer:'책',options:['책','공','꽃']},
  '재윤이가 방에서 자요.':{prompt:'재윤이는 어디에서 자나요?',answer:'방',options:['역','방','산']}
};
const passageUnderstanding={
  '나비가 날아와요.\n나비가 꽃에 앉아요.':{prompt:'나비는 마지막에 어디에 앉았나요?',answer:'꽃',options:['꽃','버스','책']},
  '기차가 달려요.\n기차가 역에 와요.':{prompt:'기차는 마지막에 어디에 왔나요?',answer:'역',options:['산','역','방']},
  '아기가 배가 고파요.\n아기가 우유를 마셔요.':{prompt:'아기는 왜 우유를 마셨나요?',answer:'배가 고파서',options:['배가 고파서','잠이 와서','기차를 타려고']},
  '오리가 물에 가요.\n오리가 물에서 놀아요.':{prompt:'오리는 물에서 무엇을 하나요?',answer:'놀아요',options:['자요','놀아요','책을 봐요']}
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
  const isDictation=mode==='dictation';
  return learningItem({
    type:'drawing',phase,skillId:isTrace?'trace-writing':(isDictation?'dictation-writing':'copy-writing'),targetId:target,
    writingTarget:target,writingMode:mode,display:'',word:isTrace?'따라쓰기':(isDictation?'소리 듣고 쓰기':'보고쓰기'),
    prompt:isTrace?'연한 글자를 따라 천천히 써보세요.':(isDictation?'소리를 듣고 쓴 뒤 정답을 확인해보세요.':'위 글자를 보고 빈 곳에 써보세요.'),
    speech:target+'. '+(isTrace?'연한 글자를 따라 써보세요.':(isDictation?'들은 낱말을 써보세요.':'글자를 보고 써보세요.'))
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
  if(variant===8){
    const answer=syllables[syllables.length-1];
    return learningItem({phase,skillId:'word-final-syllable',targetId:target,display:target,word:'마지막 글자는?',prompt:'낱말을 읽고 마지막 글자를 찾아보세요.',speech:'낱말을 읽고 마지막 글자를 찾아보세요.',choices:stableChoices(answer,syllablePool,choiceCount).map(value=>itemChoice(value,value,value)),answer,answerSpeech:target+'의 마지막 글자는 '+answer+'예요.'});
  }
  if(variant===9){
    const scrambled=[...syllables].reverse().join(' · ');
    return learningItem({phase,skillId:'word-order-challenge',targetId:target,display:scrambled,word:'바르게 만든 낱말은?',prompt:'글자 순서를 생각해 바른 낱말을 찾아보세요.',speech:'글자 순서를 생각해 바른 낱말을 찾아보세요.',choices:choices.map(value=>itemChoice(value,value,value)),answer:target,answerSpeech:'바른 낱말은 '+target+'이에요.'});
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
  if(variant===6 || variant===8){
    const plain=target.replace(/[.?!]$/,'');
    const reversed=[...words].reverse().join(' ')+'.';
    const rotated=words.length>1?[...words.slice(1),words[0]].join(' ')+'.':plain+'요.';
    const repeated=(words[0]+' '+words[0])+'.';
    const optionPool=[target,reversed,rotated,repeated].filter((value,index,array)=>array.indexOf(value)===index);
    return learningItem({phase,skillId:variant===8?'sentence-order-challenge':'sentence-order',targetId:target,display:'낱말 순서 맞추기',word:'바른 문장은?',prompt:'낱말 순서가 바른 문장을 찾아보세요.',speech:'낱말 순서가 바른 문장을 찾아보세요.',choices:stableChoices(target,optionPool,choiceCount).map(value=>itemChoice(value,value,value)),answer:target,answerSpeech:'바른 문장은 '+target});
  }
  if(variant===7){
    const data=sentenceUnderstanding[target] || {prompt:'문장에서 가장 먼저 나온 낱말은 무엇인가요?',answer:words[0],options:stableChoices(words[0],wordPool,3)};
    return learningItem({phase,skillId:'sentence-understanding',targetId:target,display:target,word:data.prompt,prompt:'문장을 읽고 질문에 답해보세요.',speech:'문장을 읽고 질문에 답해보세요.',choices:stableChoices(data.answer,data.options,choiceCount).map(value=>itemChoice(value,value,value)),answer:data.answer,answerSpeech:'정답은 '+data.answer+'예요. '+target});
  }
  return speakItem({phase,skillId:'read-sentence-no-tts',targetId:target,display:target,word:'혼자 문장 읽기',prompt:'그림과 소리 도움 없이 문장을 읽어보세요.',speech:'화면의 문장을 혼자 읽어보세요.'});
}
function targetKind(target){
  if(String(target).includes('\n')) return 'passage';
  if(String(target).includes(' ') || /[.?!]$/.test(String(target))) return 'sentence';
  return 'word';
}
function passageLines(passage){return String(passage).split('\n').filter(Boolean);}
function taeyoonPassageItem(target,variant,phase,choiceCount=3){
  const data=passageUnderstanding[target] || {prompt:'짧은 글에서 가장 많이 나온 것은 무엇인가요?',answer:sentenceWords(target)[0],options:sentenceWords(target).slice(0,3)};
  if(variant===0) return speakItem({phase,skillId:'read-passage-no-tts',targetId:target,display:target,word:'짧은 글 혼자 읽기',prompt:'두 문장을 차례로 천천히 읽어보세요.',speech:'짧은 글을 혼자 읽어보세요.'});
  if(variant===1 || variant===4) return learningItem({phase,skillId:variant===4?'passage-challenge':'passage-understanding',targetId:target,display:target,word:data.prompt,prompt:'짧은 글을 읽고 질문에 답해보세요.',speech:'짧은 글을 읽고 질문에 답해보세요.',choices:stableChoices(data.answer,data.options,choiceCount).map(value=>itemChoice(value,value,value)),answer:data.answer,answerSpeech:'정답은 '+data.answer+'예요.'});
  if(variant===2){
    const words=sentenceWords(target);
    const answer=words[0];
    const pool=[...new Set(words.concat(['기차','우유','꽃','책']))];
    return learningItem({phase,skillId:'passage-word-find',targetId:target,display:target,word:'글에 나온 낱말은?',prompt:'짧은 글에 나온 낱말을 찾아보세요.',speech:'짧은 글을 읽고 나온 낱말을 찾아보세요.',choices:stableChoices(answer,pool,choiceCount).map(value=>itemChoice(value,value,value)),answer,answerSpeech:answer+'가 글에 나왔어요.'});
  }
  const lines=passageLines(target);
  const reversed=[...lines].reverse().join('\n');
  const mixed=lines.length>1?lines[0]+'\n'+lines[0]:target;
  return learningItem({phase,skillId:'passage-order',targetId:target,display:'문장 순서 맞추기',word:'바른 짧은 글은?',prompt:'두 문장의 순서가 자연스러운 글을 찾아보세요.',speech:'두 문장의 순서가 자연스러운 글을 찾아보세요.',choices:stableChoices(target,[target,reversed,mixed],choiceCount).map(value=>itemChoice(value,value,value)),answer:target,answerSpeech:'바른 순서로 읽어볼게요. '+target});
}
function evenlySpacedTargets(targets,count){
  if(targets.length<=count) return [...targets];
  return Array.from({length:count},(_,index)=>{
    const targetIndex=Math.round(index*(targets.length-1)/(count-1));
    return targets[targetIndex];
  });
}
function rotatedTargets(targets,offset){
  if(!targets.length) return [];
  const start=offset%targets.length;
  return targets.slice(start).concat(targets.slice(0,start));
}
function taeyoonPoolForKind(kind){
  return [...new Set(courseFor('older').weeks.flatMap(week=>week.weeklyReview.targets).filter(target=>targetKind(target)===kind))];
}
function previousTaeyoonTargets(week,session){
  const sessionIndex=week.sessions.indexOf(session);
  if(sessionIndex>0) return week.sessions[sessionIndex-1].targets.slice(-2);
  if(week.number>1) return courseFor('older').weeks[week.number-2].weeklyReview.targets.slice(-2);
  return session.targets.slice(0,2);
}
function taeyoonReviewItem(target,index,phase){
  const kind=targetKind(target);
  const pool=taeyoonPoolForKind(kind);
  if(kind==='passage') return taeyoonPassageItem(target,index%2,phase,3);
  if(kind==='sentence') return taeyoonSentenceItem(target,pool,index===0?5:7,phase,3);
  return taeyoonWordItem(target,pool,index===0?7:5,phase,3);
}
function writingTargetFor(target){
  const kind=targetKind(target);
  if(kind==='word') return target;
  return sentenceWords(target).slice(0,2).join(' ');
}
function varyLearningItems(items,seedSource,variantIndex=0){
  return items.map((item,index)=>{
    const copy=Object.assign({},item);
    if(Array.isArray(item.choices) && item.choices.length>1){
      const baseOrder=shuffledWithSeed(item.choices,hashSeed(seedSource+'|'+index));
      copy.choices=rotatedTargets(baseOrder,(variantIndex+index)%baseOrder.length);
    }
    return copy;
  });
}
function buildTaeyoonItems(week,session,isReview,variantIndex=0){
  const baseTargets=isReview?evenlySpacedTargets(week.weeklyReview.targets,6):session.targets;
  const targets=rotatedTargets(baseTargets,variantIndex);
  const phase=isReview?'weekreview':'new';
  const reviewPhase=isReview?'weekreview':'review';
  const reviewTargets=rotatedTargets(isReview?targets:previousTaeyoonTargets(week,session),variantIndex);
  const selected=Array.from({length:8},(_,index)=>targets[index%targets.length]);
  const kind=targetKind(selected[0]);
  const pool=[...new Set(targets.concat(taeyoonPoolForKind(kind)))];
  const items=[
    taeyoonReviewItem(reviewTargets[0] || selected[0],0,reviewPhase),
    taeyoonReviewItem(reviewTargets[1] || reviewTargets[0] || selected[1],1,reviewPhase)
  ];
  let challenge=null;
  if(week.stage==='integrated' && isReview){
    selected.slice(0,7).forEach((target,index)=>{
      const itemKind=targetKind(target);
      const itemPool=taeyoonPoolForKind(itemKind);
      if(itemKind==='passage') items.push(taeyoonPassageItem(target,[0,1,2,3][index%4],phase,index>=4?4:3));
      else if(itemKind==='sentence') items.push(taeyoonSentenceItem(target,itemPool,[5,7,3,6][index%4],phase,index>=4?4:3));
      else items.push(taeyoonWordItem(target,itemPool,[7,5,8,6][index%4],phase,index>=4?4:3));
    });
    const challengeTarget=selected[7];
    const challengeKind=targetKind(challengeTarget);
    const challengePool=taeyoonPoolForKind(challengeKind);
    challenge=challengeKind==='passage'
      ? taeyoonPassageItem(challengeTarget,4,phase,4)
      : challengeKind==='sentence'
        ? taeyoonSentenceItem(challengeTarget,challengePool,8,phase,4)
        : taeyoonWordItem(challengeTarget,challengePool,9,phase,4);
  }else if(kind==='word'){
    [7,1,2,3,8,5,6].forEach((variant,index)=>{
      items.push(taeyoonWordItem(selected[index],pool,variant,phase,index>=4?4:3));
    });
    challenge=taeyoonWordItem(selected[7],pool,9,phase,4);
  }else if(kind==='sentence'){
    [5,1,2,3,6,7,4].forEach((variant,index)=>{
      items.push(taeyoonSentenceItem(selected[index],pool,variant,phase,index>=4?4:3));
    });
    challenge=taeyoonSentenceItem(selected[7],pool,8,phase,4);
  }else{
    [0,1,2,3,1,2,1].forEach((variant,index)=>{
      items.push(taeyoonPassageItem(selected[index],variant,phase,index>=4?4:3));
    });
    challenge=taeyoonPassageItem(selected[7],4,phase,4);
  }
  items.push(writingItem(writingTargetFor(selected[0]),'copy',phase));
  items.push(writingItem(writingTargetFor(selected[1]),'dictation',phase));
  items.push(challenge);
  const withIds=items.map((item,index)=>Object.assign(item,{itemId:(isReview?'review':session.id)+':item-'+(index+1)}));
  return varyLearningItems(withIds,week.id+'|'+session.id+'|'+isReview,variantIndex);
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
function buildYoungerItems(week,session,isReview,supportLevel,variantIndex=0){
  const baseTargets=isReview?week.weeklyReview.targets:session.targets;
  const targets=rotatedTargets(baseTargets,variantIndex);
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
  const withIds=items.map((item,index)=>Object.assign(item,{itemId:(isReview?'review':session.id)+':item-'+(index+1)}));
  return varyLearningItems(withIds,week.id+'|'+session.id+'|'+isReview,variantIndex);
}
function supportLevelFor(profile){
  return profile.placement.result && profile.placement.result.supportLevel || 'picture-first';
}
function buildCourseItems(child,week,session,isReview,profile,variantIndex=0){
  return child==='older'
    ? buildTaeyoonItems(week,session,isReview,variantIndex)
    : buildYoungerItems(week,session,isReview,supportLevelFor(profile),variantIndex);
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
  const previous=profile.progress.completedSessions[state.activityId];
  state.variantIndex=previous && previous.completed?safeCount(previous.attempts):0;
  state.items=buildCourseItems(child,week,session,false,profile,state.variantIndex);
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
  const previous=profile.progress.weeklyReviews[state.activityId];
  state.replay=Boolean((previous || {}).completed);
  state.variantIndex=previous && previous.completed?safeCount(previous.attempts):0;
  state.items=buildCourseItems(child,week,week.weeklyReview,true,profile,state.variantIndex);
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
  const dictation=item.writingMode==='dictation';
  guide.textContent=dictation?'':item.writingTarget || item.targetId;
  guide.classList.toggle('copy',item.writingMode==='copy');
  if((item.writingTarget || '').length>=4) guide.style.fontSize=item.writingMode==='copy'?'clamp(32px,7vw,58px)':'clamp(64px,14vw,116px)';
  else guide.style.fontSize='';
  document.getElementById('writingStatus').textContent=dictation
    ? '소리를 듣고 써보세요. 다 쓴 뒤 정답을 확인해요.'
    : item.writingMode==='copy'
      ? '위 글자를 보고 아래 빈 곳에 충분히 크게 써보세요.'
      : '연한 가이드 위를 따라 충분히 크게 써보세요.';
  const revealButton=document.getElementById('revealWritingAnswer');
  revealButton.hidden=!dictation;
  revealButton.disabled=true;
  drawingUi.activeItemId=item.itemId;
  drawingUi.inkDistance=0;
  drawingUi.strokeDistance=0;
  drawingUi.strokeCount=0;
  drawingUi.bounds=null;
  drawingUi.metricsReady=false;
  drawingUi.answerRevealed=false;
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
  drawingUi.strokeDistance=0;
  if(drawingUi.tool==='pen') includeDrawingPoint(drawingUi.lastPoint);
}
function includeDrawingPoint(point){
  if(!drawingUi.bounds){
    drawingUi.bounds={minX:point.x,maxX:point.x,minY:point.y,maxY:point.y};
    return;
  }
  drawingUi.bounds.minX=Math.min(drawingUi.bounds.minX,point.x);
  drawingUi.bounds.maxX=Math.max(drawingUi.bounds.maxX,point.x);
  drawingUi.bounds.minY=Math.min(drawingUi.bounds.minY,point.y);
  drawingUi.bounds.maxY=Math.max(drawingUi.bounds.maxY,point.y);
}
function meaningfulWritingLength(target){
  const letters=Array.from(String(target || '')).filter(char=>/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(char));
  return Math.max(1,letters.length);
}
function drawingCompletionLimits(item){
  if(state.child==='younger') return {strokes:1,distance:80,width:35,height:30};
  const length=meaningfulWritingLength(item && (item.writingTarget || item.targetId));
  if(length===1) return {strokes:2,distance:90,width:38,height:30};
  if(length===2) return {strokes:3,distance:120,width:52,height:34};
  const extra=Math.min(3,length-3);
  return {strokes:4,distance:150+extra*10,width:65+extra*8,height:38};
}
function drawingMetricsReady(item=state.items[state.index]){
  if(!drawingUi.bounds) return false;
  const width=drawingUi.bounds.maxX-drawingUi.bounds.minX;
  const height=drawingUi.bounds.maxY-drawingUi.bounds.minY;
  const limits=drawingCompletionLimits(item);
  return drawingUi.strokeCount>=limits.strokes && drawingUi.inkDistance>=limits.distance && width>=limits.width && height>=limits.height;
}
function updateDrawingCompletion(){
  const item=state.items[state.index];
  if(!item || item.type!=='drawing') return;
  drawingUi.metricsReady=drawingMetricsReady(item);
  const revealButton=document.getElementById('revealWritingAnswer');
  const nextButton=document.getElementById('nextBtn');
  if(!drawingUi.metricsReady){
    nextButton.disabled=true;
    if(item.writingMode==='dictation') revealButton.disabled=true;
    return;
  }
  if(item.writingMode==='dictation' && !drawingUi.answerRevealed){
    state.answered=false;
    revealButton.disabled=false;
    nextButton.disabled=true;
    document.getElementById('writingStatus').textContent='잘 썼어요! 이제 정답을 눌러 비교해보세요.';
    return;
  }
  state.answered=true;
  nextButton.disabled=false;
  document.getElementById('writingStatus').textContent='좋아요! 글자 크기만큼 충분히 써보았어요. ✨';
}
function revealWritingAnswer(){
  const item=state.items[state.index];
  if(!item || item.type!=='drawing' || item.writingMode!=='dictation' || !drawingUi.metricsReady) return;
  const guide=document.getElementById('writingGuide');
  guide.textContent=item.writingTarget || item.targetId;
  guide.classList.add('copy');
  if((item.writingTarget || '').length>=4) guide.style.fontSize='clamp(32px,7vw,58px)';
  drawingUi.answerRevealed=true;
  document.getElementById('revealWritingAnswer').disabled=true;
  updateDrawingCompletion();
  speak(item.writingTarget || item.targetId);
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
  if(drawingUi.tool==='pen'){
    drawingUi.inkDistance+=distance;
    drawingUi.strokeDistance+=distance;
    includeDrawingPoint(previous);
    includeDrawingPoint(point);
  }
  drawingUi.lastPoint=point;
}
function endDrawing(event){
  if(!drawingUi.drawing) return;
  if(drawingUi.tool==='pen' && drawingUi.strokeDistance>=12) drawingUi.strokeCount++;
  drawingUi.drawing=false;
  drawingUi.lastPoint=null;
  drawingUi.strokeDistance=0;
  try{event.currentTarget.releasePointerCapture(event.pointerId);}catch(error){}
  updateDrawingCompletion();
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
    return (result.allPassed?'짧은 글 이해 준비됨 · 8주차':'테스트 결과 · '+(result.startWeek||1)+'주차 시작')+diagnosticText;
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
