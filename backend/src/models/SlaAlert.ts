import {
  AutoIncrement,
  Column,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import Company from "./Company";
import Ticket from "./Ticket";
import User from "./User";

@Table({ tableName: "SlaAlerts", updatedAt: false })
class SlaAlert extends Model<SlaAlert> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @ForeignKey(() => User)
  @Column
  recipientId: number;

  @Column
  unansweredSince: Date;

  @Column
  readAt: Date;
}

export default SlaAlert;
