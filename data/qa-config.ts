import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

export type QaUser = {
  alias: string;
  name: string;
  email?: string;
  description?: string;
};

const QaUserInputSchema = z.union([
  z.string().min(1),
  z.object({
    alias: z.string().min(1),
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    description: z.string().min(1).optional(),
  }),
]);

const QaConfigSchema = z.object({
  entity: z.object({
    logicalName: z.string().min(1),
  }),
  users: z.array(QaUserInputSchema).min(1),
  domain: z.enum(['generic', 'airline', 'healthcare', 'government']).default('generic'),
  // Axe rule IDs to permanently suppress — use for violations in Microsoft-owned
  // components that your team cannot fix. Example: ["color-contrast", "region"]
  suppressedViolations: z.array(z.string()).default([]),
});

export type QaConfig = {
  entity: {
    logicalName: string;
  };
  users: QaUser[];
  domain: 'generic' | 'airline' | 'healthcare' | 'government';
  suppressedViolations: string[];
};

function normalizeQaUser(user: z.infer<typeof QaUserInputSchema>): QaUser {
  if (typeof user === 'string') {
    return {
      alias: user,
      name: user,
    };
  }

  return {
    alias: user.alias,
    name: user.name ?? user.alias,
    email: user.email,
    description: user.description,
  };
}

function loadQaConfig(): QaConfig {
  const configPath = path.resolve(process.cwd(), 'qa.config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      'qa.config.json not found. Copy qa.config.json and fill in your entity name and test users.'
    );
  }

  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const result = QaConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map(i => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`qa.config.json has invalid values:\n${issues}`);
  }

  const parsed = result.data as z.infer<typeof QaConfigSchema>;

  return {
    entity: {
      logicalName: parsed.entity.logicalName,
    },
    users: parsed.users.map(normalizeQaUser),
    domain: parsed.domain,
    suppressedViolations: parsed.suppressedViolations,
  };
}

export const qaConfig = loadQaConfig();

export function getDefaultQaUser(): QaUser {
  return qaConfig.users[0];
}

export function findQaUser(identifier?: string): QaUser | undefined {
  if (!identifier) {
    return getDefaultQaUser();
  }

  const normalizedIdentifier = identifier.trim().toLowerCase();

  return qaConfig.users.find(user =>
    user.alias.toLowerCase() === normalizedIdentifier ||
    user.name.toLowerCase() === normalizedIdentifier
  );
}

export function resolveQaUser(identifier?: string): QaUser {
  const user = findQaUser(identifier);

  if (!user) {
    const availableUsers = qaConfig.users.map(qaUser => qaUser.alias).join(', ');
    throw new Error(
      `Unknown QA user "${identifier}". Available users: ${availableUsers}`
    );
  }

  return user;
}
