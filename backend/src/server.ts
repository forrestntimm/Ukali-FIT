import app from "./app";
import { config } from "./utils/config";
import { logger } from "./utils/logger";
import { startSchedulers } from "./services/scheduler";

app.listen(config.port, () => {
  logger.info(`API running on port ${config.port}`);
  startSchedulers();
});
