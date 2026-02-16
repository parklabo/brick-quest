import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

let _ai: GoogleGenAI | undefined;
export const getAI = () => (_ai ??= new GoogleGenAI({ apiKey: config.gemini.apiKey }));
