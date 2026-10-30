import { Op, Transaction, col, fn, literal } from "sequelize";
import Message from "../../models/Message";
import Contact from "../../models/Contact";
import {
  ASSISTANT_LIMITS,
  AssistantScope,
  AssistantSource,
  buildAssistantContext
} from "../../helpers/AssistantRules";

// P1/P4 share the same bounded, read-only eligibility query. The transaction is
// used only for the final local snapshot, never while a provider is awaited.
const LoadAssistantContextService = async (
  scope: AssistantScope,
  transaction?: Transaction
) => {
  const rows = await Message.findAll({
    where: {
      [Op.and]: [
        {
          companyId: scope.companyId,
          ticketId: scope.ticketId,
          isDeleted: false
        },
        literal('"Message"."body" ~ \'[^[:space:]]\''),
        {
          [Op.or]: [
            { mediaType: null },
            { mediaType: { [Op.in]: ["conversation", "extendedTextMessage"] } }
          ]
        },
        { [Op.or]: [{ mediaUrl: null }, { mediaUrl: "" }] },
        { [Op.or]: [{ thumbnailUrl: null }, { thumbnailUrl: "" }] },
        {
          [Op.or]: [
            { fromMe: true, contactId: null },
            scope.isGroup
              ? { "$contact.companyId$": scope.companyId }
              : { contactId: scope.contactId }
          ]
        }
      ]
    },
    attributes: [
      "id",
      "companyId",
      "ticketId",
      "contactId",
      "fromMe",
      "isDeleted",
      "mediaType",
      "mediaUrl",
      "thumbnailUrl",
      "createdAt",
      "updatedAt",
      [
        fn("left", col("Message.body"), ASSISTANT_LIMITS.maxCharacters + 1),
        "body"
      ],
      [
        literal(
          `char_length("Message"."body") > ${ASSISTANT_LIMITS.maxCharacters + 1}`
        ),
        "bodyTruncated"
      ]
    ],
    ...(scope.isGroup
      ? {
          include: [
            {
              model: Contact,
              as: "contact",
              attributes: ["id", "companyId"],
              where: { companyId: scope.companyId },
              required: false
            }
          ]
        }
      : {}),
    ...(transaction ? { transaction } : {}),
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    limit: ASSISTANT_LIMITS.maxMessages + 1,
    raw: true,
    logging: false
  });
  return buildAssistantContext(
    rows.map(row => ({
      ...(row as unknown as AssistantSource),
      senderCompanyId: (row as unknown as Record<string, number>)[
        "contact.companyId"
      ]
    })),
    scope
  );
};

export default LoadAssistantContextService;
