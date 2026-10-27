/**
 * Safe Programmatic Calculator Engine — Phase 9 Advanced Calculations
 *
 * Programmatically evaluates mathematical operations from spoken speech.
 * Handles +, -, *, /, %, GST ("12500 plus 18 percent GST"), discounts, percentages.
 * Never uses raw eval or unvalidated AI output.
 */

export interface CalculationResult {
  expression: string;
  value: number;
  spokenMalayalamResult: string;
}

export class CalculatorService {
  /**
   * Safely calculate spoken mathematical expression
   */
  static calculate(spokenInput: string): CalculationResult | null {
    const raw = spokenInput.trim().toLowerCase();

    // 1. Check GST / Tax: e.g. "12500 plus 18 percent GST" or "12500 + 18% GST"
    const gstMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:plus|\+|\കൂട്ടുക)\s*(\d+(?:\.\d+)?)\s*(?:%|percent|ശതമാനം)\s*(?:gst|tax|ജി\.എസ്\.ടി)/i) ||
      raw.match(/(\d+(?:\.\d+)?)\s*(?:രൂപയുടെ|ന്റെ)?\s*(\d+(?:\.\d+)?)\s*(?:%|percent|ശതമാനം)\s*(?:gst|tax|ജി\.എസ്\.ടി)/i);

    if (gstMatch) {
      const base = parseFloat(gstMatch[1]);
      const gstRate = parseFloat(gstMatch[2]);
      const gstAmount = (gstRate / 100) * base;
      const total = base + gstAmount;
      const roundedTotal = Number.isInteger(total) ? total : parseFloat(total.toFixed(2));
      const roundedGst = Number.isInteger(gstAmount) ? gstAmount : parseFloat(gstAmount.toFixed(2));

      return {
        expression: `${base} + ${gstRate}% GST (${roundedGst})`,
        value: roundedTotal,
        spokenMalayalamResult: `${base.toLocaleString()} രൂപയും ${gstRate}% GSTയും കൂട്ടുമ്പോൾ ആകെ ${roundedTotal.toLocaleString()} രൂപയാണ്.`,
      };
    }

    // 2. Check Discount: e.g. "5000 minus 20 percent discount" or "5000 20% discount"
    const discountMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:minus|\-|\കുറച്ച്|ഓഫ്)?\s*(\d+(?:\.\d+)?)\s*(?:%|percent|ശതമാനം)\s*(?:discount|ഓഫ്|discounts)/i);
    if (discountMatch) {
      const base = parseFloat(discountMatch[1]);
      const discountRate = parseFloat(discountMatch[2]);
      const discountAmount = (discountRate / 100) * base;
      const finalPrice = base - discountAmount;
      const roundedPrice = Number.isInteger(finalPrice) ? finalPrice : parseFloat(finalPrice.toFixed(2));

      return {
        expression: `${base} - ${discountRate}% Discount`,
        value: roundedPrice,
        spokenMalayalamResult: `${base.toLocaleString()} രൂപയിൽ നിന്ന് ${discountRate}% ഡിസ്കൗണ്ട് കുറച്ചാൽ ബാക്കി ${roundedPrice.toLocaleString()} രൂപയാണ്.`,
      };
    }

    // 3. Check percentage: e.g. "20% of 500" or "250ന്റെ 20 ശതമാനം"
    const percentMatch =
      raw.match(/(\d+(?:\.\d+)?)\s*(?:%|ശതമാനം|percent|percentage)\s*(?:of|ന്റെ)?\s*(\d+(?:\.\d+)?)/i) ||
      raw.match(/(\d+(?:\.\d+)?)\s*(?:ന്റെ)\s*(\d+(?:\.\d+)?)\s*(?:%|ശതമാനം|percent)/i);

    if (percentMatch) {
      let pct = parseFloat(percentMatch[1]);
      let total = parseFloat(percentMatch[2]);
      // If "250ന്റെ 20%" match order inverted
      if (raw.includes('ന്റെ') && raw.indexOf('ന്റെ') < raw.indexOf('%')) {
        const temp = pct;
        pct = total;
        total = temp;
      }
      const result = (pct / 100) * total;
      const roundedRes = Number.isInteger(result) ? result : parseFloat(result.toFixed(2));
      return {
        expression: `${pct}% of ${total}`,
        value: roundedRes,
        spokenMalayalamResult: `${total}ന്റെ ${pct} ശതമാനം ${roundedRes} ആണ്.`,
      };
    }

    // 4. Normalize spoken math keywords to arithmetic operators
    const normalized = raw
      .replace(/പ്ലസ്|കൂട്ടുക|കൂട്ടി|plus|\+/gi, '+')
      .replace(/മൈനസ്|കുറയ്ക്കുക|കുറച്ച്|minus|-/gi, '-')
      .replace(/ഗുണനം|ഗുണിക്കുക|multiply|multiplied by|times|into|×|\*/gi, '*')
      .replace(/ഹരിക്കുക|ഹരിച്ചു|divided by|divide|\//gi, '/');

    // Extract numbers and operator: e.g. "25 + 35 ethra", "1000 / 25 എത്ര", "125 * 8"
    const mathMatch = normalized.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/);

    if (!mathMatch) {
      return null;
    }

    const num1 = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const num2 = parseFloat(mathMatch[3]);

    let resVal = 0;
    switch (op) {
      case '+':
        resVal = num1 + num2;
        break;
      case '-':
        resVal = num1 - num2;
        break;
      case '*':
        resVal = num1 * num2;
        break;
      case '/':
        if (num2 === 0) {
          return {
            expression: `${num1} / ${num2}`,
            value: 0,
            spokenMalayalamResult: 'പൂജ്യം കൊണ്ട് ഹരിക്കാൻ സാധിക്കില്ല.',
          };
        }
        resVal = num1 / num2;
        break;
      default:
        return null;
    }

    const roundedRes = Number.isInteger(resVal) ? resVal : parseFloat(resVal.toFixed(2));

    return {
      expression: `${num1} ${op} ${num2}`,
      value: roundedRes,
      spokenMalayalamResult: `${num1} ${op === '+' ? 'കൂട്ടണം' : op === '-' ? 'കുറയ്ക്കണം' : op === '*' ? 'ഗുണിക്കണം' : 'ഹരിക്കണം'} ${num2} എന്നത് ${roundedRes} ആണ്.`,
    };
  }
}
