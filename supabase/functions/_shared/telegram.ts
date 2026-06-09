export type TelegramConfig = {
  botToken: string;
};

export type SendTelegramInput = {
  chatId: string;
  text: string;
};

export function getTelegramConfigFromEnv(env: Record<string, string | undefined>): TelegramConfig {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim() || "";
  if (!botToken) {
    throw new Error("Falta TELEGRAM_BOT_TOKEN en los secretos de la funcion.");
  }
  return { botToken };
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  input: SendTelegramInput,
): Promise<{ message_id: number | null }> {
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(`Telegram respondio ${response.status}: ${JSON.stringify(result)}`);
  }

  return { message_id: result.result?.message_id ?? null };
}
