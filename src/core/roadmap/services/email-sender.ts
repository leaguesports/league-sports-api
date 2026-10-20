export type RoadmapEmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface RoadmapEmailSender {
  send(message: RoadmapEmailMessage): Promise<void>;
}

export class ConsoleRoadmapEmailSender implements RoadmapEmailSender {
  async send(message: RoadmapEmailMessage): Promise<void> {
    console.log("[roadmap-email]", JSON.stringify(message));
  }
}

export class RecordingRoadmapEmailSender implements RoadmapEmailSender {
  readonly sent: RoadmapEmailMessage[] = [];

  async send(message: RoadmapEmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

export class ResendRoadmapEmailSender implements RoadmapEmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: RoadmapEmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html ?? message.text,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend email failed (${response.status}): ${body}`);
    }
  }
}

export class SendGridRoadmapEmailSender implements RoadmapEmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: RoadmapEmailMessage): Promise<void> {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: parseFrom(this.from),
        subject: message.subject,
        content: [
          { type: "text/plain", value: message.text },
          { type: "text/html", value: message.html ?? message.text },
        ],
      }),
    });
    if (!response.ok && response.status !== 202) {
      const body = await response.text();
      throw new Error(`SendGrid email failed (${response.status}): ${body}`);
    }
  }
}

function parseFrom(from: string): { email: string; name?: string } {
  const match = from.match(/^(.*)<([^>]+)>$/);
  if (!match) return { email: from.trim() };
  return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
}

export function createRoadmapEmailSender(input: {
  fromEmail?: string;
  resendApiKey?: string;
  sendgridApiKey?: string;
}): RoadmapEmailSender {
  const from =
    input.fromEmail?.trim() || "League Sports <noreply@leaguesports.co.za>";
  if (input.resendApiKey) {
    return new ResendRoadmapEmailSender(input.resendApiKey, from);
  }
  if (input.sendgridApiKey) {
    return new SendGridRoadmapEmailSender(input.sendgridApiKey, from);
  }
  return new ConsoleRoadmapEmailSender();
}
