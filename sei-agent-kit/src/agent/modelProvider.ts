import { ModelProviderName } from "../types";

export function getTokenForProvider(
    provider: ModelProviderName,
): string | undefined {
    switch (provider) {
        case ModelProviderName.ANTHROPIC:
            return process.env.ANTHROPIC_API_KEY;
        case ModelProviderName.COHERE:
            return process.env.COHERE_API_KEY;
        case ModelProviderName.GOOGLE:
            return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        case ModelProviderName.MISTRAL:
            return process.env.MISTRAL_API_KEY;
        case ModelProviderName.OPENAI:
            return process.env.OPENAI_API_KEY;
        default:
            const errorMessage = `Failed to get token - unsupported model provider: ${provider}`;
            throw new Error(errorMessage);
    }
}
