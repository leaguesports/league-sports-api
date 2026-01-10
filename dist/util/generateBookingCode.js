"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBookingCode = generateBookingCode;
const CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_LENGTH = 6;
/**
 * Generates a random booking code
 * @returns A random booking code
 */
function generateBookingCode() {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    }
    return code;
}
//# sourceMappingURL=generateBookingCode.js.map