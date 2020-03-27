import { correspondentsSchema } from './correspondents.schema';
import { transactionsSchema } from './transactions.schema';

export const modelTokens = {
  correspondents: 'correspondents',
  transactions: 'transactions',
};

export const dbModels = [
  { name: modelTokens.correspondents, schema: correspondentsSchema },
  { name: modelTokens.transactions, schema: transactionsSchema },
];
