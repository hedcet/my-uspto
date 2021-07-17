import joi from '@hapi/joi';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { pick } from 'lodash';
import * as path from 'path';

const schema = joi.object({
  AMQP_INSTANCE_LIMIT: joi.number().default(1),
  AMQP_QUEUE_NAME: joi.string().required(),
  AMQP_URL: joi
    .string()
    .uri()
    .required(),
  MONGO_URL: joi.string().required(),
  NODE_ENV: joi.string().default('development'),
  PORT: joi.number().default(8080),
  ROOT_URL: joi
    .string()
    .uri()
    .default('http://localhost:8080'),
});

const ENV_FILEPATH = path.resolve(process.env.ENV_FILEPATH || './.env');
const { error, value } = schema.validate({
  ...dotenv.parse(
    fs.existsSync(ENV_FILEPATH) ? fs.readFileSync(ENV_FILEPATH, 'utf8') : '',
  ),
  ...pick(process.env, [...schema._ids._byKey.keys()]),
});

if (error) throw error;

export const env: { [key: string]: any } = value;
