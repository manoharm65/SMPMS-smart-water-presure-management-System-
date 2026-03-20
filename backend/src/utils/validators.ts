import { plainToInstance } from 'class-transformer';
import { validate as classValidate } from 'class-validator';

export async function validateDto<T>(dtoClass: new (...args: any[]) => T, body: any): Promise<T> {
  const instance = plainToInstance(dtoClass, body);
  const errors = await classValidate(instance as any);

  if (errors.length > 0) {
    const messages = errors.map((e) => Object.values(e.constraints || {}).join(', '));
    throw new Error(`Validation failed: ${messages.join('; ')}`);
  }

  return instance;
}
