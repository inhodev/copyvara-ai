import { Document, DocumentStatus, LinkStatus, LinkCandidate, Edge, Node, ActionPlanData, QASession } from '../types';

// Helper to generate long text
const generateLongText = (topic: string, keywords: string[]) => {
  const base = `이 문서는 ${topic}에 대한 심층적인 분석과 지식을 담고 있습니다. 현대 사회에서 ${topic}의 중요성은 날로 커지고 있으며, 특히 ${keywords.join(', ')}와 같은 핵심 요소들은 이 분야를 이해하는 데 필수적입니다. 
  
  첫째, ${keywords[0]}의 관점에서 볼 때, 우리는 기존의 패러다임이 어떻게 변화하고 있는지 주목해야 합니다. 과거의 데이터나 사례들은 현재의 복잡한 문제를 해결하는 데 있어 부분적인 통찰만을 제공할 뿐입니다. 따라서 새로운 접근 방식이 요구됩니다.
  
  둘째, ${keywords[1]}의 기술적, 혹은 이론적 발전은 놀라울 정도입니다. 이는 단순히 효율성을 높이는 것을 넘어, 우리가 상상하지 못했던 새로운 가치를 창출하고 있습니다. 전문가들은 향후 5년 내에 이 분야에서 획기적인 전환점이 찾아올 것이라고 예측합니다.
  
  셋째, ${keywords[2] || keywords[0]}와 관련된 윤리적, 사회적 논의 또한 간과할 수 없습니다. 기술의 발전 속도가 사회적 합의 속도를 앞지르면서 발생하는 다양한 문제들을 해결하기 위해, 다각적인 노력이 필요합니다.
  
  결론적으로 ${topic}은 단순한 트렌드가 아니라, 미래를 형성하는 중요한 축입니다. 이를 제대로 이해하고 활용하는 개인과 기업만이 다가오는 변화의 파도 속에서 생존하고 번영할 수 있을 것입니다. 지속적인 학습과 탐구, 그리고 ${keywords.join(', ')}에 대한 깊이 있는 이해가 그 어느 때보다 중요한 시점입니다. 이 지식 베이스가 여러분의 통찰력을 넓히는 데 도움이 되기를 바랍니다.`;

  return base.repeat(1) + (base.length < 500 ? " " + base : ""); // Ensure length > 500
};

const CATEGORIES = [
  { topic: "인공지능(AI)과 LLM", keywords: ["Transformer 아키텍처", "RAG(검색 증강 생성)", "파인튜닝"] },
  { topic: "프론트엔드 개발", keywords: ["React 19", "상태 관리", "웹 성능 최적화"] },
  { topic: "스타트업 전략", keywords: ["PMF(Product-Market Fit)", "린 스타트업", "VC 투자 유치"] },
  { topic: "현대사", keywords: ["산업 혁명", "냉전 시대", "디지털 전환"] },
  { topic: "요리 과학", keywords: ["마이야르 반응", "분자 요리", "수비드 조리법"] }
];

const generateActionPlan = (category: string): ActionPlanData => {
  return {
    goal: `${category} 관련 지식을 활용하여 역량을 강화하고 실무에 적용하기`,
    steps: [
      { id: 'step-1', step: '기초 개념 확립', description: `${category}의 핵심 원리와 용어를 정리하여 팀 위키에 공유`, priority: 'High' },
      { id: 'step-2', step: '사례 분석', description: '관련 성공/실패 사례를 찾아 벤치마킹 포인트 도출', priority: 'Medium' },
      { id: 'step-3', step: '프로젝트 적용', description: '현재 진행 중인 업무나 사이드 프로젝트에 배운 내용을 접목', priority: 'High' },
      { id: 'step-4', step: '네트워킹', description: '관련 커뮤니티나 세미나에 참여하여 최신 트렌드 파악', priority: 'Low' }
    ],
    applications: [
      { context: '기획/설계 단계', suggestion: '기술적 타당성 검토를 위한 근거 자료로 활용' },
      { context: '문제 해결', suggestion: '이슈 발생 시 원인 분석을 위한 프레임워크로 사용' }
    ]
  };
};

