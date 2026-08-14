'use strict';

const CURRICULUM=window.HANGUL_CURRICULUM;
const weekLetters=['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ'];
const letterSpeech=CURRICULUM.letterSpeech;

const words={
  'ㄱ':[
    {emoji:'🐶',word:'강아지',initial:'ㄱ'},
    {emoji:'🎒',word:'가방',initial:'ㄱ'},
    {emoji:'🚂',word:'기차',initial:'ㄱ'},
    {emoji:'⚽',word:'공',initial:'ㄱ'}
  ],
  'ㄴ':[
    {emoji:'🦋',word:'나비',initial:'ㄴ'},
    {emoji:'🌳',word:'나무',initial:'ㄴ'},
    {emoji:'👁️',word:'눈',initial:'ㄴ'},
    {emoji:'🎵',word:'노래',initial:'ㄴ'}
  ],
  'ㄷ':[
    {emoji:'🌙',word:'달',initial:'ㄷ'},
    {emoji:'🦵',word:'다리',initial:'ㄷ'},
    {emoji:'🍩',word:'도넛',initial:'ㄷ'},
    {emoji:'🐷',word:'돼지',initial:'ㄷ'}
  ],
  'ㄹ':[
    {emoji:'🤖',word:'로봇',initial:'ㄹ'},
    {emoji:'🍜',word:'라면',initial:'ㄹ'},
    {emoji:'📻',word:'라디오',initial:'ㄹ'},
    {emoji:'🎀',word:'리본',initial:'ㄹ'}
  ],
  'ㅁ':[
    {emoji:'🚪',word:'문',initial:'ㅁ'},
    {emoji:'💧',word:'물',initial:'ㅁ'},
    {emoji:'🍈',word:'멜론',initial:'ㅁ'},
    {emoji:'👒',word:'모자',initial:'ㅁ'}
  ],
  'ㅂ':[
    {emoji:'🍌',word:'바나나',initial:'ㅂ'},
    {emoji:'🌧️',word:'비',initial:'ㅂ'},
    {emoji:'🧼',word:'비누',initial:'ㅂ'},
    {emoji:'🍚',word:'밥',initial:'ㅂ'}
  ]
};

const distractors={
  'ㄱ':['ㄴ','ㄷ','ㄹ'],'ㄴ':['ㄱ','ㄷ','ㅁ'],'ㄷ':['ㄴ','ㄹ','ㅁ'],
  'ㄹ':['ㄱ','ㄷ','ㅁ'],'ㅁ':['ㄴ','ㄹ','ㅂ'],'ㅂ':['ㄴ','ㄷ','ㅁ']
};

let state={
  child:null,
  items:[],
  index:0,
  stars:0,
  answered:false,
  mode:'lesson',
  lessonIndex:0,
  currentLetter:'ㄱ'
};

