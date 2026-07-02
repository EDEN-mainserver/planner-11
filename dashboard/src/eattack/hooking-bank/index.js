export const EXAM_QUESTION_COUNT = 10;

export const ENGINES = [
  {
    key: "fast_slow_brain",
    label: "빠른 뇌 vs 느린 뇌",
    group: "토대",
    stage: "기초",
    definition: "0~3초 안에 논리보다 즉각 반응으로 승부가 난다.",
    tell: "0.5초 안에 이해되는 쉬운 자극",
    formulas: ["이거 보면 끝남", "딱 봐도 다르죠?", "[대상]이라면 바로 이해하는 [상황]"],
    examples: ["이거 보면 끝남", "딱 봐도 다르죠?"],
    weakExample: "이 영상은 다음 세 가지 이유로 볼 가치가 있습니다",
    strongExample: "이거 하나만 보면 됩니다",
    diagnosis: "설명이 길고 빠른 뇌가 바로 잡을 자극이 없다.",
    prescription: "첫 문장을 한 호흡으로 줄이고 익숙한 단어 하나에 힘을 실어라.",
  },
  {
    key: "cognitive_ease",
    label: "인지 편안함",
    group: "토대",
    stage: "기초",
    definition: "이해가 쉬울수록 더 믿고 더 오래 본다.",
    tell: "쉬운 단어, 짧은 문장, 한 문장 한 정보",
    formulas: ["한 줄로 끝내드림", "초등학생도 아는 [주제]", "[복잡한 것] 쉽게 정리"],
    examples: ["한 줄로 끝내드림", "초등학생도 아는 방법"],
    weakExample: "객단가 제고를 위한 다각적 접근",
    strongExample: "손님 한 명이 더 쓰게 만드는 법",
    diagnosis: "전문 용어와 긴 문장 때문에 스쳐 보는 사람이 멈칫한다.",
    prescription: "한자어를 쉬운 말로 바꾸고 문장을 둘로 쪼개라.",
  },
  {
    key: "variable_reward",
    label: "가변 보상",
    group: "토대",
    stage: "기초",
    definition: "다음 보상이 예측되지 않을 때 계속 보게 된다.",
    tell: "다음 보상·반전·결과를 바로 주지 않음",
    formulas: ["마지막에 반전 있음", "끝까지 봐야 하는 이유", "다음이 진짜입니다"],
    examples: ["마지막에 반전 있음", "끝까지 봐야 함"],
    weakExample: "결론부터 말하면 A입니다",
    strongExample: "1등은 의외였어요. 5위부터 갈게요",
    diagnosis: "결과를 너무 빨리 알려줘서 뒤를 볼 이유가 사라졌다.",
    prescription: "가장 큰 보상을 뒤로 미루고 중간 보상을 계단식으로 배치하라.",
  },
  {
    key: "attention_currency",
    label: "주의 = 화폐",
    group: "토대",
    stage: "기초",
    definition: "매 순간 시청자가 주의를 지불할 이유를 줘야 한다.",
    tell: "첫 프레임부터 마지막까지 값이 있음",
    formulas: ["첫 장면부터 결론", "멈추는 자막", "지금 볼 이유를 계속 제공"],
    examples: ["첫 장면부터 결론", "멈추는 자막"],
    weakExample: "잡담으로 시작하는 도입",
    strongExample: "첫 1초에 문제와 보상을 동시에 제시",
    diagnosis: "초반 이후 주의값을 계속 갚지 못한다.",
    prescription: "각 3초마다 새 정보·질문·보상 중 하나를 배치하라.",
  },
  {
    key: "amp_specificity",
    label: "구체성·숫자",
    group: "증폭기",
    stage: "MSG",
    definition: "숫자와 구체어가 후킹의 믿음과 강도를 키운다.",
    tell: "3일, 87%, 9가지, 30만 원처럼 구체 숫자",
    formulas: ["[숫자]년 차도 모르는 [분야] 꿀팁", "[숫자]%가 놓치는 [상황]", "[기간] 안에 [결과]"],
    examples: ["3일 만에 1000명", "87%가 모르는"],
    weakExample: "많은 사람이 놓치는 방법",
    strongExample: "자영업자 87%가 놓치는 단골 만드는 한마디",
    diagnosis: "맞는 말이지만 막연해서 꽂히지 않는다.",
    prescription: "형용사·부사를 숫자·기간·수량으로 바꿔라.",
  },
  {
    key: "amp_secondperson",
    label: "2인칭 호명",
    group: "증폭기",
    stage: "MSG",
    definition: "직접 부르면 내 얘기가 되어 관련성이 오른다.",
    tell: "당신, 대표님, OO하는 분들, 특정 집단 호명",
    formulas: ["[연령대]라면 주목", "[직업] 대표님, 이 실수 하지 마세요", "혹시 당신도 [상황]인가요?"],
    examples: ["당신만 모르는", "30대라면 주목"],
    weakExample: "사람들이 자주 하는 실수",
    strongExample: "헬스 3개월 차가 꼭 겪는 정체기 실수",
    diagnosis: "모두에게 말해 아무도 자기 얘기로 느끼지 않는다.",
    prescription: "타겟을 직업·상황·연령·고민으로 좁혀 직접 불러라.",
  },
  {
    key: "amp_timecompression",
    label: "시간 압축",
    group: "증폭기",
    stage: "MSG",
    definition: "짧은 시간 약속이 시청·행동 부담을 낮춘다.",
    tell: "30초, 5분, 오늘, 한 번에",
    formulas: ["30초만에 [주제] 정리", "단 5분이면 [결과]", "[기간] 안에 [변화]"],
    examples: ["30초만에 정리", "단 5분이면 됨"],
    weakExample: "나중에 천천히 알려드릴게요",
    strongExample: "30초만에 예약 전환 막는 장면 3개 정리합니다",
    diagnosis: "보는 데 오래 걸릴 것 같아 시작 장벽이 높다.",
    prescription: "걸리는 시간을 명시하고 약속한 시간 안에 끝내라.",
  },
  {
    key: "info_gap",
    label: "정보 격차",
    group: "멈춤",
    stage: "0~3초",
    coreEmotion: "호기심",
    definition: "아는 것과 알고 싶은 것 사이의 틈이 생기면 멈춘다.",
    tell: "비밀, 진짜 이유, 아무도 모르는, 결론 유보",
    formulas: ["대부분 모르는 [주제]의 비밀", "아무도 안 알려주는 [분야] 진실", "99%가 놓치는 [상황]에서 해야 할 것", "[결과]의 진짜 이유, 알아냈습니다"],
    examples: ["99%가 모르는 법", "아무도 안 알려준 비밀"],
    weakExample: "다이소 청소 용품 소개합니다",
    strongExample: "다이소 직원도 모르는 청소 끝판왕 템 3개",
    diagnosis: "결론을 다 말해 호기심의 틈이 없다.",
    prescription: "핵심 단어 하나를 지우고 답은 뒤로 미뤄라.",
    boosters: ["amp_specificity", "amp_secondperson", "amp_timecompression"],
  },
  {
    key: "self_reference",
    label: "자기 호명",
    group: "멈춤",
    stage: "0~3초",
    coreEmotion: "관련성",
    definition: "특정 대상을 콕 집어 부르면 그 사람 앞에서 스크롤이 멈춘다.",
    tell: "특정 집단·상황·고민 직접 호명",
    formulas: ["[연령대]라면 무조건 알아야 하는 [주제]", "[상황] 겪어본 사람만 압니다", "POV: [공감 가는 상황]", "[고민] 중이라면 이 영상 멈추세요"],
    examples: ["직장인이라면", "OO 사장님 주목"],
    weakExample: "운동할 때 흔한 실수",
    strongExample: "헬스 3개월 차가 꼭 겪는 정체기 실수",
    diagnosis: "타겟이 넓어 내 얘기라는 느낌이 약하다.",
    prescription: "사람들을 지우고 특정 집단/상황/고민을 앞에 붙여라.",
    boosters: ["amp_specificity", "amp_secondperson"],
  },
  {
    key: "pattern_interrupt",
    label: "패턴 인터럽트",
    group: "멈춤",
    stage: "0~3초",
    coreEmotion: "놀람",
    definition: "예상과 다른 말·장면이 나오면 뇌가 깨어난다.",
    tell: "정반대, 사실은, 통념 반박, 의외의 행동",
    formulas: ["[보통의 행동]? 저는 정반대로 합니다", "[상식]인 줄 알았는데, 사실 [반전]", "다들 [통념], 근데 그게 틀렸습니다", "[좋아 보이는 것]이 사실 [부정적 결과]였어요"],
    examples: ["생산하자마자 폐기했습니다", "여기가 한국이라니"],
    weakExample: "이 카페 커피 맛있어요",
    strongExample: "이 카페, 커피를 일부러 늦게 줍니다",
    diagnosis: "다음에 올 말이 너무 뻔해서 자동으로 넘겨진다.",
    prescription: "사용자가 예상한 다음 문장을 본론과 연결된 반대 문장으로 배신하라.",
    boosters: ["amp_specificity"],
  },
  {
    key: "loss_aversion",
    label: "손실 회피",
    group: "멈춤",
    stage: "0~3초",
    coreEmotion: "공포",
    definition: "이득보다 손실의 고통이 더 커서 '안 하면 손해'가 강하게 멈춘다.",
    tell: "손실, 경고, 안 하면, 모르면, 절대",
    formulas: ["이거 모르면 [손실/금액] 날립니다", "[행동] 안 하면 [나쁜 결과] 됩니다", "아직도 [구식 방법] 하세요?", "[상황]에서 절대 하면 안 되는 것 N가지", "이 신호 보이면 [문제] 이미 시작된 겁니다"],
    examples: ["이거 모르면 돈 날립니다", "안 바꾸면 큰일납니다"],
    weakExample: "이 방법을 쓰면 좋아집니다",
    strongExample: "이 설정 그대로 두면 배터리 매일 갉아먹힙니다",
    diagnosis: "좋은 점만 말해서 멈춤 압력이 약하다.",
    prescription: "이득을 손실로 뒤집고 손실 대상·기간·금액을 구체화하라.",
    commonMistakes: ["공포만 있고 해결 단서가 없음", "페르소나와 무관한 과장 경고", "매번 공포 후킹만 써 피로감 유발"],
    boosters: ["amp_specificity", "amp_secondperson", "amp_timecompression"],
  },
  {
    key: "visual_salience",
    label: "시각 현저성",
    group: "멈춤",
    stage: "0~3초",
    coreEmotion: "시선",
    definition: "글을 읽기 전 얼굴·움직임·큰 자막·대비가 눈을 먼저 잡는다.",
    tell: "얼굴, 움직임, 큰 자막, 대비, 화살표",
    formulas: ["첫 컷에 표정 있는 얼굴", "핵심 단어 큰 자막·강한 대비", "첫 0.5초에 움직임", "시선 둘 곳 하나로 명확"],
    examples: ["이런 말 쓰는 사람 피하세요", "큰 자막+표정"],
    weakExample: "작은 흰 자막과 먼 인물",
    strongExample: "클로즈업 표정 + 화면 절반 노란 자막 + 빠른 줌인",
    diagnosis: "문장은 괜찮지만 첫 화면에서 눈이 멈추지 않는다.",
    prescription: "소리 끄고 첫 0.5초만 보며 얼굴·자막·움직임·대비를 키워라.",
  },
  {
    key: "open_loop",
    label: "열린 고리",
    group: "유지",
    stage: "중반 체류",
    coreEmotion: "미완결",
    definition: "끝나지 않은 정보 고리를 열어두면 닫고 싶어서 끝까지 본다.",
    tell: "마지막에, 끝까지 보면, 결과는 뒤에",
    formulas: ["[결과]는 마지막에 공개할게요", "끝까지 보면 [보상]을 알려드립니다", "N개 중 [가장 중요한 것]은 마지막에", "제일 충격이었던 건 [숫자]번이에요"],
    examples: ["결과는 마지막에", "과연 성공했을까요?"],
    weakExample: "1등은 A예요. 이유는...",
    strongExample: "1등은 예상 밖이었어요. 5위부터 갈게요",
    diagnosis: "정답을 앞에서 줘 중반 이후 볼 이유가 없다.",
    prescription: "핵심·결과·정답을 뒤로 미루고 초반에는 고리만 열어라.",
  },
  {
    key: "processing_fluency",
    label: "처리 유창성",
    group: "유지",
    stage: "중반 체류",
    coreEmotion: "쉬움",
    definition: "이해가 막히지 않고 미끄러질수록 이탈하지 않는다.",
    tell: "짧은 호흡, 명확한 순서, 쉬운 말",
    formulas: ["방법은 3단계예요", "첫째 [A], 둘째 [B], 셋째 [C]", "[복잡한 것] 쉽게 말하면 [쉬운 말]"],
    examples: ["딱 1분이면 이해됨", "3단계로 정리"],
    weakExample: "본 콘텐츠는 객단가 제고를 위한 다각적 접근...",
    strongExample: "손님 한 명이 더 쓰게 만드는 법, 3가지로 정리했어요",
    diagnosis: "어려운 말·긴 문장·갑작스러운 전환이 이탈을 만든다.",
    prescription: "한 문장 한 정보, 첫째·둘째 순서, 용어 즉시 풀이로 바꿔라.",
  },
  {
    key: "escalating_reward",
    label: "점층 보상",
    group: "유지",
    stage: "중반 체류",
    coreEmotion: "기대",
    definition: "정보 보상을 갈수록 크게 배치하면 끊기 아깝다.",
    tell: "갈수록 중요, 마지막 핵심, N번부터 충격",
    formulas: ["[N]가지 알려드릴게요, 마지막이 핵심", "[숫자]번부터 충격일 거예요", "작은 것부터 갈게요. 큰 건 뒤에"],
    examples: ["3번부터 충격", "마지막 게 제일 중요"],
    weakExample: "팁 3개입니다. A, B, C",
    strongExample: "팁 3개인데 3번이 게임 체인저예요. 1번부터",
    diagnosis: "좋은 정보를 앞에 다 쏟아 뒤가 비었다.",
    prescription: "중요도를 줄 세우고 가장 강한 보상을 마지막에 둬라.",
  },
  {
    key: "tension_curve",
    label: "긴장 곡선",
    group: "유지",
    stage: "중반 체류",
    coreEmotion: "성패 궁금증",
    definition: "성공할지 실패할지 모르게 하면 결과 확인을 위해 끝까지 본다.",
    tell: "될까요, 과연, 도전, 위기, 마지막 시도",
    formulas: ["[기간/목표]에 도전했습니다. 과연?", "이게 될까요? 직접 해봤어요", "N일 차, [위기]가 왔습니다", "마지막 시도입니다. 이번에 안 되면 끝"],
    examples: ["이게 될까요?", "마지막 시도입니다"],
    weakExample: "30일 운동해서 살 뺐어요",
    strongExample: "30일 만에 10kg 도전. 2주 차에 포기할 뻔했어요",
    diagnosis: "결과를 앞에서 말해 성패 긴장이 사라졌다.",
    prescription: "결과를 엔딩으로 옮기고 중간에 위기 한 번을 추가하라.",
  },
  {
    key: "peak_end",
    label: "피크-엔드",
    group: "유지",
    stage: "엔딩",
    coreEmotion: "기억",
    definition: "가장 강한 순간과 마지막이 전체 인상을 결정한다.",
    tell: "강한 한 줄 정리, 반전, 저장 CTA, 다음 편 예고",
    formulas: ["이거 하나만 기억하세요: [핵심]", "결국 핵심은 [한 줄]", "다음 편엔 [예고]", "저장해두고 [상황]에 써보세요"],
    examples: ["엔딩 보고 가세요", "마지막 한마디에 소름"],
    weakExample: "오늘은 여기까지입니다",
    strongExample: "결국 단골은 맛이 아니라 기억으로 옵니다. 이 한 줄만 가져가세요",
    diagnosis: "끝까지 보지만 저장·공유가 안 나오는 약한 엔딩이다.",
    prescription: "영상의 피크와 마지막 3초에 가장 강한 정보·정리·행동을 배치하라.",
  },
  {
    key: "narrative_transport",
    label: "이야기 몰입",
    group: "신뢰",
    stage: "신뢰",
    coreEmotion: "몰입",
    definition: "사람은 주장에는 반박하지만 이야기에 빠지면 저항이 낮아진다.",
    tell: "기간 전, 사건, 실패, 변화, 개인 서사",
    formulas: ["[기간] 전 저는 [바닥]이었어요", "그날 [사건]이 모든 걸 바꿨습니다", "사실 저도 [실패/고민]했었어요"],
    examples: ["사실 저 망하기 직전이었어요", "그날 이후 바뀜"],
    weakExample: "꾸준함이 중요합니다",
    strongExample: "3년 전 매일 포기하던 제가 딱 하나 바꾸고 달라졌어요",
    diagnosis: "주장만 있고 따라갈 이야기 흐름이 없다.",
    prescription: "핵심 주장을 경험 이야기로 바꾸고 문제→전환→변화를 보여줘라.",
  },
  {
    key: "authority",
    label: "권위",
    group: "신뢰",
    stage: "신뢰",
    coreEmotion: "자격 신뢰",
    definition: "전문가·경력·실적 신호가 검증 부담을 낮춘다.",
    tell: "N년차, 현직, 전문가, 자격, 실적",
    formulas: ["[분야] N년 차가 알려드립니다", "현직 [직업]이 진짜 쓰는 법", "[경력] 동안 본 것 중"],
    examples: ["현직 의사가 말하는", "30년 경력 명장"],
    weakExample: "이 운동이 좋아요",
    strongExample: "물리치료사 10년 차가 환자한테 진짜 시키는 운동",
    diagnosis: "정보는 있는데 '넌 누군데?'라는 자격 신호가 부족하다.",
    prescription: "진짜 경력·환경·결과물·작업 과정을 말하거나 보여줘라.",
  },
  {
    key: "vulnerability",
    label: "취약성 공개",
    group: "신뢰",
    stage: "신뢰",
    coreEmotion: "진정성",
    definition: "작은 약점 공개가 나머지 주장의 진정성을 보증한다.",
    tell: "사실 저도, 솔직히, 실패, 처음엔",
    formulas: ["사실 저도 [실패/약점] 했었어요", "솔직히 이 방법, [단점]도 있어요", "처음엔 저도 [흔한 실수]했습니다"],
    examples: ["저 이거 때문에 망했어요", "처음엔 다 틀렸습니다"],
    weakExample: "이 방법이면 무조건 됩니다",
    strongExample: "이 방법, 처음 2주는 진짜 힘들어요. 근데 그 뒤부터...",
    diagnosis: "너무 완벽하게 말해 오히려 광고처럼 느껴진다.",
    prescription: "권위를 깨지 않는 선의 인간적 약점·실패·단점을 먼저 인정하라.",
  },
  {
    key: "social_proof",
    label: "사회적 증거",
    group: "신뢰",
    stage: "신뢰",
    coreEmotion: "군중 안전",
    definition: "확신이 없을 때 사람은 남들의 행동을 안전 신호로 삼는다.",
    tell: "요즘 다들, 후기 N개, 이미 N명, 댓글 반응",
    formulas: ["요즘 [대상]들이 다 한다는 [것]", "후기 [숫자]개 돌파한 [제품]", "[숫자]명이 이미 [행동]했어요"],
    examples: ["요즘 난리난 그것", "후기 700개 돌파"],
    weakExample: "많은 분들이 좋아해요",
    strongExample: "후기 700개 중 가장 많이 나온 말이 이겁니다",
    diagnosis: "안전 신호가 막연하거나 타겟과 맞지 않는다.",
    prescription: "진짜 숫자·후기·댓글·타겟과 같은 집단의 증거를 제시하라.",
  },
  {
    key: "identification",
    label: "동일시",
    group: "신뢰",
    stage: "신뢰",
    coreEmotion: "동질감",
    definition: "'나랑 같네'가 생기면 방어가 내려가고 신뢰가 열린다.",
    tell: "POV, 이런 적 있죠, 저도 같았어요, 공감 상황",
    formulas: ["저도 [같은 처지]였어요", "여러분도 이런 적 있죠?", "POV: [공감 상황]"],
    examples: ["POV: 월요일 아침의 나", "이런 적 있죠?"],
    weakExample: "고객들은 이런 문제를 겪습니다",
    strongExample: "밤 11시에 냉장고 앞에서 또 고민하는 분들, 저도 그랬어요",
    diagnosis: "관찰자처럼 말해 사용자가 자기 이야기로 못 느낀다.",
    prescription: "구체적 하루 장면·감정·말버릇으로 같은 처지를 보여줘라.",
  },
  {
    key: "reciprocity",
    label: "상호성",
    group: "신뢰",
    stage: "신뢰",
    coreEmotion: "부채감",
    definition: "먼저 가치 있는 것을 주면 갚고 싶어진다.",
    tell: "무료, 그냥 공개, 돈 받고 알려주던 것, 저장만",
    formulas: ["원래 [유료]인데 그냥 공개합니다", "[전체 노하우] 다 공개", "돈 받고 알려주던 걸 무료로"],
    examples: ["이거 그냥 다 공개합니다", "무료로 알려드림"],
    weakExample: "구매하시면 알려드릴게요",
    strongExample: "원래 컨설팅에서만 말하던 체크리스트를 그냥 공개합니다",
    diagnosis: "받기 전에 요구해서 강매처럼 느껴진다.",
    prescription: "먼저 실질적인 정보·템플릿·기준을 주고 작은 행동을 요청하라.",
  },
  {
    key: "consistency",
    label: "일관성",
    group: "행동",
    stage: "행동",
    coreEmotion: "작은 동의",
    definition: "작은 yes가 다음 행동을 쉽게 만든다.",
    tell: "맞죠?, 이런 적 있죠?, 저장만, 궁금하면",
    formulas: ["이런 적 있죠?", "일단 저장만 해두세요", "맞다 싶으면 좋아요", "궁금하면 프로필 한 번만"],
    examples: ["한 번쯤 그런 적 있죠?", "저장만 해두세요"],
    weakExample: "지금 당장 구매하세요",
    strongExample: "맞다 싶으면 저장만 해두세요. 나중에 그대로 쓰면 됩니다",
    diagnosis: "큰 행동을 바로 요구해 심리적 저항이 크다.",
    prescription: "저장·댓글·프로필 방문 같은 낮은 마찰의 첫 행동부터 요청하라.",
  },
  {
    key: "scarcity",
    label: "희소성·긴급성",
    group: "행동",
    stage: "행동",
    coreEmotion: "기회 상실",
    definition: "사라진다고 느끼면 지금 움직인다.",
    tell: "오늘까지만, 선착순, 마감, 이번에 놓치면",
    formulas: ["오늘까지만 [혜택]", "선착순 [숫자]명", "이번에 놓치면 [손실]", "[수량] 남음"],
    examples: ["오늘까지만 공개", "선착순 100명"],
    weakExample: "언제든 신청하세요",
    strongExample: "이번 주까지만 무료 진단 열어둘게요. 선착순 20명입니다",
    diagnosis: "지금 해야 할 이유가 없어 미뤄진다.",
    prescription: "진짜 마감·수량·기간·기회비용을 명확히 제시하라.",
  },
  {
    key: "liking",
    label: "호감",
    group: "행동",
    stage: "행동",
    coreEmotion: "친근감",
    definition: "친근한 말투와 솔직한 고백이 방어를 낮춘다. 단, 말투만 있고 대상/문제가 없으면 첫후킹으로는 약하다.",
    tell: "친구처럼, 솔직히, 우리끼리, 나 믿고 + 구체 타겟/문제",
    formulas: ["[고민] 겪는 분들, 친구한테만 말하듯 솔직히 알려드릴게요", "나 믿고 [구식 방법]만 오늘 멈춰보세요", "우리끼리 얘긴데, [대상]이 놓치는 건 [문제]입니다", "솔직히 말하면, [상품]은 [문제]부터 잡아야 팔립니다"],
    examples: ["강아지 사진 100장 찍고도 건질 게 없는 분들, 친구처럼 솔직히 말할게요", "우리끼리 얘긴데, 카페 사진은 장소보다 첫 장면이 더 중요합니다"],
    weakExample: "친구한테 알려주듯 말할게요",
    strongExample: "강아지 사진 100장 찍고도 건질 게 없는 분들, 친구처럼 솔직히 말할게요",
    diagnosis: "친근한 말투만 있고 타겟·문제·멈춤 이유가 없어 첫후킹이 아니라 태도 설명에 머문다.",
    prescription: "친근체 앞뒤에 구체 타겟, 현재 불편, 볼 이유를 붙여 첫 1초 문장으로 만들어라.",
  },
  {
    key: "anchoring",
    label: "대비·앵커링",
    group: "행동",
    stage: "행동",
    coreEmotion: "가치 비교",
    definition: "높은 기준을 먼저 보면 다음 제안의 가치가 또렷해진다.",
    tell: "원래, 보통, 대신, 비교, before/after",
    formulas: ["원래 [높은 가격/기준]인데, [낮은 내 제안]", "보통 [긴 시간] 걸리는데, 이건 [짧은 시간]", "[큰 노력] 대신 [작은 노력]으로"],
    examples: ["10만 원짜리? 이건 만 원", "원래 5배 비싼데"],
    weakExample: "3만 원이에요",
    strongExample: "보통 30만 원 컨설팅에서 하는 진단을 이 영상에 담았어요",
    diagnosis: "비교 기준이 없어 제안의 가치가 흐릿하다.",
    prescription: "더 비싼 것·오래 걸리는 것·힘든 것을 먼저 보여주고 내 제안을 그 아래 둬라.",
  },
  {
    key: "friction_removal",
    label: "마찰 제거",
    group: "행동",
    stage: "행동",
    coreEmotion: "쉬운 실행",
    definition: "행동이 쉬울수록 더 많이 한다.",
    tell: "한 번만, 댓글만, 저장만, 그대로 따라",
    formulas: ["프로필 링크 한 번만 누르면 끝", "댓글에 '[키워드]'만 쓰세요", "저장만 해두세요", "그대로 따라만 하면 돼요"],
    examples: ["링크 한 번만 누르면 끝", "복붙만 하면 됨"],
    weakExample: "프로필 가서 링크 찾아 사이트 들어가 회원가입하고 신청하세요",
    strongExample: "댓글에 '신청'만 쓰면 링크 보내드릴게요",
    diagnosis: "관심은 있는데 행동 단계가 많아 중간에 샌다.",
    prescription: "CTA를 한 번의 탭·한 단어 댓글·저장 같은 쉬운 행동으로 줄여라.",
  },
];

