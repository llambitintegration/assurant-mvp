import dotenv from "dotenv";

dotenv.config();
global.Promise = require("bluebird");

try {
  const SegfaultHandler = require("segfault-handler");
  SegfaultHandler.registerHandler("crash.log");
} catch (e) {
  // Segfault handler is optional - not available on all platforms
}
