/**
 * VAANI AI — Malayalam Speech-to-Text Accuracy Metric Engine
 *
 * Implements standard speech recognition accuracy metrics:
 * - Word Error Rate (WER) using dynamic programming Levenshtein distance on word tokens.
 * - Character Error Rate (CER) on Unicode characters.
 * - Documented Malayalam Unicode normalization rules (applied strictly to COPIES).
 * - Dedicated entity accuracy scorers: numbers, dates/times, technical terms, keywords.
 *
 * SAFEGUARDS:
 * 1. Raw transcripts are NEVER altered; normalization produces a separate clone.
 * 2. No AI post-processing or rewriting is used.
 */

export interface MetricNormalizationRules {
  unicodeNfc: boolean;
  atomicChilluNormalization: boolean;
  punctuationStripped: boolean;
  latinLowercased: boolean;
  whitespaceCollapsed: boolean;
}

export interface MetricEvaluationResult {
  rawGroundTruth: string;
  rawTranscript: string;
  normalizedGroundTruth: string;
  normalizedTranscript: string;
  wer: number; // 0.0 to 1.0 (can exceed 1.0 if insertions > N)
  cer: number; // 0.0 to 1.0
  wordSubstitutions: number;
  wordDeletions: number;
  wordInsertions: number;
  groundTruthWordCount: number;
  transcriptWordCount: number;
  numberAccuracy: {
    expected: string[];
    found: string[];
    score: number; // 0.0 to 1.0
  };
  dateTimeAccuracy: {
    expected: string[];
    found: string[];
    score: number; // 0.0 to 1.0
  };
  technicalTermAccuracy: {
    expected: string[];
    found: string[];
    score: number; // 0.0 to 1.0
  };
  keywordAccuracy: {
    expected: string[];
    found: string[];
    score: number; // 0.0 to 1.0
  };
  passed: boolean;
}

/**
 * Normalization Rules Documentation:
 * 1. Unicode NFC Normalization: converts composed/decomposed characters into canonical NFC form.
 * 2. Chillu Normalization: converts legacy Virama + ZWJ combinations into canonical atomic Malayalam chillu code points (U+0D7A - U+0D7F).
 * 3. Punctuation Stripping: removes commas, periods, question marks, exclamation points, quotes, and brackets.
 * 4. Latin Lowercasing: lowercases Latin/ASCII characters for case-insensitive matching; Malayalam characters are preserved untouched.
 * 5. Whitespace Collapsing: replaces multi-spaces and linebreaks with a single standard ASCII space, and trims extremities.
 */
