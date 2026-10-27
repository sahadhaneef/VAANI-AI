/**
 * Mode C: Unit Tests for STT Accuracy Metrics & Normalization Engine
 */

import {
  normalizeForMetrics,
  calculateWER,
  calculateCER,
  scoreEntities,
  evaluateSTTOutput,
} from './metrics.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
}

function runTests() {
  console.log('=== Running Mode C Metric Unit Tests ===\n');

  // Test 1: Exact match
  const test1 = calculateWER('സുഖമാണോ', 'സുഖമാണോ');
  assert(test1.wer === 0, `Exact match WER should be 0, got ${test1.wer}`);
  console.log('✓ Test 1: Exact match WER = 0.0');

  // Test 2: Single word substitution in 4-word sentence
  const test2 = calculateWER(
    'ഇന്ന് നല്ല ഒരു ദിവസമാണ്',
    'ഇന്ന് മഴയുള്ള ഒരു ദിവസമാണ്'
  );
  assert(test2.substitutions === 1, `Expected 1 substitution, got ${test2.substitutions}`);
  assert(test2.wer === 0.25, `Expected WER 0.25, got ${test2.wer}`);
  console.log('✓ Test 2: Single word substitution WER = 0.25');

  // Test 3: Deletion
  const test3 = calculateWER('ഒന്ന് രണ്ട് മൂന്ന് നാല്', 'ഒന്ന് മൂന്ന് നാല്');
  assert(test3.deletions === 1, `Expected 1 deletion, got ${test3.deletions}`);
  assert(test3.wer === 0.25, `Expected WER 0.25, got ${test3.wer}`);
  console.log('✓ Test 3: Word deletion WER = 0.25');

  // Test 4: Insertion
  const test4 = calculateWER('ഒന്ന് രണ്ട് മൂന്ന് നാല്', 'ഒന്ന് രണ്ട് പുതിയ മൂന്ന് നാല്');
  assert(test4.insertions === 1, `Expected 1 insertion, got ${test4.insertions}`);
  assert(test4.wer === 0.25, `Expected WER 0.25, got ${test4.wer}`);
  console.log('✓ Test 4: Word insertion WER = 0.25');

  // Test 5: Character Error Rate
  const test5 = calculateCER('python', 'pyton'); // 1 deletion ('h') out of 6
  assert(test5.deletions === 1, `Expected 1 char deletion, got ${test5.deletions}`);
  assert(test5.cer === Number((1 / 6).toFixed(4)), `Expected CER 0.1667, got ${test5.cer}`);
  console.log('✓ Test 5: Character Error Rate = 0.1667');

  // Test 6: Chillu Normalization
  // Legacy sequence (ണ + virama + ZWJ) vs atomic chillu (ൺ U+0D7A)
  const legacyChillu = '\u0D23\u0D4D\u200D';
  const atomicChillu = '\u0D7A';
  assert(
    normalizeForMetrics(legacyChillu) === normalizeForMetrics(atomicChillu),
    'Legacy chillu sequence should normalize to atomic chillu'
  );
  console.log('✓ Test 6: Chillu character normalization matches canonical form');

  // Test 7: Punctuation stripping does not mutate raw text
  const rawText = 'സുഖമാണോ? അതെ, എനിക്ക് സുഖമാണ്!';
  const normalized = normalizeForMetrics(rawText);
  assert(rawText.includes('?'), 'Raw text must keep punctuation');
  assert(!normalized.includes('?'), 'Normalized copy must strip question mark');
  console.log('✓ Test 7: Normalization preserves raw text immutability');

  // Test 8: Number preservation error detection
  // Prompt requirement: "₹60,000" vs "₹16,000" must be caught as a recognition error!
  const numScoreCorrect = scoreEntities(['₹60,000'], '₹60,000 ബഡ്ജറ്റിൽ', '₹60 000 ബഡ്ജറ്റിൽ');
  assert(numScoreCorrect.score === 1.0, 'Number should be recognized when matching');

  const numScoreWrong = scoreEntities(['₹60,000'], '₹16,000 ബഡ്ജറ്റിൽ', '₹16 000 ബഡ്ജറ്റിൽ');
  assert(numScoreWrong.score === 0.0, 'Mismatch between 60,000 and 16,000 must score 0.0');
  console.log('✓ Test 8: Number preservation correctly catches ₹60,000 vs ₹16,000');

  // Test 9: Time preservation error detection
  // Prompt requirement: "രാവിലെ എട്ട് മണിക്ക്" vs "രാവിലെ ഏഴ് മണിക്ക്"
  const timeScoreWrong = scoreEntities(
    ['രാവിലെ എട്ട് മണിക്ക്'],
    'രാവിലെ ഏഴ് മണിക്ക് എന്നെ വിളിക്കണം',
    'രാവിലെ ഏഴ് മണിക്ക് എന്നെ വിളിക്കണം'
  );
  assert(timeScoreWrong.score === 0.0, 'Time error (8 vs 7) must score 0.0');
  console.log('✓ Test 9: Time preservation correctly catches 8:00 vs 7:00 error');

  // Test 10: Technical terms preservation
  const techScore = scoreEntities(
    ['Python', 'React', 'TypeScript', 'Node.js'],
    'Enikku Python and TypeScript project undu',
    'enikku python and typescript project undu'
  );
  assert(techScore.found.length === 2, `Expected 2 tech terms, got ${techScore.found.length}`);
  assert(techScore.score === 0.5, `Expected 0.5 score, got ${techScore.score}`);
  console.log('✓ Test 10: Technical term preservation evaluates 2/4 = 0.5');

  // Test 11: Full evaluation wrapper
  const evalResult = evaluateSTTOutput(
    '₹60,000 budget-il codinginu nalla laptop venam.',
    '₹60,000 budget-il codinginu nalla laptop venam.',
    {
      numbers: ['₹60,000'],
      technicalTerms: ['coding', 'laptop'],
    }
  );
  assert(evalResult.wer === 0.0, 'Full eval WER should be 0');
  assert(evalResult.passed === true, 'Full eval should pass');
  assert(evalResult.numberAccuracy.score === 1.0, 'Number accuracy should be 1.0');
  assert(evalResult.technicalTermAccuracy.score === 1.0, 'Tech term accuracy should be 1.0');
  console.log('✓ Test 11: Full evaluateSTTOutput wrapper succeeded');

  console.log('\n=== ALL 11 MODE C UNIT TESTS PASSED ===\n');
}

runTests();
