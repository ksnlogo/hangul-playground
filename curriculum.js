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

  const taeyoonWeeks=[
    week(1,'기본 자음 1','consonant',[
      session('session-1','ㄱ 만나기',['ㄱ'],['recognize','initial-sound']),
      session('session-2','ㄴ 만나기',['ㄴ'],['review','recognize','initial-sound']),
      session('session-3','ㄷ 만나기',['ㄷ'],['review','recognize','initial-sound']),
      session('session-4','ㄹ 만나기',['ㄹ'],['review','recognize','initial-sound']),
      session('session-5','ㅁ 만나기',['ㅁ'],['review','recognize','initial-sound'])
    ],weeklyReview(['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ'],['recognize','initial-sound'])),
    week(2,'기본 자음 2','consonant',[
      session('session-1','ㅂ 만나기',['ㅂ'],['review','recognize','initial-sound']),
      session('session-2','ㅅ 만나기',['ㅅ'],['review','recognize','initial-sound']),
      session('session-3','ㅇ 만나기',['ㅇ'],['review','recognize','initial-letter']),
      session('session-4','ㅈ 만나기',['ㅈ'],['review','recognize','initial-sound']),
      session('session-5','ㅊ 만나기',['ㅊ'],['review','recognize','initial-sound'])
    ],weeklyReview(['ㅂ','ㅅ','ㅇ','ㅈ','ㅊ'],['recognize','initial-letter'])),
    week(3,'자음 구별하기','consonant',[
      session('session-1','ㅋ 만나기',['ㅋ'],['review','recognize','initial-sound']),
      session('session-2','ㅌ 만나기',['ㅌ'],['review','recognize','initial-sound']),
      session('session-3','ㅍ 만나기',['ㅍ'],['review','recognize','initial-sound']),
      session('session-4','ㅎ 만나기',['ㅎ'],['review','recognize','initial-sound']),
      session('session-5','자음 친구 구별하기',['ㄱ','ㅋ','ㄷ','ㅌ','ㅂ','ㅍ','ㅈ','ㅊ'],['discriminate'])
    ],weeklyReview(['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'],['recognize','discriminate'])),
    week(4,'기본 모음 1','vowel',[
      session('session-1','ㅏ 만나기',['ㅏ'],['recognize','sound-match']),
      session('session-2','ㅑ 만나기',['ㅑ'],['review','recognize','sound-match']),
      session('session-3','ㅓ 만나기',['ㅓ'],['review','recognize','sound-match']),
      session('session-4','ㅕ 만나기',['ㅕ'],['review','recognize','sound-match']),
      session('session-5','ㅗ 만나기',['ㅗ'],['review','recognize','sound-match'])
    ],weeklyReview(['ㅏ','ㅑ','ㅓ','ㅕ','ㅗ'],['recognize','sound-match'])),
    week(5,'기본 모음 2','vowel',[
      session('session-1','ㅛ 만나기',['ㅛ'],['review','recognize','sound-match']),
      session('session-2','ㅜ 만나기',['ㅜ'],['review','recognize','sound-match']),
      session('session-3','ㅠ 만나기',['ㅠ'],['review','recognize','sound-match']),
      session('session-4','ㅡ 만나기',['ㅡ'],['review','recognize','sound-match']),
      session('session-5','ㅣ 만나기',['ㅣ'],['review','recognize','sound-match'])
    ],weeklyReview(['ㅛ','ㅜ','ㅠ','ㅡ','ㅣ'],['recognize','discriminate'])),
    week(6,'자음과 모음 합치기','syllable',[
      session('session-1','ㅏ와 글자 만들기',['가','나','다','라','마'],['combine','read-syllable']),
      session('session-2','ㅓ와 글자 만들기',['거','너','더','러','머'],['combine','read-syllable']),
      session('session-3','ㅗ와 글자 만들기',['고','노','도','로','모'],['combine','read-syllable']),
      session('session-4','ㅜ와 글자 만들기',['구','누','두','루','무'],['combine','read-syllable']),
      session('session-5','모음 바꾸어 읽기',['가','거','고','구','기'],['combine','discriminate'])
    ],weeklyReview(['가','나','다','라','마','거','너','더','러','머','고','노','도','로','모','구','누','두','루','무'],['combine','read-syllable'])),
    week(7,'받침 없는 쉬운 단어 읽기','word',[
      session('session-1','동물 단어',['나비','오리','사자'],['picture-word','read-word']),
      session('session-2','음식 단어',['우유','오이','바나나'],['picture-word','read-word']),
      session('session-3','생활 단어',['모자','비누','나무'],['picture-word','read-word']),
      session('session-4','두세 글자 단어',['기차','다리','바다'],['picture-word','read-word']),
      session('session-5','쉬운 단어 다시 읽기',['나비','우유','모자','기차'],['picture-word','read-word'])
    ],weeklyReview(['나비','오리','사자','우유','오이','바나나','모자','비누','나무','기차','다리','바다'],['picture-word','read-word'])),
    week(8,'짧은 문장 읽기','sentence',[
      session('session-1','아기가 자요',['아기가 자요.'],['picture-sentence','read-sentence']),
      session('session-2','나비가 와요',['나비가 와요.'],['picture-sentence','read-sentence']),
      session('session-3','기차가 가요',['기차가 가요.'],['picture-sentence','read-sentence']),
      session('session-4','우유를 마셔요',['우유를 마셔요.'],['picture-sentence','read-sentence']),
      session('session-5','사자가 와요',['사자가 와요.'],['picture-sentence','read-sentence'])
    ],weeklyReview(['아기가 자요.','나비가 와요.','기차가 가요.','우유를 마셔요.','사자가 와요.'],['picture-sentence','read-sentence']))
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
      session('session-1','ㄱ 소리 친구',['강아지','가방','기차','공'],['initial-exposure','same-initial']),
      session('session-2','ㅁ 소리 친구',['모자','문','물','멜론'],['initial-exposure','same-initial']),
      session('session-3','ㅂ 소리 친구',['버스','바나나','밥','비행기'],['initial-exposure','same-initial']),
      session('session-4','ㅅ 소리 친구',['사과','사자','손'],['initial-exposure','same-initial']),
      session('session-5','첫 소리 친구 모으기',['ㄱ','ㅁ','ㅂ','ㅅ'],['same-initial'])
    ],weeklyReview(['ㄱ','ㅁ','ㅂ','ㅅ'],['same-initial'])),
    week(8,'전체 종합 놀이','mixed-play',[
      session('session-1','가족과 동물',['가족','동물'],['picture-find','picture-word']),
      session('session-2','탈것과 음식',['탈것','음식'],['picture-find','picture-word']),
      session('session-3','몸과 내 물건',['몸','생활물건'],['picture-find','picture-word']),
      session('session-4','첫 소리 놀이',['ㄱ','ㅁ','ㅂ','ㅅ'],['initial-exposure','same-initial']),
      session('session-5','내가 좋아하는 한글 놀이',['가족','동물','탈것','음식','몸','장난감'],['picture-find','picture-word','same-initial'])
    ],weeklyReview(['가족','동물','탈것','음식','몸','장난감','첫 글자'],['picture-find','picture-word','same-initial']))
  ];

  const taeyoonTest={
    id:'taeyoon-placement-v2',
    title:'태윤 한글 읽기 레벨테스트',
    estimatedMinutes:5,
    maxQuestions:15,
    stages:[
      {
        id:'consonant',label:'자음',startWeek:1,
        questions:[
          question('t-c-1','symbol','ㄱ','기역을 찾아보세요.','기역을 찾아보세요.',[choice('ㄱ','ㄱ','기역'),choice('ㄴ','ㄴ','니은'),choice('ㄷ','ㄷ','디귿')],'ㄱ'),
          question('t-c-2','symbol','ㄴ','니은을 찾아보세요.','니은을 찾아보세요.',[choice('ㅁ','ㅁ','미음'),choice('ㄴ','ㄴ','니은'),choice('ㄹ','ㄹ','리을')],'ㄴ'),
          question('t-c-3','symbol','ㅁ','미음을 찾아보세요.','미음을 찾아보세요.',[choice('ㅂ','ㅂ','비읍'),choice('ㅁ','ㅁ','미음'),choice('ㄷ','ㄷ','디귿')],'ㅁ')
        ]
      },
      {
        id:'vowel',label:'모음',startWeek:4,
        questions:[
          question('t-v-1','symbol','ㅏ','아 소리의 모음을 찾아보세요.','아 소리의 모음을 찾아보세요.',[choice('ㅏ','ㅏ','아'),choice('ㅓ','ㅓ','어'),choice('ㅗ','ㅗ','오')],'ㅏ'),
          question('t-v-2','symbol','ㅗ','오 소리의 모음을 찾아보세요.','오 소리의 모음을 찾아보세요.',[choice('ㅜ','ㅜ','우'),choice('ㅗ','ㅗ','오'),choice('ㅡ','ㅡ','으')],'ㅗ'),
          question('t-v-3','symbol','ㅣ','이 소리의 모음을 찾아보세요.','이 소리의 모음을 찾아보세요.',[choice('ㅏ','ㅏ','아'),choice('ㅣ','ㅣ','이'),choice('ㅡ','ㅡ','으')],'ㅣ')
        ]
      },
      {
        id:'syllable',label:'자음+모음 조합',startWeek:6,
        questions:[
          question('t-sy-1','syllable','ㄱ + ㅏ','기역과 아가 만나면 어떤 글자가 될까요?','기역과 아가 만나면 어떤 글자가 될까요?',[choice('가','가'),choice('나','나'),choice('다','다')],'가'),
          question('t-sy-2','syllable','ㄴ + ㅏ','니은과 아가 만나면 어떤 글자가 될까요?','니은과 아가 만나면 어떤 글자가 될까요?',[choice('마','마'),choice('나','나'),choice('라','라')],'나'),
          question('t-sy-3','syllable','ㅁ + ㅜ','미음과 우가 만나면 어떤 글자가 될까요?','미음과 우가 만나면 어떤 글자가 될까요?',[choice('누','누'),choice('부','부'),choice('무','무')],'무')
        ]
      },
      {
        id:'word',label:'쉬운 단어',startWeek:7,
        questions:[
          question('t-w-1','word','🐶','강아지에 맞는 낱말을 찾아보세요.','강아지에 맞는 낱말을 찾아보세요.',[choice('강아지','강아지'),choice('나비','나비'),choice('모자','모자')],'강아지'),
          question('t-w-2','word','🍎','사과에 맞는 낱말을 찾아보세요.','사과에 맞는 낱말을 찾아보세요.',[choice('우유','우유'),choice('사과','사과'),choice('기차','기차')],'사과'),
          question('t-w-3','word','🚂','기차에 맞는 낱말을 찾아보세요.','기차에 맞는 낱말을 찾아보세요.',[choice('바나나','바나나'),choice('기차','기차'),choice('다리','다리')],'기차')
        ]
      },
      {
        id:'sentence',label:'짧은 문장',startWeek:8,
        questions:[
          question('t-se-1','sentence','😴👶','그림에 맞는 문장을 찾아보세요.','아기가 자는 그림이에요. 알맞은 문장을 찾아보세요.',[choice('아기가 자요.','아기가 자요.'),choice('기차가 가요.','기차가 가요.'),choice('사과가 있어요.','사과가 있어요.')],'아기가 자요.'),
          question('t-se-2','sentence','🚂💨','그림에 맞는 문장을 찾아보세요.','기차가 가는 그림이에요. 알맞은 문장을 찾아보세요.',[choice('나비가 와요.','나비가 와요.'),choice('기차가 가요.','기차가 가요.'),choice('우유를 마셔요.','우유를 마셔요.')],'기차가 가요.'),
          question('t-se-3','sentence','🦁👋','그림에 맞는 문장을 찾아보세요.','사자가 오는 그림이에요. 알맞은 문장을 찾아보세요.',[choice('나비가 와요.','나비가 와요.'),choice('아기가 자요.','아기가 자요.'),choice('사자가 와요.','사자가 와요.')],'사자가 와요.')
        ]
      }
    ]
  };

  const jaeyoonTest={
    id:'jaeyoon-placement-v2',
    title:'재윤 한글 놀이 레벨테스트',
    estimatedMinutes:3,
    maxQuestions:9,
    stages:[
      {
        id:'picture-find',label:'그림 찾기',supportLevelOnFail:'picture-first',
        questions:[
          question('j-p-1','picture','👩','엄마를 찾아보세요.','엄마를 찾아보세요.',[choice('mom','👩 엄마','엄마'),choice('dog','🐶 강아지','강아지')],'mom'),
          question('j-p-2','picture','🐱','고양이를 찾아보세요.','고양이를 찾아보세요.',[choice('cat','🐱 고양이','고양이'),choice('bus','🚌 버스','버스')],'cat'),
          question('j-p-3','picture','🍎','사과를 찾아보세요.','사과를 찾아보세요.',[choice('apple','🍎 사과','사과'),choice('ball','⚽ 공','공')],'apple')
        ]
      },
      {
        id:'sound-link',label:'그림·소리·단어 모양 연결',supportLevelOnFail:'sound-link',
        questions:[
          question('j-l-1','picture-word','🚗','자동차 그림과 같은 카드를 찾아보세요.','자동차 그림과 같은 카드를 찾아보세요.',[choice('car','🚗 자동차','자동차'),choice('bread','🍞 빵','빵')],'car'),
          question('j-l-2','picture-word','🐰','토끼 그림과 같은 카드를 찾아보세요.','토끼 그림과 같은 카드를 찾아보세요.',[choice('milk','🥛 우유','우유'),choice('rabbit','🐰 토끼','토끼')],'rabbit'),
          question('j-l-3','picture-word','🤖','로봇 그림과 같은 카드를 찾아보세요.','로봇 그림과 같은 카드를 찾아보세요.',[choice('robot','🤖 로봇','로봇'),choice('banana','🍌 바나나','바나나')],'robot')
        ]
      },
      {
        id:'initial-experience',label:'첫 글자 소리 경험',supportLevelOnFail:'initial-intro',
        questions:[
          question('j-i-1','initial-sound','👩 엄마','엄마와 같은 미음 소리로 시작하는 그림을 찾아보세요.','엄마와 같은 미음 소리로 시작하는 그림을 찾아보세요.',[choice('hat','👒 모자','모자'),choice('dog','🐶 강아지','강아지')],'hat'),
          question('j-i-2','initial-sound','🚌 버스','버스와 같은 비읍 소리로 시작하는 그림을 찾아보세요.','버스와 같은 비읍 소리로 시작하는 그림을 찾아보세요.',[choice('apple','🍎 사과','사과'),choice('banana','🍌 바나나','바나나')],'banana'),
          question('j-i-3','initial-sound','🐶 강아지','강아지와 같은 기역 소리로 시작하는 그림을 찾아보세요.','강아지와 같은 기역 소리로 시작하는 그림을 찾아보세요.',[choice('train','🚂 기차','기차'),choice('rabbit','🐰 토끼','토끼')],'train')
        ]
      }
    ]
  };

  window.HANGUL_CURRICULUM={
    version:'0.5-B',
    letterSpeech:{
      'ㄱ':'기역','ㄴ':'니은','ㄷ':'디귿','ㄹ':'리을','ㅁ':'미음','ㅂ':'비읍','ㅅ':'시옷',
      'ㅇ':'이응','ㅈ':'지읒','ㅊ':'치읓','ㅋ':'키읔','ㅌ':'티읕','ㅍ':'피읖','ㅎ':'히읗',
      'ㅏ':'아','ㅑ':'야','ㅓ':'어','ㅕ':'여','ㅗ':'오','ㅛ':'요','ㅜ':'우','ㅠ':'유','ㅡ':'으','ㅣ':'이'
    },
    courses:{
      older:{id:'taeyoon-reading-v1',learnerKey:'older',name:'태윤 한글 읽기 코스',weeks:taeyoonWeeks},
      younger:{id:'jaeyoon-play-v1',learnerKey:'younger',name:'재윤 한글 놀이 코스',weeks:jaeyoonWeeks}
    },
    levelTests:{older:taeyoonTest,younger:jaeyoonTest}
  };
})();
