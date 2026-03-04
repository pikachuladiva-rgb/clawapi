import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3100),
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string(),
  ANTHROPIC_API_KEY: z.string().default(''),
});

export const config = schema.parse(process.env);
