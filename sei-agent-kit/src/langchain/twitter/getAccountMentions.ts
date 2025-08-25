import { SeiAgentKit } from "../../agent";
import { TwitterAccountMentionsSchema } from "../../tools";
import { StructuredTool } from "langchain/tools";
import { z } from "zod";


export class SeiGetAccountMentionsTool extends StructuredTool<typeof TwitterAccountMentionsSchema> {
    name = "get_account_mentions";
    description = `
This tool will return mentions for the specified Twitter (X) user id.

A successful response will return a message with the API response as a JSON payload:
    {"data": [{"id": "1857479287504584856", "text": "@CDPAgentKit reply"}]}

A failure response will return a message with the Twitter API request error:
    Error retrieving user mentions: 429 Too Many Requests`;
    schema = TwitterAccountMentionsSchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(args: z.infer<typeof TwitterAccountMentionsSchema>) {
        return this.seiKit.getAccountMentions(args);
    }
}