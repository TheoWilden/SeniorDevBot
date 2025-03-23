# SeniorDevBot

> A GitHub App built with [Probot](https://github.com/probot/probot) that Makes fun of your code

## Description

SeniorDevBot is a GitHub App that behaves like a grumpy senior developer reviewing your code and issues. It analyzes your code changes and generates snarky but somewhat constructive comments that poke fun at your coding style and choices.

## Features

- Automatically comments on new pull requests with AI-generated snarky code reviews
- Provides grumpy feedback on commits pushed to your repository
- Responds to new issues with condescending but witty comments
- Analyzes code changes to provide personalized feedback
- Uses Hugging Face AI models to generate witty and sarcastic comments
- Makes you question your life choices as a developer (just kidding... sort of)

## How It Works

SeniorDevBot uses the Hugging Face API to generate realistic, contextual responses:

1. **For Pull Requests**: Analyzes the code changes and provides detailed snarky feedback
2. **For Commits**: Comments directly on commits with criticism of your coding style
3. **For Issues**: Responds to new issues with witty, slightly condescending comments

All comments maintain a humorous tone while still being somewhat constructive.

## Setup

```sh
# Install dependencies
npm install

# Copy .env.example to .env and update the values
cp .env.example .env

# Get your Hugging Face API key
# Visit https://huggingface.co/settings/tokens and create a new token
# Add the token to your .env file as HUGGINGFACE_API_KEY

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t SeniorDevBot .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> -e HUGGINGFACE_API_KEY=<api-key> SeniorDevBot
```

## GitHub App Permissions

SeniorDevBot requires the following permissions:

- **Contents**: Read access (to access code in commits)
- **Issues**: Write access (to comment on issues)
- **Pull Requests**: Write access (to comment on PRs)
- **Metadata**: Read access

And subscribes to these events:

- Pull request events
- Push events
- Issues events
- Commit comment events

## Hugging Face Integration

SeniorDevBot uses Hugging Face's text generation models to create realistic "senior developer" responses. To enable this functionality:

1. Create an account at [Hugging Face](https://huggingface.co/)
2. Generate an API token at https://huggingface.co/settings/tokens
3. Add your token to the .env file as HUGGINGFACE_API_KEY

By default, if no API key is provided, the app will fall back to a set of predefined responses.

## Contributing

If you have suggestions for how SeniorDevBot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2025 TheoWilden
