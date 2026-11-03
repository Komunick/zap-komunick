import { literal } from "sequelize";
import { startOfDay } from "date-fns";
import User from "../../models/User";
import Queue from "../../models/Queue";
import { buildOnlinePanel, OnlinePanel } from "../../helpers/OnlineUsers";

// Zap Komunick: panel of the team online (docs/PRD.md, RF-013). Presence comes
// from the browser sessions the socket already records (UserSocketSessions).
const OnlineUsersService = async (
  companyId: number,
  now: Date = new Date()
): Promise<OnlinePanel> => {
  const today = startOfDay(now).toISOString();

  const users = await User.findAll({
    where: { companyId },
    attributes: [
      "id",
      "name",
      "profile",
      "super",
      "accessHours",
      [
        literal(`EXISTS (
          SELECT 1 FROM "UserSocketSessions" s
          WHERE s."userId" = "User"."id" AND s."active" = true
        )`),
        "online"
      ],
      [
        literal(`(
          SELECT MIN(s."createdAt") FROM "UserSocketSessions" s
          WHERE s."userId" = "User"."id" AND s."active" = true
        )`),
        "onlineSince"
      ],
      [
        literal(`(
          SELECT MAX(s."updatedAt") FROM "UserSocketSessions" s
          WHERE s."userId" = "User"."id"
        )`),
        "lastSeen"
      ],
      [
        literal(`(
          SELECT COUNT(*) FROM "Tickets" t
          WHERE t."userId" = "User"."id" AND t."status" = 'open'
        )`),
        "openCount"
      ],
      [
        literal(`(
          SELECT COUNT(*) FROM "Tickets" t
          WHERE t."userId" = "User"."id" AND t."status" = 'paused'
        )`),
        "pausedCount"
      ],
      [
        literal(`(
          SELECT COUNT(*) FROM "TicketTraking" tt
          WHERE tt."userId" = "User"."id"
            AND tt."finishedAt" >= '${today}'
        )`),
        "closedToday"
      ]
    ],
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color"],
        through: { attributes: [] }
      }
    ]
  });

  return buildOnlinePanel(
    users.map(user => {
      const row = user.get({ plain: true }) as unknown as Record<
        string,
        unknown
      >;
      return {
        id: row.id as number,
        name: row.name as string,
        profile: row.profile as string,
        super: !!row.super,
        accessHours: (row.accessHours as never) || null,
        online: row.online === true,
        onlineSince: row.onlineSince as string,
        lastSeen: row.lastSeen as string,
        openCount: Number(row.openCount) || 0,
        pausedCount: Number(row.pausedCount) || 0,
        closedToday: Number(row.closedToday) || 0,
        queues: (row.queues as never) || []
      };
    }),
    now
  );
};

export default OnlineUsersService;
