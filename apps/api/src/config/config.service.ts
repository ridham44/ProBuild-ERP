import { Injectable } from '@nestjs/common';
import { Env, validateEnv } from './env';

@Injectable()
export class AppConfig {
  private readonly env: Env = validateEnv(process.env);

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}
