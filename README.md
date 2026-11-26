# Multi-Agent Content System

A team of AI agents, built in **n8n**, that researches, checks, writes and designs Instagram content, sends a preview to Telegram and can publish to Instagram.

Built with Google Gemini, Composio, Telegram and imgbb. Includes a single-file web dashboard.

## Formats

| Format | Output |
|---|---|
| `script` | Reel script, caption and hashtags on Telegram. No images, no posting. |
| `carousel` | Cover and slide images, caption and reel script. Can publish to Instagram. |
| `image` | Single image, caption and reel script. Can publish to Instagram. |

The system writes reel scripts. It does not create videos.

## How it works

```
Dashboard / n8n Form / Webhook
        │
        ▼
Config → Research → Validator → Strategist ──► (script) Telegram, end
                                     │
                                     ▼
                      Creative → Publisher/QA
                                     │
                                     ▼
              Image Studio → Telegram preview → Instagram
```

| Agent | Job |
|---|---|
| **1. Research** | Suggests 8 content ideas, from Google trending searches or from your topic. |
| **2. Validator** | Checks the ideas against your rules and keeps up to 5. |
| **3. Strategist** | Picks the best idea and writes the hook, reel script, caption, hashtags and call to action. |
| **4. Creative** | Plans the cover and slides: headlines, image prompts, visual style and shot list. |
| **5. Publisher/QA** | Reviews and fixes the content, scores it and suggests a posting time. Only approved content continues. |

**Image Studio** is an automation stage: Gemini generates the images, they are converted to JPEG, and imgbb hosts them so Instagram can fetch them.

**Publishing:** Composio creates the media container, the workflow waits until it is ready, then publishes it.

## Repository structure

```
├── dashboard.html                               # Web UI that calls the webhook
├── workflows/
│   └── instagram-multi-agent-content-system.json  # n8n workflow
└── README.md
```

## Prerequisites

