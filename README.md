# TaleVault AI - Obsidian Plugin

An AI-powered roleplay companion plugin for Obsidian. Chat with AI characters, import character cards, and have immersive conversations - all stored as markdown files in your vault.

**Version:** 0.2.0 | **Author:** Sourman | **License:** MIT

## Features

- **Multi-Provider LLM Support**: Add/edit/delete providers (OpenAI, Google, OpenRouter, Groq, custom OpenAI-compatible)
- **Character Cards**: Import PNG character cards (SillyTavern/Chub.ai format) or create your own
- **Auto Model Fetching**: Automatically fetch available models from provider APIs
- **AI Chat**: Chat with characters using OpenAI-compatible APIs
- **Markdown Storage**: All messages stored as markdown files - edit, search, and link them like any other note
- **Memory System**: BM25-based memory retrieval for context-aware conversations
- **Token Tracking**: Per-message input/output token counts
- **Mobile-First UI**: Responsive design with dropdown character selector
- **Streaming Responses**: Real-time LLM output display

## Installation

### Via BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from Obsidian Community Plugins
2. Open BRAT settings → Click "Add Beta plugin"
3. Enter: `sourman-dev/obsidian-talevault-ai`
4. Click "Add Plugin"
5. Enable "TaleVault AI" in Community Plugins

### Manual Installation

1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/sourman-dev/obsidian-talevault-ai/releases)
2. Create: `<vault>/.obsidian/plugins/mianix-roleplay/`
3. Copy files into the folder
4. Reload Obsidian and enable the plugin

## Configuration

### Provider Setup

1. Go to **Settings > TaleVault AI**
2. Click "Add Provider" to configure LLM service:
   - **Name**: Friendly provider name
   - **Type**: Provider type (OpenAI, Google, OpenRouter, Groq, Custom)
   - **API Key**: Authentication credential
   - **Base URL**: Custom endpoint (if applicable)

3. Click "Fetch Models" to auto-populate available models

### Character Settings

Per-character LLM options (temperature, top-p, max tokens) are configured in the chat interface.

### Optional: Memory Extraction

Enable automatic memory extraction in settings to help the AI remember important facts:
- Toggle "Enable Memory Extraction"
- Configure a fast/cheap model for extraction tasks

## Usage

1. Click the message icon in the ribbon or use command palette: "Open Chat"
2. Select a provider and model from the dropdown
3. Choose a character from the character list (or import a new card)
4. Start chatting!

### Importing Character Cards

Supported formats:
- **PNG Cards** (SillyTavern/Chub.ai): Card metadata embedded in PNG EXIF
- **Manual Creation**: Create character via the UI

### File Structure

```
tale-vault/
├── character-cards/
│   └── {character-slug}/
│       ├── card.md              # Character metadata
│       ├── avatar.png           # Character portrait
│       ├── session.json         # LLM options
│       ├── index.json           # Message index + memories
│       └── messages/
│           ├── 001.md           # Message 1
│           ├── 002.md           # Message 2
│           └── ...
└── presets/
    ├── multi-mode.md            # System prompt
    └── output-format.md         # Output formatting
```

## Development

```bash
# Install dependencies
pnpm install

# Development build (watch mode)
pnpm dev

# Production build
pnpm build

# Type checking
pnpm typecheck
```

### Tech Stack

- **TypeScript** 5.3 + **React** 18.2
- **Zustand** 4.4 for state management
- **Obsidian API** 1.11+
- **YAML** 2.8.2 for configuration parsing

### Documentation

- [Project Overview & PDR](./docs/project-overview-pdr.md)
- [Code Standards](./docs/code-standards.md)
- [System Architecture](./docs/system-architecture.md)
- [Codebase Summary](./docs/codebase-summary.md)

## License

MIT

## Credits

- Built with [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- React for modern UI framework
- BM25 for memory retrieval
- PNG/YAML parsing for card import