export const STRUCTURES = [
  { key: "growth_narrative", label: "성장 서사", category: "서사형", full: "바닥→문제→실패→해결→성공→CTA", hint: "못난 과거에서 성공으로 끝남", template: "[바닥]→[문제]→[실패]→[해결]→[성공]→CTA", coreEngines: ["identification", "tension_curve", "authority"], diagnosis: "과거·위기·변화가 없이 성과만 말하면 서사가 약하다.", prescription: "바닥과 전환점을 넣고 마지막에 변화/CTA로 닫아라." },
  { key: "self_intro", label: "자기 소개", category: "서사형", full: "과거→계기→깨달음→변화→사명", hint: "X년 전 나는...", template: "[과거]→[계기]→[깨달음]→[변화]→사명", coreEngines: ["identification", "authority"], diagnosis: "이름/직함만 있고 왜 믿어야 하는지가 없다.", prescription: "계기와 깨달음, 지금의 사명을 연결하라." },
  { key: "big_dream", label: "거대한 꿈/목표", category: "서사형", full: "꿈 선언→도전→진행→과연?", hint: "미래 목표와 결과 유보", template: "[꿈] 선언→도전→진행→과연?", coreEngines: ["open_loop", "tension_curve"], diagnosis: "꿈 선언이나 결과 유보 없이 일반 설명에 머문다.", prescription: "큰 목표를 선언하고 도전 과정과 결과 궁금증을 남겨라." },
  { key: "adversity", label: "역경 극복", category: "서사형", full: "의심→투쟁→전환점→성공→통념 깨기", hint: "안 된다 했지만 해냄", template: "[의심]→[투쟁]→[전환]→[성공]→통념 깨기", coreEngines: ["vulnerability", "tension_curve", "pattern_interrupt"], diagnosis: "위기와 전환점이 없어 극복감이 약하다.", prescription: "외부 의심/실패/전환을 분명히 넣어라." },
  { key: "breakthrough", label: "획기적 발견(PS)", category: "서사형", full: "문제→발견→해결책→결과/CTA", hint: "문제로 열고 해결책으로 닫음", template: "[문제]→[발견]→[해결책]→결과/CTA", coreEngines: ["info_gap", "reciprocity"], diagnosis: "문제와 해결책 연결이 흐릿하다.", prescription: "문제를 선명히 만들고 발견/해결책을 한 줄로 연결하라." },
  { key: "lesson", label: "교훈/배움", category: "서사형", full: "실패→고통→성과→교훈", hint: "실패담 끝에 깨달음", template: "[실패]→[고통]→[성과]→교훈", coreEngines: ["vulnerability", "narrative_transport"], diagnosis: "교훈만 말하고 실패·고통의 근거가 없다.", prescription: "실패 장면과 그 뒤 얻은 한 줄 교훈을 붙여라." },
  { key: "listicle", label: "리스티클", category: "포맷형", full: "후킹(N가지)→1→2→3→마지막 강조", hint: "N가지 나열형", template: "[대상]이 [행동]할 [숫자]가지", coreEngines: ["info_gap", "escalating_reward", "amp_specificity"], diagnosis: "항목 간 점층이 없어 중간 이탈이 생긴다.", prescription: "가장 강한 항목을 마지막에 두고 초반에 예고하라." },
  { key: "tutorial", label: "튜토리얼", category: "포맷형", full: "문제→1단계→2단계→완성", hint: "따라하면 되는 단계 안내", template: "[어려운 것] [숫자]단계로", coreEngines: ["friction_removal", "authority", "processing_fluency"], diagnosis: "단계가 추상적이라 따라 할 수 없다.", prescription: "1단계마다 행동 동사를 넣고 완성 결과를 보여라." },
  { key: "myth_bust", label: "신화 타파", category: "포맷형", full: "통념→반박→진실→근거", hint: "다들 틀렸다", template: "아직도 [통념]? 사실 [진실]", coreEngines: ["pattern_interrupt", "authority"], diagnosis: "반박할 통념이나 근거가 약하다.", prescription: "대중적 믿음을 먼저 말하고 왜 틀렸는지 증거로 뒤집어라." },
  { key: "versus", label: "비교/대결", category: "포맷형", full: "A→B→차이→결론", hint: "A vs B, before/after", template: "[A] vs [B]", coreEngines: ["anchoring"], diagnosis: "비교 기준이 불명확해 차이가 흐릿하다.", prescription: "가격·시간·노력·결과 중 하나의 기준으로 비교하라." },
  { key: "twist", label: "반전/떡밥", category: "포맷형", full: "평범한 전개→떡밥→끝에 반전", hint: "마지막에 뒤집음", template: "[평범]인 줄... 마지막 [반전]", coreEngines: ["open_loop", "peak_end"], diagnosis: "반전이 예측 가능하거나 본론과 연결되지 않는다.", prescription: "초반에 떡밥을 깔고 엔딩에서 의미가 뒤집히게 하라." },
  { key: "challenge", label: "챌린지", category: "포맷형", full: "도전 선언→과정→위기→결과", hint: "N일 해봤다", template: "[기간] [행동]해봤더니", coreEngines: ["tension_curve", "open_loop"], diagnosis: "성패 불확실성과 중간 위기가 없다.", prescription: "목표, 기간, 위기, 결과 유보를 넣어라." },
  { key: "reveal", label: "폭로/비밀", category: "포맷형", full: "떡밥→비밀 공개→상세", hint: "아무도 모르는 공개형", template: "[집단]만 아는 [비밀] 공개", coreEngines: ["info_gap", "reciprocity"], diagnosis: "비밀이 너무 약하거나 이미 아는 정보다.", prescription: "타겟이 궁금해할 숨은 기준/뒷이야기를 공개하라." },
  { key: "qna", label: "큐앤에이", category: "포맷형", full: "질문→단답 반복", hint: "Q&A 반복 구조", template: "[질문]에 솔직하게", coreEngines: ["self_reference", "processing_fluency"], diagnosis: "질문이 타겟의 실제 고민과 다르다.", prescription: "타겟이 실제로 물을 법한 질문으로 시작하라." },
  { key: "day_routine", label: "데이/루틴", category: "포맷형", full: "하루 시작→일과→문제/해결→마무리", hint: "OO의 하루", template: "[직업]의 [하루]", coreEngines: ["identification", "narrative_transport"], diagnosis: "하루 나열만 있고 문제/해결 순간이 없다.", prescription: "루틴 중 고객 문제와 해결 장면을 하나 넣어라." },
];

