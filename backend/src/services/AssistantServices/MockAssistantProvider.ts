import {
  AssistantKind,
  AssistantMessage,
  createMockAssistantOutput
} from "../../helpers/AssistantRules";

// P1 has exactly one local provider. No SDK, secret resolver, URL or network client.
export const generateMockAssistant = async (
  kind: AssistantKind,
  messages: AssistantMessage[]
): Promise<unknown> => createMockAssistantOutput(kind, messages);
