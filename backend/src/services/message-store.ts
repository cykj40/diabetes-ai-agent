import { db, chatMessage } from '../db';
import { eq, asc } from 'drizzle-orm';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { BaseListChatMessageHistory } from '@langchain/core/chat_history';

export class PersistentMessageHistory extends BaseListChatMessageHistory {
  private sessionId: string;
  public lc_serializable = true;
  public lc_kwargs: { sessionId: string };

  constructor(sessionId: string = 'default') {
    super();
    this.sessionId = sessionId;
    this.lc_kwargs = {
      sessionId: this.sessionId,
    };
  }

  async getMessages(): Promise<BaseMessage[]> {
    const messages = await db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.sessionId, this.sessionId))
      .orderBy(asc(chatMessage.timestamp));

    return messages.map((msg) => {
      if (msg.type === 'human') {
        return new HumanMessage(msg.content);
      } else if (msg.type === 'ai') {
        return new AIMessage(msg.content);
      } else {
        return new SystemMessage(msg.content);
      }
    });
  }

  async addMessage(message: BaseMessage): Promise<void> {
    let type = 'system';
    if (message instanceof HumanMessage) type = 'human';
    if (message instanceof AIMessage) type = 'ai';

    await db.insert(chatMessage).values({
      sessionId: this.sessionId,
      type,
      content: message.content as string,
      timestamp: new Date(),
    });
  }

  async clear(): Promise<void> {
    await db.delete(chatMessage).where(eq(chatMessage.sessionId, this.sessionId));
  }

  async addMessages(messages: BaseMessage[]): Promise<void> {
    for (const message of messages) {
      await this.addMessage(message);
    }
  }

  async addUserMessage(message: string): Promise<void> {
    await this.addMessage(new HumanMessage(message));
  }

  async addAIMessage(message: string): Promise<void> {
    await this.addMessage(new AIMessage(message));
  }

  get lc_namespace(): string[] {
    return ['langchain', 'chat_history', 'persistent'];
  }

  get lc_secrets(): { [key: string]: string } {
    return {
      sessionId: 'The session ID for the chat history',
    };
  }

  get lc_aliases(): { [key: string]: string } {
    return {};
  }
}
