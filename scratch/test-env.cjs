import dotenv from 'dotenv';
dotenv.config();
console.log('GEMINI_API_KEY configured:', Boolean(process.env.GEMINI_API_KEY));
console.log('GEMINI_REASONING_MODEL:', process.env.GEMINI_REASONING_MODEL);
console.log('GEMINI_SEARCH_MODEL:', process.env.GEMINI_SEARCH_MODEL);
