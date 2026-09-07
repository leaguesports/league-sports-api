import { DartsMatchRepository } from "../repositories/darts-match.repository";

export class GetDartsMatchById {
  constructor(private readonly matches: DartsMatchRepository) {}

  async execute(id: string) {
    return this.matches.findById(id);
  }
}
