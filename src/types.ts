import type { AuthContext } from './auth/middleware.js';

export type AppEnv = { Variables: { auth: AuthContext } };
