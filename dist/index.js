"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
async function main() {
    const config = (0, config_1.getConfig)();
    (0, app_1.createApp)(config);
}
function handleError(error) {
    console.error(error);
    process.exit(1);
}
main().catch(handleError);
//# sourceMappingURL=index.js.map