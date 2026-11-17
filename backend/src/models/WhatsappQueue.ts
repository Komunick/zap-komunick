import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  ForeignKey,
  BelongsTo,
  AllowNull,
  DataType
} from "sequelize-typescript";
import Queue from "./Queue";
import Whatsapp from "./Whatsapp";

@Table
class WhatsappQueue extends Model<WhatsappQueue> {
  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  // Order of the queue in the bot menu of the channel (1 = first option).
  // Null for links saved before an order existed: they go last.
  @AllowNull
  @Column(DataType.INTEGER)
  position: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Queue)
  queue: Queue;
}

export default WhatsappQueue;
