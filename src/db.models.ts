import { RequestSchema } from './request.schema';

export const modelTokens = { request: 'request' };
export const DbModels = [{ name: modelTokens.request, schema: RequestSchema }];
