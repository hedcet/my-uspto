import { CorrespondentsSchema } from './correspondents.schema';
import { TransactionsSchema } from './transactions.schema';

export const modelTokens = {
  correspondents: 'correspondents',
  transactions: 'transactions',
};

export const DbModels = [
  { name: modelTokens.correspondents, schema: CorrespondentsSchema },
  { name: modelTokens.transactions, schema: TransactionsSchema },
];
