import { randomInt } from "crypto";

const DEFAULT_JOIN_CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const DEFAULT_JOIN_CODE_LENGTH = 6;

export type JoinCodeSource = {
  generate(): string;
};

export class JoinCodeGenerator implements JoinCodeSource {
  private readonly characters: string;
  private readonly length: number;

  constructor(
    characters = DEFAULT_JOIN_CODE_CHARACTERS,
    length = DEFAULT_JOIN_CODE_LENGTH,
  ) {
    this.characters = characters;
    this.length = length;
  }

  generate(): string {
    let code = "";
    for (let index = 0; index < this.length; index += 1) {
      code += this.characters[randomInt(this.characters.length)];
    }
    return code;
  }
}
