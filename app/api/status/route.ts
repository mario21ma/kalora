import {anonymousAiEnabled,configuredAiModel} from '@/lib/ai-server';
export async function GET(){return Response.json({ai:!!process.env.OPENAI_API_KEY,anonymous:anonymousAiEnabled(),model:configuredAiModel()})}
