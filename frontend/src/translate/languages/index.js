import { messages as portugueseMessages } from "./pt";
import { messages as portuguesePortugalMessages } from "./pt_PT";
import { messages as englishMessages } from "./en";
import { messages as spanishMessages } from "./es";
import { messages as frenchMessages } from "./fr";
import { messages as germanMessages } from "./de";
import { messages as italianMessages } from "./it";
import { messages as indonesianMessages } from "./id";
import { merge } from "lodash";
import { komunickMessages } from "./komunick";

const messages = merge(
  {
    ...portugueseMessages,
    ...portuguesePortugalMessages,
    ...englishMessages,
    ...spanishMessages,
    ...frenchMessages,
    ...germanMessages,
    ...italianMessages,
    ...indonesianMessages
  },
  komunickMessages
);

export { messages };
