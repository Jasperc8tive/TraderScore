import type {
  FraudFlagType,
  FraudSubjectType,
  FraudSeverity,
  FraudFlagStatus,
  UUID,
} from "@tradescore/shared";

export interface FraudFlagRecord {
  id: UUID;
  flagType: FraudFlagType;
  subjectType: FraudSubjectType;
  subjectId: string;
  severity: FraudSeverity;
  status: FraudFlagStatus;
  detail: Record<string, unknown>;
  detectedAt: Date;
  reviewedBy: UUID | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
}
