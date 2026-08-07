import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url(),
});

export const validateEnv = () => {
  const parsed = envSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
};
