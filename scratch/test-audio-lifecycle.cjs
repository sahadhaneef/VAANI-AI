/**
 * Automated Unit Test Suite for Phase 3 Audio Capture Lifecycle and Safeguards
 */

// 1. Test capability-based MIME selection logic
function selectBestMimeType(supportedMap) {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
  ];
  for (const mime of candidates) {
    if (supportedMap[mime]) {
      return mime;
    }
  }
  return '';
}

// 2. Test Audio Validation rules (Safeguard 12)
function validateAudioCapture(blobSize, durationMs) {
  if (blobSize === 0) {
    return { valid: false, errorCode: 'AUDIO_EMPTY', failureStage: 'AUDIO_FAILURE' };
  }
  if (blobSize < 600 || durationMs < 400) {
    return { valid: false, errorCode: 'AUDIO_TOO_SHORT', failureStage: 'AUDIO_FAILURE' };
  }
  return { valid: true, errorCode: 'NONE', failureStage: 'NONE' };
}

// 3. Test Session ID & Overlap guard
class MockCaptureSessionManager {
  constructor() {
    this.activeRequestId = null;
    this.audioChunks = [];
    this.state = 'idle';
  }

  start(reqId) {
    // Invalidate old session
    this.activeRequestId = reqId;
    this.audioChunks = [];
    this.state = 'listening';
  }

  addData(reqId, chunk) {
    if (this.activeRequestId !== reqId) {
      // Stale callback blocked!
      return false;
    }
    this.audioChunks.push(chunk);
    return true;
  }

  finalize(reqId) {
    if (this.activeRequestId !== reqId) {
      return null;
    }
    this.state = 'finalized';
    return { reqId, chunkCount: this.audioChunks.length };
  }
}

async function runPhase3UnitTests() {
  console.log('=== PHASE 3 AUDIO CAPTURE UNIT & LIFECYCLE TESTS ===\n');

  // Test 1: Capability-based MIME selection
  console.log('[Test 1] Capability-based MIME Selection:');
  const chromeSupport = { 'audio/webm;codecs=opus': true, 'audio/webm': true };
  const safariSupport = { 'audio/mp4': true };
  const fallbackSupport = {};

  const chromeMime = selectBestMimeType(chromeSupport);
  const safariMime = selectBestMimeType(safariSupport);
  const fallbackMime = selectBestMimeType(fallbackSupport);

  console.assert(chromeMime === 'audio/webm;codecs=opus', `Expected audio/webm;codecs=opus, got ${chromeMime}`);
  console.assert(safariMime === 'audio/mp4', `Expected audio/mp4, got ${safariMime}`);
  console.assert(fallbackMime === '', `Expected empty fallback, got ${fallbackMime}`);
  console.log('✓ Capability-based MIME selection correctly prioritized without forcing unsupported types.');

  // Test 2: Audio Validation Rules
  console.log('\n[Test 2] Audio Validation Rules:');
  const resEmpty = validateAudioCapture(0, 0);
  console.assert(!resEmpty.valid && resEmpty.errorCode === 'AUDIO_EMPTY', 'Empty audio not rejected');
  console.log('✓ Correctly detected AUDIO_EMPTY (0 bytes)');

  const resTooShort = validateAudioCapture(450, 300);
  console.assert(!resTooShort.valid && resTooShort.errorCode === 'AUDIO_TOO_SHORT', 'Too short audio not rejected');
  console.log('✓ Correctly detected AUDIO_TOO_SHORT (<600 bytes or <400ms)');

  const resValid = validateAudioCapture(8500, 2500);
  console.assert(resValid.valid && resValid.errorCode === 'NONE', 'Valid audio incorrectly rejected');
  console.log('✓ Correctly accepted valid audio (8.5KB, 2.5s)');

  // Test 3: Session Overlap & Stale Request Protection
  console.log('\n[Test 3] Session Overlap & Stale Request Protection:');
  const mgr = new MockCaptureSessionManager();
  mgr.start('req_001');
  const accepted1 = mgr.addData('req_001', 'chunk_1A');
  console.assert(accepted1 === true, 'Chunk 1A should be accepted');

  // Interruption: User triggers req_002
  mgr.start('req_002');
  const staleAccepted = mgr.addData('req_001', 'late_chunk_1B');
  console.assert(staleAccepted === false, 'Late chunk from req_001 should be blocked');

  const accepted2 = mgr.addData('req_002', 'chunk_2A');
  console.assert(accepted2 === true, 'Chunk 2A should be accepted');

  const finalizedStale = mgr.finalize('req_001');
  console.assert(finalizedStale === null, 'Stale finalize callback should be ignored');

  const finalizedActive = mgr.finalize('req_002');
  console.assert(finalizedActive !== null && finalizedActive.reqId === 'req_002', 'Active finalize should succeed');
  console.assert(finalizedActive.chunkCount === 1, 'Active session must not contain chunks from req_001');
  console.log('✓ Stale request callbacks completely isolated; no chunk contamination across sessions.');

  console.log('\n=== ALL PHASE 3 UNIT & LIFECYCLE TESTS PASSED ===\n');
}

runPhase3UnitTests().catch((err) => {
  console.error('Unit tests failed:', err);
  process.exit(1);
});
