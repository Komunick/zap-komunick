import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  BeforeCreate,
  BeforeUpdate,
  PrimaryKey,
  AutoIncrement,
  Default,
  HasMany,
  BelongsToMany,
  ForeignKey,
  BelongsTo,
  DefaultScope
} from "sequelize-typescript";
import { v4 as uuidv4 } from "uuid";
import { hash, compare } from "bcryptjs";
import Ticket from "./Ticket";
import Queue from "./Queue";
import UserQueue from "./UserQueue";
import Company from "./Company";
import QuickMessage from "./QuickMessage";
import UserSocketSession from "./UserSocketSession"; // Importação da nova model

@DefaultScope(() => ({
  attributes: {
    exclude: [
      "twoFactorSecret",
      "twoFactorPendingSecret",
      "twoFactorRecoveryCodes"
    ]
  }
}))
@Table
class User extends Model<User> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Default(uuidv4())
  @Column(DataType.UUID)
  uuid: string;

  @BeforeCreate
  static setUUID(user: User) {
    user.uuid = uuidv4();
  }

  @Column
  name: string;

  @Column
  email: string;

  @Column(DataType.VIRTUAL)
  password: string;

  @Column
  passwordHash: string;

  @Default(0)
  @Column
  tokenVersion: number;

  @Default("admin")
  @Column
  profile: string;

  @Column
  super: boolean;

  // weekdays (0 = Sunday) and "HH:mm" range in which the user may access the
  // system; null means no restriction
  @Column(DataType.JSONB)
  accessHours: { weekdays: number[]; start: string; end: string } | null;

  // Zap Komunick: two-factor sign-in (docs/PRD.md, RF-016)
  @Default(false)
  @Column
  twoFactorEnabled: boolean;

  @Column
  twoFactorSecret: string;

  @Column
  twoFactorPendingSecret: string;

  @Column(DataType.JSONB)
  twoFactorRecoveryCodes: string[] | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @BelongsToMany(() => Queue, () => UserQueue)
  queues: Queue[];

  @HasMany(() => QuickMessage, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    hooks: true
  })
  quickMessages: QuickMessage[];

  @HasMany(() => UserSocketSession, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE"
  })
  socketSessions: UserSocketSession[]; // Nova associação

  @BeforeUpdate
  @BeforeCreate
  static hashPassword = async (instance: User): Promise<void> => {
    if (instance.password) {
      instance.passwordHash = await hash(instance.password, 8);
    }
  };

  public checkPassword = async (password: string): Promise<boolean> => {
    return compare(password, this.getDataValue("passwordHash"));
  };

  // Zap Komunick: the password hash and the two-factor secrets never go out
  // in an API response, whatever query loaded the user
  toJSON(): object {
    const values = {
      ...(super.toJSON() as unknown as Record<string, unknown>)
    };
    delete values.passwordHash;
    delete values.password;
    delete values.twoFactorSecret;
    delete values.twoFactorPendingSecret;
    delete values.twoFactorRecoveryCodes;
    return values;
  }
}

export default User;
