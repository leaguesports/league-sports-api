import { MatchRepository } from "../domain/matchRepository";

export class GetMatchById {
  constructor(private readonly matches: MatchRepository) {}

  async execute(id: string) {
    return this.matches.findById(id);
  }
}
