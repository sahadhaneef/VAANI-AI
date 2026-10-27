/**
 * Natural Spoken Malayalam Speech Formatter — Phase 9 Voice Output Layer
 *
 * Formats AI reasoning and tool outputs into natural, clear spoken Malayalam / English.
 * - Strips all markdown syntax (asterisks, hashtags, markdown tables, bullet points, brackets).
 * - Converts bullet points into conversational spoken connectors:
 *   "ആദ്യം...", "രണ്ടാമതായി...", "കൂടാതെ...", "അവസാനമായി..."
 * - Normalizes currency symbols (₹ -> രൂപ, Rs -> രൂപ).
 * - Maintains concise, human-friendly 2-4 spoken sentences for optimal audio listening.
 */

export class SpeechFormatter {
  /**
   * Cleans and normalizes text for speech synthesis
   */
  static cleanForSpeech(text: string): string {
    if (!text) return '';

    return text
      // Remove markdown headers
      .replace(/#{1,6}\s+/g, '')
      // Remove bold / italics
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove code blocks and inline code
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove reference tags like [Ref: ...] or [Topic: ...]
      .replace(/\[(?:Ref|Topic|Intent|Status):[^\]]+\]/gi, '')
      // Currency conversion
      .replace(/₹\s*(\d+(?:,\d+)*(?:\.\d+)?)/g, '$1 രൂപ')
      .replace(/Rs\.?\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi, '$1 രൂപ')
      .replace(/INR\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi, '$1 രൂപ')
      // Clean multiple whitespaces & newlines
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Converts structured items/bullet points into flowing spoken Malayalam
   */
  static formatStructuredListToMalayalam(items: string[]): string {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return this.cleanForSpeech(items[0]);

    const connectors = [
      'ആദ്യം',
      'രണ്ടാമതായി',
      'മൂന്നാമതായി',
      'തുടർന്ന്',
      'കൂടാതെ',
      'അവസാനമായി',
    ];

    const spokenParts = items.map((item, index) => {
      const cleanItem = this.cleanForSpeech(item).replace(/^\d+[\.\)]\s*/, '').replace(/^[-*•]\s*/, '');
      const connector = index === items.length - 1 && items.length > 2
        ? 'അവസാനമായി'
        : (connectors[index] || 'കൂടാതെ');
      return `${connector}, ${cleanItem}`;
    });

    return spokenParts.join('. ') + '.';
  }

  /**
   * Formats a multi-day plan into natural spoken Malayalam
   */
  static formatPlanToSpokenMalayalam(planTitle: string, steps: { label: string; detail: string }[]): string {
    const cleanTitle = this.cleanForSpeech(planTitle);
    const spokenSteps = steps.slice(0, 4).map((s, idx) => {
      if (idx === 0) {
        return `ആദ്യ ഘട്ടത്തിൽ ${s.detail}`;
      } else if (idx === 1) {
        return `രണ്ടാം ഘട്ടത്തിൽ ${s.detail}`;
      } else if (idx === 2) {
        return `മൂന്നാം ഘട്ടത്തിൽ ${s.detail}`;
      } else {
        return `തുടർന്ന് ${s.detail}`;
      }
    });

    return `${cleanTitle}. ${spokenSteps.join('. ')}. ഇതിന്റെ വിശദമായ വിവരങ്ങൾ ഞാൻ തയ്യാറാക്കിയിട്ടുണ്ട്.`;
  }

  /**
   * Formats a recommendation (e.g. laptop specs) for speech
   */
  static formatRecommendationToSpokenMalayalam(
    category: string,
    budget: string,
    keySpecs: string[],
    recommendedBrands: string[]
  ): string {
    const specsSummary = keySpecs.join(', ');
    const brandsSummary = recommendedBrands.slice(0, 3).join(', ');

    return `${budget} ബഡ്ജറ്റിൽ മികച്ചൊരു ${category} വാങ്ങാൻ താഴെ പറയുന്ന ഫീച്ചറുകൾ ശ്രദ്ധിക്കാം. ${specsSummary} എന്നിവയാണ് പ്രധാനമായും വേണ്ടത്. ${brandsSummary} തുടങ്ങിയ കമ്പനികളുടെ മോഡലുകൾ ഇതിനായി തിരഞ്ഞെടുക്കാം.`;
  }
}