export const FUNNEL_STAGES = [
  { key: "pulling", label: "풀링", goal: "낯선 다수를 멈추고 유입", structures: ["listicle", "myth_bust", "versus", "twist"], engines: ["info_gap", "self_reference", "pattern_interrupt", "loss_aversion"], tell: "넓은 호기심·도달·팔로우 유도" },
  { key: "key", label: "키", goal: "관심을 신뢰로 전환", structures: ["growth_narrative", "self_intro", "lesson", "reveal", "day_routine"], engines: ["narrative_transport", "authority", "vulnerability", "social_proof", "identification"], tell: "왜 믿을 만한지, 누구인지, 어떤 증거가 있는지" },
  { key: "landing", label: "랜딩", goal: "신뢰를 행동으로 전환", structures: ["breakthrough", "tutorial", "qna"], engines: ["reciprocity", "scarcity", "anchoring", "friction_removal"], tell: "명확한 행동, 쉬운 CTA, 지금 해야 할 이유" },
];

export const AD_STRUCTURES = [
  { key: "pas", label: "PAS", awareness: "문제 인식", full: "Problem→Amplify→Solution", hint: "문제부터 아프게 키우고 해결책 제시", template: "아직도 [문제]? 방치하면 [증폭]. 해결은 [솔루션]." },
  { key: "bab", label: "BAB", awareness: "해결책 인식", full: "Before→After→Bridge", hint: "이전과 이후를 보여주고 다리를 제시", template: "[이전 상태]에서 [이후 상태]로, 다리는 [방법]." },
  { key: "pastor", label: "PASTOR", awareness: "고가·복잡한 상품", full: "Problem→Amplify→Story→Transformation→Offer→Response", hint: "문제와 스토리, 제안과 응답까지 길게 설득", template: "[문제]→[증폭]→[스토리]→[변화]→[제안]→[응답]" },
  { key: "fab", label: "FAB", awareness: "제품 인식", full: "Features→Advantages→Benefits", hint: "기능, 장점, 고객 이익 순서", template: "[기능]이 있어서 [장점], 그래서 고객은 [이익]." },
  { key: "four_p", label: "4P", awareness: "제품 인식", full: "Picture→Promise→Prove→Push", hint: "그림을 그려주고 약속·증명·푸시", template: "[상상 장면]→[약속]→[증거]→[행동]." },
  { key: "three_why", label: "3-Why", awareness: "최고 인식", full: "Why you→Why now→Why this", hint: "왜 당신, 왜 지금, 왜 이것", template: "왜 [당신]에게, 왜 [지금], 왜 [이 상품]인지." },
];

