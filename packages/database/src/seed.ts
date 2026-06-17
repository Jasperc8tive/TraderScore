import type { Logger } from "@tradescore/logging";
import { Role, UserStatus, BusinessStatus, AssuranceLevel } from "@tradescore/shared";
import type { Database } from "./pool";

/**
 * Idempotent development seed.
 *
 * Establishes the minimum data a developer needs to explore the system: the
 * pilot market (Computer Village), an admin, a business owner, and one business.
 * Every insert is conflict-guarded so running `db:seed` repeatedly is safe.
 *
 * NOTE: this seed is for local development only. It is never run in production.
 */
export async function runSeeds(db: Database, logger: Logger): Promise<void> {
  await db.withTransaction(async (client) => {
    // Pilot market cluster.
    const cluster = await client.query<{ id: string }>(
      `INSERT INTO market_clusters (name, slug, city, state, country, description)
       VALUES ($1, $2, $3, $4, 'NG', $5)
       ON CONFLICT (slug) WHERE deleted_at IS NULL
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [
        "Computer Village",
        "computer-village-ikeja",
        "Ikeja",
        "Lagos",
        "Nigeria's largest ICT accessories market — TradeScore pilot market.",
      ],
    );
    const clusterId = cluster.rows[0]!.id;

    // Platform admin.
    await client.query(
      `INSERT INTO users (phone, email, full_name, role, status, phone_verified_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (phone) WHERE deleted_at IS NULL DO NOTHING`,
      ["+2348000000000", "admin@tradescore.local", "TradeScore Admin", Role.ADMIN, UserStatus.ACTIVE],
    );

    // Demo business owner.
    const owner = await client.query<{ id: string }>(
      `INSERT INTO users (phone, email, full_name, role, status, phone_verified_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (phone) WHERE deleted_at IS NULL
       DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [
        "+2348011111111",
        "owner@tradescore.local",
        "Demo Owner",
        Role.BUSINESS_OWNER,
        UserStatus.ACTIVE,
      ],
    );
    const ownerId = owner.rows[0]!.id;

    // Demo business.
    await client.query(
      `INSERT INTO businesses
         (name, slug, description, phone, market_cluster_id, assurance_level, status, created_by, referral_code, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING`,
      [
        "Adigun Electronics",
        "adigun-electronics",
        "Wholesale phone accessories.",
        "+2348011111111",
        clusterId,
        AssuranceLevel.PHONE_VERIFIED,
        BusinessStatus.ACTIVE,
        ownerId,
        "ADIGUN01",
      ],
    );
  });

  logger.info("seed complete");
}

/**
 * Pilot seed for the Computer Village launch: provisions the market plus a set of
 * businesses (each with an owner), referral links, and confirmed trades between
 * them — so the pilot environment is demonstrable and the analytics dashboard is
 * non-trivial on day one. Idempotent. Local/staging only.
 */
export async function runPilotSeed(db: Database, logger: Logger): Promise<void> {
  await db.withTransaction(async (client) => {
    const cluster = await client.query<{ id: string }>(
      `INSERT INTO market_clusters (name, slug, city, state, country, description)
       VALUES ('Computer Village', 'computer-village-ikeja', 'Ikeja', 'Lagos', 'NG', 'Pilot market')
       ON CONFLICT (slug) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    );
    const clusterId = cluster.rows[0]!.id;

    const businesses = [
      { name: "Ikeja Phone Hub", slug: "ikeja-phone-hub", phone: "+2348120000001", code: "IKEJA001" },
      { name: "Village Accessories", slug: "village-accessories", phone: "+2348120000002", code: "VILAG002" },
      { name: "Bright Computers", slug: "bright-computers", phone: "+2348120000003", code: "BRGHT003" },
      { name: "Naija Gadgets", slug: "naija-gadgets", phone: "+2348120000004", code: "NAIJA004" },
      { name: "Lagos Tech Mart", slug: "lagos-tech-mart", phone: "+2348120000005", code: "LAGOS005" },
    ];

    const ids: Record<string, { businessId: string; ownerId: string }> = {};
    for (const b of businesses) {
      const owner = await client.query<{ id: string }>(
        `INSERT INTO users (phone, full_name, role, status, phone_verified_at)
         VALUES ($1, $2, 'BUSINESS_OWNER', 'ACTIVE', now())
         ON CONFLICT (phone) WHERE deleted_at IS NULL DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [b.phone, `${b.name} Owner`],
      );
      const ownerId = owner.rows[0]!.id;
      const biz = await client.query<{ id: string }>(
        `INSERT INTO businesses (name, slug, market_cluster_id, assurance_level, status, created_by, referral_code, verified_at)
         VALUES ($1, $2, $3, 'PHONE_VERIFIED', 'ACTIVE', $4, $5, now())
         ON CONFLICT (slug) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [b.name, b.slug, clusterId, ownerId, b.code],
      );
      const businessId = biz.rows[0]!.id;
      await client.query(
        `INSERT INTO business_members (business_id, user_id, member_role, added_by)
         VALUES ($1, $2, 'OWNER', $2)
         ON CONFLICT (business_id, user_id) WHERE deleted_at IS NULL DO NOTHING`,
        [businessId, ownerId],
      );
      ids[b.slug] = { businessId, ownerId };
    }

    // A simple referral chain (idempotent).
    const referralPairs: Array<[string, string, string]> = [
      ["ikeja-phone-hub", "village-accessories", "IKEJA001"],
      ["ikeja-phone-hub", "bright-computers", "IKEJA001"],
      ["village-accessories", "naija-gadgets", "VILAG002"],
    ];
    for (const [referrer, referred, code] of referralPairs) {
      await client.query(
        `INSERT INTO referrals (referrer_business_id, referred_business_id, referral_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (referred_business_id) DO NOTHING`,
        [ids[referrer]!.businessId, ids[referred]!.businessId, code],
      );
    }

    // Confirmed trades between distinct counterparties (drives active/confirmation KPIs).
    const tradePairs: Array<[string, string, number]> = [
      ["ikeja-phone-hub", "village-accessories", 250000],
      ["ikeja-phone-hub", "bright-computers", 180000],
      ["bright-computers", "naija-gadgets", 90000],
      ["naija-gadgets", "lagos-tech-mart", 120000],
      ["village-accessories", "lagos-tech-mart", 60000],
    ];
    let n = 0;
    for (const [from, to, amount] of tradePairs) {
      n += 1;
      const ref = `TS-PILOT${n.toString().padStart(2, "0")}`;
      const t = await client.query<{ id: string }>(
        `INSERT INTO trades (reference_code, initiator_business_id, counterparty_business_id, direction, amount_minor, currency, occurred_on, status, created_by)
         VALUES ($1, $2, $3, 'SALE', $4, 'NGN', current_date, 'CONFIRMED', $5)
         ON CONFLICT (reference_code) WHERE deleted_at IS NULL DO NOTHING
         RETURNING id`,
        [ref, ids[from]!.businessId, ids[to]!.businessId, amount, ids[from]!.ownerId],
      );
      const tradeId = t.rows[0]?.id;
      if (tradeId) {
        await client.query(
          `INSERT INTO trade_events (trade_id, event_type, from_status, to_status, actor_user_id)
           VALUES ($1, 'CONFIRMED', 'PENDING_CONFIRMATION', 'CONFIRMED', $2)`,
          [tradeId, ids[to]!.ownerId],
        );
      }
    }
  });

  logger.info("pilot seed complete");
}
