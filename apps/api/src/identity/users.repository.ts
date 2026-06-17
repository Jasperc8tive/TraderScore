import { Inject, Injectable } from "@nestjs/common";
import type { Role, UserStatus, UUID } from "@tradescore/shared";
import type { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import { mapUser } from "./row-mappers";
import type { UserRecord } from "./types";

@Injectable()
export class UsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: UUID): Promise<UserRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async findByPhone(phone: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM users WHERE phone = $1 AND deleted_at IS NULL",
      [phone],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  /** Create a PENDING user for a phone, or return the existing one (idempotent). */
  async findOrCreateByPhone(phone: string, role: Role): Promise<UserRecord> {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;
    const { rows } = await this.db.query(
      `INSERT INTO users (phone, role, status)
       VALUES ($1, $2, 'PENDING')
       ON CONFLICT (phone) WHERE deleted_at IS NULL DO UPDATE SET phone = EXCLUDED.phone
       RETURNING *`,
      [phone, role],
    );
    return mapUser(rows[0]!);
  }

  /** Mark a user phone-verified and ACTIVE. Returns the updated record. */
  async activate(id: UUID): Promise<UserRecord> {
    const { rows } = await this.db.query(
      `UPDATE users
       SET status = 'ACTIVE', phone_verified_at = COALESCE(phone_verified_at, now())
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id],
    );
    return mapUser(rows[0]!);
  }

  async setStatus(id: UUID, status: UserStatus): Promise<void> {
    await this.db.query("UPDATE users SET status = $2 WHERE id = $1", [id, status]);
  }

  /** Set the display name only if not already set (don't overwrite a user's own). */
  async setFullNameIfEmpty(id: UUID, fullName: string): Promise<void> {
    await this.db.query(
      "UPDATE users SET full_name = $2 WHERE id = $1 AND full_name IS NULL",
      [id, fullName],
    );
  }
}
