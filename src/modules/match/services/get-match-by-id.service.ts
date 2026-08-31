import { MatchRepository } from "../repositories/match.repository";

export class GetMatchById {
  constructor(private readonly matches: MatchRepository) {}

  async execute(id: string) {
    return this.matches.findById(id);
  }
}