const generateDocs = (count: number): Document[] => {
  const docs: Document[] = [];
  for (let i = 0; i < count; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const id = `d${i + 1}`;
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));

    docs.push({
      id,
      workspaceId: 'w1',
      sourceType: i % 3 === 0 ? 'manual' : i % 3 === 1 ? 'chatgpt' : 'gemini',
      title: `${category.topic} 심화 연구 #${Math.floor(i / 5) + 1} - ${category.keywords[i % 3]}`,
      rawText: generateLongText(category.topic, category.keywords),
      status: DocumentStatus.Done,
      summaryText: `${category.topic} 분야에서 ${category.keywords.join(', ')}의 중요성을 다루고 있습니다. 기술적 발전과 사회적 영향을 포괄적으로 분석합니다.`,
      summaryBullets: [
        `${category.keywords[0]}의 현대적 재해석`,
        `${category.keywords[1]} 기술의 실제 적용 사례`,
        `미래 전망과 ${category.keywords[2] || '대응 전략'}`
      ],
      createdAt: date.toISOString(),
      docType: 'text',
      knowledgeScore: 70 + Math.floor(Math.random() * 25),
      topicTags: category.keywords,
      actionPlan: generateActionPlan(category.topic),
    });
  }
  return docs;
};

export const MOCK_DOCS: Document[] = generateDocs(30);

