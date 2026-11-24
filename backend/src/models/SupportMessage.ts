import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  DataType,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import SupportTicket from "./SupportTicket";

export interface SupportAttachment {
  storedName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

// Zap Komunick: one entry of the conversation of a support ticket (RF-030).
// kind "event" records a change of status ("taken", "waiting", "resumed",
// "done", "reopened", "cancelled") so the conversation tells the whole story.
@Table
class SupportMessage extends Model<SupportMessage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => SupportTicket)
  @AllowNull(false)
  @Column
  ticketId: number;

  @BelongsTo(() => SupportTicket)
  ticket: SupportTicket;

  @Column
  userId: number;

  @Column
  userName: string;

  @Default(false)
  @Column
  fromSupport: boolean;

  @Default("message")
  @Column
  kind: string;

  @Column
  event: string;

  @Column(DataType.TEXT)
  body: string;

  @Default([])
  @Column(DataType.JSONB)
  attachments: SupportAttachment[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SupportMessage;
