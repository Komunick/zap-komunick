import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  BelongsTo,
  ForeignKey
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import Queue from "./Queue";
import Ticket from "./Ticket";
import User from "./User";

export type ScheduleRoutingMode = "queue" | "ticket" | "ticket_queue";

@Table
class Schedule extends Model<Schedule> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.TEXT)
  body: string;

  @Column
  sendAt: Date;

  @Column
  sentAt: Date;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @ForeignKey(() => Queue)
  @Column(DataType.INTEGER)
  queueId: number | null;

  @Column(DataType.STRING)
  routingMode: ScheduleRoutingMode | null;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @Column
  saveMessage: boolean;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column(DataType.STRING)
  status: string;

  // none, daily, weekly, monthly or yearly
  @Column({ type: DataType.STRING, defaultValue: "none" })
  recurrence: string;

  @Column
  recurrenceEndAt: Date;

  @Column
  recurrenceAnchorAt: Date;

  // Zap Komunick: attachment and business days
  @Column
  mediaPath: string;

  @Column
  mediaName: string;

  @Column({ defaultValue: false })
  businessDaysOnly: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Contact, "contactId")
  contact: Contact;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @BelongsTo(() => Queue)
  queue: Queue;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => Company)
  company: Company;
}

export default Schedule;
