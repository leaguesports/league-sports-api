import { DomainError } from "../../../lib/domain-error";

export const LOBBY_SKILLS = ["casual", "intermediate", "competitive"] as const;
export type LobbySkillValue = (typeof LOBBY_SKILLS)[number];

export class LobbySkill {
  static readonly CASUAL = new LobbySkill("casual");
  static readonly INTERMEDIATE = new LobbySkill("intermediate");
  static readonly COMPETITIVE = new LobbySkill("competitive");

  private constructor(readonly value: LobbySkillValue) {}

  static from(raw: unknown): LobbySkill | null {
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new DomainError(
        "skill must be casual, intermediate, or competitive",
      );
    }
    const skill = raw.trim().toLowerCase();
    if (skill.length === 0) return null;
    if (skill === "casual") return LobbySkill.CASUAL;
    if (skill === "intermediate") return LobbySkill.INTERMEDIATE;
    if (skill === "competitive") return LobbySkill.COMPETITIVE;
    throw new DomainError("skill must be casual, intermediate, or competitive");
  }

  equals(other: LobbySkill): boolean {
    return this.value === other.value;
  }
}
