import { getConfig } from "../../../config";
import { createPrismaClient } from "../../../lib/prisma";
import { PrismaRoadmapRepository } from "../repositories/prisma-roadmap.repository";
import { createRoadmapEmailSender } from "../services/email-sender";
import { ShipRoadmapFeature } from "../services/roadmap.service";

function parseFeatureArg(argv: string[]): string {
  const index = argv.indexOf("--feature");
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(
      "Usage: yarn roadmap:ship -- --feature <id|slug>",
    );
  }
  return value;
}

async function main() {
  const featureIdOrSlug = parseFeatureArg(process.argv.slice(2));
  const config = getConfig();
  const prisma = createPrismaClient(config);
  const repository = new PrismaRoadmapRepository(prisma);
  const emailSender = createRoadmapEmailSender({
    fromEmail: config.ROADMAP_FROM_EMAIL,
    resendApiKey: config.RESEND_API_KEY,
    sendgridApiKey: config.SENDGRID_API_KEY,
  });
  const productUrl = `${config.FRONTEND_URL.replace(/\/$/, "")}/roadmap`;
  const ship = new ShipRoadmapFeature(repository, emailSender, {
    jwtSecret: config.JWT_SECRET,
    productUrl,
    unsubscribeUrl: (token) =>
      `${config.FRONTEND_URL.replace(/\/$/, "")}/roadmap/unsubscribe?token=${encodeURIComponent(token)}`,
  });

  try {
    const result = await ship.execute({ featureIdOrSlug });
    console.log(
      JSON.stringify(
        {
          id: result.feature.id,
          slug: result.feature.slug,
          title: result.feature.title,
          status: result.feature.status,
          shippedAt: result.feature.shippedAt,
          emailsSent: result.emailsSent,
          emailErrors: result.emailErrors,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
