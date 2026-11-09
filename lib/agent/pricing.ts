/** USD per 1M tokens, [input, output]. Update when the models in lib/openai.ts change. */
export const PRICES: Record<string, [number, number]> = {
	"gpt-6-luna": [0.1, 0.5],
	"gpt-5-nano": [0.05, 0.4],
	"gpt-4o-mini": [0.15, 0.6],
	"gpt-5.5": [5, 30],
	"gpt-5.4-mini": [0.75, 4.5],
};

/** Share of a request's tokens that are input. agent_requests stores only a total (tokens_in + tokens_out), and
 *  the prompt (profile + records) dwarfs the reply, so cost is estimated at a blended 85% input / 15% output. */
export const INPUT_SHARE = 0.85;

/** Estimated USD for `tokens` on `model`; 0 for an unpriced model (rather than a wrong number). */
export function estimateCost(model: string, tokens: number): number {
	const p = PRICES[model];
	return p ? (tokens * (INPUT_SHARE * p[0] + (1 - INPUT_SHARE) * p[1])) / 1_000_000 : 0;
}
