import { SeiAgentKit } from "../../agent";
import { TwitterPostTweetReplySchema } from "../../tools";
import { StructuredTool } from "langchain/tools";
import { z } from "zod";


export class SeiPostTweetReplyTool extends StructuredTool<typeof TwitterPostTweetReplySchema> {
    name = "post_tweet_reply";
    description = `
This tool will post a tweet on Twitter. The tool takes the text of the tweet as input. Tweets can be maximum 280 characters.

A successful response will return a message with the API response as a JSON payload:
    {"data": {"text": "hello, world!", "id": "0123456789012345678", "edit_history_tweet_ids": ["0123456789012345678"]}}

A failure response will return a message with the Twitter API request error:
    You are not allowed to create a Tweet with duplicate content.`;
    schema = TwitterPostTweetReplySchema;

    constructor(private readonly seiKit: SeiAgentKit) {
        super();
    }

    async _call(args: z.infer<typeof TwitterPostTweetReplySchema>) {
        return this.seiKit.postTweetReply(args);
    }
}