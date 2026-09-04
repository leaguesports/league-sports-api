import { GolfRoundRepository } from "../repositories/golf-round.repository";

export class GetGolfRoundById {
  constructor(private readonly rounds: GolfRoundRepository) {}

  async execute(id: string) {
    return this.rounds.findById(id);
  }
}