let placementUi={waiting:false,finished:false};

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
      ? result.stageScores.map(value=>safeObject(value)).filter(Boolean).slice(0,5)
      : []
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
function normalizeProgress(progress){
  const clean=emptyProgress();
  if(!progress || typeof progress!=='object') return clean;
  if(progress.startWeek!==null && progress.startWeek!==undefined) clean.startWeek=Math.max(1,safeCount(progress.startWeek,8));
  if(progress.currentWeek!==null && progress.currentWeek!==undefined) clean.currentWeek=Math.max(1,safeCount(progress.currentWeek,8));
  clean.currentSession=Math.max(1,safeCount(progress.currentSession,5));
  clean.completedSessions=safeObject(progress.completedSessions,{}) || {};
  clean.weeklyReviews=safeObject(progress.weeklyReviews,{}) || {};
  clean.placedWeeks=Array.isArray(progress.placedWeeks)
    ? progress.placedWeeks.map(value=>safeCount(value,8)).filter(value=>value>0)
    : [];
  clean.courseCompleted=Boolean(progress.courseCompleted);
  return clean;
}
function normalizeProfile(profile,child){
  const clean=emptyProfile(child);
  if(!profile || typeof profile!=='object') return clean;
  clean.courseId=courseIdFor(child);
  clean.legacyStars=safeCount(profile.legacyStars);
  clean.stars=Math.max(safeCount(profile.stars),clean.legacyStars);
  clean.placement=normalizePlacement(profile.placement,child);
  clean.progress=normalizeProgress(profile.progress);
  clean.legacyV04=normalizeLegacyProfile(profile.legacyV04);
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
function progressText(profile){
  const legacy=profile.legacyV04;
  const review=legacy.weeklyReview.completed?' · 복습 완료':
    (legacy.completedLessons>=weekLetters.length?' · 복습 가능':'');
  return legacy.completedLessons+' / '+weekLetters.length+review;
}
function renderProgressStrip(elementId,profile){
  const labels=['1회','2회','3회','4회','5회','복습'];
  const legacy=profile.legacyV04;
  const element=document.getElementById(elementId);
  element.innerHTML='';
  labels.forEach((label,index)=>{
    const div=document.createElement('div');
    div.className='day';
    div.textContent=label;
    if(index<weekLetters.length){
      if(index<legacy.completedLessons) div.classList.add('done');
      else if(index===legacy.completedLessons) div.classList.add('active');
    }else if(legacy.weeklyReview.completed){
      div.classList.add('done');
    }else if(legacy.completedLessons>=weekLetters.length){
      div.classList.add('active');
    }else{
      div.classList.add('locked');
    }
    element.appendChild(div);
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
  renderProgressStrip('olderProgressStrip',data.children.older);
  renderProgressStrip('youngerProgressStrip',data.children.younger);
  document.getElementById('homeOlderProgress').textContent=progressText(data.children.older);
  document.getElementById('homeYoungerProgress').textContent=progressText(data.children.younger);
  document.getElementById('olderPlacementBadge').textContent=placementHomeLabel(data.children.older,'older');
  document.getElementById('youngerPlacementBadge').textContent=placementHomeLabel(data.children.younger,'younger');
  updateReviewAction();
}
function updateReviewAction(){
  const action=document.getElementById('reviewAction');
  if(!state.child){action.hidden=true;return;}
  const profile=store().children[state.child];
  const legacy=profile.legacyV04;
  if(legacy.completedLessons<weekLetters.length){action.hidden=true;return;}
  const who=childName(state.child);
  action.hidden=false;
  document.getElementById('reviewActionTitle').textContent=legacy.weeklyReview.completed
    ? who+' · 이번 주 학습 완료'
    : who+' · 주간복습 가능';
  document.getElementById('reviewActionText').textContent=legacy.weeklyReview.completed
    ? '주간복습까지 모두 마쳤어요. 원하면 다시 연습할 수 있어요.'
    : '5회 학습을 모두 마쳤어요. 준비되면 복습을 시작하세요.';
  document.getElementById('reviewActionButton').textContent=legacy.weeklyReview.completed
    ? '다시 연습하기'
    : '주간복습 시작';
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
  const legacy=profile.legacyV04;
  if(legacy.completedLessons>=weekLetters.length){
    state.mode=legacy.weeklyReview.completed?'complete':'review-ready';
    show('home');
    updateProgressDisplay();
    return;
  }
  startLesson(legacy.completedLessons);
}
function startSelectedWeeklyReview(){
  if(!state.child) return;
  const legacy=store().children[state.child].legacyV04;
  if(legacy.completedLessons>=weekLetters.length) startWeeklyReview();
}

function showPlacementIntro(child,profile){
  const isOlder=child==='older';
  const inProgress=profile.placement.status==='in-progress';
  document.getElementById('placementIntroTitle').textContent=childName(child)+' 레벨테스트';
  document.getElementById('placementIntroText').textContent=isOlder
    ? '자음부터 짧은 문장까지 차례로 확인해 알맞은 시작 주차를 추천해요. 약 5분 안에 끝나요.'
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
    stageScores:stageScores(test,attempt)
  };
  profile.placement.status='completed';
  profile.placement.testVersion=test.id;
  profile.placement.result=result;
  profile.placement.activeAttempt=null;
  profile.placement.attempts.push({...clone(result),answers:clone(attempt.answers)});
  profile.placement.attempts=profile.placement.attempts.slice(-5);
  profile.progress.startWeek=details.startWeek;
  profile.progress.currentWeek=details.startWeek;
  profile.progress.currentSession=1;
  profile.progress.placedWeeks=details.startWeek>1
    ? Array.from({length:details.startWeek-1},(_,index)=>index+1)
    : [];
  return result;
}
function advanceOlderPlacement(context){
  const {profile,attempt,test,stage}=context;
  const stageAnswers=answersForStage(attempt,stage.id);
  const correct=stageAnswers.filter(answer=>answer.correct).length;
  if(stageAnswers.length===1){attempt.questionIndex=1;return null;}
  if(stageAnswers.length===2 && correct===1){attempt.questionIndex=2;return null;}
  const passed=correct>=2;
  if(!passed){
    return finishPlacement(profile,attempt,test,{
      startWeek:stage.startWeek,
      failedStageId:stage.id,
      allPassed:false
    });
  }
  if(attempt.stageIndex===test.stages.length-1){
    return finishPlacement(profile,attempt,test,{startWeek:8,allPassed:true});
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
  profile.progress.startWeek=1;
  profile.progress.currentWeek=1;
  profile.progress.currentSession=1;
  profile.progress.placedWeeks=[];
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
  }else if(!skipped){
    headline=supportLevelLabel(result.supportLevel);
    detail='재윤은 테스트 결과와 관계없이 1주차부터 시작합니다.';
  }
  document.getElementById('placementResultHeadline').textContent=headline;
  document.getElementById('placementResultText').textContent=detail;
  show('placementResult');
  updateProgressDisplay();
}

function shuffled(values){return [...values].sort(()=>Math.random()-.5);}
function makeLearnItem(letter,wordObj,phase){return {type:'learn',letter,wordObj,phase};}
function makeQuizItem(letter,wordObj,phase){return {type:'quiz',letter,wordObj,phase};}
function startLesson(lessonIndex){
  state.mode='lesson';
  state.lessonIndex=lessonIndex;
  state.currentLetter=weekLetters[lessonIndex];
  state.items=[];
  if(lessonIndex>0){
    const previous=weekLetters[lessonIndex-1];
    shuffled(words[previous]).slice(0,2).forEach(word=>state.items.push(makeQuizItem(previous,word,'review')));
  }
  const newWords=shuffled(words[state.currentLetter]).slice(0,3);
  newWords.forEach((word,index)=>{
    state.items.push(index===0?makeLearnItem(state.currentLetter,word,'new'):makeQuizItem(state.currentLetter,word,'new'));
  });
  if(state.child==='older') state.items.push({type:'combine',letter:state.currentLetter,phase:'new'});
  else state.items.push(makeLearnItem(state.currentLetter,shuffled(words[state.currentLetter])[0],'new'));
  begin();
}
function startWeeklyReview(){
  state.mode='weekreview';
  state.lessonIndex=weekLetters.length;
  state.items=[];
  weekLetters.forEach(letter=>state.items.push(makeQuizItem(letter,shuffled(words[letter])[0],'weekreview')));
  begin();
}
function begin(){
  state.index=0;
  state.stars=0;
  state.answered=false;
  show('lesson');
  render();
}
function render(){
  if(state.index>=state.items.length){finish();return;}
  const item=state.items[state.index];
  state.answered=false;
  document.getElementById('nextBtn').disabled=true;
  document.getElementById('feedback').textContent='';
  document.getElementById('choices').innerHTML='';
  document.getElementById('progressText').textContent=(state.index+1)+' / '+state.items.length;
  document.getElementById('progressBar').style.width=(((state.index+1)/state.items.length)*100)+'%';
  document.getElementById('stars').textContent=state.stars;

  const isReview=item.phase==='review' || item.phase==='weekreview';
  document.getElementById('phaseBadge').textContent=
    item.phase==='review'?'🔁 이전 학습 복습 · 약 3분':
    item.phase==='weekreview'?'🧩 5회 학습 복습 · 약 10분':
    '🌱 새 학습 · 약 7분';
  document.getElementById('timeText').textContent=
    state.mode==='weekreview'?'주간 복습':(state.lessonIndex===0?'새 학습 중심':'복습 3분 + 새 학습 7분');

  if(item.type==='learn'){
    document.getElementById('lessonTitle').textContent=childName(state.child)+' · '+item.letter+' 배우기';
    document.getElementById('bigEmoji').textContent=item.wordObj.emoji;
    document.getElementById('bigLetter').textContent=item.letter;
    document.getElementById('word').textContent=item.wordObj.word;
    document.getElementById('hint').textContent=state.child==='older'
      ? item.wordObj.word+'의 첫 글자는 "'+item.letter+'"이에요.'
      : '그림을 보고 소리와 글자를 같이 익혀요.';
    const button=document.createElement('button');
    button.className='choice correct';
    button.textContent='알겠어요 👍';
    button.onclick=()=>{
      state.answered=true;
      document.getElementById('nextBtn').disabled=false;
      speak(item.wordObj.word+'. '+spokenLetter(item.letter)+' 소리로 시작해요.');
    };
    document.getElementById('choices').appendChild(button);
    speak(spokenLetter(item.letter)+'. '+item.wordObj.word);
    return;
  }
  if(item.type==='combine'){
    const vowelMap={'ㄱ':'가','ㄴ':'나','ㄷ':'다','ㄹ':'라','ㅁ':'마','ㅂ':'바'};
    document.getElementById('lessonTitle').textContent='태윤 · 글자 만들기';
    document.getElementById('bigEmoji').textContent='🧩';
    document.getElementById('bigLetter').textContent=item.letter+' + ㅏ';
    document.getElementById('word').textContent='무슨 글자가 될까요?';
    document.getElementById('hint').textContent='자음과 모음을 합쳐 보세요.';
    const answer=vowelMap[item.letter];
    const options=shuffled([answer,'사','자'].filter((value,index,array)=>array.indexOf(value)===index)).slice(0,3);
    renderChoices(options,answer,spokenLetter(item.letter)+'과 아가 만나서 '+answer);
    return;
  }
  document.getElementById('lessonTitle').textContent=childName(state.child)+(isReview?' · 복습 퀴즈':' · 오늘의 퀴즈');
  document.getElementById('bigEmoji').textContent=item.wordObj.emoji;
  document.getElementById('bigLetter').textContent='?';
  document.getElementById('word').textContent=item.wordObj.word;
  document.getElementById('hint').textContent=state.child==='older'
    ? '"'+item.wordObj.word+'"의 첫 글자를 골라보세요.'
    : '그림 이름을 듣고 첫 글자를 찾아보세요.';
  const options=shuffled([item.letter,...distractors[item.letter].slice(0,2)]);
  renderChoices(options,item.letter,item.wordObj.word+'의 첫 글자는 '+spokenLetter(item.letter));
  speak(item.wordObj.word+'. 첫 글자를 찾아보세요.');
}
function renderChoices(options,answer,successSpeech){
  const wrap=document.getElementById('choices');
  options.forEach(option=>{
    const button=document.createElement('button');
    button.className='choice';
    button.textContent=option;
    button.onclick=()=>{
      if(state.answered) return;
      state.answered=true;
      [...wrap.children].forEach(element=>element.disabled=true);
      if(option===answer){
        button.classList.add('correct');
        state.stars++;
        document.getElementById('stars').textContent=state.stars;
        document.getElementById('feedback').textContent='🎉 정답! 정말 잘했어요!';
        speak('정답! '+successSpeech);
      }else{
        button.classList.add('wrong');
        [...wrap.children].forEach(element=>{if(element.textContent===answer) element.classList.add('correct');});
        document.getElementById('feedback').textContent='괜찮아요. 정답을 같이 볼까요?';
        speak('정답은 '+spokenLetter(answer)+'이에요. 한 번 더 기억해요.');
      }
      document.getElementById('nextBtn').disabled=false;
    };
    wrap.appendChild(button);
  });
}
function spokenLetter(letter){return letterSpeech[letter] || letter;}
function speak(text){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='ko-KR';
  utterance.rate=0.85;
  utterance.pitch=1.05;
  speechSynthesis.speak(utterance);
}
function speakCurrent(){
  const item=state.items[state.index];
  if(!item) return;
  if(item.type==='combine') speak(spokenLetter(item.letter)+'과 아를 합쳐 보세요.');
  else speak(item.wordObj.word+'. '+spokenLetter(item.letter)+' 소리로 시작해요.');
}
function nextStep(){state.index++;render();}
function recordCurrentSession(profile){
  const legacy=profile.legacyV04;
  const now=new Date().toISOString();
  if(state.mode==='weekreview'){
    const previous=legacy.weeklyReview || {completed:false,bestStars:0,completedAt:null};
    const previousBest=safeCount(previous.bestStars);
    const awarded=previous.completed?0:state.stars;
    profile.stars+=awarded;
    legacy.weeklyReview={
      completed:true,
      bestStars:Math.max(previousBest,state.stars),
      completedAt:previous.completedAt || now
    };
    return {awarded,firstCompletion:!previous.completed};
  }
  const key='lesson-'+state.lessonIndex;
  const previous=legacy.records[key] || {completed:false,bestStars:0,completedAt:null};
  const previousBest=safeCount(previous.bestStars);
  const awarded=previous.completed?0:state.stars;
  profile.stars+=awarded;
  legacy.records[key]={
    completed:true,
    bestStars:Math.max(previousBest,state.stars),
    completedAt:previous.completedAt || now
  };
  if(!previous.completed) legacy.completedLessons=Math.max(legacy.completedLessons,state.lessonIndex+1);
  return {awarded,firstCompletion:!previous.completed};
}
function finish(){
  document.getElementById('progressBar').style.width='100%';
  const data=store();
  const profile=data.children[state.child];
  const result=recordCurrentSession(profile);
  save(data);
  const who=state.child==='older'?'태윤이':'재윤이';
  const isReview=state.mode==='weekreview';
  document.getElementById('doneTitle').textContent=isReview?'주간복습 완료!':'오늘 학습 완료!';
  const rewardText=result.awarded>0
    ? '누적 별에 <b>⭐ '+result.awarded+'개</b>가 반영되었어요.'
    : '반복 학습이라 누적 별은 중복해서 늘어나지 않아요.';
  document.getElementById('doneText').innerHTML=
    who+'가 오늘 <b>⭐ '+state.stars+'개</b>를 모았어요.<br>'+rewardText+'<br>'+
    (isReview
      ? '앞의 5회 학습에서 배운 ㄱ·ㄴ·ㄷ·ㄹ·ㅁ을 한 번씩 다시 확인했습니다.'
      : '짧게 끝내고 다음 학습에서 다시 만나는 것이 핵심이에요.');
  show('done');
  updateProgressDisplay();
  speak('오늘 한글 놀이 끝! 정말 잘했어요!');
}
function repeatToday(){
  if(state.mode==='weekreview') startWeeklyReview();
  else startLesson(state.lessonIndex);
}
function goHome(){show('home');updateProgressDisplay();}
function reviewStatus(profile){
  const legacy=profile.legacyV04;
  if(legacy.weeklyReview.completed) return '주간복습 완료';
  return legacy.completedLessons>=weekLetters.length?'주간복습 가능':'복습 잠김';
}
function parentPlacementStatus(profile,child){
  const placement=profile.placement;
  if(placement.status==='pending') return '레벨테스트 전';
  if(placement.status==='in-progress') return '레벨테스트 진행 중';
  if(placement.status==='skipped') return '테스트 건너뜀 · 1주차 시작';
  const result=placement.result || {};
  if(child==='older'){
    return result.allPassed?'문장 단계 준비됨 · 8주차':'테스트 결과 · '+(result.startWeek||1)+'주차 시작';
  }
  return '테스트 결과 · '+supportLevelLabel(result.supportLevel)+' · 1주차';
}
function openParent(){
  const data=store();
  const older=data.children.older;
  const younger=data.children.younger;
  document.getElementById('pOlderStars').textContent=older.stars+'개';
  document.getElementById('pOlderProgress').textContent=older.legacyV04.completedLessons+' / '+weekLetters.length;
  document.getElementById('pOlderReview').textContent=reviewStatus(older);
  document.getElementById('pOlderPlacement').textContent=parentPlacementStatus(older,'older');
  document.getElementById('pYoungerStars').textContent=younger.stars+'개';
  document.getElementById('pYoungerProgress').textContent=younger.legacyV04.completedLessons+' / '+weekLetters.length;
  document.getElementById('pYoungerReview').textContent=reviewStatus(younger);
  document.getElementById('pYoungerPlacement').textContent=parentPlacementStatus(younger,'younger');
  document.getElementById('parentModal').classList.add('show');
}
function closeParent(event){
  if(event.target.id==='parentModal') event.currentTarget.classList.remove('show');
}

updateProgressDisplay();

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}
