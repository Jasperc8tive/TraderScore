import { Inject, Injectable } from "@nestjs/common";
import {
  type NotificationChannel,
  type NotificationStatus,
  NotificationStatus as Status,
  type UUID,
} from "@tradescore/shared";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";

export interface NotificationRecord {
  id: UUID;
  recipientUserId: UUID | null;
  channel: NotificationChannel;
  address: string | null;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  attempts: number;
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface OwnerContact {
  userId: UUID;
  phone: string;
  email: string | null;
}

function mapRow(r: Record<string, unknown>): NotificationRecord {
  return {
    id: r.id as string,
    recipientUserId: (r.recipient_user_id as string | null) ?? null,
    channel: r.channel as NotificationChannel,
    address: (r.address as string | null) ?? null,
    type: r.type as string,
    title: r.title as string,
    body: r.body as string,
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: r.status as NotificationStatus,
    attempts: Number(r.attempts),
    error: (r.error as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    sentAt: r.sent_at ? new Date(r.sent_at as string) : null,
  };
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(input: {
    recipientUserId: UUID | null;
    channel: NotificationChannel;
    address: string | null;
    type: string;
    title: string;
    body: string;
    payload: Record<string, unknown>;
  }): Promise<NotificationRecord> {
    const { rows } = await this.db.query(
      `INSERT INTO notifications (recipient_user_id, channel, address, type, title, body, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        input.recipientUserId,
        input.channel,
        input.address,
        input.type,
        input.title,
        input.body,
        JSON.stringify(input.payload),
      ],
    );
    return mapRow(rows[0]!);
  }

  async markSent(id: UUID, attempts: number): Promise<void> {
    await this.db.query(
      "UPDATE notifications SET status = $2, attempts = $3, sent_at = now(), error = NULL WHERE id = $1",
      [id, Status.SENT, attempts],
    );
  }

  async markFailed(id: UUID, attempts: number, error: string): Promise<void> {
    await this.db.query(
      "UPDATE notifications SET status = $2, attempts = $3, error = $4 WHERE id = $1",
      [id, Status.FAILED, attempts, error.slice(0, 1000)],
    );
  }

  async listForUser(userId: UUID, limit = 50): Promise<NotificationRecord[]> {
    const { rows } = await this.db.query(
      "SELECT * FROM notifications WHERE recipient_user_id = $1 ORDER BY created_at DESC LIMIT $2",
      [userId, limit],
    );
    return rows.map(mapRow);
  }

  /** The two party business ids for a trade (initiator + counterparty, if any). */
  async getTradePartyBusinessIds(tradeId: UUID): Promise<UUID[]> {
    const { rows } = await this.db.query<{ initiator_business_id: string; counterparty_business_id: string | null }>(
      "SELECT initiator_business_id, counterparty_business_id FROM trades WHERE id = $1",
      [tradeId],
    );
    const row = rows[0];
    if (!row) return [];
    const ids = [row.initiator_business_id];
    if (row.counterparty_business_id) ids.push(row.counterparty_business_id);
    return ids;
  }

  /** OWNER members' contact details for a business (notification recipients). */
  async getBusinessOwnerContacts(businessId: UUID): Promise<OwnerContact[]> {
    const { rows } = await this.db.query(
      `SELECT u.id AS user_id, u.phone, u.email
       FROM business_members m JOIN users u ON u.id = m.user_id
       WHERE m.business_id = $1 AND m.member_role = 'OWNER'
         AND m.deleted_at IS NULL AND u.deleted_at IS NULL`,
      [businessId],
    );
    return rows.map((r) => ({
      userId: r.user_id as string,
      phone: r.phone as string,
      email: (r.email as string | null) ?? null,
    }));
  }
}
