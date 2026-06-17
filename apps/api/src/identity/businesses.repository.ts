import { Inject, Injectable } from "@nestjs/common";
import {
  type AssuranceLevel,
  type UUID,
  BusinessMemberRole,
  BusinessStatus,
} from "@tradescore/shared";
import type { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import { mapBusiness } from "./row-mappers";
import type { BusinessRecord } from "./types";

export interface CreateBusinessInput {
  name: string;
  slug: string;
  description?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  marketClusterId?: UUID | undefined;
  createdBy: UUID;
  referralCode: string;
  referrerBusinessId?: UUID | undefined;
}

export interface ReferralStats {
  referralCode: string;
  totalReferred: number;
  referred: Array<{ businessId: UUID; name: string; createdAt: Date }>;
}

export interface UpdateBusinessInput {
  name?: string | undefined;
  description?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  marketClusterId?: UUID | null | undefined;
}

export interface BusinessSearchQuery {
  query?: string | undefined;
  marketClusterId?: UUID | undefined;
  page: number;
  pageSize: number;
}

@Injectable()
export class BusinessesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: UUID): Promise<BusinessRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM businesses WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return rows[0] ? mapBusiness(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<BusinessRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM businesses WHERE slug = $1 AND deleted_at IS NULL",
      [slug],
    );
    return rows[0] ? mapBusiness(rows[0]) : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const { rows } = await this.db.query(
      "SELECT 1 FROM businesses WHERE slug = $1 AND deleted_at IS NULL",
      [slug],
    );
    return rows.length > 0;
  }

  /**
   * Create a business and its OWNER membership atomically. A business must never
   * exist without an owner, so both inserts share one transaction.
   */
  async createWithOwner(input: CreateBusinessInput): Promise<BusinessRecord> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO businesses (name, slug, description, phone, email, market_cluster_id, created_by, status, assurance_level, referral_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UNVERIFIED', $9)
         RETURNING *`,
        [
          input.name,
          input.slug,
          input.description ?? null,
          input.phone ?? null,
          input.email ?? null,
          input.marketClusterId ?? null,
          input.createdBy,
          BusinessStatus.ACTIVE,
          input.referralCode,
        ],
      );
      const business = mapBusiness(rows[0]!);
      await client.query(
        `INSERT INTO business_members (business_id, user_id, member_role, added_by)
         VALUES ($1, $2, $3, $2)`,
        [business.id, input.createdBy, BusinessMemberRole.OWNER],
      );
      // Record the referral within the same transaction, if a valid referrer.
      if (input.referrerBusinessId && input.referrerBusinessId !== business.id) {
        await client.query(
          `INSERT INTO referrals (referrer_business_id, referred_business_id, referral_code)
           VALUES ($1, $2, $3)`,
          [input.referrerBusinessId, business.id, input.referralCode],
        );
      }
      return business;
    });
  }

  async findByReferralCode(code: string): Promise<BusinessRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM businesses WHERE referral_code = $1 AND deleted_at IS NULL",
      [code],
    );
    return rows[0] ? mapBusiness(rows[0]) : null;
  }

  async referralCodeExists(code: string): Promise<boolean> {
    const { rows } = await this.db.query("SELECT 1 FROM businesses WHERE referral_code = $1", [code]);
    return rows.length > 0;
  }

  async getReferralStats(businessId: UUID): Promise<ReferralStats> {
    const biz = await this.findById(businessId);
    const { rows } = await this.db.query(
      `SELECT r.referred_business_id, b.name, r.created_at
       FROM referrals r JOIN businesses b ON b.id = r.referred_business_id
       WHERE r.referrer_business_id = $1
       ORDER BY r.created_at DESC`,
      [businessId],
    );
    return {
      referralCode: biz?.referralCode ?? "",
      totalReferred: rows.length,
      referred: rows.map((r) => ({
        businessId: r.referred_business_id as string,
        name: r.name as string,
        createdAt: new Date(r.created_at as string),
      })),
    };
  }

  async update(id: UUID, input: UpdateBusinessInput): Promise<BusinessRecord> {
    // Build a dynamic, parameterized SET clause for only the provided fields.
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    const add = (col: string, val: unknown): void => {
      sets.push(`${col} = $${i}`);
      params.push(val);
      i += 1;
    };
    if (input.name !== undefined) add("name", input.name);
    if (input.description !== undefined) add("description", input.description);
    if (input.phone !== undefined) add("phone", input.phone);
    if (input.email !== undefined) add("email", input.email);
    if (input.marketClusterId !== undefined) add("market_cluster_id", input.marketClusterId);

    if (sets.length === 0) {
      const current = await this.findById(id);
      return current!;
    }
    params.push(id);
    const { rows } = await this.db.query(
      `UPDATE businesses SET ${sets.join(", ")} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    return mapBusiness(rows[0]!);
  }

  /** Set a business's lifecycle status (moderation: suspend/reactivate). */
  async setStatus(id: UUID, status: BusinessStatus): Promise<BusinessRecord | null> {
    const { rows } = await this.db.query(
      "UPDATE businesses SET status = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING *",
      [id, status],
    );
    return rows[0] ? mapBusiness(rows[0]) : null;
  }

  /** Raise the assurance level of a business and stamp verification. */
  async verify(id: UUID, assuranceLevel: AssuranceLevel): Promise<BusinessRecord> {
    const { rows } = await this.db.query(
      `UPDATE businesses
       SET assurance_level = $2, verified_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id, assuranceLevel],
    );
    return mapBusiness(rows[0]!);
  }

  /** Paginated, soft-delete-aware search by name and optional market cluster. */
  async search(
    q: BusinessSearchQuery,
  ): Promise<{ items: BusinessRecord[]; total: number }> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];
    let i = 1;
    if (q.query) {
      conditions.push(`name ILIKE '%' || $${i} || '%'`);
      params.push(q.query);
      i += 1;
    }
    if (q.marketClusterId) {
      conditions.push(`market_cluster_id = $${i}`);
      params.push(q.marketClusterId);
      i += 1;
    }
    const where = conditions.join(" AND ");

    const countRes = await this.db.query(`SELECT count(*)::int AS total FROM businesses WHERE ${where}`, params);
    const total = (countRes.rows[0] as { total: number }).total;

    const limit = q.pageSize;
    const offset = (q.page - 1) * q.pageSize;
    const listRes = await this.db.query(
      `SELECT * FROM businesses WHERE ${where} ORDER BY name ASC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset],
    );
    return { items: listRes.rows.map(mapBusiness), total };
  }
}
