// Cloudflare Worker entry point. The API key comes from the Worker secret
// ANTHROPIC_API_KEY (set with `npx wrangler secret put ANTHROPIC_API_KEY`).
import Anthropic from '@anthropic-ai/sdk';
import { createHandler } from './reader.js';

const handle = createHandler((env) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }));

export default {
  fetch: (request, env) => handle(request, env),
};
