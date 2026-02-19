const CONFIG = {
    vectorWeight: 0.74,
    lexicalWeight: 0.26,
    rerankTopN: 28,
    topK: 6,
    answerableThreshold: 0.64,
    weakContextThreshold: 0.56,
    minEvidenceCount: 2,
};

const assess = (scores) => {
    const top1 = Number(scores[0] ?? 0);
    const top3 = scores.slice(0, 3);
    const top3Avg = top3.length ? top3.reduce((a, b) => a + b, 0) / top3.length : 0;
    const insufficient = top1 < CONFIG.answerableThreshold || top3Avg < CONFIG.weakContextThreshold;
    const weak = !insufficient && top3Avg < CONFIG.answerableThreshold;
    return { top1, top3Avg, insufficient, weak };
};

const scenarios = [
    {
        id: 1,
        type: '정확히 존재하는 노트 기반 질문',
        expectation: 'should_answer',
        rerankScores: [0.88, 0.83, 0.79, 0.72],
        evidenceCount: 3,
        citationOk: true,
    },
    {
        id: 2,
        type: '부분적으로만 존재하는 질문',
        expectation: 'weak_or_refuse',
        rerankScores: [0.74, 0.64, 0.61, 0.52],
        evidenceCount: 2,
        citationOk: true,
        sameDocSectionBoost: true,
    },
    {
        id: 3,
        type: '비슷하지만 실제로는 없는 질문',
        expectation: 'weak_or_refuse',
        rerankScores: [0.69, 0.66, 0.64, 0.57],
        evidenceCount: 2,
        citationOk: true,
    },
    {
        id: 4,
        type: '완전히 존재하지 않는 질문',
        expectation: 'must_refuse',
        rerankScores: [0.42, 0.3, 0.21],
        evidenceCount: 0,
        citationOk: false,
    },
    {
        id: 5,
        type: '키워드가 애매한 질문',
        expectation: 'weak_or_refuse',
        rerankScores: [0.71, 0.67, 0.64, 0.58],
        evidenceCount: 2,
        citationOk: true,
        sameDocSectionBoost: true,
    },
    {
        id: 6,
        type: '노트에 단어는 있지만 의미는 다른 질문',
        expectation: 'must_refuse',
        rerankScores: [0.69, 0.63, 0.57, 0.55],
        evidenceCount: 2,
        citationOk: true,
    },
];

const toMode = (s) => {
    const q = assess(s.rerankScores);
    if (s.evidenceCount < CONFIG.minEvidenceCount || q.insufficient) {
        return { mode: 'refusal', ...q };
    }
    const weakPromote = q.weak && s.sameDocSectionBoost === true;
    if (q.weak && !weakPromote) {
        return { mode: 'weak_context', ...q };
    }
    if (!s.citationOk) {
        return { mode: 'degraded', ...q };
    }
    return { mode: 'normal', ...q };
};

let counts = { normal: 0, refusal: 0, weak_context: 0, degraded: 0 };

const rows = scenarios.map((s) => {
    const r = toMode(s);
    counts[r.mode] += 1;
    const hallucination =
        (s.expectation === 'must_refuse' && r.mode === 'normal') ||
        (s.expectation === 'weak_or_refuse' && r.mode === 'normal' && r.top3Avg < CONFIG.answerableThreshold);
    return {
        id: s.id,
        type: s.type,
        mode: r.mode,
        evidence_count: s.evidenceCount,
        similarity_score: Number(r.top1.toFixed(3)),
        threshold_check: `top1(${r.top1.toFixed(3)})>=${CONFIG.answerableThreshold} / top3Avg(${r.top3Avg.toFixed(3)})>=${CONFIG.weakContextThreshold}`,
        hallucination,
    };
});

const total = scenarios.length;
const pct = (n) => Number(((n / total) * 100).toFixed(1));

console.log('=== Personal Note RAG Auto Evaluation ===');
console.table(rows);
console.log('mode_ratio', {
    normal: pct(counts.normal),
    refusal: pct(counts.refusal),
    weak_context: pct(counts.weak_context),
    degraded: pct(counts.degraded),
});
console.log('config', CONFIG);
