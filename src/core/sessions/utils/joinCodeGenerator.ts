const DEFAULT_JOIN_CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const DEFAULT_JOIN_CODE_LENGTH = 6;

export class JoinCodeGenerator {
  private readonly characters: string = DEFAULT_JOIN_CODE_CHARACTERS;
  private readonly length: number = DEFAULT_JOIN_CODE_LENGTH;

  constructor() {}

  generate() {
    const randomCharacter = () => this.characters[Math.floor(Math.random() * this.characters.length)];
    return Array.from({ length: this.length }, randomCharacter).join("");
  }
}
