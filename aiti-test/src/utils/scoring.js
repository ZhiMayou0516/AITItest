const BUG_TRAITS = new Set(['LIAR', 'FLATTERER']);

export function calculateResult(config, answers, options = {}) {
  const topN = options.topN ?? 5;
  const alpha = options.alpha ?? 9;
  const traitCodes = getTraitCodes(config);
  const scores = createEmptyScores(traitCodes);
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));

  for (const question of config.questions ?? []) {
    const selectedOptionId = answerMap.get(question.id);
    if (!selectedOptionId) continue;

    const option = question.options?.find((item) => item.id === selectedOptionId);
    if (!option) continue;

    const optionScores = option.scores ?? option.weights ?? {};
    for (const [trait, value] of Object.entries(optionScores)) {
      scores[trait] = (scores[trait] ?? 0) + Number(value || 0);
    }
  }

  const normalTraitCodes = traitCodes.filter((trait) => !BUG_TRAITS.has(trait));
  const aiMatches = calculateAiMatches(config.ai_profiles ?? {}, scores, normalTraitCodes, topN, alpha);
  const sortedNormalTraits = rankTraits(scores, normalTraitCodes);
  const sortedBugTraits = rankTraits(scores, traitCodes.filter((trait) => BUG_TRAITS.has(trait)));

  return {
    personalityScores: scores,
    aiMatches,
    mainTrait: sortedNormalTraits[0] ?? { trait: 'GENERALIST', score: 0 },
    subTraits: sortedNormalTraits.slice(1, 3),
    hiddenBug: sortedBugTraits[0] ?? { trait: 'LIAR', score: 0 },
    topTraits: sortedNormalTraits.slice(0, 8),
    answeredCount: answers.length,
    totalQuestions: config.questions?.length ?? 0
  };
}

export function getTraitCodes(config) {
  if (Array.isArray(config.personalities)) {
    return config.personalities.map((item) => item.code);
  }
  if (Array.isArray(config.traits)) {
    return config.traits.map((item) => item.id ?? item.code ?? item);
  }
  return [];
}

export function getTraitMeta(config, traitCode) {
  const personalities = config.personalities ?? config.traits ?? [];
  const found = personalities.find((item) => (item.code ?? item.id ?? item) === traitCode);
  if (!found || typeof found === 'string') {
    return { code: traitCode, zh: traitCode, description: '' };
  }
  return found;
}

function createEmptyScores(traitCodes) {
  return Object.fromEntries(traitCodes.map((trait) => [trait, 0]));
}

function rankTraits(scores, traits) {
  return traits
    .map((trait) => ({ trait, score: scores[trait] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.trait.localeCompare(b.trait));
}

function calculateAiMatches(aiProfiles, userScores, traits, topN, alpha) {
  const raw = Object.entries(aiProfiles).map(([key, profile]) => {
    const similarity = cosineSimilarity(userScores, profile.weights ?? {}, traits);
    return {
      key,
      name: profile.display_name ?? key,
      shortProfile: profile.short_profile ?? '',
      origin: profile.origin ?? '',
      icon: profile.icon ?? '',
      score: similarity
    };
  });

  const top = raw.sort((a, b) => b.score - a.score).slice(0, topN);
  return softmaxToPercent(top, alpha);
}

function cosineSimilarity(userVector, aiVector, traits) {
  let dot = 0;
  let userNorm = 0;
  let aiNorm = 0;

  for (const trait of traits) {
    const u = Number(userVector[trait] ?? 0);
    const a = Number(aiVector[trait] ?? 0);
    dot += u * a;
    userNorm += u * u;
    aiNorm += a * a;
  }

  if (userNorm === 0 || aiNorm === 0) return 0;
  return dot / (Math.sqrt(userNorm) * Math.sqrt(aiNorm));
}

function softmaxToPercent(items, alpha) {
  if (items.length === 0) return [];

  const maxScore = Math.max(...items.map((item) => item.score));
  const expItems = items.map((item) => ({
    ...item,
    expScore: Math.exp(alpha * (item.score - maxScore))
  }));
  const total = expItems.reduce((sum, item) => sum + item.expScore, 0) || 1;

  const withPercent = expItems.map(({ expScore, ...item }) => ({
    ...item,
    percent: Math.round((expScore / total) * 100)
  }));

  const diff = 100 - withPercent.reduce((sum, item) => sum + item.percent, 0);
  withPercent[0].percent += diff;

  return withPercent;
}