export const RUBRICS = {
  hook: [
    { key: "stop_power", label: "첫 1초 멈춤력", max: 25 },
    { key: "engine_match", label: "목표 엔진 일치", max: 25 },
    { key: "persona_fit", label: "페르소나 반영", max: 25 },
    { key: "curiosity_specificity", label: "궁금증/구체성", max: 15 },
    { key: "no_cta_pollution", label: "CTA 오염 방지", max: 5 },
    { key: "clarity", label: "문장 완성도", max: 5 },
  ],
  rewrite: [
    { key: "fix_weakness", label: "기존 약점 해결", max: 25 },
    { key: "engine_boost", label: "지정 엔진 강화", max: 25 },
    { key: "persona_specificity", label: "타겟/페인 구체화", max: 20 },
    { key: "stronger_stop", label: "멈춤력 상승", max: 15 },
    { key: "trust", label: "과장 없이 신뢰 유지", max: 10 },
    { key: "clarity", label: "표현 선명도", max: 5 },
  ],
  structure: [
    { key: "steps", label: "요구 구조 단계 충족", max: 35 },
    { key: "flow", label: "단계 간 흐름", max: 20 },
    { key: "persona_fit", label: "페르소나/상품 적합", max: 20 },
    { key: "core_engines", label: "핵심 엔진 사용", max: 15 },
    { key: "cta", label: "CTA/마무리 적합", max: 10 },
  ],
  funnel: [
    { key: "stage_goal", label: "풀링/키/랜딩 목표 이해", max: 25 },
    { key: "structure_fit", label: "단계별 구조 선택", max: 25 },
    { key: "bridge", label: "연결 고리 설계", max: 20 },
    { key: "business_fit", label: "광고주 목표 반영", max: 20 },
    { key: "execution", label: "실행 가능성", max: 10 },
  ],
  ad: [
    { key: "awareness", label: "고객 인식 단계 판단", max: 25 },
    { key: "ad_structure", label: "광고 구조 적합성", max: 25 },
    { key: "baton", label: "문제/욕구/신뢰 바통", max: 20 },
    { key: "cta", label: "CTA와 마찰 제거", max: 15 },
    { key: "message_match", label: "메시지 매칭", max: 15 },
  ],
};

