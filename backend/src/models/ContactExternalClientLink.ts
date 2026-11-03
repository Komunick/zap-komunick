import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";

// P2: local authorization mapping, never a vendor-side write or copied company record.
@Table({ tableName: "ContactExternalClientLinks" })
class ContactExternalClientLink extends Model<ContactExternalClientLink> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @Column
  provider: string;

  @Column
  externalClientId: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ContactExternalClientLink;
