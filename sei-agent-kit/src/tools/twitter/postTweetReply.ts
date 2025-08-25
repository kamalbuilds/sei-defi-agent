import { TwitterApi, TwitterApiTokens } from "twitter-api-v2";
import { TwitterConfig } from "./types";
import { TwitterPostTweetReplySchema } from "./schemas";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export async function postTweetReply(args: z.infer<typeof TwitterPostTweetReplySchema>) {
    const config = {
        apiKey: process.env.TWITTER_API_KEY,
        apiSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    } as TwitterConfig;

    if (!config.apiKey) {
        throw new Error("TWITTER_API_KEY is not configured.");
    }
    if (!config.apiSecret) {
        throw new Error("TWITTER_API_SECRET is not configured.");
    }
    if (!config.accessToken) {
        throw new Error("TWITTER_ACCESS_TOKEN is not configured.");
    }
    if (!config.accessTokenSecret) {
        throw new Error("TWITTER_ACCESS_TOKEN_SECRET is not configured.");
    }

    try {
        const Client = new TwitterApi({
            appKey: config.apiKey,
            appSecret: config.apiSecret,
            accessToken: config.accessToken,
            accessSecret: config.accessTokenSecret,
        } as TwitterApiTokens);

        const response = await Client.v2.tweet(args.tweetReply, {
            reply: { in_reply_to_tweet_id: args.tweetId },
          });
    
          return `Successfully posted reply to Twitter:\n${JSON.stringify(response)}`;
    } catch (error) {
        return `Error posting reply to Twitter: ${error}`;
    }
}