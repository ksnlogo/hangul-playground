(function(){
  'use strict';

  const session=(id,title,targets,activityTypes)=>({id,title,targets,activityTypes});
  const weeklyReview=(targets,activityTypes)=>({id:'review',title:'주간복습',targets,activityTypes});
  const week=(number,title,stage,sessions,review)=>({
    id:'week-'+number,
    number,
    title,
    stage,
    sessions,
    weeklyReview:review
  });
  const choice=(id,label,speech=label)=>({id,label,speech});
  const question=(id,type,display,prompt,speech,choices,answer)=>({
    id,type,display,prompt,speech,choices,answer
  });
  const diagnosticQuestion=(id,type,display,prompt,speech,choices,answer,metadata)=>(
    Object.assign(question(id,type,display,prompt,speech,choices,answer),metadata)
  );

  const taeyoonWeeks=[
    week(1,'받침 없는 낱말 읽기와 쓰기','word-basic',[
      session('session-1','나비·오리·사자',['나비','오리','사자'],['read-word','word-parts','writing']),
      session('session-2','우유·오이·바나나',['우유','오이','바나나'],['review','read-word','fill-word','writing']),
      session('session-3','모자·비누·나무',['모자','비누','나무'],['review','read-word','word-parts','writing']),
      session('session-4','기차·다리·바다',['기차','다리','바다'],['review','read-word','fill-word','writing']),
      session('session-5','쉬운 낱말 도전',['나비','우유','모자','기차'],['review','read-word','challenge','writing'])
    ],weeklyReview(['나비','오리','사자','우유','오이','바나나','모자','비누','나무','기차','다리','바다'],['read-word','fill-word','writing'])),
    week(2,'쉬운 받침 낱말 읽기','word-final-basic',[
      session('session-1','눈·문·공',['눈','문','공'],['review','read-word','final-syllable','writing']),
      session('session-2','달·손·발',['달','손','발'],['review','read-word','final-syllable','writing']),
      session('session-3','밥·책·집',['밥','책','집'],['review','read-word','fill-word','writing']),
      session('session-4','옷·꽃·산',['옷','꽃','산'],['review','read-word','discriminate','writing']),
      session('session-5','받침 낱말 모으기',['눈','문','공','달','손','발','밥','책'],['review','read-word','challenge','writing'])
    ],weeklyReview(['눈','문','공','달','손','발','밥','책','집','옷','꽃','산'],['read-word','final-syllable','writing'])),
    week(3,'다양한 받침 낱말 구별하기','word-final-varied',[
      session('session-1','밤·별·산',['밤','별','산'],['review','read-word','discriminate','writing']),
      session('session-2','꽃·옷·빛',['꽃','옷','빛'],['review','read-word','discriminate','writing']),
      session('session-3','약·입·집',['약','입','집'],['review','read-word','final-syllable','writing']),
      session('session-4','책·공·문',['책','공','문'],['review','read-word','fill-word','writing']),
      session('session-5','받침 구별 도전',['밤','별','꽃','옷','약','입','책','공'],['review','discriminate','challenge','writing'])
    ],weeklyReview(['밤','별','산','꽃','옷','빛','약','입','집','책','공','문'],['read-word','discriminate','writing'])),
    week(4,'비슷한 글자 구별과 낱말 완성','word-completion',[
      session('session-1','눈과 문',['눈','문','눈물'],['review','discriminate','fill-word','writing']),
      session('session-2','달과 발',['달','발','다리'],['review','discriminate','fill-word','writing']),
      session('session-3','밤과 밥',['밤','밥','바다'],['review','discriminate','fill-word','writing']),
      session('session-4','꽃과 옷',['꽃','옷','오이'],['review','discriminate','fill-word','writing']),
      session('session-5','낱말 완성 도전',['눈','문','달','발','밤','밥','꽃','옷'],['review','fill-word','challenge','writing'])
    ],weeklyReview(['눈','문','눈물','달','발','다리','밤','밥','바다','꽃','옷','오이'],['discriminate','fill-word','writing'])),
    week(5,'짧은 문장 읽기','sentence-read',[
      session('session-1','기차가 가요',['기차가 가요.','나비가 와요.'],['review','read-sentence','sentence-order','writing']),
      session('session-2','아기가 자요',['아기가 자요.','사자가 와요.'],['review','read-sentence','sentence-meaning','writing']),
      session('session-3','우유를 마셔요',['우유를 마셔요.','오리가 가요.'],['review','read-sentence','fill-sentence','writing']),
      session('session-4','공이 굴러가요',['공이 굴러가요.','달이 떠요.'],['review','read-sentence','sentence-order','writing']),
      session('session-5','짧은 문장 도전',['기차가 가요.','아기가 자요.','우유를 마셔요.'],['review','read-sentence','challenge','writing'])
    ],weeklyReview(['기차가 가요.','나비가 와요.','아기가 자요.','사자가 와요.','우유를 마셔요.','오리가 가요.','공이 굴러가요.','달이 떠요.'],['read-sentence','sentence-order','writing'])),
    week(6,'문장 완성과 의미 이해','sentence-understanding',[
      session('session-1','문장 빈칸 채우기',['나비가 꽃에 앉아요.','기차가 역에 와요.'],['review','fill-sentence','sentence-meaning','writing']),
      session('session-2','낱말 순서 맞추기',['아기가 우유를 마셔요.','사자가 산에 가요.'],['review','sentence-order','sentence-meaning','writing']),
      session('session-3','누가 무엇을 하나요',['오리가 물에서 놀아요.','태윤이가 책을 봐요.'],['review','sentence-meaning','fill-sentence','writing']),
      session('session-4','어디에서 하나요',['재윤이가 방에서 자요.','나비가 꽃에 앉아요.'],['review','sentence-meaning','sentence-order','writing']),
      session('session-5','문장 이해 도전',['기차가 역에 와요.','오리가 물에서 놀아요.','태윤이가 책을 봐요.'],['review','sentence-meaning','challenge','writing'])
    ],weeklyReview(['나비가 꽃에 앉아요.','기차가 역에 와요.','아기가 우유를 마셔요.','사자가 산에 가요.','오리가 물에서 놀아요.','태윤이가 책을 봐요.','재윤이가 방에서 자요.'],['fill-sentence','sentence-meaning','writing'])),
    week(7,'짧은 글 읽고 답하기','passage',[
      session('session-1','나비와 꽃',['나비가 날아와요.\n나비가 꽃에 앉아요.'],['review','read-passage','passage-question','writing']),
      session('session-2','기차와 역',['기차가 달려요.\n기차가 역에 와요.'],['review','read-passage','passage-question','writing']),
      session('session-3','아기와 우유',['아기가 배가 고파요.\n아기가 우유를 마셔요.'],['review','read-passage','passage-question','writing']),
      session('session-4','오리와 물',['오리가 물에 가요.\n오리가 물에서 놀아요.'],['review','read-passage','passage-question','writing']),
      session('session-5','짧은 글 도전',['나비가 날아와요.\n나비가 꽃에 앉아요.','기차가 달려요.\n기차가 역에 와요.'],['review','passage-question','challenge','writing'])
    ],weeklyReview(['나비가 날아와요.\n나비가 꽃에 앉아요.','기차가 달려요.\n기차가 역에 와요.','아기가 배가 고파요.\n아기가 우유를 마셔요.','오리가 물에 가요.\n오리가 물에서 놀아요.'],['read-passage','passage-question','writing'])),
    week(8,'읽기·이해·쓰기 종합','integrated',[
      session('session-1','낱말 종합',['나비','기차','눈','문','책','꽃'],['review','read-word','fill-word','writing']),
      session('session-2','문장 종합',['기차가 역에 와요.','나비가 꽃에 앉아요.'],['review','read-sentence','sentence-meaning','writing']),
      session('session-3','짧은 글 종합',['아기가 배가 고파요.\n아기가 우유를 마셔요.'],['review','read-passage','passage-question','writing']),
      session('session-4','읽고 완성하기',['오리가 물에서 놀아요.','태윤이가 책을 봐요.'],['review','fill-sentence','sentence-order','writing']),
      session('session-5','마지막 종합 도전',['나비가 꽃에 앉아요.','기차가 역에 와요.','아기가 우유를 마셔요.'],['review','sentence-meaning','challenge','writing'])
    ],weeklyReview(['나비','기차','눈','문','책','꽃','나비가 꽃에 앉아요.','기차가 역에 와요.','아기가 우유를 마셔요.'],['read','understand','writing']))
  ];

  const jaeyoonWeeks=[
    week(1,'가족','family',[
      session('session-1','엄마',['👩 엄마'],['picture-find','picture-word']),
      session('session-2','아빠',['👨 아빠'],['picture-find','picture-word']),
      session('session-3','태윤과 재윤',['👦🏻 태윤','🧒🏻 재윤'],['picture-find','picture-word']),
      session('session-4','할머니와 할아버지',['👵 할머니','👴 할아버지'],['picture-find','picture-word']),
      session('session-5','우리 가족',['👩 엄마','👨 아빠','👦🏻 태윤','🧒🏻 재윤','👶 아기'],['picture-find','picture-word','initial-exposure'])
    ],weeklyReview(['엄마','아빠','태윤','재윤','아기','할머니','할아버지'],['picture-find','picture-word'])),
    week(2,'동물','animals',[
      session('session-1','강아지',['🐶 강아지'],['picture-find','picture-word']),
      session('session-2','고양이',['🐱 고양이'],['picture-find','picture-word']),
      session('session-3','토끼',['🐰 토끼'],['picture-find','picture-word']),
      session('session-4','사자와 원숭이',['🦁 사자','🐵 원숭이'],['picture-find','picture-word']),
      session('session-5','동물 친구들',['🐶 강아지','🐱 고양이','🐰 토끼'],['picture-find','picture-word','initial-exposure'])
    ],weeklyReview(['강아지','고양이','토끼','사자','원숭이'],['picture-find','picture-word'])),
    week(3,'탈것','vehicles',[
      session('session-1','자동차',['🚗 자동차'],['picture-find','picture-word']),
      session('session-2','버스',['🚌 버스'],['picture-find','picture-word']),
      session('session-3','기차',['🚂 기차'],['picture-find','picture-word']),
      session('session-4','비행기와 배',['✈️ 비행기','🚢 배'],['picture-find','picture-word']),
      session('session-5','탈것 친구들',['🚗 자동차','🚌 버스','🚂 기차'],['picture-find','picture-word','initial-exposure'])
    ],weeklyReview(['자동차','버스','기차','비행기','배'],['picture-find','picture-word'])),
    week(4,'음식','food',[
      session('session-1','밥',['🍚 밥'],['picture-find','picture-word']),
      session('session-2','사과',['🍎 사과'],['picture-find','picture-word']),
      session('session-3','바나나',['🍌 바나나'],['picture-find','picture-word']),
      session('session-4','우유와 빵',['🥛 우유','🍞 빵'],['picture-find','picture-word']),
      session('session-5','맛있는 음식',['🍚 밥','🍎 사과','🍌 바나나'],['picture-find','picture-word','initial-exposure'])
    ],weeklyReview(['밥','사과','바나나','우유','빵'],['picture-find','picture-word'])),
    week(5,'몸','body',[
      session('session-1','눈',['👁️ 눈'],['picture-find','picture-word']),
      session('session-2','코',['👃 코'],['picture-find','picture-word']),
      session('session-3','입',['👄 입'],['picture-find','picture-word']),
      session('session-4','손과 발',['✋ 손','🦶 발'],['picture-find','picture-word']),
      session('session-5','내 몸',['👁️ 눈','👃 코','👄 입','✋ 손','🦶 발'],['picture-find','picture-word','initial-exposure'])
    ],weeklyReview(['눈','코','입','손','발'],['picture-find','picture-word'])),
    week(6,'장난감과 생활물건','toys-and-objects',[
      session('session-1','공',['⚽ 공'],['picture-find','picture-word']),
      session('session-2','로봇',['🤖 로봇'],['picture-find','picture-word']),
      session('session-3','책',['📚 책'],['picture-find','picture-word']),
      session('session-4','가방',['🎒 가방'],['picture-find','picture-word']),
      session('session-5','모자',['👒 모자'],['picture-find','picture-word','initial-exposure'])
    ],weeklyReview(['공','로봇','책','가방','모자'],['picture-find','picture-word'])),
    week(7,'같은 첫 글자 찾기','same-initial',[
      session('session-1','ㄱ 첫 글자 친구',['강아지','가방','기차','공'],['initial-exposure','same-initial']),
      session('session-2','ㅁ 첫 글자 친구',['모자','문','물','멜론'],['initial-exposure','same-initial']),
      session('session-3','ㅂ 첫 글자 친구',['버스','바나나','밥','비행기'],['initial-exposure','same-initial']),
      session('session-4','ㅅ 첫 글자 친구',['사과','사자','손'],['initial-exposure','same-initial']),
      session('session-5','첫 글자 친구 모으기',['ㄱ','ㅁ','ㅂ','ㅅ'],['same-initial'])
    ],weeklyReview(['ㄱ','ㅁ','ㅂ','ㅅ'],['same-initial'])),
    week(8,'전체 종합 놀이','mixed-play',[
      session('session-1','가족과 동물',['가족','동물'],['picture-find','picture-word']),
      session('session-2','탈것과 음식',['탈것','음식'],['picture-find','picture-word']),
      session('session-3','몸과 내 물건',['몸','생활물건'],['picture-find','picture-word']),
      session('session-4','첫 소리 놀이',['ㄱ','ㅁ','ㅂ','ㅅ'],['initial-exposure','same-initial']),
      session('session-5','내가 좋아하는 한글 놀이',['가족','동물','탈것','음식','몸','장난감'],['picture-find','picture-word','same-initial'])
    ],weeklyReview(['가족','동물','탈것','음식','몸','장난감','첫 글자'],['picture-find','picture-word','same-initial']))
  ];

  const jaeyoonProgression={
    1:{level:'picture-foundation',skills:['sound-picture','picture-word','word-exposure'],writing:'initial-consonant'},
    2:{level:'picture-foundation',skills:['sound-picture','picture-word','word-exposure'],writing:'initial-consonant'},
    3:{level:'sound-word-link',skills:['picture-word','sound-word','picture-first-syllable','same-initial'],writing:'first-syllable'},
    4:{level:'sound-word-link',skills:['picture-word','sound-word','picture-first-syllable','same-initial'],writing:'first-syllable'},
    5:{level:'word-discrimination',skills:['sound-word','sound-first-syllable','similar-word','word-completion'],writing:'single-syllable'},
    6:{level:'word-discrimination',skills:['sound-word','sound-first-syllable','similar-word','word-completion'],writing:'single-syllable'},
    7:{level:'audio-word-challenge',skills:['audio-word','first-syllable-category','word-completion'],writing:'familiar-word'},
    8:{level:'audio-word-challenge',skills:['audio-word','first-syllable-category','word-completion'],writing:'familiar-word'}
  };

  const stage=(id,label,questionBank,options={})=>Object.assign({id,label,sampleCount:3,questionBank},options);
  const wordPicture=(id,word,options,answer)=>question(
    id,'word-picture',word,'낱말을 읽고 알맞은 그림을 찾아보세요.','낱말을 읽고 알맞은 그림을 골라보세요.',
    options.map(([value,emoji])=>choice(value,emoji,value)),answer
  );
  const sentencePicture=(id,sentence,options,answer)=>question(
    id,'sentence-picture',sentence,'문장을 읽고 뜻에 맞는 그림을 찾아보세요.','문장을 읽고 알맞은 그림을 골라보세요.',
    options.map(([value,emoji])=>choice(value,emoji,value)),answer
  );
  const readingQuestion=(id,type,display,prompt,options,answer)=>question(
    id,type,display,prompt,type==='passage-understanding'?'짧은 글을 읽고 질문에 답해보세요.':'문장을 읽고 질문에 답해보세요.',
    options.map(value=>choice(value,value,value)),answer
  );

  const taeyoonWordBasicBank=[
    wordPicture('t-wb-01','나비',[['나비','🦋'],['기차','🚂'],['사과','🍎']],'나비'),
    wordPicture('t-wb-02','우유',[['오이','🥒'],['우유','🥛'],['모자','👒']],'우유'),
    wordPicture('t-wb-03','기차',[['바나나','🍌'],['나무','🌳'],['기차','🚂']],'기차'),
    wordPicture('t-wb-04','오리',[['오리','🦆'],['사자','🦁'],['비누','🧼']],'오리'),
    wordPicture('t-wb-05','사자',[['나비','🦋'],['사자','🦁'],['우유','🥛']],'사자'),
    wordPicture('t-wb-06','오이',[['오이','🥒'],['기차','🚂'],['나무','🌳']],'오이'),
    wordPicture('t-wb-07','바나나',[['바다','🌊'],['바나나','🍌'],['오리','🦆']],'바나나'),
    wordPicture('t-wb-08','모자',[['모자','👒'],['우유','🥛'],['사자','🦁']],'모자'),
    wordPicture('t-wb-09','비누',[['기차','🚂'],['비누','🧼'],['나비','🦋']],'비누'),
    wordPicture('t-wb-10','나무',[['나무','🌳'],['오이','🥒'],['모자','👒']],'나무'),
    wordPicture('t-wb-11','다리',[['다리','🦵'],['바다','🌊'],['오리','🦆']],'다리'),
    wordPicture('t-wb-12','바다',[['나무','🌳'],['바다','🌊'],['바나나','🍌']],'바다')
  ];
  const taeyoonWordFinalBank=[
    wordPicture('t-wf-01','눈',[['눈','👁️'],['문','🚪'],['공','⚽']],'눈'),
    wordPicture('t-wf-02','문',[['달','🌙'],['문','🚪'],['눈','👁️']],'문'),
    wordPicture('t-wf-03','공',[['공','⚽'],['책','📚'],['발','🦶']],'공'),
    wordPicture('t-wf-04','달',[['달','🌙'],['손','✋'],['집','🏠']],'달'),
    wordPicture('t-wf-05','손',[['발','🦶'],['손','✋'],['옷','👕']],'손'),
    wordPicture('t-wf-06','발',[['공','⚽'],['발','🦶'],['문','🚪']],'발'),
    wordPicture('t-wf-07','밥',[['밥','🍚'],['꽃','🌼'],['책','📚']],'밥'),
    wordPicture('t-wf-08','책',[['집','🏠'],['책','📚'],['눈','👁️']],'책'),
    wordPicture('t-wf-09','집',[['옷','👕'],['문','🚪'],['집','🏠']],'집'),
    wordPicture('t-wf-10','옷',[['손','✋'],['옷','👕'],['달','🌙']],'옷')
  ];
  const taeyoonVariedFinalBank=[
    wordPicture('t-wv-01','밤',[['밤','🌙'],['발','🦶'],['밥','🍚']],'밤'),
    wordPicture('t-wv-02','별',[['별','⭐'],['꽃','🌼'],['책','📚']],'별'),
    wordPicture('t-wv-03','산',[['산','⛰️'],['집','🏠'],['옷','👕']],'산'),
    wordPicture('t-wv-04','꽃',[['빛','💡'],['꽃','🌼'],['약','💊']],'꽃'),
    wordPicture('t-wv-05','옷',[['입','👄'],['옷','👕'],['밤','🌙']],'옷'),
    wordPicture('t-wv-06','빛',[['별','⭐'],['빛','💡'],['책','📚']],'빛'),
    wordPicture('t-wv-07','약',[['약','💊'],['입','👄'],['집','🏠']],'약'),
    wordPicture('t-wv-08','입',[['꽃','🌼'],['입','👄'],['산','⛰️']],'입'),
    wordPicture('t-wv-09','집',[['옷','👕'],['밤','🌙'],['집','🏠']],'집'),
    wordPicture('t-wv-10','책',[['책','📚'],['산','⛰️'],['빛','💡']],'책')
  ];
  const taeyoonWordCompletionBank=[
    question('t-wc-01','fill-word','□물','빈칸에 들어갈 글자를 찾아보세요.','낱말의 빈칸에 들어갈 글자를 찾아보세요.',[choice('눈','눈'),choice('국','국'),choice('괴','괴')],'눈'),
    question('t-wc-02','fill-word','□다','빈칸에 들어갈 글자를 찾아보세요.','낱말의 빈칸에 들어갈 글자를 찾아보세요.',[choice('바','바'),choice('가','가'),choice('오','오')],'바'),
    question('t-wc-03','fill-word','기□','빈칸에 들어갈 글자를 찾아보세요.','낱말의 빈칸에 들어갈 글자를 찾아보세요.',[choice('자','자'),choice('차','차'),choice('사','사')],'차'),
    question('t-wc-04','similar-word','밤하늘에 밝게 떠요.','설명에 맞는 낱말을 찾아보세요.','설명을 읽고 알맞은 낱말을 찾아보세요.',[choice('달','달'),choice('발','발'),choice('말','말')],'달'),
    question('t-wc-05','similar-word','문을 열고 들어가는 곳이에요.','설명에 맞는 낱말을 찾아보세요.','설명을 읽고 알맞은 낱말을 찾아보세요.',[choice('집','집'),choice('입','입'),choice('빛','빛')],'집'),
    question('t-wc-06','similar-word','음식을 먹는 몸의 부분이에요.','설명에 맞는 낱말을 찾아보세요.','설명을 읽고 알맞은 낱말을 찾아보세요.',[choice('옷','옷'),choice('입','입'),choice('집','집')],'입'),
    question('t-wc-07','complete-word','ㅂ + ㅏ + ㄹ','글자 조각을 합쳐 낱말을 완성해보세요.','글자 조각을 합쳐 알맞은 낱말을 찾아보세요.',[choice('달','달'),choice('발','발'),choice('말','말')],'발'),
    question('t-wc-08','complete-word','ㅂ + ㅏ + ㅁ','글자 조각을 합쳐 낱말을 완성해보세요.','글자 조각을 합쳐 알맞은 낱말을 찾아보세요.',[choice('밤','밤'),choice('밥','밥'),choice('발','발')],'밤'),
    question('t-wc-09','complete-word','ㅂ + ㅏ + ㅂ','글자 조각을 합쳐 낱말을 완성해보세요.','글자 조각을 합쳐 알맞은 낱말을 찾아보세요.',[choice('밤','밤'),choice('밥','밥'),choice('발','발')],'밥'),
    question('t-wc-10','fill-word','□리','빈칸에 들어갈 글자를 찾아보세요.','낱말의 빈칸에 들어갈 글자를 찾아보세요.',[choice('오','오'),choice('다','다'),choice('소','소')],'오')
  ];
  const taeyoonSentenceBank=[
    sentencePicture('t-sr-01','기차가 가요.',[['기차가 가요.','🚂💨'],['나비가 와요.','🦋👋'],['우유를 마셔요.','🥛😋']],'기차가 가요.'),
    sentencePicture('t-sr-02','아기가 자요.',[['아기가 자요.','👶😴'],['공이 굴러가요.','⚽💨'],['달이 떠요.','🌙✨']],'아기가 자요.'),
    sentencePicture('t-sr-03','우유를 마셔요.',[['사자가 와요.','🦁👋'],['우유를 마셔요.','🥛😋'],['오리가 가요.','🦆➡️']],'우유를 마셔요.'),
    sentencePicture('t-sr-04','나비가 와요.',[['나비가 와요.','🦋👋'],['기차가 가요.','🚂💨'],['달이 떠요.','🌙✨']],'나비가 와요.'),
    sentencePicture('t-sr-05','사자가 와요.',[['아기가 자요.','👶😴'],['사자가 와요.','🦁👋'],['공이 굴러가요.','⚽💨']],'사자가 와요.'),
    sentencePicture('t-sr-06','오리가 가요.',[['우유를 마셔요.','🥛😋'],['오리가 가요.','🦆➡️'],['나비가 와요.','🦋👋']],'오리가 가요.'),
    sentencePicture('t-sr-07','공이 굴러가요.',[['공이 굴러가요.','⚽💨'],['달이 떠요.','🌙✨'],['기차가 가요.','🚂💨']],'공이 굴러가요.'),
    sentencePicture('t-sr-08','달이 떠요.',[['아기가 자요.','👶😴'],['달이 떠요.','🌙✨'],['사자가 와요.','🦁👋']],'달이 떠요.'),
    sentencePicture('t-sr-09','태윤이가 책을 봐요.',[['태윤이가 책을 봐요.','👦🏻📚'],['재윤이가 자요.','🧒🏻😴'],['기차가 와요.','🚂👋']],'태윤이가 책을 봐요.'),
    sentencePicture('t-sr-10','재윤이가 자요.',[['우유를 마셔요.','🥛😋'],['재윤이가 자요.','🧒🏻😴'],['공이 굴러가요.','⚽💨']],'재윤이가 자요.')
  ];
  const taeyoonSentenceUnderstandingBank=[
    readingQuestion('t-su-01','sentence-understanding','나비가 꽃에 앉아요.','나비는 어디에 앉았나요?',['꽃','기차','우유'],'꽃'),
    readingQuestion('t-su-02','sentence-understanding','기차가 역에 와요.','무엇이 역에 왔나요?',['오리','기차','사자'],'기차'),
    readingQuestion('t-su-03','sentence-understanding','아기가 우유를 마셔요.','아기는 무엇을 마시나요?',['우유','물고기','책'],'우유'),
    readingQuestion('t-su-04','sentence-understanding','사자가 산에 가요.','사자는 어디에 가나요?',['바다','산','방'],'산'),
    readingQuestion('t-su-05','sentence-understanding','오리가 물에서 놀아요.','누가 물에서 노나요?',['나비','오리','태윤'],'오리'),
    readingQuestion('t-su-06','sentence-understanding','태윤이가 책을 봐요.','태윤이는 무엇을 보나요?',['책','공','꽃'],'책'),
    readingQuestion('t-su-07','sentence-understanding','재윤이가 방에서 자요.','재윤이는 어디에서 자나요?',['역','방','산'],'방'),
    readingQuestion('t-su-08','sentence-understanding','공이 문 앞에 있어요.','공은 어디에 있나요?',['문 앞','꽃 위','기차 안'],'문 앞'),
    readingQuestion('t-su-09','sentence-understanding','달이 밤하늘에 떠요.','언제 달이 떠 있나요?',['밤','아침','점심'],'밤'),
    readingQuestion('t-su-10','sentence-understanding','아빠가 버스를 타요.','아빠는 무엇을 타나요?',['기차','버스','배'],'버스')
  ];
  const taeyoonPassageBank=[
    readingQuestion('t-pu-01','passage-understanding','나비가 날아와요.\n나비가 꽃에 앉아요.','나비는 마지막에 어디에 앉았나요?',['꽃','버스','책'],'꽃'),
    readingQuestion('t-pu-02','passage-understanding','기차가 달려요.\n기차가 역에 와요.','기차는 마지막에 어디에 왔나요?',['산','역','방'],'역'),
    readingQuestion('t-pu-03','passage-understanding','아기가 배가 고파요.\n아기가 우유를 마셔요.','아기는 왜 우유를 마셨나요?',['배가 고파서','잠이 와서','기차를 타려고'],'배가 고파서'),
    readingQuestion('t-pu-04','passage-understanding','오리가 물에 가요.\n오리가 물에서 놀아요.','오리는 물에서 무엇을 하나요?',['자요','놀아요','책을 봐요'],'놀아요'),
    readingQuestion('t-pu-05','passage-understanding','태윤이가 책을 펴요.\n태윤이가 책을 읽어요.','태윤이는 무엇을 읽나요?',['책','편지','지도'],'책'),
    readingQuestion('t-pu-06','passage-understanding','재윤이가 공을 찾아요.\n공은 문 앞에 있어요.','공은 어디에 있었나요?',['문 앞','책 위','버스 안'],'문 앞'),
    readingQuestion('t-pu-07','passage-understanding','밤이 되었어요.\n달이 하늘에 떠요.','하늘에 무엇이 떴나요?',['해','달','구름'],'달'),
    readingQuestion('t-pu-08','passage-understanding','아빠가 버스에 타요.\n버스가 집으로 가요.','버스는 어디로 가나요?',['집','산','학교'],'집')
  ];
  const taeyoonFallbackBank=[
    question('t-fb-01','sound-syllable','🔊','소리를 듣고 글자를 찾아보세요.','가. 들은 글자를 찾아보세요.',[choice('가','가'),choice('나','나'),choice('다','다')],'가'),
    question('t-fb-02','sound-syllable','🔊','소리를 듣고 글자를 찾아보세요.','나. 들은 글자를 찾아보세요.',[choice('마','마'),choice('나','나'),choice('라','라')],'나'),
    question('t-fb-03','sound-syllable','🔊','소리를 듣고 글자를 찾아보세요.','모. 들은 글자를 찾아보세요.',[choice('노','노'),choice('모','모'),choice('도','도')],'모'),
    question('t-fb-04','combine','ㄱ + ㅏ','두 글자 조각을 합쳐보세요.','기역과 아를 합쳐보세요.',[choice('나','나'),choice('가','가'),choice('다','다')],'가'),
    question('t-fb-05','combine','ㄴ + ㅗ','두 글자 조각을 합쳐보세요.','니은과 오를 합쳐보세요.',[choice('노','노'),choice('모','모'),choice('고','고')],'노'),
    question('t-fb-06','combine','ㅁ + ㅜ','두 글자 조각을 합쳐보세요.','미음과 우를 합쳐보세요.',[choice('누','누'),choice('무','무'),choice('부','부')],'무'),
    question('t-fb-07','sound-letter','🔊','들은 자음을 찾아보세요.','기역을 찾아보세요.',[choice('ㄴ','ㄴ','니은'),choice('ㄱ','ㄱ','기역'),choice('ㄷ','ㄷ','디귿')],'ㄱ'),
    question('t-fb-08','sound-letter','🔊','들은 자음을 찾아보세요.','미음을 찾아보세요.',[choice('ㅂ','ㅂ','비읍'),choice('ㄹ','ㄹ','리을'),choice('ㅁ','ㅁ','미음')],'ㅁ'),
    question('t-fb-09','sound-letter','🔊','들은 모음을 찾아보세요.','아 소리의 모음을 찾아보세요.',[choice('ㅓ','ㅓ','어'),choice('ㅏ','ㅏ','아'),choice('ㅗ','ㅗ','오')],'ㅏ'),
    question('t-fb-10','sound-letter','🔊','들은 모음을 찾아보세요.','우 소리의 모음을 찾아보세요.',[choice('ㅗ','ㅗ','오'),choice('ㅡ','ㅡ','으'),choice('ㅜ','ㅜ','우')],'ㅜ')
  ];

  const taeyoonTest={
    id:'taeyoon-placement-v6',
    title:'태윤 한글 읽기 레벨테스트',
    estimatedMinutes:8,
    maxQuestions:24,
    stages:[
      stage('word-basic','받침 없는 낱말 읽기',taeyoonWordBasicBank,{startWeek:1,fallbackStageId:'foundation-fallback'}),
      stage('word-final-basic','쉬운 받침 낱말 읽기',taeyoonWordFinalBank,{startWeek:2}),
      stage('word-final-varied','다양한 받침 낱말 읽기',taeyoonVariedFinalBank,{startWeek:3}),
      stage('word-completion','비슷한 낱말 구별과 완성',taeyoonWordCompletionBank,{startWeek:4}),
      stage('sentence-read','짧은 문장 읽기',taeyoonSentenceBank,{startWeek:5}),
      stage('sentence-understanding','문장 내용 이해',taeyoonSentenceUnderstandingBank,{startWeek:6}),
      stage('passage-understanding','짧은 글 이해',taeyoonPassageBank,{startWeek:7}),
      stage('foundation-fallback','음절·자모 보충 진단',taeyoonFallbackBank,{fallbackOnly:true,startWeek:1})
    ]
  };

  const jaeyoonPictureWordBank=[
    diagnosticQuestion('j-ptw-01','picture-to-word','🚂','그림 이름을 찾아보세요.','그림을 보고 알맞은 낱말을 찾아보세요.',[choice('기차','기차'),choice('모자','모자'),choice('우유','우유')],'기차',{targetWord:'기차',cue:'picture'}),
    diagnosticQuestion('j-ptw-02','picture-to-word','👒','그림 이름을 찾아보세요.','그림을 보고 알맞은 낱말을 찾아보세요.',[choice('모자','모자'),choice('사과','사과'),choice('버스','버스')],'모자',{targetWord:'모자',cue:'picture'}),
    diagnosticQuestion('j-ptw-03','picture-to-word','🥛','그림 이름을 찾아보세요.','그림을 보고 알맞은 낱말을 찾아보세요.',[choice('우유','우유'),choice('토끼','토끼'),choice('가방','가방')],'우유',{targetWord:'우유',cue:'picture'}),
    diagnosticQuestion('j-ptw-04','picture-to-word','🍎','그림 이름을 찾아보세요.','그림을 보고 알맞은 낱말을 찾아보세요.',[choice('사과','사과'),choice('기차','기차'),choice('로봇','로봇')],'사과',{targetWord:'사과',cue:'picture'}),
    diagnosticQuestion('j-ptw-05','picture-to-word','🐰','그림 이름을 찾아보세요.','그림을 보고 알맞은 낱말을 찾아보세요.',[choice('토끼','토끼'),choice('우유','우유'),choice('책','책')],'토끼',{targetWord:'토끼',cue:'picture'}),
    diagnosticQuestion('j-ptw-06','picture-to-word','⚽','그림 이름을 찾아보세요.','그림을 보고 알맞은 낱말을 찾아보세요.',[choice('공','공'),choice('빵','빵'),choice('눈','눈')],'공',{targetWord:'공',cue:'picture'}),
    diagnosticQuestion('j-ptw-07','picture-to-word','📚','그림 이름을 찾아보세요.','그림을 보고 알맞은 낱말을 찾아보세요.',[choice('책','책'),choice('발','발'),choice('배','배')],'책',{targetWord:'책',cue:'picture'}),
    diagnosticQuestion('j-ptw-08','picture-to-word','🤖','그림 이름을 찾아보세요.','그림을 보고 알맞은 낱말을 찾아보세요.',[choice('로봇','로봇'),choice('사자','사자'),choice('문','문')],'로봇',{targetWord:'로봇',cue:'picture'})
  ];
  const jaeyoonSoundWordBank=[
    diagnosticQuestion('j-stw-01','sound-to-word','🔊','들은 낱말을 찾아보세요.','바나나. 들은 낱말을 찾아보세요.',[choice('바나나','바나나'),choice('자동차','자동차'),choice('사과','사과')],'바나나',{targetWord:'바나나',cue:'sound'}),
    diagnosticQuestion('j-stw-02','sound-to-word','🔊','들은 낱말을 찾아보세요.','자동차. 들은 낱말을 찾아보세요.',[choice('자동차','자동차'),choice('강아지','강아지'),choice('모자','모자')],'자동차',{targetWord:'자동차',cue:'sound'}),
    diagnosticQuestion('j-stw-03','sound-to-word','🔊','들은 낱말을 찾아보세요.','강아지. 들은 낱말을 찾아보세요.',[choice('강아지','강아지'),choice('고양이','고양이'),choice('기차','기차')],'강아지',{targetWord:'강아지',cue:'sound'}),
    diagnosticQuestion('j-stw-04','sound-to-word','🔊','들은 낱말을 찾아보세요.','버스. 들은 낱말을 찾아보세요.',[choice('버스','버스'),choice('우유','우유'),choice('로봇','로봇')],'버스',{targetWord:'버스',cue:'sound'}),
    diagnosticQuestion('j-stw-05','sound-to-word','🔊','들은 낱말을 찾아보세요.','고양이. 들은 낱말을 찾아보세요.',[choice('고양이','고양이'),choice('토끼','토끼'),choice('가방','가방')],'고양이',{targetWord:'고양이',cue:'sound'}),
    diagnosticQuestion('j-stw-06','sound-to-word','🔊','들은 낱말을 찾아보세요.','빵. 들은 낱말을 찾아보세요.',[choice('빵','빵'),choice('공','공'),choice('책','책')],'빵',{targetWord:'빵',cue:'sound'}),
    diagnosticQuestion('j-stw-07','sound-to-word','🔊','들은 낱말을 찾아보세요.','사자. 들은 낱말을 찾아보세요.',[choice('사자','사자'),choice('모자','모자'),choice('우유','우유')],'사자',{targetWord:'사자',cue:'sound'}),
    diagnosticQuestion('j-stw-08','sound-to-word','🔊','들은 낱말을 찾아보세요.','가방. 들은 낱말을 찾아보세요.',[choice('가방','가방'),choice('기차','기차'),choice('사과','사과')],'가방',{targetWord:'가방',cue:'sound'})
  ];
  const jaeyoonSoundFirstSyllableBank=[
    diagnosticQuestion('j-sfs-01','sound-to-first-syllable','🔊','들은 낱말의 첫 글자를 찾아보세요.','기차. 첫 글자를 찾아보세요.',[choice('기','기'),choice('모','모'),choice('사','사')],'기',{targetWord:'기차',targetSyllable:'기',cue:'sound'}),
    diagnosticQuestion('j-sfs-02','sound-to-first-syllable','🔊','들은 낱말의 첫 글자를 찾아보세요.','모자. 첫 글자를 찾아보세요.',[choice('모','모'),choice('나','나'),choice('우','우')],'모',{targetWord:'모자',targetSyllable:'모',cue:'sound'}),
    diagnosticQuestion('j-sfs-03','sound-to-first-syllable','🔊','들은 낱말의 첫 글자를 찾아보세요.','사과. 첫 글자를 찾아보세요.',[choice('사','사'),choice('자','자'),choice('바','바')],'사',{targetWord:'사과',targetSyllable:'사',cue:'sound'}),
    diagnosticQuestion('j-sfs-04','sound-to-first-syllable','🔊','들은 낱말의 첫 글자를 찾아보세요.','바나나. 첫 글자를 찾아보세요.',[choice('바','바'),choice('기','기'),choice('토','토')],'바',{targetWord:'바나나',targetSyllable:'바',cue:'sound'}),
    diagnosticQuestion('j-sfs-05','sound-to-first-syllable','🔊','들은 낱말의 첫 글자를 찾아보세요.','토끼. 첫 글자를 찾아보세요.',[choice('토','토'),choice('코','코'),choice('로','로')],'토',{targetWord:'토끼',targetSyllable:'토',cue:'sound'}),
    diagnosticQuestion('j-sfs-06','sound-to-first-syllable','🔊','들은 낱말의 첫 글자를 찾아보세요.','로봇. 첫 글자를 찾아보세요.',[choice('로','로'),choice('모','모'),choice('오','오')],'로',{targetWord:'로봇',targetSyllable:'로',cue:'sound'}),
    diagnosticQuestion('j-sfs-07','sound-to-first-syllable','🔊','들은 낱말의 첫 글자를 찾아보세요.','책. 첫 글자를 찾아보세요.',[choice('책','책'),choice('배','배'),choice('공','공')],'책',{targetWord:'책',targetSyllable:'책',cue:'sound'}),
    diagnosticQuestion('j-sfs-08','sound-to-first-syllable','🔊','들은 낱말의 첫 글자를 찾아보세요.','우유. 첫 글자를 찾아보세요.',[choice('우','우'),choice('오','오'),choice('아','아')],'우',{targetWord:'우유',targetSyllable:'우',cue:'sound'})
  ];
  const jaeyoonSameInitialBank=[
    diagnosticQuestion('j-sis-01','same-initial-sound','🔊','같은 첫소리로 시작하는 그림을 찾아보세요.','모자. 같은 첫소리로 시작하는 그림을 찾아보세요.',[choice('물','💧','물'),choice('강아지','🐶','강아지'),choice('빵','🍞','빵')],'물',{targetWord:'모자',answerWord:'물',relation:'same-initial',cue:'sound'}),
    diagnosticQuestion('j-sis-02','same-initial-sound','🔊','같은 첫소리로 시작하는 그림을 찾아보세요.','토끼. 같은 첫소리로 시작하는 그림을 찾아보세요.',[choice('토마토','🍅','토마토'),choice('코','👃','코'),choice('사과','🍎','사과')],'토마토',{targetWord:'토끼',answerWord:'토마토',relation:'same-initial',cue:'sound'}),
    diagnosticQuestion('j-sis-03','same-initial-sound','🔊','같은 첫소리로 시작하는 그림을 찾아보세요.','책. 같은 첫소리로 시작하는 그림을 찾아보세요.',[choice('치마','👗','치마'),choice('자동차','🚗','자동차'),choice('모자','👒','모자')],'치마',{targetWord:'책',answerWord:'치마',relation:'same-initial',cue:'sound'}),
    diagnosticQuestion('j-sis-04','same-initial-sound','🔊','같은 첫소리로 시작하는 그림을 찾아보세요.','로봇. 같은 첫소리로 시작하는 그림을 찾아보세요.',[choice('라디오','📻','라디오'),choice('다리','🦵','다리'),choice('가방','🎒','가방')],'라디오',{targetWord:'로봇',answerWord:'라디오',relation:'same-initial',cue:'sound'}),
    diagnosticQuestion('j-sis-05','same-initial-sound','🔊','같은 첫소리로 시작하는 그림을 찾아보세요.','기차. 같은 첫소리로 시작하는 그림을 찾아보세요.',[choice('강아지','🐶','강아지'),choice('모자','👒','모자'),choice('사과','🍎','사과')],'강아지',{targetWord:'기차',answerWord:'강아지',relation:'same-initial',cue:'sound'}),
    diagnosticQuestion('j-sis-06','same-initial-sound','🔊','같은 첫소리로 시작하는 그림을 찾아보세요.','바나나. 같은 첫소리로 시작하는 그림을 찾아보세요.',[choice('버스','🚌','버스'),choice('사과','🍎','사과'),choice('모자','👒','모자')],'버스',{targetWord:'바나나',answerWord:'버스',relation:'same-initial',cue:'sound'}),
    diagnosticQuestion('j-sis-07','same-initial-sound','🔊','같은 첫소리로 시작하는 그림을 찾아보세요.','사자. 같은 첫소리로 시작하는 그림을 찾아보세요.',[choice('손','✋','손'),choice('기차','🚂','기차'),choice('우유','🥛','우유')],'손',{targetWord:'사자',answerWord:'손',relation:'same-initial',cue:'sound'}),
    diagnosticQuestion('j-sis-08','same-initial-sound','🔊','같은 첫소리로 시작하는 그림을 찾아보세요.','우유. 같은 첫소리로 시작하는 그림을 찾아보세요.',[choice('오리','🦆','오리'),choice('나비','🦋','나비'),choice('모자','👒','모자')],'오리',{targetWord:'우유',answerWord:'오리',relation:'same-initial',cue:'sound'})
  ];
  const jaeyoonTest={
    id:'jaeyoon-placement-v6',
    title:'재윤 한글 놀이 레벨테스트',
    estimatedMinutes:4,
    maxQuestions:12,
    stages:[
      stage('picture-to-word','그림 보고 낱말 찾기',jaeyoonPictureWordBank,{supportLevelOnFail:'picture-first'}),
      stage('sound-to-word','소리 듣고 낱말 찾기',jaeyoonSoundWordBank,{supportLevelOnFail:'sound-link'}),
      stage('sound-to-first-syllable','소리 듣고 첫 글자 찾기',jaeyoonSoundFirstSyllableBank,{supportLevelOnFail:'initial-intro'}),
      stage('same-initial-sound','같은 첫소리 찾기',jaeyoonSameInitialBank,{supportLevelOnFail:'initial-intro'})
    ]
  };

  window.HANGUL_CURRICULUM={
    version:'0.5-D.2',
    letterSpeech:{
      'ㄱ':'기역','ㄴ':'니은','ㄷ':'디귿','ㄹ':'리을','ㅁ':'미음','ㅂ':'비읍','ㅅ':'시옷',
      'ㅇ':'이응','ㅈ':'지읒','ㅊ':'치읓','ㅋ':'키읔','ㅌ':'티읕','ㅍ':'피읖','ㅎ':'히읗',
      'ㅏ':'아','ㅑ':'야','ㅓ':'어','ㅕ':'여','ㅗ':'오','ㅛ':'요','ㅜ':'우','ㅠ':'유','ㅡ':'으','ㅣ':'이'
    },
    courses:{
      older:{
        id:'taeyoon-reading-v2',learnerKey:'older',name:'태윤 한글 읽기 코스',weeks:taeyoonWeeks,
        remediation:{
          preservedSkillIds:['consonant-recognize','vowel-sound-match','combine','split-syllable','sound-syllable'],
          strategy:'word-to-syllable-to-jamo'
        }
      },
      younger:{
        id:'jaeyoon-play-v1',learnerKey:'younger',name:'재윤 한글 놀이 코스',weeks:jaeyoonWeeks,
        progression:jaeyoonProgression
      }
    },
    levelTests:{older:taeyoonTest,younger:jaeyoonTest}
  };
})();
