type CitationDoc = {
    id: string;
    title: string;
    content: string;
};

const STOPWORDS = new Set([
    '그리고', '하지만', '그러나', '또한', '대한', '관련', '위해', '에서', '으로', '에게', '저는', '제가', '그냥', '정리',
    'what', 'how', 'why', 'when', 'where', 'which', 'about', 'with', 'from', 'into', 'that', 'this'
]);

const SYNONYM_MAP: Record<string, string[]> = {
    ai: ['인공지능', 'llm', 'rag'],
    인공지능: ['ai', 'llm', 'rag'],
    llm: ['대형언어모델', 'ai', 'rag'],
    rag: ['검색증강생성', 'retrieval', 'llm'],
    프론트엔드: ['frontend', 'react', '상태관리'],
    react: ['프론트엔드', '상태관리'],
    스타트업: ['pmf', '투자', '전략'],
    pmf: ['product market fit', '스타트업'],
    상태관리: ['state', 'react', 'store']
};

const normalize = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const tokenize = (text: string): string[] => normalize(text).split(' ').filter((t) => t.length > 1);

export const extractKeywords = (question: string, min = 3, max = 6): string[] => {
    const tokens = tokenize(question).filter((t) => !STOPWORDS.has(t));
    const uniq = Array.from(new Set(tokens));
    if (uniq.length >= min) return uniq.slice(0, max);
    return Array.from(new Set([...uniq, ...tokenize(question)])).slice(0, max);
};

export const expandKeywords = (keywords: string[]): string[] => {
    const expanded = new Set<string>(keywords);
    keywords.forEach((k) => {
        const linked = SYNONYM_MAP[k] || [];
        linked.forEach((s) => expanded.add(s));
    });
    return Array.from(expanded).slice(0, 14);
};

export const buildExpandedQuery = (question: string, expandedKeywords: string[]): string => {
    const keyPart = expandedKeywords.slice(0, 8).join(' ');
    return `${question} ${keyPart}`.trim();
};

export const hasTopicOverlap = (question: string, docs: CitationDoc[]): boolean => {
    const q = new Set(extractKeywords(question, 2, 8));
    if (!q.size) return false;
    const hits = docs.slice(0, 10).reduce((acc, d) => {
        const docTokens = new Set(tokenize(`${d.title} ${d.content.slice(0, 300)}`));
        let overlap = 0;
        q.forEach((k) => {
            if (docTokens.has(k)) overlap += 1;
        });
        return acc + (overlap > 0 ? 1 : 0);
    }, 0);
    return hits >= 2;
};

export const buildTopicGuideAnswer = (question: string, docs: CitationDoc[]): string => {
    const topicNames = Array.from(new Set(docs.slice(0, 6).map((d) => d.title))).slice(0, 3);
    const topics = topicNames.length ? topicNames : ['저장 문서 주제'];
    return [
        `질문 "${question}"과 직접적으로 맞는 근거는 아직 약합니다.`,
        `대신 현재 저장 문서에서 가까운 주제 후보는 ${topics.map((t) => `"${t}"`).join(', ')} 입니다.`,
        '원하시면 위 주제 중 하나를 지정해 다시 질문해 주세요. 예: "첫 번째 주제로 실행 계획 정리해줘"',
        '(출처: 저장 문서 인덱스)'
    ].join('\n');
};

export const buildCitationPrompt = (params: { question: string; docs: CitationDoc[] }): string => {
    const context = (params.docs || [])
        .slice(0, 10)
        .map(
            (d, i) =>
                `[ID:${i + 1}] key=${d.id}\nTITLE: ${d.title || '-'}\nCONTENT: ${(d.content || '').slice(0, 1000)}`
        )
        .join('\n\n');

    const keywords = extractKeywords(params.question);
    const expanded = expandKeywords(keywords);

    return [
        '당신은 Copyvara의 개인 전략 파트너이자 근거 기반 RAG 답변기입니다. 반드시 JSON으로만 답하십시오.',
        '',
        '출력 스키마:',
        '- answer: string',
        '- evidence: [{id,title,snippet,segmentId?}]',
        '- citations: [{id,title,quote}]',
        '- confidence: number(0~1)',
        '- ambiguity: boolean',
        '',
        '강제 규칙:',
        '1) 답변 형식은 반드시 아래 4개 섹션을 고정한다: 핵심 요약 / 저장된 지식 기반 분석 / 실행 관점 정리 / 추가 통찰.',
        '2) 각 주요 문단 끝에는 반드시 (출처: 문서명) 형식으로 근거를 붙인다.',
        '3) 근거가 약하면 임의추론하지 말고 "해석"이라고 명시한다.',
        '4) 문서가 약하게 연결되어도 2개 이상이면 weak_context 요약을 시도한다.',
        '5) evidence/citations는 실제 사용한 context에서만 뽑고, citations.quote는 짧은 인용문이어야 한다.',
        '6) 답변 길이는 최소 500자 이상, 평균 1000자 수준의 밀도를 유지한다.',
        '',
        `question keywords: ${keywords.join(', ') || '(none)'}`,
        `expanded keywords: ${expanded.join(', ') || '(none)'}`,
        `question:\n${params.question}`,
        '',
        `context:\n${context || '(empty)'}`
    ].join('\n');
};

export const hasSentenceLevelCitation = (answer: string): boolean => {
    const paragraphs = answer
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (!paragraphs.length) return false;
    return paragraphs.every((p) => /\(출처:\s*[^)]+\)$/.test(p));
};
