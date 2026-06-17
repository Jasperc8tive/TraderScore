import { Inject, Injectable } from "@nestjs/common";
import type { BusinessMemberRole, UUID } from "@tradescore/shared";
import type { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import { mapBusinessMember } from "./row-mappers";
import type { BusinessMemberRecord } from "./types";

export interface MemberWithUser extends BusinessMemberRecord {
  userPhone: string;
  userFullName: string | null;
}

@Injectable()
export class BusinessMembersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async find(businessId: UUID, userId: UUID): Promise<BusinessMemberRecord | null> {
    const { rows } = await this.db.query(
      `SELECT * FROM business_members
       WHERE business_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [businessId, userId],
    );
    return rows[0] ? mapBusinessMember(rows[0]) : null;
  }

  async add(
    businessId: UUID,
    userId: UUID,
    memberRole: BusinessMemberRole,
    addedBy: UUID,
  ): Promise<BusinessMemberRecord> {
    const { rows } = await this.db.query(
      `INSERT INTO business_members (business_id, user_id, member_role, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, user_id) WHERE deleted_at IS NULL
       DO UPDATE SET member_role = EXCLUDED.member_role
       RETURNING *`,
      [businessId, userId, memberRole, addedBy],
    );
    return mapBusinessMember(rows[0]!);
  }

  async listForBusiness(businessId: UUID): Promise<MemberWithUser[]> {
    const { rows } = await this.db.query(
      `SELECT m.*, u.phone AS user_phone, u.full_name AS user_full_name
       FROM business_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.business_id = $1 AND m.deleted_at IS NULL
       ORDER BY m.created_at ASC`,
      [businessId],
    );
    return rows.map((r) => ({
      ...mapBusinessMember(r),
      userPhone: r.user_phone as string,
      userFullName: (r.user_full_name as string | null) ?? null,
    }));
  }

  async countOwners(businessId: UUID): Promise<number> {
    const { rows } = await this.db.query(
      `SELECT count(*)::int AS c FROM business_members
       WHERE business_id = $1 AND member_role = 'OWNER' AND deleted_at IS NULL`,
      [businessId],
    );
    return (rows[0] as { c: number }).c;
  }

  /** Soft-delete a membership. */
  async remove(businessId: UUID, userId: UUID): Promise<void> {
    await this.db.query(
      `UPDATE business_members SET deleted_at = now()
       WHERE business_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [businessId, userId],
    );
  }
}
