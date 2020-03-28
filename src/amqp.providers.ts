import { connect, connection } from 'amqplib';

import { env } from './env.validations';

export const AmqpProviders = [
  {
    provide: 'AMQP',
    useFactory: async (): Promise<connection> => await connect(env.AMQP_URL),
  },
];
