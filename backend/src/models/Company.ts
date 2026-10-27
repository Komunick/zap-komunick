import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType,
  HasMany,
  Default,
  BeforeCreate
} from "sequelize-typescript";
import { v4 as uuidv4 } from "uuid";
import Contact from "./Contact";
import Message from "./Message";

import Plan from "./Plan";
import Queue from "./Queue";
import Setting from "./Setting";
import Ticket from "./Ticket";
import TicketTraking from "./TicketTraking";
import User from "./User";
import UserRating from "./UserRating";
import Whatsapp from "./Whatsapp";
import { OpenHoursData } from "../helpers/checkOpenHours";
import { publicCompanyData } from "../helpers/CredentialRules";

@Table
class Company extends Model<Company> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Default(uuidv4())
  @Column(DataType.UUID)
  uuid: string;

  @BeforeCreate
  static setUUID(company: Company) {
    company.uuid = uuidv4();
  }

  @Column
  name: string;

  @Column
  phone: string;

  @Column
  email: string;

  @Column
  status: boolean;

  @Column
  dueDate: string;

  @Column
  recurrence: string;

  @Column({
    type: DataType.JSONB
  })
  schedules: OpenHoursData;

  @ForeignKey(() => Plan)
  @Column
  planId: number;

  @BelongsTo(() => Plan)
  plan: Plan;

  @Column
  language: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => User, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  users: User[];

  @HasMany(() => UserRating, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  userRatings: UserRating[];

  @HasMany(() => Queue, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  queues: Queue[];

  @HasMany(() => Whatsapp, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  whatsapps: Whatsapp[];

  @HasMany(() => Message, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  messages: Message[];

  @HasMany(() => Contact, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  contacts: Contact[];

  @HasMany(() => Setting, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  settings: Setting[];

  @HasMany(() => Ticket, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  tickets: Ticket[];

  @HasMany(() => TicketTraking, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  ticketTrankins: TicketTraking[];

  toJSON(): object {
    return publicCompanyData(super.toJSON());
  }
}

export default Company;