export const QUESTION_SEQUENCE = [
  "chooseHook",
  "chooseStructure",
  "formulaFill",
  "writeHook",
  "rewriteHook",
  "writeStructure",
  "diagnoseHook",
  "chooseFunnelStage",
  "chooseAdStructure",
  "writeAdPlan",
];

const FIRST_HOOK_ENGINE_KEYS = [
  "info_gap",
  "self_reference",
  "pattern_interrupt",
  "loss_aversion",
  "visual_salience",
  "open_loop",
  "tension_curve",
  "narrative_transport",
  "authority",
  "vulnerability",
  "social_proof",
  "identification",
  "reciprocity",
  "scarcity",
  "liking",
  "anchoring",
  "friction_removal",
];

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function sampleOptions(list, answer, count = 4) {
  const sameGroup = list.filter((item) => item.group && answer.group && item.group === answer.group && item.key !== answer.key);
  const others = list.filter((item) => item.key !== answer.key && !sameGroup.includes(item));
  const pool = [...sameGroup.sort(() => Math.random() - 0.5), ...others.sort(() => Math.random() - 0.5)];
  return [answer, ...pool.slice(0, count - 1)].sort(() => Math.random() - 0.5);
}

function withInstrumentParticle(label) {
  const last = String(label || "").trim().slice(-1);
  if (!last) return label;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${label}로`;
  return (code - 0xac00) % 28 === 0 ? `${label}로` : `${label}으로`;
}

export function fillTemplate(template, persona) {
  return String(template || "")
    .replaceAll("[주제]", persona.product || "상품")
    .replaceAll("[분야]", persona.product || "서비스")
    .replaceAll("[상황]", persona.pain || "문제 상황")
    .replaceAll("[대상]", persona.audience || "타겟")
    .replaceAll("[직업]", persona.owner || "대표")
    .replaceAll("[고민]", persona.pain || "고민")
    .replaceAll("[문제]", persona.pain || "문제")
    .replaceAll("[욕구]", persona.desire || "욕구")
    .replaceAll("[제품]", persona.product || "상품")
    .replaceAll("[상품]", persona.product || "상품")
    .replaceAll("[브랜드]", persona.brand || "브랜드")
    .replaceAll("[숫자]", "3")
    .replaceAll("[기간]", "7일")
    .replaceAll("[손실/금액]", "광고비 30만 원")
    .replaceAll("[행동]", "지금 방식 그대로 운영")
    .replaceAll("[나쁜 결과]", "문의만 받고 예약은 놓치게")
    .replaceAll("[구식 방법]", "설명만 긴 홍보")
    .replaceAll("[결과]", persona.desire || "원하는 결과")
    .replaceAll("[비밀]", "구매 직전 망설이는 이유")
    .replaceAll("[핵심]", "고객은 설명보다 장면을 믿습니다")
    .replaceAll("[A]", "일반 홍보")
    .replaceAll("[B]", "퍼널형 숏폼");
}

function audienceLabel(persona) {
  const audience = String(persona.audience || "").trim();
  if (!audience) return "고객";
  if (/이유식|아이|아기|육아|엄마/.test(audience)) return "초보 엄마";
  if (/반려견|강아지|반려동물/.test(audience) && /보호자/.test(audience)) return "반려견 보호자";
  if (/부모님|어르신|요양|치매|거동/.test(audience)) return "부모님 돌봄을 고민하는 자녀";
  if (/건강한 먹거리|유기농|주부|제철/.test(audience)) return "유기농 먹거리를 찾는 주부";
  const roleMatch = audience.match(/([0-9~대\s]*[가-힣A-Za-z]+(?:대표|사장님|대표님|보호자|학부모|직장인|예비창업자|자영업자|원장님|고객))/);
  if (roleMatch?.[1]) return roleMatch[1].replace(/\s+/g, " ").trim();
  return audience.length > 30 ? `${audience.slice(0, 24).trim()} 고객` : audience;
}

function productLabel(persona) {
  const product = String(persona.product || "상품").trim();
  if (/이유식/.test(product)) return "맞춤 이유식";
  if (/재가\s*요양|인지\s*활동|요양/.test(product)) return "맞춤형 재가 요양 서비스";
  if (/반려견|강아지|루프탑|포토존/.test(product)) return "반려견 루프탑 포토존";
  if (/유기농|제철|채소|과일|꾸러미/.test(product)) return "유기농 꾸러미";
  if (/정기\s*배송|구독/.test(product)) return product.replace(/유기농 인증을 받은|제철|채소와 과일|정기 배송 서비스/g, "").trim() || "정기 배송 서비스";
  return product.length > 26 ? product.slice(0, 24).trim() : product;
}

function painLabel(persona) {
  const pain = String(persona.pain || "고민").trim();
  if (/혼자 두기 불안/.test(pain)) return "부모님을 혼자 두기 불안한 상황";
  return pain.endsWith("없음") ? `${pain.slice(0, -2)}없는 문제` : pain;
}

function ownerLabel(persona) {
  const owner = String(persona.owner || "").trim();
  if (/이유식|육아/.test(owner)) return "이유식 연구원";
  if (/요양보호사/.test(owner)) return "10년 경력 요양보호사";
  if (/농부|귀농|농장/.test(owner)) return "친환경 농부";
  if (owner) return owner.length > 22 ? owner.slice(0, 20).trim() : owner;
  return "현장 전문가";
}

function hookDomain(persona) {
  const text = `${persona.product || ""} ${persona.audience || ""} ${persona.owner || ""}`;
  if (/이유식|아기|아이|육아|엄마/.test(text)) return "babyfood";
  if (/유기농|제철|채소|과일|꾸러미|농부|농장/.test(text)) return "organic";
  if (/요양|치매|거동|부모님|어르신/.test(text)) return "care";
  if (/반려견|강아지|반려동물|포토존/.test(text)) return "pet";
  return "generic";
}

function customerPainLabel(persona) {
  const domain = hookDomain(persona);
  if (domain === "babyfood") return "이유식 재료와 영양이 늘 불안한 마음";
  if (domain === "organic") return "유기농이라 믿었는데 신선도가 애매했던 경험";
  if (domain === "care") return "부모님을 혼자 두기 불안한 상황";
  if (domain === "pet") return "강아지 사진을 많이 찍어도 건질 사진이 없는 문제";
  return painLabel(persona);
}

function subjectForm(value) {
  const label = String(value || "고객").trim();
  const last = label.slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${label}가`;
  return (code - 0xac00) % 28 === 0 ? `${label}가` : `${label}이`;
}

