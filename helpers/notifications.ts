import { DataverseClient } from './dataverse';

export type EmailNotificationSearch = {
  /** GUID of the business record the email is regarding. */
  recordId: string;
  /** Exact subject match. */
  subject?: string;
  /** Partial subject match when exact subject is too rigid. */
  subjectContains?: string;
  /** Ignore messages created before this time. */
  createdAfter?: Date | string;
  /** Optional Dataverse statuscode filter if your org needs it. */
  statusCode?: number;
  /** Poll timeout. */
  timeoutMs?: number;
  /** Poll interval. */
  intervalMs?: number;
  /** Limit candidate rows pulled per poll. */
  top?: number;
};

export type EmailNotificationRecord = {
  activityid?: string;
  subject?: string;
  createdon?: string;
  description?: string;
  statuscode?: number;
  statecode?: number;
  _regardingobjectid_value?: string;
  [key: string]: unknown;
};

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeGuid(value: string): string {
  return value.replace(/[{}]/g, '').toLowerCase();
}

function parseCreatedOn(value: unknown): Date | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function matchesCreatedAfter(record: EmailNotificationRecord, createdAfter?: Date | string): boolean {
  if (!createdAfter) {
    return true;
  }

  const createdOn = parseCreatedOn(record.createdon);
  if (!createdOn) {
    return false;
  }

  const threshold = createdAfter instanceof Date ? createdAfter : new Date(createdAfter);
  return createdOn.getTime() >= threshold.getTime();
}

function matchesSubject(record: EmailNotificationRecord, criteria: EmailNotificationSearch): boolean {
  const subject = typeof record.subject === 'string' ? record.subject : '';

  if (criteria.subject && subject !== criteria.subject) {
    return false;
  }

  if (criteria.subjectContains && !subject.includes(criteria.subjectContains)) {
    return false;
  }

  return true;
}

function buildEmailFilter(criteria: EmailNotificationSearch): string {
  const clauses = [
    `_regardingobjectid_value eq ${normalizeGuid(criteria.recordId)}`,
  ];

  if (criteria.subject) {
    clauses.push(`subject eq '${escapeODataString(criteria.subject)}'`);
  }

  if (criteria.subjectContains) {
    clauses.push(`contains(subject,'${escapeODataString(criteria.subjectContains)}')`);
  }

  if (typeof criteria.statusCode === 'number') {
    clauses.push(`statuscode eq ${criteria.statusCode}`);
  }

  return clauses.join(' and ');
}

/**
 * Poll Dataverse email activities until one matching the record + subject appears.
 *
 * This intentionally verifies email receipt indirectly by checking the email
 * activity row created by the app/flow, rather than reading a mailbox.
 */
export async function waitForEmailNotification(
  criteria: EmailNotificationSearch,
  client = new DataverseClient()
): Promise<EmailNotificationRecord | null> {
  const timeoutMs = criteria.timeoutMs ?? 30_000;
  const intervalMs = criteria.intervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const results = await client.query('emails', {
      filter: buildEmailFilter(criteria),
      select: [
        'activityid',
        'subject',
        'createdon',
        'description',
        'statuscode',
        'statecode',
        '_regardingobjectid_value',
      ],
      orderBy: ['createdon desc'],
      top: criteria.top ?? 10,
    });

    const match = results.find((result): result is EmailNotificationRecord =>
      matchesSubject(result, criteria) && matchesCreatedAfter(result, criteria.createdAfter)
    );

    if (match) {
      return match;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return null;
}
