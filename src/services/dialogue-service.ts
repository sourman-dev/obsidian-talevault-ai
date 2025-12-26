import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type {
  DialogueMessage,
  DialogueMessageWithContent,
  DialogueSession,
  LLMOptions,
  MessageTokenUsage,
} from '../types';
import type { MessageIndexEntry } from '../types/memory';
import { DEFAULT_LLM_OPTIONS } from '../presets';
import { IndexService } from './index-service';
import { parseFrontmatter, stringifyFrontmatter } from '../utils/frontmatter';

/**
 * DialogueService manages dialogue for characters.
 *
 * Simplified structure:
 *   mianix-ai/characters/{slug}/
 *   ├── card.md
 *   ├── avatar.png
 *   ├── session.json      (LLM options)
 *   ├── index.json        (message index + memories for BM25)
 *   └── messages/
 *       ├── 001.md        (user or assistant message)
 *       ├── 002.md
 *       └── ...
 *
 * Messages are read directly from files to build history.
 * Index.json provides fast lookup and BM25 memory search.
 * No separate database - vault IS the database.
 */
export class DialogueService {
  private indexService: IndexService;

  constructor(private app: App) {
    this.indexService = new IndexService(app);
  }

  /**
   * Initialize session for a character (create session.json if missing)
   * Called when importing a character card
   */
  async initializeSession(
    characterFolderPath: string,
    characterId: string
  ): Promise<string> {
    const messagesPath = normalizePath(`${characterFolderPath}/messages`);
    await this.ensureFolderExists(messagesPath);

    // Create session.json with default LLM options if not exists
    const sessionFilePath = normalizePath(`${characterFolderPath}/session.json`);
    const existingSession = this.app.vault.getAbstractFileByPath(sessionFilePath);

    if (!existingSession) {
      const session: DialogueSession = {
        id: characterId,
        characterId,
        createdAt: new Date().toISOString(),
        llmOptions: { ...DEFAULT_LLM_OPTIONS },
      };
      await this.app.vault.create(
        sessionFilePath,
        JSON.stringify(session, null, 2)
      );
    }

    return characterFolderPath;
  }

  /**
   * Load session metadata from session.json
   */
  async loadSession(characterFolderPath: string): Promise<DialogueSession | null> {
    const sessionFilePath = normalizePath(`${characterFolderPath}/session.json`);
    const file = this.app.vault.getAbstractFileByPath(sessionFilePath);

    if (!(file instanceof TFile)) {
      return null;
    }

    try {
      const content = await this.app.vault.read(file);
      return JSON.parse(content) as DialogueSession;
    } catch {
      return null;
    }
  }

  /**
   * Update LLM options for a session
   */
  async updateLLMOptions(
    characterFolderPath: string,
    llmOptions: LLMOptions
  ): Promise<void> {
    const sessionFilePath = normalizePath(`${characterFolderPath}/session.json`);
    const file = this.app.vault.getAbstractFileByPath(sessionFilePath);

    if (!(file instanceof TFile)) {
      throw new Error('Session file not found');
    }

    const content = await this.app.vault.read(file);
    const session = JSON.parse(content) as DialogueSession;
    session.llmOptions = llmOptions;

    await this.app.vault.modify(file, JSON.stringify(session, null, 2));
  }

  /**
   * Load all messages from character's messages folder
   */
  async loadMessages(
    characterFolderPath: string
  ): Promise<DialogueMessageWithContent[]> {
    const messagesPath = normalizePath(`${characterFolderPath}/messages`);
    const folder = this.app.vault.getAbstractFileByPath(messagesPath);

    if (!(folder instanceof TFolder)) {
      return [];
    }

    const messages: DialogueMessageWithContent[] = [];

    // Get all markdown files and sort by name (001, 002, ...)
    const files = folder.children
      .filter((f): f is TFile => f instanceof TFile && f.extension === 'md')
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const file of files) {
      const msg = await this.readMessageFile(file);
      if (msg) {
        messages.push(msg);
      }
    }

