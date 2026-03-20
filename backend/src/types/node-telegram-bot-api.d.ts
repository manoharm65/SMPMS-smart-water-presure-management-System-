declare module 'node-telegram-bot-api' {
  export default class TelegramBot {
    constructor(token: string, options?: { polling?: boolean });
    sendMessage(chatId: string | number, text: string, options?: { parse_mode?: string }): Promise<any>;
    on(event: string, callback: (msg: any) => void): this;
    startPolling(): void;
    stopPolling(): void;
  }
}