- n8n, cloud or self-hosted. The workflow was developed on self-hosted n8n 2.16.1. Self-hosted servers need **GraphicsMagick** for the image resize node.
- Google Gemini API key from [Google AI Studio](https://aistudio.google.com), with **billing enabled** for image generation
- [Composio](https://composio.dev) account
- Instagram **Business or Creator** account
- Telegram bot
- [imgbb API key](https://api.imgbb.com)

## Setup

### 1. Import the workflow

In n8n, open the workflow menu, choose **Import from File** and select the JSON file in `workflows/`.

### 2. Gemini

1. Create an API key in Google AI Studio.
2. Enable billing on that key's project. Image generation failed on the free tier with `429 quota, limit: 0`.
3. In n8n, create a **Google Gemini(PaLM) API** credential.

### 3. Composio

1. Sign up and switch to **Platform** in the dashboard.
2. Copy the **project API key**. An MCP consumer key (`ck_...`) does not work with this workflow.
3. Add **Instagram**, log in and grant access.
4. Copy the **Connected Account ID** (`ca_...`) and make sure its status is **ACTIVE**.
5. Copy that connection's **User ID**. This is the entity ID, not your Instagram username.
6. In n8n, create a **Header Auth** credential with name `x-api-key` and your project API key as the value.

Available Instagram tools can differ between Composio accounts and versions. The workflow uses:
`INSTAGRAM_GET_USER_INFO`, `INSTAGRAM_CREATE_MEDIA_CONTAINER`, `INSTAGRAM_CREATE_CAROUSEL_CONTAINER`, `INSTAGRAM_GET_POST_STATUS` and `INSTAGRAM_CREATE_POST`. Composio listed some of these as deprecated during development.

### 4. Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Open your bot and press **Start**.
3. Get your chat ID from [@userinfobot](https://t.me/userinfobot).
4. In n8n, create a **Telegram API** credential.

### 5. imgbb

Get a free key at [api.imgbb.com](https://api.imgbb.com). Anyone with an image link can view that image, so don't upload confidential content.

### 6. Add your credentials and values

| Where | What to add |
|---|---|
| All Gemini chat model nodes and **Generate Image (Gemini)**. The Research model node is named *Google Gemini Chat Model*. | Gemini credential |
| All four **Telegram** nodes | Telegram credential and your chat ID |
| **Get IG Account**, **Create Carousel Child**, **Create Carousel**, **Create Reel**, **Create Image Post**, **Check Container Status**, **Publish Instagram Post** | Header Auth credential |
| **Config** → `imgbb_api_key` | imgbb key |
| **Instagram Settings** → `composio_instagram_account_id` | Your `ca_...` ID |
| **Instagram Settings** → `composio_entity_id` | Your Composio User ID |
| **Instagram Settings** → `auto_post` | `false` while testing, `true` to publish |

> **Warning:** when `auto_post` is `true`, carousel and image runs publish to your real account. The QA approval is automatic, and the workflow does not wait for a reply on Telegram.

### Models

The model names are set in the workflow. Change them if your key doesn't have access.

| Used by | Model |
|---|---|
| Research | `gemini-3.5-flash-lite` |
| Validator, Strategist, Creative, Publisher/QA | `gemini-3.6-flash` |
| Image generation | `gemini-2.5-flash-image` (default, can be changed per run) |

## Running it

Activate (publish) the workflow, then use any of these.

### Dashboard

1. Open `dashboard.html` in a browser.
2. Under **Connection settings**, enter your n8n address.
3. Choose a format, fill in the fields and send.

The dashboard confirms that the workflow started. Results arrive on Telegram, and errors appear in n8n under **Executions**. If the browser blocks the request, set **Allowed Origins (CORS)** in the Webhook node options.

### n8n Form

Open the URL shown in the **Content Form** node.

### Webhook

```bash
curl -X POST "https://YOUR_N8N_URL/webhook/ig-content-factory" \
  -H "Content-Type: application/json" \
  -d '{"format": "script", "topic": "ChatGPT Ads for business", "language": "Hinglish"}'
```

For testing, use `/webhook-test/` and click **Execute workflow** in n8n first.

| Field | Description |
|---|---|
| `format` | `script`, `carousel` or `image`. Default: `carousel`. |
| `topic` | Optional. When set, it overrides the niche. |
| `niche` | Used to find ideas when there is no topic. |
| `audience` | Target audience. |
| `language` | Content language. |
| `brand_voice` | Tone of voice. |
| `geo` | Country code for trending searches. Default: `IN`. |
| `instructions` | Replaces the Validator's default rules. |
| `image_model` | Gemini image model. |

The workflow also contains a `reel` posting branch. It needs your own public MP4 link in **Instagram Settings** → `video_url`, and it isn't offered in the form or dashboard.

## Troubleshooting

| Problem | What to check |
|---|---|
| `401 Invalid API key` | Use the Composio project API key. |
| `User ID is required with connected account` | Set `composio_entity_id`. |
| `429 quota, limit: 0` | Enable billing for the Gemini key's project. |
| `Tool ... not found` | Check which Instagram tools your Composio account provides. |
| `message text is empty` (Telegram) | An earlier step produced no content. |
| `Strategist returned no script` | See Known issues. |
| `imgbb returned no URLs` | Check `imgbb_api_key`. |

## Known issues

- The Strategist step has returned an empty result in some runs. The **Check Script** node then stops the run with details. The cause has not been identified.
- The status check loop before publishing has no maximum number of retries. Stop the execution in n8n if it keeps looping.

## Security

- Never commit API keys, `.env` files, account IDs or chat IDs. n8n workflow exports can contain values typed directly into nodes.
- The webhook and form have no authentication by default. Add it before sharing their URLs, and send the same authentication from any client. The included dashboard does not send authentication headers.
- AI-generated content can be wrong. Check facts before publishing.
