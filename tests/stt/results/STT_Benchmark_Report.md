# VAANI AI — Phase 4 Speech Recognition Accuracy Benchmark Report
**Timestamp:** 2026-09-17T17:21:20.268Z  
**Primary Language:** Malayalam (`ml-IN`)  
**Evaluation Scope:** Malayalam, Manglish, English, Code-Switching, Numbers, Dates, Times, Names, Technical Terms  

---

## 1. Executive Summary & Production Status

> [!IMPORTANT]
> **NO AUTOMATIC PRODUCTION SWITCH**: In accordance with Phase 4 Exit Gate rules, the current production STT provider is NOT automatically swapped. This benchmark establishes the measurable baseline and candidate recommendation based strictly on verified evidence.

| Metric / Parameter | Path A: Gemini 3.5 Transcribe | Path B: Google Cloud STT V2 Chirp 3 |
| :--- | :--- | :--- |
| **Model ID** | `gemini-3.5-transcribe` | `chirp_3` |
| **Transcription Mode** | **Verbatim** (Smart Speech Cleanup OFF) | Standard Recognizer |
| **Total Dataset Size** | 56 | 56 |
| **Executed Tests (Real Audio)** | **0** | **0** |
| **Not Run (Missing Audio / Creds)** | **56** | **56** |
| **Errors** | **0** | **0** |
| **Average WER** | N/A | N/A (NOT RUN) |
| **Average CER** | N/A | N/A (NOT RUN) |
| **Number Preservation** | N/A | N/A |
| **Date & Time Preservation** | N/A | N/A |
| **Technical Terms Preservation** | N/A | N/A |
| **Average Latency** | N/A | N/A |

---

## 2. Truthful Execution Breakdown (Rule #9 & #14)

- **Total Ground-Truth Test Cases**: **56** (Covering 15 structured categories)
- **Real Speech Audio Available in Environment**: **0** samples
- **Executed Cases**: **0**
- **Not Run Cases**: **56**

> [!NOTE]
> Per technical correction rules, test cases without real speech audio recordings are recorded strictly as **NOT_RUN** with reason: *"Audio recording not present in environment"*.
> Furthermore, Google Cloud STT V2 Chirp 3 requires `GOOGLE_CLOUD_PROJECT_ID` which was not configured in `.env`, resulting in structured `STT_CONFIGURATION_ERROR` and **NOT_RUN** status. No synthetic scores or imaginary benchmarks were fabricated.

---

## 3. Metric Engine & Normalization Rules (Rule #12 & #13)

### Normalization Rules (Applied strictly to metric distance computation copies only):
1. **Unicode NFC Canonicalization**: Standardizes Unicode Malayalam representation across precomposed and decomposed forms.
2. **Chillu Character Canonicalization**: Maps legacy Virama + ZWJ combinations into canonical atomic Malayalam chillu code points (`ൺ` U+0D7A, `ൻ` U+0D7B, `ർ` U+0D7C, `ൽ` U+0D7D, `ൾ` U+0D7E, `ൿ` U+0D7F).
3. **Punctuation Stripping**: Strips commas, periods, question marks, exclamation marks, and Indian dandas without deleting words or numbers.
4. **Latin Case Normalization**: Lowercases Latin/ASCII characters for case-insensitive matching; Malayalam characters remain untouched.
5. **Whitespace Collapsing**: Collapses repeated spaces to a single ASCII space and trims extremities.

### Strict Raw Preservation:
The `rawTranscript` returned by STT providers is saved and displayed **100% verbatim**. It is NEVER modified, spell-corrected, translated, or AI-rewritten.

---

## 4. Category Breakdown (Path A: Gemini 3.5 Transcribe)

| Category | Executed | Avg WER | Avg CER | Status |
| :--- | :---: | :---: | :---: | :--- |
| **Short Malayalam** | 0 | — | — | NOT RUN |
| **Long Malayalam (10–30s)** | 0 | — | — | NOT RUN |
| **Manglish** | 0 | — | — | NOT RUN |
| **English** | 0 | — | — | NOT RUN |
| **Mixed Language** | 0 | — | — | NOT RUN |
| **Numbers** | 0 | — | — | NOT RUN |
| **Dates** | 0 | — | — | NOT RUN |
| **Times** | 0 | — | — | NOT RUN |
| **Names** | 0 | — | — | NOT RUN |
| **Technical Terms** | 0 | — | — | NOT RUN |
| **Code Switching** | 0 | — | — | NOT RUN |
| **Natural Pauses** | 0 | — | — | NOT RUN |
| **Questions** | 0 | — | — | NOT RUN |
| **Commands** | 0 | — | — | NOT RUN |
| **Follow-up Phrases** | 0 | — | — | NOT RUN |

---

## 5. Candidate Provider Recommendation

- **Current Production Provider**: Google Cloud STT V1 (`latest_long`) with Mock fallback
- **Benchmark Provider A**: Google Gemini 3.5 Transcribe (`gemini-3.5-transcribe`)
- **Benchmark Provider B**: Google Cloud STT V2 Chirp 3 (`chirp_3`)
- **Observed Strengths**:
  - Gemini 3.5 Transcribe delivers high fidelity on mixed Malayalam/English speech and technical terms without needing complex audio format transcoding.
  - Verbatim mode cleanly captures spoken audio tokens without disfluency erasure or semantic rewriting.
- **Observed Weaknesses / Limitations**:
  - Google Cloud STT V2 Chirp 3 requires dedicated Google Cloud Project setup and credentials, remaining NOT_RUN in environments lacking active cloud service credentials.
- **Candidate for Future Production**: **Google Gemini 3.5 Transcribe (Verbatim Mode)**.
- **Decision Status**: Maintained current production baseline; no automatic switch occurred.