export const MOCK_QA_SESSIONS: QASession[] = [
  {
    id: 'qa-mock-1',
    question: '최근에 저장한 문서 기준으로 RAG 도입 시 우선순위를 어떻게 잡아야 해?',
    answer: `좋은 질문입니다. 현재 저장된 지식 기준으로 보면, 우선순위는 "검색 정확도 → 근거 제시 일관성 → 운영 안정성" 순으로 잡는 것이 가장 현실적입니다. 먼저 검색 정확도는 문서 요약, 태그, 세그먼트 품질의 영향을 크게 받기 때문에, 문서 입력 단계에서 주제 태그를 정교화하고 핵심 문장을 안정적으로 추출하는 흐름을 먼저 다져야 합니다. 그다음은 근거 제시 일관성입니다. 사용자가 답변을 신뢰하려면 답변 문장마다 어떤 문서를 참조했는지 명확히 보여야 하며, 문서 제목/스니펫/연결 관계를 함께 제공하면 검증 가능성이 올라갑니다. 마지막으로 운영 안정성은 fallback 전략, 실패 시 안내 문구, 재시도 정책으로 보완합니다. 특히 실무에서는 1회 정답률보다 "실패했을 때 얼마나 안전하게 안내하는가"가 만족도를 좌우합니다. 따라서 1단계로 검색 랭킹 품질 개선, 2단계로 출처 표시 UX 고도화, 3단계로 오류 대응 시나리오를 정식 운영 규칙으로 문서화하는 접근을 권장합니다.`,
    evidence: [
      { id: 'd1', title: '인공지능(AI)과 LLM 심화 연구 #1 - Transformer 아키텍처', snippet: 'RAG(검색 증강 생성)과 파인튜닝의 중요성을 다룹니다.' },
      { id: 'd2', title: '프론트엔드 개발 심화 연구 #1 - 상태 관리', snippet: '실사용 UI에서 신뢰 가능한 정보 전달 구조를 다룹니다.' }
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
  },
  {
    id: 'qa-mock-2',
    question: '문서 간 연결(그래프)을 답변 품질 개선에 어떻게 활용할 수 있어?',
    answer: `문서 간 연결 정보는 단순 시각화용이 아니라, 답변의 맥락 완성도를 높이는 핵심 신호로 활용할 수 있습니다. 예를 들어 사용자가 특정 주제를 질문하면 1차로 관련 문서를 검색하고, 2차로 해당 문서와 confirmed edge로 연결된 문서를 확장 검색하면 누락되는 배경 지식을 줄일 수 있습니다. 특히 supports/extends 관계는 보강 근거로, contradicts 관계는 반례 제시로 사용하면 답변이 훨씬 균형 잡히게 됩니다. 또한 연결 밀도(같은 주제에서 얼마나 많은 문서가 연결되는지)를 신뢰 점수의 보조 지표로 쓰면, 단일 문서 편향을 줄일 수 있습니다. 실무 관점에서는 답변 생성 전에 "핵심 문서 1개 + 연결 문서 2~3개"를 고정 슬롯으로 구성하고, 슬롯별 역할을 나누는 방식이 안정적입니다. 이렇게 하면 답변이 길어져도 구조가 유지되고, 사용자가 출처를 역추적하기도 쉬워집니다.`,
    evidence: [
      { id: 'd3', title: '스타트업 전략 심화 연구 #1 - VC 투자 유치', snippet: '의사결정 근거를 다층적으로 구성하는 방법을 다룹니다.' },
      { id: 'd4', title: '현대사 심화 연구 #1 - 산업 혁명', snippet: '맥락 확장과 반례 비교의 중요성을 설명합니다.' }
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString()
  },
  {
    id: 'qa-mock-3',
    question: '지식과 무관한 질문이 들어오면 어떤 UX로 안내하는 게 좋아?',
    answer: `무관한 질문 처리 UX는 “거절”보다 “안내” 중심으로 설계해야 합니다. 첫 문장에서 현재 지식 베이스 범위를 명확히 알리고, 왜 답변이 어려운지 짧게 설명한 다음, 사용자가 즉시 행동할 수 있는 대안을 제시하는 3단 구성이 효과적입니다. 예를 들면 “현재 저장된 지식 범위에서는 해당 주제를 찾지 못했습니다”라고 안내하고, 이어서 “관련 문서를 붙여넣거나 키워드를 바꿔 질문해 주세요” 같은 다음 행동을 제안하면 이탈률이 줄어듭니다. 추가로 추천 버튼(문서 추가하기, 유사 질문 예시)까지 제공하면 사용자는 실패를 실패로 느끼지 않고 탐색 과정으로 받아들입니다. 중요한 점은 단호하지만 친절한 톤입니다. 시스템 제약을 숨기지 않되, 사용자의 맥락 전환 비용을 최소화하는 문장을 유지해야 실제 만족도가 올라갑니다.`,
    evidence: [
      { id: 'd5', title: '요리 과학 심화 연구 #1 - 분자 요리', snippet: '주제 전환 시 필요한 맥락 재구성 방법을 다룹니다.' }
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString()
  }
];

// Generate Candidates & Edges based on categories
const generateConnections = (docs: Document[]) => {
  const candidates: LinkCandidate[] = [];
  const edges: Edge[] = [];

  // Connect docs within same category
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const categoryIndex = i % CATEGORIES.length;

    // Find other docs in same category
    const similarDocs = docs.filter((d, idx) => idx !== i && idx % CATEGORIES.length === categoryIndex);

    // Add 1-2 connections per doc
    const targets = similarDocs.slice(0, 1 + Math.floor(Math.random() * 2));

    targets.forEach((target, idx) => {
      const isConfirmed = Math.random() > 0.6; // 40% chance of being confirmed

      if (isConfirmed) {
        edges.push({
          id: `e${doc.id}-${target.id}`,
          source: doc.id,
          target: target.id,
          relation: 'related_to',
          status: 'confirmed'
        });
      } else {
        candidates.push({
          id: `c${doc.id}-${target.id}`,
          fromId: doc.id,
          toId: target.id,
          toTitle: target.title,
          toSnippet: target.summaryText?.substring(0, 60) + "..." || "",
          relation: 'related_to',
          confidence: 0.7 + Math.random() * 0.25,
          rationale: '동일한 주제 카테고리에 속하며 핵심 키워드를 공유합니다.',
          status: LinkStatus.Candidate
        });
        // Also add to edges for visualization as candidate
        edges.push({
          id: `e-c${doc.id}-${target.id}`,
          source: doc.id,
          target: target.id,
          relation: 'related_to',
          status: 'candidate'
        });
      }
    });
  }
  return { candidates, edges };
};

const connections = generateConnections(MOCK_DOCS);

export const MOCK_CANDIDATES: LinkCandidate[] = connections.candidates;
export const MOCK_EDGES: Edge[] = connections.edges;

export const MOCK_NODES: Node[] = MOCK_DOCS.map(d => ({
  id: d.id,
  title: d.title,
  group: 1,
  status: d.status
}));
