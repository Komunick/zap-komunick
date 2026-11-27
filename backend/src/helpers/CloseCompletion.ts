// Zap Komunick: the completion message of a ticket ("Mensagem de conclusão" of
// the connection, sent to the client when a ticket is finished) and who
// decides whether it goes (docs/PRD.md, RF-034).
//
// The office chooses, in Configurações › Opções › "Mensagem de finalização":
//   - "disabled" (default, how it always was): every finish sends it;
//   - "enabled": whoever finishes is ASKED, with the text in front of them,
//     and it only goes when that person says so.
//
// IN THE "ASK" MODE THE MESSAGE NEEDS AN EXPLICIT YES IN THE REQUEST. A screen
// opened before the option was turned on, a finish from the list, a bulk
// action, an automation: none of them knows about the question, so none of
// them sends a message to a client that nobody decided to send.

export const COMPLETION_PROMPT_SETTING = "completionMessagePrompt";

export interface CloseFacts {
  channel?: string | null;
  isGroup?: boolean | null;
  // the client asked not to receive automatic messages
  contactDisableBot?: boolean | null;
  whatsappStatus?: string | null;
  completionMessage?: string | null;
}

// Automatic messages at the end of a ticket only go to a person, through a
// connection that is up, and never to a client who turned the robot off.
export const mayNotifyOnClose = (facts: CloseFacts): boolean =>
  facts.whatsappStatus === "CONNECTED" &&
  !facts.isGroup &&
  !facts.contactDisableBot;

// The text that would be sent, or null when there is none to send.
export const completionTextOnClose = (facts: CloseFacts): string | null => {
  const text = (facts.completionMessage || "").trim();
  if (!text || facts.channel !== "whatsapp" || !mayNotifyOnClose(facts)) {
    return null;
  }
  return text;
};

export const completionPromptEnabled = (setting: unknown): boolean =>
  setting === "enabled";

// Whether THIS finish sends the completion message, given what the office
// chose and what the request said. Asking, only a literal `true` counts as the
// yes. Not asking, every finish sends it, as it always did, unless the request
// carries a literal `false`: the answer of someone who was asked a moment ago,
// before the office turned the question off, is still that person's no.
export const completionAllowed = (
  promptSetting: unknown,
  sendCompletion: unknown
): boolean =>
  completionPromptEnabled(promptSetting)
    ? sendCompletion === true
    : sendCompletion !== false;

// Someone said yes (the question was put to them) and is waiting for the
// message to go: if it cannot go, they must be told instead of the ticket
// finishing in silence.
export const completionRequested = (
  promptSetting: unknown,
  sendCompletion: unknown
): boolean => completionPromptEnabled(promptSetting) && sendCompletion === true;
