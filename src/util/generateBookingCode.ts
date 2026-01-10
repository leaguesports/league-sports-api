const CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_LENGTH = 6;

/**
 * Generates a random booking code
 * @returns A random booking code
 */
export function generateBookingCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  }
  return code;
}
