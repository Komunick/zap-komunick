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
  DataType
} from "sequelize-typescript";

export interface ErrorReportAttachment {
  storedName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export type ErrorReportEmailStatus = "pending" | "sending" | "sent";

// Zap Komunick: error reported by a user during the beta (docs/PRD.md,
// RF-030). The name of the user and of the company are copied here so the
// mail can still be written if either is removed later.
@Table
class ErrorReport extends Model<ErrorReport> {
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

  @Column
  location: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.TEXT)
  userAgent: string;

  @Column
  screen: string;

  @Column
  appUrl: string;

  @Default([])
  @Column(DataType.JSONB)
  attachments: ErrorReportAttachment[];

  @Default("pending")
  @Column
  emailStatus: ErrorReportEmailStatus;

  @Default(0)
  @Column
  emailAttempts: number;

  @Column(DataType.TEXT)
  emailError: string;

  @Column
  emailAttemptedAt: Date;

  @Column
  emailSentAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ErrorReport;
