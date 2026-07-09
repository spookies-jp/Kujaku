export interface Env {
  UNFURL_CACHE: KVNamespace;
  ESA_TEAM_NAME: string;
  ESA_MAX_ARTICLE_LINES: string;
  ESA_MAX_COMMENT_LINES: string;
  SLACK_OAUTH_ACCESS_TOKEN: string;
  ESA_ACCESS_TOKEN: string;
  SENTRY_DSN: string;
}

export interface SlackLink {
  url: string;
}

export interface SlackEventCallbackPayload {
  type: "event_callback";
  event: {
    channel: string;
    message_ts: string;
    links: SlackLink[];
  };
}

export interface SlackUrlVerificationPayload {
  type: "url_verification";
  challenge: string;
}

export type SlackWebhookPayload =
  | SlackUrlVerificationPayload
  | SlackEventCallbackPayload;

export interface UnfurlAttachment {
  title: string;
  title_link: string;
  author_name: string;
  author_icon: string;
  text: string;
  color: string;
  footer: string;
  ts: number;
}
