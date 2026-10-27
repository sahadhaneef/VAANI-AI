import { useState, useEffect, useMemo } from 'react';
import type { VoiceState, STTProviderId, STTBenchmarkTestCase } from '../types/assistant';
import { ttsService } from '../services/ttsService';
import { aiService } from '../services/aiService';
import { speechService } from '../services/speechService';
import { evaluateSTTOutput, type MetricEvaluationResult } from '../../tests/stt/metrics';

interface DebugPanelProps {
  status: VoiceState;
  userTranscript: string | null;
  aiResponse: string | null;
  errorMessage?: string | null;
}

export default function DebugPanel({
  status,
  userTranscript,
  aiResponse,
  errorMessage,
}: DebugPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [recTimerMs, setRecTimerMs] = useState(0);
  const [sttTestMode, setSttTestModeState] = useState(speechService.isSttTestMode());
  const [selectedProvider, setSelectedProviderState] = useState<STTProviderId>(speechService.getSelectedProvider());
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(speechService.getLanguageConfig().autoDetect);
  
  // Benchmark dataset state
  const [dataset, setDataset] = useState<STTBenchmarkTestCase[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTestId, setSelectedTestId] = useState<string>('ml-001');

  useEffect(() => {
    let interval: any = null;
    if (status === 'listening') {
      interval = setInterval(() => {
        setRecTimerMs(speechService.getRecordingDurationMs());
      }, 100);
    } else {
      setRecTimerMs(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  // Load benchmark dataset
  useEffect(() => {
    fetch('/api/stt/benchmark/dataset')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: STTBenchmarkTestCase[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setDataset(data);
        }
      })
      .catch((err) => {
        console.warn('Could not load benchmark dataset:', err);
      });
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    dataset.forEach((d) => set.add(d.category));
    return Array.from(set);
  }, [dataset]);

  const filteredTests = useMemo(() => {
    if (selectedCategory === 'all') return dataset;
    return dataset.filter((d) => d.category === selectedCategory);
  }, [dataset, selectedCategory]);

  const currentTestCase = useMemo(() => {
    return dataset.find((d) => d.id === selectedTestId) || dataset[0] || null;
  }, [dataset, selectedTestId]);

  // Recompute live evaluation whenever transcript or test case changes
  const liveEvaluation = useMemo<MetricEvaluationResult | null>(() => {
    if (!userTranscript || !currentTestCase) return null;
    try {
      return evaluateSTTOutput(
        currentTestCase.groundTruth,
        userTranscript,
        {
          numbers: currentTestCase.expectedNumbers,
          dateTime: currentTestCase.expectedDateTime,
          technicalTerms: currentTestCase.expectedTechnicalTerms,
          keywords: currentTestCase.expectedKeywords,
        }
      );
    } catch (err) {
      console.warn('Evaluation computation error:', err);
      return null;
    }
  }, [userTranscript, currentTestCase]);

  const toggleTestMode = () => {
    const next = !sttTestMode;
    speechService.setSttTestMode(next);
    setSttTestModeState(next);
  };

  const handleProviderChange = (p: STTProviderId) => {
    setSelectedProviderState(p);
    speechService.setSelectedProvider(p);
  };

  const handleLanguageToggle = () => {
    const nextAuto = !autoDetectLanguage;
    setAutoDetectLanguage(nextAuto);
    speechService.setLanguageConfig({
      languageCode: 'ml-IN',
      autoDetect: nextAuto,
    });
  };

  const ttsDebug = ttsService.getDebugStatus();
  const aiDebug = aiService.getDebugStatus();
  const sttDiag = speechService.getDiagnostics();

  const isSttDone = !!userTranscript || status === 'listening' || status === 'processing' || status === 'executing' || status === 'speaking';
  const isAiDone = !!aiResponse || status === 'processing' || status === 'executing' || status === 'speaking';
  const isTtsDone = ttsDebug.apiSuccess || status === 'speaking';
  const isAudioDone = ttsDebug.status === 'completed' || ttsDebug.status === 'playing' || status === 'speaking';

  const audioSizeKb = (sttDiag.audioSize / 1024).toFixed(1);

  return (
    <div className="mx-1 my-2">
      <div className="bg-surface-900/95 border border-surface-700/60 rounded-xl p-3 text-[11px] text-surface-300 font-mono shadow-md backdrop-blur-md space-y-3">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-surface-800 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-accent">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>Phase 4 STT Malayalam Benchmark & Engine Diagnostics</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTestMode}
              className={`text-[9px] px-2.5 py-1 rounded-md font-bold cursor-pointer transition-all ${
                sttTestMode
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-sm'
                  : 'bg-surface-800 text-surface-400 hover:text-white border border-surface-700'
              }`}
              title="Toggle STT-Only Mode (Halts pipeline after transcription; bypasses AI and TTS)"
            >
              {sttTestMode ? '⚡ STT-Only Mode: ON' : 'STT-Only: OFF'}
            </button>
            <button
              onClick={() => setCollapsed((prev) => !prev)}
              className="text-[10px] text-surface-400 hover:text-white cursor-pointer bg-surface-800 px-2 py-0.5 rounded border border-surface-700"
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        </div>

        {/* Real-time Step Indicators */}
        <div className="grid grid-cols-4 gap-1 text-center py-1 bg-surface-950/60 rounded-lg border border-surface-800/60">
          <StepBadge label="STT" active={isSttDone} />
          <StepBadge label="AI" active={isAiDone && !sttTestMode} />
          <StepBadge label="TTS" active={isTtsDone && !sttTestMode} />
          <StepBadge label="Audio" active={isAudioDone && !sttTestMode} />
        </div>

        {!collapsed && (
          <div className="space-y-3">
            {/* ── PHASE 4 STT BENCHMARK CONTROLS ── */}
            <div className="bg-surface-950/80 border border-accent/30 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-accent text-[10px] tracking-wide uppercase">
                  STT Benchmark Configuration
                </span>
                <span className="text-[9px] text-surface-400">
                  {sttTestMode ? 'Bypasses AI / TTS for raw STT measurement' : 'Standard Pipeline Active'}
                </span>
              </div>

              {/* Provider Selection (Path A vs Path B vs Baseline) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                <button
                  onClick={() => handleProviderChange('google-cloud-v2')}
                  className={`p-1.5 rounded border text-left transition-all cursor-pointer ${
                    selectedProvider === 'google-cloud-v2'
                      ? 'bg-accent/20 text-accent border-accent font-bold'
                      : 'bg-surface-900 text-surface-400 border-surface-800 hover:border-surface-700'
                  }`}
                >
                  <div className="font-semibold">Path B: Cloud STT V2</div>
                  <div className="text-[8px] opacity-75">Chirp 3 Multilingual</div>
                </button>

                <button
                  onClick={() => handleProviderChange('google-cloud-v1')}
                  className={`p-1.5 rounded border text-left transition-all cursor-pointer ${
                    selectedProvider === 'google-cloud-v1'
                      ? 'bg-accent/20 text-accent border-accent font-bold'
                      : 'bg-surface-900 text-surface-400 border-surface-800 hover:border-surface-700'
                  }`}
                >
                  <div className="font-semibold">Baseline: Cloud STT V1</div>
                  <div className="text-[8px] opacity-75">Legacy Recognizer</div>
                </button>
              </div>

              {/* Language Configuration Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-surface-800/60 text-[10px]">
                <span>Language Detection:</span>
                <button
                  onClick={handleLanguageToggle}
                  className="px-2 py-0.5 rounded bg-surface-800 border border-surface-700 text-surface-200 cursor-pointer font-semibold hover:text-white"
                >
                  {autoDetectLanguage ? 'Auto-Detect (ml-IN + en-IN)' : 'Explicit: ml-IN (Malayalam)'}
                </button>
              </div>
            </div>

            {/* ── BENCHMARK DATASET EXPLORER ── */}
            {dataset.length > 0 && (
              <div className="bg-surface-950/80 border border-surface-800 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-surface-200 text-[10px]">
                    Ground-Truth Benchmark Dataset ({dataset.length} cases)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-surface-400">Category:</span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-surface-900 text-surface-200 text-[9px] border border-surface-700 rounded px-1.5 py-0.5"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-surface-400">Test Case:</span>
                  <select
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(e.target.value)}
                    className="flex-1 bg-surface-900 text-surface-200 text-[9px] border border-surface-700 rounded px-1.5 py-0.5 truncate"
                  >
                    {filteredTests.map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        [{tc.id}] {tc.groundTruth.substring(0, 45)}...
                      </option>
                    ))}
                  </select>
                </div>

                {currentTestCase && (
                  <div className="p-2 bg-surface-900/90 rounded border border-surface-800/80 text-[10px] space-y-1">
                    <div className="text-surface-400 flex justify-between">
                      <span>Ground Truth ({currentTestCase.category}):</span>
                      <span className="text-[8px] text-surface-500">{currentTestCase.notes}</span>
                    </div>
                    <div className="text-surface-100 font-semibold text-xs leading-relaxed">
                      "{currentTestCase.groundTruth}"
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ACCURACY & ENTITY EVALUATION CARD ── */}
            {liveEvaluation && (
              <div className="bg-surface-950/90 border border-emerald-500/40 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 text-[10px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Accuracy Evaluation Result
                  </span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                      liveEvaluation.passed
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {liveEvaluation.passed ? 'PASSED (WER ≤ 0.35)' : 'NEEDS IMPROVEMENT'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-center">
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">WER (Word Error)</div>
                    <div className="text-xs font-bold text-surface-100">
                      {(liveEvaluation.wer * 100).toFixed(1)}%
                    </div>
                    <div className="text-[8px] text-surface-500">
                      S:{liveEvaluation.wordSubstitutions} D:{liveEvaluation.wordDeletions} I:{liveEvaluation.wordInsertions}
                    </div>
                  </div>

                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">CER (Char Error)</div>
                    <div className="text-xs font-bold text-surface-100">
                      {(liveEvaluation.cer * 100).toFixed(1)}%
                    </div>
                    <div className="text-[8px] text-surface-500">
                      Ref Chars: {liveEvaluation.rawGroundTruth.replace(/\s+/g, '').length}
                    </div>
                  </div>

                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Numbers Preserved</div>
                    <div className="text-xs font-bold text-amber-300">
                      {liveEvaluation.numberAccuracy.expected.length === 0
                        ? 'N/A'
                        : `${(liveEvaluation.numberAccuracy.score * 100).toFixed(0)}%`}
                    </div>
                    <div className="text-[8px] text-surface-500">
                      {liveEvaluation.numberAccuracy.found.length}/{liveEvaluation.numberAccuracy.expected.length}
                    </div>
                  </div>

                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Tech Terms</div>
                    <div className="text-xs font-bold text-cyan-300">
                      {liveEvaluation.technicalTermAccuracy.expected.length === 0
                        ? 'N/A'
                        : `${(liveEvaluation.technicalTermAccuracy.score * 100).toFixed(0)}%`}
                    </div>
                    <div className="text-[8px] text-surface-500">
                      {liveEvaluation.technicalTermAccuracy.found.length}/{liveEvaluation.technicalTermAccuracy.expected.length}
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-surface-400 space-y-0.5 pt-1 border-t border-surface-800/60">
                  <div className="flex justify-between">
                    <span>Raw STT Transcript:</span>
                    <span className="text-surface-200 font-semibold truncate max-w-[220px]">
                      "{liveEvaluation.rawTranscript}"
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── PHASE 5 SEMANTIC UNDERSTANDING DIAGNOSTICS ── */}
            {aiDebug.lastUnderstanding && (
              <div className="bg-surface-950/90 border border-indigo-500/40 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-400 text-[10px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    Phase 5 Semantic Understanding
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                    {aiDebug.lastUnderstanding.complexity}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-center">
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Intent</div>
                    <div className="text-xs font-bold text-surface-100 truncate" title={aiDebug.lastUnderstanding.intent}>
                      {aiDebug.lastUnderstanding.intent}
                    </div>
                  </div>
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Language Mode</div>
                    <div className="text-xs font-bold text-cyan-300 capitalize">
                      {aiDebug.lastUnderstanding.languageMode}
                    </div>
                  </div>
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Future Tool Intent</div>
                    <div className="text-xs font-bold text-amber-300 truncate" title={aiDebug.lastUnderstanding.futureToolIntent || 'none'}>
                      {aiDebug.lastUnderstanding.futureToolIntent || 'none'}
                    </div>
                  </div>
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Clarification</div>
                    <div className="text-xs font-bold text-surface-100">
                      {aiDebug.lastUnderstanding.needsClarification ? 'YES' : 'NO'}
                    </div>
                  </div>
                </div>

                {/* Extracted Entities & Context Resolution */}
                {aiDebug.lastUnderstanding.entities && (
                  <div className="text-[9px] text-surface-400 space-y-0.5 pt-1 border-t border-surface-800/60">
                    {aiDebug.lastUnderstanding.entities.technicalTerms && aiDebug.lastUnderstanding.entities.technicalTerms.length > 0 && (
                      <div className="flex justify-between">
                        <span>Technical Terms:</span>
                        <span className="text-surface-200 font-semibold truncate max-w-[220px]">
                          {aiDebug.lastUnderstanding.entities.technicalTerms.join(', ')}
                        </span>
                      </div>
                    )}
                    {aiDebug.lastUnderstanding.entities.date && (
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span className="text-surface-200 font-semibold truncate max-w-[220px]">
                          {aiDebug.lastUnderstanding.entities.date}
                        </span>
                      </div>
                    )}
                    {aiDebug.lastUnderstanding.entities.time && (
                      <div className="flex justify-between">
                        <span>Time:</span>
                        <span className="text-surface-200 font-semibold truncate max-w-[220px]">
                          {aiDebug.lastUnderstanding.entities.time}
                        </span>
                      </div>
                    )}
                    {aiDebug.lastUnderstanding.entities.locations && aiDebug.lastUnderstanding.entities.locations.length > 0 && (
                      <div className="flex justify-between">
                        <span>Locations:</span>
                        <span className="text-surface-200 font-semibold truncate max-w-[220px]">
                          {aiDebug.lastUnderstanding.entities.locations.join(', ')}
                        </span>
                      </div>
                    )}
                    {aiDebug.lastUnderstanding.entities.products && aiDebug.lastUnderstanding.entities.products.length > 0 && (
                      <div className="flex justify-between">
                        <span>Products:</span>
                        <span className="text-surface-200 font-semibold truncate max-w-[220px]">
                          {aiDebug.lastUnderstanding.entities.products.join(', ')}
                        </span>
                      </div>
                    )}
                    {aiDebug.lastUnderstanding.entities.references && aiDebug.lastUnderstanding.entities.references.length > 0 && (
                      <div className="flex justify-between">
                        <span>Resolved Refs:</span>
                        <span className="text-emerald-400 font-semibold truncate max-w-[220px]">
                          {aiDebug.lastUnderstanding.entities.references.join(', ')}
                        </span>
                      </div>
                    )}
                    {aiDebug.lastUnderstanding.entities.references && aiDebug.lastUnderstanding.entities.references.length > 0 && (
                      <div className="flex justify-between text-indigo-300 font-semibold">
                        <span>Contextual Follow-up:</span>
                        <span>Active Session Context Used</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── PHASE 6 PERSISTENT MEMORY & CONTEXT DIAGNOSTICS ── */}
            {aiDebug.memoryDiagnostics && (
              <div className="bg-surface-950/90 border border-emerald-500/40 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 text-[10px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Phase 6 Context & Persistent Memory
                  </span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                      aiDebug.memoryDiagnostics.dbStatus === 'OK'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    DB: {aiDebug.memoryDiagnostics.dbStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-center">
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Memory Intent</div>
                    <div className="text-xs font-bold text-surface-100 uppercase">
                      {aiDebug.memoryDiagnostics.memoryIntent || 'None'}
                    </div>
                  </div>
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Operation</div>
                    <div
                      className={`text-xs font-bold capitalize ${
                        aiDebug.memoryDiagnostics.memoryOperation === 'refused'
                          ? 'text-rose-400'
                          : aiDebug.memoryDiagnostics.memoryOperation === 'created' ||
                            aiDebug.memoryDiagnostics.memoryOperation === 'updated'
                          ? 'text-emerald-400'
                          : 'text-cyan-300'
                      }`}
                    >
                      {aiDebug.memoryDiagnostics.memoryOperation}
                    </div>
                  </div>
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Retrieved Count</div>
                    <div className="text-xs font-bold text-amber-300">
                      {aiDebug.memoryDiagnostics.retrievalCount} active
                    </div>
                  </div>
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Retrieval Latency</div>
                    <div className="text-xs font-bold text-indigo-300">
                      {aiDebug.memoryDiagnostics.retrievalLatencyMs} ms
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-surface-400 space-y-1 pt-1 border-t border-surface-800/60">
                  {aiDebug.memoryDiagnostics.memoryId && (
                    <div className="flex justify-between">
                      <span>Memory ID:</span>
                      <span className="text-surface-200 font-mono text-[8px] truncate max-w-[200px]">
                        {aiDebug.memoryDiagnostics.memoryId}
                      </span>
                    </div>
                  )}
                  {aiDebug.memoryDiagnostics.memoryType && (
                    <div className="flex justify-between">
                      <span>Memory Type:</span>
                      <span className="text-cyan-300 font-semibold uppercase text-[8px]">
                        {aiDebug.memoryDiagnostics.memoryType}
                      </span>
                    </div>
                  )}
                  {aiDebug.memoryCandidate && (
                    <div className="flex justify-between">
                      <span>Candidate Fact:</span>
                      <span className="text-surface-200 font-semibold truncate max-w-[220px]">
                        {aiDebug.memoryCandidate.key}: {aiDebug.memoryCandidate.value}
                      </span>
                    </div>
                  )}
                  {aiDebug.memoryDiagnostics.errorMessage && (
                    <div className="flex justify-between text-rose-400">
                      <span>Notice:</span>
                      <span>{aiDebug.memoryDiagnostics.errorMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PHASE 7: GOOGLE SEARCH GROUNDING & WEB RESEARCH DIAGNOSTICS ── */}
            {aiDebug.searchDiagnostics && (
              <div className="bg-surface-950/80 border border-emerald-500/30 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-[10px] tracking-wide uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Phase 7: Google Search Grounding & Web Research</span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      aiDebug.searchDiagnostics.searched
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-surface-800 text-surface-400 border-surface-700'
                    }`}
                  >
                    {aiDebug.searchDiagnostics.searched ? '⚡ Grounded Search: YES' : 'No Web Search Needed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Search Intent</div>
                    <div className="text-xs font-bold text-emerald-300 uppercase">
                      {aiDebug.searchDiagnostics.searchIntent || aiDebug.searchIntent || 'none'}
                    </div>
                  </div>
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Search Reason</div>
                    <div className="text-[10px] font-bold text-teal-300 truncate">
                      {aiDebug.searchDiagnostics.searchReason || aiDebug.searchReason || 'NONE'}
                    </div>
                  </div>
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Queries Executed</div>
                    <div className="text-xs font-bold text-cyan-300">
                      {aiDebug.searchDiagnostics.queryCount ?? (aiDebug.searchDiagnostics.queries?.length || 0)}
                    </div>
                  </div>
                  <div className="bg-surface-900 p-1.5 rounded border border-surface-800">
                    <div className="text-[9px] text-surface-400">Sources / Latency</div>
                    <div className="text-xs font-bold text-amber-300">
                      {aiDebug.searchDiagnostics.sourcesCount ?? (aiDebug.searchDiagnostics.sources?.length || 0)} src ({aiDebug.searchDiagnostics.searchLatencyMs || 0}ms)
                    </div>
                  </div>
                </div>

                {/* Grounded Web Queries */}
                {Array.isArray(aiDebug.searchDiagnostics.queries) && aiDebug.searchDiagnostics.queries.length > 0 && (
                  <div className="text-[9px] text-surface-400 pt-1 border-t border-surface-800/60">
                    <span className="font-semibold text-surface-300">Grounding Queries: </span>
                    <span className="text-surface-200">
                      {aiDebug.searchDiagnostics.queries.map((q: string) => `"${q}"`).join(', ')}
                    </span>
                  </div>
                )}

                {/* Grounded Web Sources */}
                {Array.isArray(aiDebug.searchDiagnostics.sources) && aiDebug.searchDiagnostics.sources.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-surface-800/60">
                    <div className="text-[9px] font-semibold text-emerald-400">Grounded Citations & Sources:</div>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto pr-1">
                      {aiDebug.searchDiagnostics.sources.map((src: { title: string; url: string }, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-[8px] bg-surface-900/60 px-1.5 py-0.5 rounded border border-surface-800">
                          <span className="text-surface-200 truncate max-w-[200px]" title={src.title}>
                            {src.title || src.url}
                          </span>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline ml-2 truncate max-w-[120px]"
                            title={src.url}
                          >
                            Visit ↗
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(aiDebug.searchDiagnostics.errorMessage || aiDebug.searchDiagnostics.errorCategory) && (
                  <div className="text-[9px] text-rose-400 pt-1 border-t border-surface-800/60 flex items-center justify-between flex-wrap gap-1">
                    <span>Notice: {aiDebug.searchDiagnostics.errorMessage || 'Search could not retrieve live results'}</span>
                    {aiDebug.searchDiagnostics.errorCategory && (
                      <span className="bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded text-rose-300 font-mono text-[8px]">
                        [{aiDebug.searchDiagnostics.errorCategory}{aiDebug.searchDiagnostics.httpStatus ? `:${aiDebug.searchDiagnostics.httpStatus}` : ''}]
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* ── CORE DIAGNOSTICS READOUT ── */}
            <div className="space-y-1 text-[10px] text-surface-400 pt-1 border-t border-surface-800">
              {sttDiag.requestId && (
                <div className="flex justify-between">
                  <span>Request ID:</span>
                  <span className="text-surface-300 font-mono text-[9px] truncate max-w-[180px]">
                    {sttDiag.requestId}
                  </span>
                </div>
              )}
              {status === 'listening' ? (
                <div className="flex justify-between text-red-400 font-bold">
                  <span>Rec Duration:</span>
                  <span>{(recTimerMs / 1000).toFixed(1)}s ({sttDiag.chunksCount} chunks)</span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span>Audio Blob Size:</span>
                  <span className="text-surface-200 font-semibold">
                    {audioSizeKb} KB ({sttDiag.chunksCount} chunks, {sttDiag.recordingDurationMs}ms)
                  </span>
                </div>
              )}
              {sttDiag.mimeType && (
                <div className="flex justify-between">
                  <span>Audio MIME:</span>
                  <span className="text-surface-300 font-mono text-[9px] truncate max-w-[180px]">
                    {sttDiag.mimeType}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Active STT Provider:</span>
                <span className="text-surface-200 font-semibold truncate max-w-[180px]">
                  {sttDiag.sttProvider}
                </span>
              </div>
              {sttDiag.model && (
                <div className="flex justify-between">
                  <span>STT Model:</span>
                  <span className="text-surface-300 font-mono text-[9px]">
                    {sttDiag.model}
                  </span>
                </div>
              )}
              {sttDiag.languageConfigUsed && (
                <div className="flex justify-between">
                  <span>Language Config:</span>
                  <span className="text-surface-300 font-mono text-[9px]">
                    {sttDiag.languageConfigUsed}
                  </span>
                </div>
              )}
              {sttDiag.providerLatencyMs !== undefined && (
                <div className="flex justify-between">
                  <span>STT Provider Latency:</span>
                  <span className="text-amber-400 font-mono font-semibold">
                    {sttDiag.providerLatencyMs} ms
                  </span>
                </div>
              )}
              {sttDiag.status && (
                <div className="flex justify-between">
                  <span>STT Benchmark Status:</span>
                  <span className={`font-bold ${
                    sttDiag.status === 'RUN' ? 'text-emerald-400' : sttDiag.status === 'NOT_RUN' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {sttDiag.status}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Microphone Track:</span>
                <span className="text-emerald-400 font-medium">
                  {sttDiag.micPermission?.toUpperCase()} ({sttDiag.trackState?.toUpperCase()})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Failure Stage:</span>
                <span className={sttDiag.failureStage === 'NONE' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {sttDiag.failureStage || 'NONE'} {sttDiag.errorCode && sttDiag.errorCode !== 'NONE' ? `(${sttDiag.errorCode})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Raw Spoken Transcript:</span>
                <span className="text-surface-200 font-medium truncate max-w-[180px]">
                  "{userTranscript || aiDebug.lastSpokenInput || '—'}"
                </span>
              </div>
              {errorMessage && (
                <div className="text-red-400 font-semibold mt-1">
                  ⚠️ Error: {errorMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`py-1 rounded font-bold text-[10px] transition-all ${
        active
          ? 'bg-accent/20 text-accent border border-accent/40'
          : 'bg-surface-900 text-surface-500 border border-surface-800'
      }`}
    >
      {label}: {active ? '✓' : '○'}
    </div>
  );
}
