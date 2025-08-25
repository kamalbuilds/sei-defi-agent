import { SeiAgentKit } from "../../agent";
import { TwitterPostTweetSchema } from "../../tools";
import { StructuredTool } from "langchain/tools";
import { z } from "zod";

export class SeiPostTweetTool extends StructuredTool<typeof TwitterPostTweetSchema> {
    name = "post_tweet";
    description = "Posts a tweet to Twitter";
    schema = TwitterPostTweetSchema;
    
    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(args: z.infer<typeof TwitterPostTweetSchema>) {
        return this.seiKit.postTweet(args);
    }
}