    return messages;
  }

  /**
   * Load dialogue for character (session + messages)
   * Returns null if no session exists yet
   */
  async loadDialogue(characterFolderPath: string): Promise<{
    messages: DialogueMessageWithContent[];
    session: DialogueSession;
  } | null> {
    // Load session metadata
    let session = await this.loadSession(characterFolderPath);
    if (!session) {
      // No session.json, create default
      session = {
        id: '',
        characterId: '',
        createdAt: new Date().toISOString(),
        llmOptions: { ...DEFAULT_LLM_OPTIONS },
      };
    }

    const messages = await this.loadMessages(characterFolderPath);

    return { messages, session };
  }

  /**
   * Create initial first message from character
   */
  async createFirstMessage(
    characterFolderPath: string,
    firstMessageContent: string
  ): Promise<DialogueMessageWithContent> {
    return this.appendMessage(
      characterFolderPath,
      'assistant',
      firstMessageContent,
      null
    );
  }

  /**
   * Append a new message to dialogue
   * @param tokenUsage - Optional token tracking for assistant messages
   */
  async appendMessage(
    characterFolderPath: string,
    role: 'user' | 'assistant',
    content: string,
    parentId: string | null,
    tokenUsage?: MessageTokenUsage
  ): Promise<DialogueMessageWithContent> {
    const messagesPath = normalizePath(`${characterFolderPath}/messages`);

    // Ensure messages folder exists
    await this.ensureFolderExists(messagesPath);

    // Get next message number
    const nextNum = await this.getNextMessageNumber(messagesPath);
    const fileName = nextNum.toString().padStart(3, '0') + '.md';
    const filePath = normalizePath(`${messagesPath}/${fileName}`);

    // Create message metadata
    const message: DialogueMessage = {
      id: `msg-${nextNum.toString().padStart(3, '0')}`,
      role,
      parentId,
      timestamp: new Date().toISOString(),
      // Add token tracking for assistant messages
      ...(role === 'assistant' && tokenUsage && {
        providerId: tokenUsage.providerId,
        model: tokenUsage.model,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
      }),
    };

    // Generate file content
    const fileContent = stringifyFrontmatter(message, content);

    // Create file
    await this.app.vault.create(filePath, fileContent);

    // Update index
    const indexEntry: MessageIndexEntry = {
      id: message.id,
      role: message.role,
      timestamp: message.timestamp,
      preview: content.slice(0, 100),
    };
    await this.indexService.addMessageToIndex(characterFolderPath, indexEntry);

    return {
      ...message,
      content,
      filePath,
    };
  }

  /**
   * Update message content (for editing or streaming)
   */
  async updateMessageContent(filePath: string, content: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      throw new Error(`Message file not found: ${filePath}`);
    }

    // Read existing to preserve metadata
    const existingContent = await this.app.vault.read(file);
    const { data } = parseFrontmatter(existingContent);

    // Generate new content with same metadata
    const newContent = stringifyFrontmatter(data, content);
    await this.app.vault.modify(file, newContent);
  }

  /**
   * Update message suggestions (for storing extracted prompts)
   */
  async updateMessageSuggestions(
    filePath: string,
    suggestions: string[]
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      throw new Error(`Message file not found: ${filePath}`);
    }

    const existingContent = await this.app.vault.read(file);
    const { data, content } = parseFrontmatter(existingContent);

    // Add suggestions to frontmatter
    const updatedData = { ...data, suggestions };

    const newContent = stringifyFrontmatter(updatedData, content);
    await this.app.vault.modify(file, newContent);
  }

  /**
   * Delete a message file
   */
  async deleteMessage(
    filePath: string,
    characterFolderPath?: string
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      throw new Error(`Message file not found: ${filePath}`);
    }

    // Extract message ID from filename (e.g., "001.md" -> "msg-001")
    const msgNum = file.basename;
    const messageId = `msg-${msgNum}`;

    await this.app.vault.trash(file, true);

    // Update index if characterFolderPath provided
    if (characterFolderPath) {
      await this.indexService.removeMessageFromIndex(
        characterFolderPath,
        messageId
      );
    }
  }

  /**
   * Delete message and all messages after it (for regenerate)
   * Returns the messages that were kept
   */
  async deleteMessagesFrom(
    characterFolderPath: string,
    fromFilePath: string
  ): Promise<DialogueMessageWithContent[]> {
    const messages = await this.loadMessages(characterFolderPath);
    const fromIndex = messages.findIndex((m) => m.filePath === fromFilePath);

    if (fromIndex === -1) {
      return messages;
    }

    // Delete messages from this index onwards
    const toDelete = messages.slice(fromIndex);
    for (const msg of toDelete) {
      await this.deleteMessage(msg.filePath);
    }

    // Return remaining messages
    return messages.slice(0, fromIndex);
  }

  /**
   * Get recent messages for LLM context (default 10)
   * More efficient than loading all messages
   */
  async getRecentMessages(
    characterFolderPath: string,
    count: number = 10
  ): Promise<DialogueMessageWithContent[]> {
    const messages = await this.loadMessages(characterFolderPath);
    return messages.slice(-count);
  }

  /**
   * Search for relevant memories using BM25
   * Returns formatted string for LLM prompt
   */
  async searchMemories(
    characterFolderPath: string,
    query: string,
    limit: number = 5
  ): Promise<string> {
    const memories = await this.indexService.searchMemories(
      characterFolderPath,
      query,
      limit
    );

    if (memories.length === 0) {
      return '';
    }

    return memories
      .map((m) => `- ${m.content} (${m.type}, importance: ${m.importance})`)
      .join('\n');
  }

  /**
   * Get IndexService for direct access (e.g., adding memories)
   */
  getIndexService(): IndexService {
    return this.indexService;
  }

  // --- Private helpers ---

  private async readMessageFile(
    file: TFile
  ): Promise<DialogueMessageWithContent | null> {
    const rawContent = await this.app.vault.read(file);
    const { data, content: body } = parseFrontmatter<DialogueMessage>(rawContent);

    if (!data.id || !data.role) {
      return null;
    }

    // Normalize suggestions - handle both array and string (legacy) formats
    let suggestions: string[] | undefined;
    if (data.suggestions) {
      if (Array.isArray(data.suggestions)) {
        // Clean up suggestions - remove brackets if present
        suggestions = data.suggestions
          .map((s: string) => s.replace(/^\[|\]$/g, '').trim())
          .filter((s: string) => s.length > 0);
      } else if (typeof data.suggestions === 'string') {
        // Legacy format: "item1 | item2 | item3"
        suggestions = (data.suggestions as string)
          .split(/\s*\|\s*/)
          .map((s) => s.replace(/^\[|\]$/g, '').trim())
          .filter((s) => s.length > 0);
      }
    }

    return {
      id: data.id,
      role: data.role,
      parentId: data.parentId || null,
      timestamp: data.timestamp || new Date().toISOString(),
      suggestions,
      content: body.trim(),
      filePath: file.path,
    };
  }

  private async getNextMessageNumber(messagesPath: string): Promise<number> {
    const folder = this.app.vault.getAbstractFileByPath(messagesPath);
    if (!(folder instanceof TFolder)) {
      return 1;
    }

    const files = folder.children.filter(
      (f) => f instanceof TFile && f.extension === 'md'
    );

    return files.length + 1;
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const parts = path.split('/');
    let current = '';

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const exists = this.app.vault.getAbstractFileByPath(current);
      if (!exists) {
        try {
          await this.app.vault.createFolder(current);
        } catch {
          // Folder may have been created by another call, ignore
        }
      }
    }
  }
}