function objectForm(value) {
  const label = String(value || "상품").trim();
  const last = label.slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${label}를`;
  return (code - 0xac00) % 28 === 0 ? `${label}를` : `${label}을`;
}

function compactHook(text) {
  return String(text || "")
    .replace(/나중에 더 불안해집니다/g, "후회합니다")
    .replace(/고르기 전 이 기준 놓치면/g, "이 기준 없으면")
    .replace(/상담 직전에 가장 많이 망설이는 진짜 이유/g, "망설이는 진짜 이유")
    .replace(/알아볼수록 오히려 더 불안해지는 이유/g, "볼수록 더 불안한 이유")
    .replace(/꼭 확인해야 할 기준이 있습니다/g, "꼭 볼 기준")
    .replace(/고르기 전 꼭 볼 기준/g, "고르기 전 볼 기준")
    .replace(/친구한테 말하듯 솔직히 알려드릴게요/g, "솔직히 알려드릴게요")
    .replace(/\s+/g, " ")
    .trim();
}

function domainHookMap({ domain, product, audience, pain, brand, owner, audienceSubject, productObject, painAudience }) {
  if (domain === "babyfood") {
    return {
      info_gap: "이유식 고를 때 엄마들이 가장 많이 놓치는 기준",
      self_reference: `${audience}라면 이 기준 하나는 꼭 보세요`,
      pattern_interrupt: "직접 만든 이유식이 항상 더 안전한 건 아닙니다",
      loss_aversion: "이유식, 월령 기준 놓치면 아이가 먼저 힘듭니다",
      visual_salience: "성분표에 이 단어가 없으면 다시 보세요",
      open_loop: `${brand} 이유식에서 마지막에 확인할 기준이 있습니다`,
      processing_fluency: "이유식 고르는 법, 월령 원재료 알레르기",
      escalating_reward: "첫째는 월령, 둘째는 원재료, 마지막은 알레르기입니다",
      tension_curve: "배송 이유식, 정말 직접 만든 것만큼 괜찮을까요?",
      peak_end: "좋은 이유식은 먹는 순간보다 다음 변에서 티가 납니다",
      narrative_transport: "첫 이유식 시작할 때 제일 불안했던 게 뭔가요?",
      authority: `${owner}이 말하는 이유식 고르기 전 기준`,
      vulnerability: "솔직히 유기농 이유식도 월령이 안 맞으면 불안합니다",
      social_proof: `요즘 ${audience}는 이유식을 이렇게 비교합니다`,
      identification: "POV: 오늘도 이유식 레시피만 보다가 지친 엄마",
      reciprocity: "이유식 주문 전 체크리스트, 그냥 공개합니다",
      consistency: "이유식 성분표 보고도 불안했던 적 있죠?",
      scarcity: "월령별 이유식은 타이밍 놓치면 더 어려워집니다",
      liking: "이유식 고민하는 엄마들, 솔직히 알려드릴게요",
      anchoring: "직접 만든 이유식과 배송 이유식, 기준은 따로 있습니다",
      friction_removal: "이유식은 월령 하나만 먼저 확인하세요",
    };
  }
  if (domain === "organic") {
    return {
      info_gap: "유기농 꾸러미에서 먼저 봐야 할 진짜 기준",
      self_reference: `${audience}라면 이 기준 하나는 꼭 보세요`,
      pattern_interrupt: "유기농 인증만 보고 고르면 놓치는 게 있습니다",
      loss_aversion: "유기농 꾸러미, 이 기준 없으면 후회합니다",
      visual_salience: "상자 열었을 때 이 상태면 신선도는 이미 늦었습니다",
      open_loop: `${brand} 꾸러미에서 마지막에 확인할 기준이 있습니다`,
      processing_fluency: "유기농 꾸러미 고르는 법, 3가지만 보세요",
      escalating_reward: "첫째는 인증, 둘째는 산지, 마지막이 신선도입니다",
      tension_curve: "이번 꾸러미, 정말 마트보다 신선할까요?",
      peak_end: "좋은 꾸러미는 결국 냉장고에서 티가 납니다",
      narrative_transport: "처음 받은 유기농 꾸러미가 실망스러웠던 적 있나요?",
      authority: `${owner}가 말하는 유기농 꾸러미 고르는 기준`,
      vulnerability: "솔직히 유기농이어도 꾸러미 구성은 실패할 수 있습니다",
      social_proof: `요즘 ${audience}는 유기농 꾸러미를 이렇게 비교합니다`,
      identification: "POV: 건강하게 먹고 싶은데 뭘 믿어야 할지 모르겠는 날",
      reciprocity: "유기농 꾸러미 체크리스트, 그냥 공개합니다",
      consistency: "유기농이라 믿고 샀다가 실망한 적 있죠?",
      scarcity: "제철 꾸러미는 타이밍 놓치면 맛이 달라집니다",
      liking: "유기농 꾸러미 고민하는 분들, 솔직히 알려드릴게요",
      anchoring: "마트 채소와 산지 꾸러미, 비교 기준은 따로 있습니다",
      friction_removal: "유기농 꾸러미는 이 체크 하나만 먼저 보세요",
    };
  }
  return {
    info_gap: `${audienceSubject} 망설이는 진짜 이유`,
    self_reference: `${audience}라면 이 기준 하나는 꼭 확인하세요`,
    pattern_interrupt: `${productObject} 볼수록 더 불안한 이유`,
    loss_aversion: `${productObject} 이 기준 없으면 후회합니다`,
    visual_salience: `첫 상담에서 이 질문이 없으면 ${audience}는 바로 불안해집니다`,
    open_loop: `${brand} 상담에서 마지막에 꼭 확인할 진짜 기준이 있습니다`,
    processing_fluency: `${pain} 해결법, 3단계로 보여드립니다`,
    escalating_reward: `${productObject} 고를 때 첫째는 가격, 둘째는 거리, 마지막이 진짜 기준입니다`,
    tension_curve: "낯선 사람이 집에 와도 부모님이 편안할까요?",
    peak_end: `${product} 선택은 마지막 한 질문에서 갈립니다`,
    narrative_transport: "사실 이 가족도 처음엔 집에 요양보호사가 오는 게 불안했습니다",
    authority: `${owner}가 말하는 ${product} 고르기 전 볼 기준`,
    vulnerability: `솔직히 ${product}는 서비스보다 먼저 불안감을 풀어야 합니다`,
    social_proof: `요즘 ${audience}는 ${productObject} 이렇게 비교합니다`,
    identification: `POV: ${pain} 때문에 오늘도 휴대폰만 붙잡고 있는 가족`,
    reciprocity: `${product} 상담 전 질문 리스트, 그냥 공개합니다`,
    consistency: `${pain} 때문에 고민한 적 있죠?`,
    scarcity: `이번 달 방문 상담 전에 ${audienceSubject} 꼭 볼 기준`,
    liking: `${painAudience} 분들, 솔직히 알려드릴게요`,
    anchoring: "시설 입소 전에 먼저 비교해야 할 선택지가 있습니다",
    friction_removal: `${productObject} 알아보는 가족이라면 이 체크만 보세요`,
  };
}

export function makeHookExample(persona, key) {
  const product = productLabel(persona);
  const audience = audienceLabel(persona);
  const pain = customerPainLabel(persona);
  const brand = persona.brand || "이 브랜드";
  const owner = ownerLabel(persona);
  const audienceSubject = subjectForm(audience);
  const productObject = objectForm(product);
  const painAudience = pain.replace(/한 상황$/, "한").replace(/없는 문제$/, "없는");
  const map = domainHookMap({ domain: hookDomain(persona), product, audience, pain, brand, owner, audienceSubject, productObject, painAudience });
  if (map[key]) return compactHook(map[key]);
  const engine = ENGINES.find((item) => item.key === key);
  const template = engine?.formulas?.[0] || `${product}, 이렇게 팔면 고객은 보고도 안 삽니다.`;
  return compactHook(fillTemplate(template, persona));
}

export function makeHookModelAnswers(persona, key) {
  const product = productLabel(persona);
  const audience = audienceLabel(persona);
  const pain = customerPainLabel(persona);
  const brand = persona.brand || "이 브랜드";
  const owner = ownerLabel(persona);
  const audienceSubject = subjectForm(audience);
  const productObject = objectForm(product);
  const painAudience = pain.replace(/한 상황$/, "한").replace(/없는 문제$/, "없는");
  const domain = hookDomain(persona);
  const primary = domainHookMap({ domain, product, audience, pain, brand, owner, audienceSubject, productObject, painAudience });
  if (domain === "babyfood") {
    const babyfoodSecond = {
      info_gap: "이유식 실패는 레시피보다 월령에서 갈립니다",
      self_reference: "첫 이유식 시작한 엄마라면 이 기준부터 보세요",
      pattern_interrupt: "유기농 이유식도 월령이 안 맞으면 의미 없습니다",
      loss_aversion: "이유식, 알레르기 체크 없으면 후회합니다",
      visual_salience: "성분표 첫 줄에 이게 없으면 다시 보세요",
      open_loop: "좋은 이유식의 마지막 기준은 따로 있습니다",
      processing_fluency: "이유식은 월령 원재료 알레르기만 먼저 보세요",
      escalating_reward: "월령보다 중요한 건 마지막 알레르기 체크입니다",
      tension_curve: "우리 아이, 배송 이유식도 잘 먹을까요?",
      peak_end: "좋은 이유식은 완밥보다 속 편함에서 티가 납니다",
      narrative_transport: "첫 이유식 날, 엄마들이 제일 많이 하는 실수",
      authority: "이유식 연구원이 보는 월령별 선택 기준입니다",
      vulnerability: "솔직히 비싼 이유식도 월령이 안 맞으면 아깝습니다",
      social_proof: "요즘 엄마들은 이유식을 이렇게 비교합니다",
      identification: "POV: 이유식 레시피 저장만 30개인 엄마",
      reciprocity: "이유식 주문 전 월령 체크리스트를 공개합니다",
      consistency: "이유식 시작하고 변 상태부터 보게 됐죠?",
      scarcity: "월령 타이밍 놓치면 이유식 단계가 더 꼬입니다",
      liking: "초보 엄마들, 이유식 기준만 쉽게 말해볼게요",
      anchoring: "직접 만드는 시간과 배송 이유식 기준을 비교해보세요",
      friction_removal: "이유식은 성분표 첫 줄만 먼저 보세요",
    };
    return [primary[key], babyfoodSecond[key] || primary[key]].map(compactHook);
  }
  if (domain === "organic") {
    const organicSecond = {
      info_gap: "유기농 꾸러미 실패는 인증서보다 여기서 갈립니다",
      self_reference: "건강한 장보기 고민 중이라면 이 기준부터 보세요",
      pattern_interrupt: "신선한 꾸러미일수록 예쁜 구성만 보면 안 됩니다",
      loss_aversion: "유기농 꾸러미, 산지 확인 없으면 후회합니다",
      visual_salience: "잎 끝이 이렇게 보이면 신선도는 이미 지난 겁니다",
      open_loop: "좋은 꾸러미를 고르는 마지막 기준은 따로 있습니다",
      processing_fluency: "유기농 꾸러미 고르는 기준, 인증 산지 수확일입니다",
      escalating_reward: "인증보다 산지, 산지보다 수확일을 보세요",
      tension_curve: "이번 주 꾸러미, 냉장고에서 며칠이나 버틸까요?",
      peak_end: "좋은 꾸러미는 먹는 날보다 남은 날에 티가 납니다",
      narrative_transport: "첫 유기농 꾸러미가 실망스러웠던 이유가 있습니다",
      authority: "친환경 농부가 보는 꾸러미 신선도 기준입니다",
      vulnerability: "솔직히 유기농이어도 오래된 채소는 실망스럽습니다",
      social_proof: "요즘 주부들은 유기농 꾸러미를 이렇게 고릅니다",
      identification: "건강하게 먹이고 싶은데 뭘 믿어야 할지 모르겠다면",
      reciprocity: "유기농 꾸러미 주문 전 체크리스트를 공개합니다",
      consistency: "유기농이라 믿고 샀다가 실망한 적 있죠?",
      scarcity: "제철 채소는 같은 유기농이어도 맛있는 때가 짧습니다",
      liking: "유기농 꾸러미 처음 고르는 분들, 솔직히 말할게요",
      anchoring: "마트 채소와 산지 꾸러미, 이 기준으로 비교하세요",
      friction_removal: "유기농 꾸러미는 수확일 하나만 먼저 보세요",
    };
    return [primary[key], organicSecond[key] || primary[key]].map(compactHook);
  }
  const byKey = {
    info_gap: [
      primary.info_gap,
      `${product} 상담이 끊기는 순간은 가격을 말하기 전부터 시작됩니다`,
    ],
    self_reference: [
      primary.self_reference,
      `${pain} 겪는 ${audience}라면 이 영상 먼저 보세요`,
    ],
    pattern_interrupt: [
      primary.pattern_interrupt,
      `친절한 상담보다 먼저 확인해야 할 건 방문 전 기준입니다`,
    ],
    loss_aversion: [
      primary.loss_aversion,
      `${pain}를 방치하면 가족의 일상부터 먼저 무너집니다`,
    ],
    visual_salience: [
      primary.visual_salience,
      `${brand}를 보기 전 가족이 먼저 확인해야 할 장면이 있습니다`,
    ],
    open_loop: [
      primary.open_loop,
      `${product} 선택 전에 가족들이 놓치는 기준은 따로 있습니다`,
    ],
    processing_fluency: [
      primary.processing_fluency,
      `${productObject} 고르기 전 가족이 꼭 봐야 할 기준을 쉽게 정리합니다`,
    ],
    escalating_reward: [
      primary.escalating_reward,
      `처음엔 비용을 봅니다. 그런데 마지막 기준 하나가 가족의 선택을 바꿉니다`,
    ],
    tension_curve: [
      primary.tension_curve,
      `${product}를 시작하면 가족의 불안이 정말 줄어들까요?`,
    ],
    peak_end: [
      primary.peak_end,
      `결국 좋은 요양은 시간보다 안심을 남깁니다`,
    ],
    narrative_transport: [
      primary.narrative_transport,
      `${pain} 때문에 지쳐 있던 가족이 처음 확인한 건 방문 기준이었습니다`,
    ],
    authority: [
      primary.authority,
      `재가 요양 상담 전, 현장 전문가가 가장 먼저 확인하는 질문입니다`,
    ],
    vulnerability: [
      primary.vulnerability,
      `좋은 돌봄이어도 가족이 불안하면 시작하기 어렵습니다`,
    ],
    social_proof: [
      primary.social_proof,
      `${product}를 고르는 가족들이 후기보다 먼저 보는 기준이 있습니다`,
    ],
    identification: [
      primary.identification,
      `부모님 걱정은 큰데 어디에 맡겨야 할지 모르겠다면 이 장면입니다`,
    ],
    reciprocity: [
      primary.reciprocity,
      `${brand} 같은 서비스를 고를 때 가족이 확인할 체크리스트를 드립니다`,
    ],
    consistency: [
      primary.consistency,
      `고객이 읽다가 멈춘 적 있죠? 그 지점이 바로 후킹 문제입니다`,
    ],
    scarcity: [
      primary.scarcity,
      `${product}는 급해진 뒤 찾으면 선택 기준이 더 흔들립니다`,
    ],
    liking: [
      primary.liking,
      `우리끼리 얘긴데, ${product}는 설명보다 이 첫 장면이 먼저입니다`,
    ],
    anchoring: [
      primary.anchoring,
      `하루 종일 직접 돌보는 것과 방문 돌봄의 차이를 먼저 보세요`,
    ],
    friction_removal: [
      primary.friction_removal,
      `상담 전에 이것만 확인하면 우리 부모님에게 맞는지 바로 보입니다`,
    ],
  };
  return (byKey[key] || [makeHookExample(persona, key)]).map(compactHook);
}

export function makeStructureExample(persona, key) {
  const map = {
    growth_narrative: `처음엔 ${persona.pain}. 전환점을 찾고 ${persona.desire}를 보여준 뒤 상담으로 연결한다.`,
    self_intro: `대표가 왜 ${persona.product}를 만들었는지, 실패와 깨달음, 지금의 사명 순서로 말한다.`,
    big_dream: `${persona.brand}가 ${String(persona.audience || "고객").split(" ")[0]} 고객의 선택 기준을 바꾸겠다는 목표를 선언하고 과정을 보여준다.`,
    adversity: `다들 ${persona.objection}라 했지만, ${persona.pain}를 숏폼 퍼널로 돌파하는 과정을 보여준다.`,
    breakthrough: `문제: ${persona.pain}. 발견: 고객은 설명보다 장면을 믿는다. 해결: ${persona.desire}.`,
    lesson: `${persona.pain}를 겪으며 깨달은 교훈과, 같은 실수를 피하는 방법을 전달한다.`,
    listicle: `${persona.product} 고객이 구매 전 확인하는 3가지 기준을 순서대로 보여준다.`,
    tutorial: `${persona.pain}를 해결하는 1단계, 2단계, 3단계 실행법을 안내한다.`,
    myth_bust: `${persona.product}는 설명을 많이 해야 팔린다는 통념을 반박하고 진짜 구매 이유를 밝힌다.`,
    versus: `일반 홍보 영상과 ${persona.brand} 퍼널형 숏폼을 비교해 차이를 보여준다.`,
    twist: `평범한 제품 소개처럼 시작하지만, 마지막에 고객이 진짜 망설이는 이유를 뒤집어 공개한다.`,
    challenge: `${persona.brand}가 7일 동안 숏폼 각도를 바꿔보고 상담 변화 결과를 공개한다.`,
    reveal: `${String(persona.audience || "고객").split(" ")[0]} 고객이 말하지 않는 구매 기준을 폭로한다.`,
    qna: `Q. 왜 구매를 망설이나요? A. ${persona.objection}. Q. 그럼 어떻게 설득하나요? A. ${persona.desire}.`,
    day_routine: `${persona.product}가 필요한 고객의 하루를 따라가며 문제와 해결 순간을 보여준다.`,
  };
  return map[key];
}

export function makeWeakHook(persona, engine) {
  const base = engine?.weakExample || `${persona.product}를 소개합니다`;
  return fillTemplate(base, persona);
}

export function buildQuestion(persona, index, examMode = false) {
  const type = examMode ? QUESTION_SEQUENCE[index % QUESTION_SEQUENCE.length] : QUESTION_SEQUENCE[index % 8];
  const enginePool = ENGINES.filter((item) => item.group !== "토대" && item.group !== "증폭기");
  const firstHookEnginePool = enginePool.filter((item) => FIRST_HOOK_ENGINE_KEYS.includes(item.key));
  if (type === "chooseHook") {
    const answer = pickRandom(firstHookEnginePool);
    return {
      kind: "chooseHook",
      questionType: "engine_choice",
      title: "심리 엔진 맞히기",
      prompt: "아래 후킹은 어떤 후킹 엔진일까요?",
      example: makeHookExample(persona, answer.key),
      options: sampleOptions(enginePool, answer),
      answer: answer.key,
      target: answer,
      model_answers: makeHookModelAnswers(persona, answer.key),
      max: 100,
    };
  }
  if (type === "chooseStructure") {
    const answer = pickRandom(STRUCTURES);
    return {
      kind: "chooseStructure",
      questionType: "structure_choice",
      title: "구조 맞히기",
      prompt: "아래 기획은 어떤 구조일까요?",
      example: makeStructureExample(persona, answer.key),
      options: sampleOptions(STRUCTURES, answer),
      answer: answer.key,
      target: answer,
      max: 100,
    };
  }
  if (type === "formulaFill") {
    const engine = pickRandom(enginePool.filter((item) => item.formulas?.length));
    const formula = pickRandom(engine.formulas);
    return {
      kind: "formulaFill",
      questionType: "formula_fill",
      title: `${engine.label} 공식 빈칸`,
      prompt: `아래 공식의 빈칸을 ${persona.brand} 맥락에 맞게 채우세요.`,
      example: formula,
      guide: `목표 엔진: ${engine.label}. 판별 단서: ${engine.tell}`,
      target: { ...engine, formula },
      max: 100,
    };
  }
  if (type === "writeHook") {
    const engine = pickRandom(firstHookEnginePool);
    return {
      kind: "writeHook",
      questionType: "write_hook_by_engine",
      title: `${engine.label} 후킹 작성`,
      prompt: `위 광고주 페르소나를 보고 ${persona.product} 숏폼 첫 문장으로 쓸 ${engine.label} 후킹을 작성하세요.`,
      guide: `판별 단서: ${engine.tell}. 공식 예시: ${engine.formulas?.slice(0, 2).join(" / ")}`,
      target: engine,
      rubric: RUBRICS.hook,
      max: 100,
    };
  }
  if (type === "rewriteHook") {
    const engine = pickRandom(firstHookEnginePool);
    return {
      kind: "rewriteHook",
      questionType: "rewrite_weak_hook",
      title: `${withInstrumentParticle(engine.label)} 약한 후킹 고치기`,
      prompt: `아래 약한 후킹을 ${engine.label}과 MSG를 활용해 더 강하게 고치세요.`,
      example: makeWeakHook(persona, engine),
      guide: `진단: ${engine.diagnosis} 처방: ${engine.prescription}`,
      target: engine,
      rubric: RUBRICS.rewrite,
      max: 100,
    };
  }
  if (type === "writeStructure") {
    const structure = pickRandom(STRUCTURES);
    return {
      kind: "writeStructure",
      questionType: "write_structure_plan",
      title: `${structure.label} 기획 작성`,
      prompt: `위 광고주에 맞는 숏폼 기획을 ${structure.label} 구조로 작성하세요.`,
      guide: `단계: ${structure.full}. 핵심 엔진: ${structure.coreEngines?.join(", ")}`,
      target: structure,
      rubric: RUBRICS.structure,
      max: 100,
    };
  }
  if (type === "diagnoseHook") {
    const engine = pickRandom(firstHookEnginePool);
    const answer = engine.diagnosis;
    const options = [
      { key: "correct", label: answer, hint: engine.prescription },
      { key: "too_visual", label: "시각 요소가 너무 강해서 문제입니다", hint: "화면 체크에 가까운 진단" },
      { key: "too_long", label: "CTA가 너무 빨리 나와서 문제입니다", hint: "행동 구간 진단" },
      { key: "wrong_stage", label: "구조는 맞지만 랜딩 메시지 매칭이 없습니다", hint: "광고 연결 진단" },
    ].sort(() => Math.random() - 0.5);
    return {
      kind: "diagnoseHook",
      questionType: "diagnose_hook",
      title: "약한 후킹 진단",
      prompt: "아래 후킹이 약한 가장 핵심 이유는 무엇일까요?",
      example: makeWeakHook(persona, engine),
      options,
      answer: "correct",
      target: engine,
      model_answers: makeHookModelAnswers(persona, engine.key),
      max: 100,
    };
  }
  if (type === "chooseFunnelStage") {
    const answer = pickRandom(FUNNEL_STAGES);
    const structureKey = pickRandom(answer.structures);
    const structure = STRUCTURES.find((item) => item.key === structureKey) || STRUCTURES[0];
    return {
      kind: "chooseFunnelStage",
      questionType: "funnel_stage_choice",
      title: "퍼널 단계 맞히기",
      prompt: "아래 영상 기획은 풀링/키/랜딩 중 어디에 가장 가까울까요?",
      example: `${answer.goal}: ${makeStructureExample(persona, structure.key)} CTA는 ${answer.key === "landing" ? "프로필 링크 한 번" : answer.key === "key" ? "가게는 프로필에" : "팔로우하고 다음 이야기 보기"}.`,
      options: FUNNEL_STAGES,
      answer: answer.key,
      target: answer,
      max: 100,
    };
  }
  if (type === "chooseAdStructure") {
    const answer = pickRandom(AD_STRUCTURES);
    return {
      kind: "chooseAdStructure",
      questionType: "ad_structure_choice",
      title: "광고 구조 맞히기",
      prompt: "아래 광고 기획은 어떤 광고 구조에 가장 가까울까요?",
      example: fillTemplate(answer.template, persona),
      options: sampleOptions(AD_STRUCTURES, answer),
      answer: answer.key,
      target: answer,
      max: 100,
    };
  }
  const ad = pickRandom(AD_STRUCTURES);
  return {
    kind: "writeAdPlan",
    questionType: "performance_ad_plan",
    title: `${ad.label} 광고 기획 작성`,
    prompt: `위 광고주를 ${ad.awareness} 고객에게 광고한다고 가정하고, ${ad.label} 구조로 20~30초 광고 대본을 작성하세요.`,
    guide: `구조: ${ad.full}. 핵심: ${ad.hint}`,
    target: ad,
    rubric: RUBRICS.ad,
    max: 100,
  };
}
