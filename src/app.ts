import { config } from './config';
import { logger } from './utils';

logger.info('Order Execution Engine');
logger.info('Environment:', { env: config.server.nodeEnv });
logger.info('Port:', { port: config.server.port });
logger.info('Configuration loaded successfully');
