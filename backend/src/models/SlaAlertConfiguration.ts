import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";
import Company from "./Company";

export interface SlaQueueRecipients {
  queueId: number;
  responsibleIds: number[];
}

@Table({ tableName: "SlaAlertConfigurations" })
class SlaAlertConfiguration extends Model<SlaAlertConfiguration> {
  @PrimaryKey
  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column
  enabled: boolean;

  @Column(DataType.JSONB)
  extraRecipientIds: number[];

  @Column(DataType.JSONB)
  queues: SlaQueueRecipients[];
}

export default SlaAlertConfiguration;