export function normalizeForMetrics(text: string): string {
  if (!text) return '';

  let normalized = text.normalize('NFC');

  // Legacy Virama + ZWJ chillu sequences to modern atomic chillu characters:
  // ണ + ് + ZWJ -> ൺ (U+0D7A)
  normalized = normalized.replace(/\u0D23\u0D4D\u200D/g, '\u0D7A');
  // ന + ് + ZWJ -> ൻ (U+0D7B)
  normalized = normalized.replace(/\u0D28\u0D4D\u200D/g, '\u0D7B');
  // ര + ് + ZWJ -> ർ (U+0D7C)
  normalized = normalized.replace(/\u0D30\u0D4D\u200D/g, '\u0D7C');
  // ല + ് + ZWJ -> ൽ (U+0D7D)
  normalized = normalized.replace(/\u0D32\u0D4D\u200D/g, '\u0D7D');
  // ള + ് + ZWJ -> ൾ (U+0D7E)
  normalized = normalized.replace(/\u0D33\u0D4D\u200D/g, '\u0D7E');
  // ക + ് + ZWJ -> ൿ (U+0D7F)
  normalized = normalized.replace(/\u0D15\u0D4D\u200D/g, '\u0D7F');

  // Lowercase Latin characters
  normalized = normalized.toLowerCase();

  // Strip punctuation but keep alphanumeric and Malayalam characters
  // Preserves currency symbols like ₹ ($ \u20B9)
  normalized = normalized.replace(/[.,?!:;"'“”‘’()[\]{}—–\-_/\\`~@#$%^&*+=|<>।॥]/g, ' ');

  // Collapse repeated whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Tokenizes a string into words after metric normalization
 */
export function tokenizeWords(text: string): string[] {
  const norm = normalizeForMetrics(text);
  if (!norm) return [];
  return norm.split(/\s+/).filter(Boolean);
}

/**
 * Computes Levenshtein distance matrix on token arrays (words or characters)
 */
export function computeLevenshtein<T>(
  ref: T[],
  hyp: T[]
): { distance: number; substitutions: number; deletions: number; insertions: number } {
  const n = ref.length;
  const m = hyp.length;

  if (n === 0) return { distance: m, substitutions: 0, deletions: 0, insertions: m };
  if (m === 0) return { distance: n, substitutions: 0, deletions: n, insertions: 0 };

  // DP table: d[i][j] = { cost, s, del, ins }
  const dp: Array<Array<{ cost: number; s: number; del: number; ins: number }>> = [];

  for (let i = 0; i <= n; i++) {
    dp[i] = [];
    for (let j = 0; j <= m; j++) {
      if (i === 0 && j === 0) {
        dp[i][j] = { cost: 0, s: 0, del: 0, ins: 0 };
      } else if (i === 0) {
        dp[i][j] = { cost: j, s: 0, del: 0, ins: j };
      } else if (j === 0) {
        dp[i][j] = { cost: i, s: 0, del: i, ins: 0 };
      } else {
        dp[i][j] = { cost: 0, s: 0, del: 0, ins: 0 };
      }
    }
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const match = ref[i - 1] === hyp[j - 1];

      // Deletion from ref
      const delCost = dp[i - 1][j].cost + 1;
      // Insertion into hyp
      const insCost = dp[i][j - 1].cost + 1;
      // Substitution (or match)
      const subCost = dp[i - 1][j - 1].cost + (match ? 0 : 1);

      if (match) {
        dp[i][j] = {
          cost: dp[i - 1][j - 1].cost,
          s: dp[i - 1][j - 1].s,
          del: dp[i - 1][j - 1].del,
          ins: dp[i - 1][j - 1].ins,
        };
      } else {
        if (subCost <= delCost && subCost <= insCost) {
          dp[i][j] = {
            cost: subCost,
            s: dp[i - 1][j - 1].s + 1,
            del: dp[i - 1][j - 1].del,
            ins: dp[i - 1][j - 1].ins,
          };
        } else if (delCost <= insCost) {
          dp[i][j] = {
            cost: delCost,
            s: dp[i - 1][j].s,
            del: dp[i - 1][j].del + 1,
            ins: dp[i - 1][j].ins,
          };
        } else {
          dp[i][j] = {
            cost: insCost,
            s: dp[i][j - 1].s,
            del: dp[i][j - 1].del,
            ins: dp[i][j - 1].ins + 1,
          };
        }
      }
    }
  }

  return {
    distance: dp[n][m].cost,
    substitutions: dp[n][m].s,
    deletions: dp[n][m].del,
    insertions: dp[n][m].ins,
  };
}

/**
 * Calculates Word Error Rate: WER = (S + D + I) / N
 */
export function calculateWER(
  groundTruth: string,
  hypothesis: string
): {
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  refCount: number;
  hypCount: number;
} {
  const refTokens = tokenizeWords(groundTruth);
  const hypTokens = tokenizeWords(hypothesis);

  if (refTokens.length === 0) {
    return {
      wer: hypTokens.length === 0 ? 0 : 1.0,
      substitutions: 0,
      deletions: 0,
      insertions: hypTokens.length,
      refCount: 0,
      hypCount: hypTokens.length,
    };
  }

  const lev = computeLevenshtein(refTokens, hypTokens);
  const wer = lev.distance / refTokens.length;

  return {
    wer: Number(wer.toFixed(4)),
    substitutions: lev.substitutions,
    deletions: lev.deletions,
    insertions: lev.insertions,
    refCount: refTokens.length,
    hypCount: hypTokens.length,
  };
}

/**
 * Calculates Character Error Rate: CER = (S + D + I) / N
 */
export function calculateCER(
  groundTruth: string,
  hypothesis: string
): {
  cer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  refCharCount: number;
  hypCharCount: number;
} {
  const normRef = normalizeForMetrics(groundTruth).replace(/\s+/g, '');
  const normHyp = normalizeForMetrics(hypothesis).replace(/\s+/g, '');

  const refChars = Array.from(normRef);
  const hypChars = Array.from(normHyp);

  if (refChars.length === 0) {
    return {
      cer: hypChars.length === 0 ? 0 : 1.0,
      substitutions: 0,
      deletions: 0,
      insertions: hypChars.length,
      refCharCount: 0,
      hypCharCount: hypChars.length,
    };
  }

  const lev = computeLevenshtein(refChars, hypChars);
  const cer = lev.distance / refChars.length;

  return {
    cer: Number(cer.toFixed(4)),
    substitutions: lev.substitutions,
    deletions: lev.deletions,
    insertions: lev.insertions,
    refCharCount: refChars.length,
    hypCharCount: hypChars.length,
  };
}

/**
 * Scans if expected entity tokens are preserved in the raw or normalized transcript
 */
export function scoreEntities(
  expectedEntities: string[],
  rawTranscript: string,
  normalizedTranscript: string
): { expected: string[]; found: string[]; score: number } {
  if (!expectedEntities || expectedEntities.length === 0) {
    return { expected: [], found: [], score: 1.0 };
  }

  const found: string[] = [];
  const rawLower = (rawTranscript || '').toLowerCase();
  const normLower = (normalizedTranscript || '').toLowerCase();

  for (const entity of expectedEntities) {
    const entLower = entity.toLowerCase();
    const entNorm = normalizeForMetrics(entity);

    // Direct substring or normalized token presence
    if (
      rawLower.includes(entLower) ||
      normLower.includes(entNorm) ||
      rawLower.replace(/,/g, '').includes(entLower.replace(/,/g, ''))
    ) {
      found.push(entity);
    }
  }

  const score = found.length / expectedEntities.length;
  return {
    expected: expectedEntities,
    found,
    score: Number(score.toFixed(4)),
  };
}

/**
 * Complete evaluation of a single test case
 */
export function evaluateSTTOutput(
  groundTruth: string,
  rawTranscript: string,
  expected?: {
    numbers?: string[];
    dateTime?: string[];
    technicalTerms?: string[];
    keywords?: string[];
  }
): MetricEvaluationResult {
  const normGT = normalizeForMetrics(groundTruth);
  const normHyp = normalizeForMetrics(rawTranscript);

  const werResult = calculateWER(groundTruth, rawTranscript);
  const cerResult = calculateCER(groundTruth, rawTranscript);

  const numberAcc = scoreEntities(expected?.numbers || [], rawTranscript, normHyp);
  const dateTimeAcc = scoreEntities(expected?.dateTime || [], rawTranscript, normHyp);
  const techAcc = scoreEntities(expected?.technicalTerms || [], rawTranscript, normHyp);
  const keywordAcc = scoreEntities(expected?.keywords || [], rawTranscript, normHyp);

  // Consider pass if WER <= 0.35 and key entities are largely preserved
  const passed = werResult.wer <= 0.35 && (expected?.numbers?.length ? numberAcc.score >= 0.8 : true);

  return {
    rawGroundTruth: groundTruth,
    rawTranscript: rawTranscript,
    normalizedGroundTruth: normGT,
    normalizedTranscript: normHyp,
    wer: werResult.wer,
    cer: cerResult.cer,
    wordSubstitutions: werResult.substitutions,
    wordDeletions: werResult.deletions,
    wordInsertions: werResult.insertions,
    groundTruthWordCount: werResult.refCount,
    transcriptWordCount: werResult.hypCount,
    numberAccuracy: numberAcc,
    dateTimeAccuracy: dateTimeAcc,
    technicalTermAccuracy: techAcc,
    keywordAccuracy: keywordAcc,
    passed,
  };
}
