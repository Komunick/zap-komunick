import {
  Table,
  Column,
  CreatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

// Zap Komunick: audit trail (docs/PRD.md, RF-016). Rows are only inserted.
@Table({ tableName: "AuditLogs", updatedAt: false })
class AuditLog extends Model<AuditLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column
  action: string;

  @Column
  entity: string;

  @Column
  entityId: string;

  @Column(DataType.JSONB)
  details: Record<string, unknown> | null;

  @Column
  ip: string;

  @Column
  userAgent: string;

  @CreatedAt
  createdAt: Date;
}

export default AuditLog;
