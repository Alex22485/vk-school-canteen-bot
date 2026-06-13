const { launch } = require("./bot");
const logger = require("./utils/logger");

console.log("🚀 Запуск VK бота школьной столовой...");
logger.info("Application starting");

launch();
