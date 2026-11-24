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
  HasMany
} from "sequelize-typescript";
import SupportMessage from "./SupportMessage";

// Zap Komunick: support ticket opened by a user of any company and answered
// by the installation's super administrators (docs/PRD.md, RF-030). The names
// are copied here so the ticket stays readable if the user or the company is
// removed later.
@Table
class SupportTicket extends Model<SupportTicket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  companyId: number;

  @Column
  userId: number;

  @Column
  companyName: string;

  @Column
  userName: string;

  @Column
  userEmail: string;

  @Column
  userProfile: string;

  @AllowNull(false)
  @Column
  title: string;

  @Default("other")
  @Column
  category: string;

  @Default("medium")
  @Column
  priority: string;

  @Default("open")
  @Column
  status: string;

  @Column
  location: string;

  @Column(DataType.TEXT)
  userAgent: string;

  @Column
  screen: string;

  @Column
  appUrl: string;

  @Column
  assignedUserId: number;

  @Column
  assignedUserName: string;

  @Column
  lastMessageAt: Date;

  @Column
  lastRequesterMessageAt: Date;

  @Column
  lastSupportMessageAt: Date;

  @Column
  requesterReadAt: Date;

  @Column
  supportReadAt: Date;

  @Column
  finishedAt: Date;

  @HasMany(() => SupportMessage)
  messages: SupportMessage[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SupportTicket;
