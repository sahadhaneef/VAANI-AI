const fs = require('fs');
let text = fs.readFileSync('src/services/aiService.ts', 'utf8');

const targetStr = "let sentimentDetected = 'NEUTRAL';";
const targetEnd = "sessionMemoryService.setReferencedEntity('ഡോക്ടർ എ.പി.ജെ. അബ്ദുൽ കലാം');";

const startIndex = text.indexOf(targetStr);
const endIndex = text.indexOf(targetEnd) + targetEnd.length;

const correctStr = `let sentimentDetected = 'NEUTRAL';

    // 11. SPECIFIC ENTITY / PERSON QUERY (MALAYALAM HARDCODED KNOWLEDGE)
    if (questionType === 'PERSON_QUERY') {
      if (lowerInput.includes('kalam') || lowerInput.includes('കലാം')) {
        responseText = 'മുൻ രാഷ്ട്രപതിയും പ്രശസ്ത ശാസ്ത്രജ്ഞനുമായിരുന്നു ഡോക്ടർ എ.പി.ജെ. അബ്ദുൽ കലാം. അദ്ദേഹം ഇന്ത്യയുടെ മിസൈൽ മാൻ എന്നറിയപ്പെടുന്നു.';
        sessionMemoryService.setReferencedEntity('ഡോക്ടർ എ.പി.ജെ. അബ്ദുൽ കലാം');`;

text = text.substring(0, startIndex) + correctStr + text.substring(endIndex);

fs.writeFileSync('src/services/aiService.ts', text);
console.log('Fixed!');
