import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  ForeignKey,
  DefaultScope
} from "sequelize-typescript";
import Company from "./Company";

@DefaultScope(() => ({ attributes: { exclude: ["encryptedValue"] } }))
@Table({ tableName: "CompanyCredentials" })
class CompanyCredential extends Model<CompanyCredential> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column
  key: string;

  @Column(DataType.TEXT)
  encryptedValue: string;

  @Column
  keyId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  toJSON(): object {
    const data = { ...(super.toJSON() as unknown as Record<string, unknown>) };
    delete data.encryptedValue;
    delete data.keyId;
    return data;
  }
}

export default CompanyCredential;
