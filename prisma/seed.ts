import * as fs from 'fs';
import { PrismaClient, BloodGroup } from '@prisma/client';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading donors.json...');
  const filePath = path.join(__dirname, 'donors.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const donors = JSON.parse(rawData);

  console.log(`Starting to seed ${donors.length} donors...`);

  for (const donor of donors) {
    try {
      await prisma.seedDonor.upsert({
        where: { studentId: donor.studentId },
        update: {
          fullName: donor.fullName,
          bloodGroup: donor.bloodGroup as BloodGroup,
          batch: donor.batch ?? null,
          department: donor.department ?? null,
          hometown: donor.hometown ?? null,
          phone: donor.phone ?? null,
        },
        create: {
          studentId: donor.studentId,
          fullName: donor.fullName,
          bloodGroup: donor.bloodGroup as BloodGroup,
          batch: donor.batch ?? null,
          department: donor.department ?? null,
          hometown: donor.hometown ?? null,
          phone: donor.phone ?? null,
        },
      });
    } catch (error) {
      console.error(`Error seeding donor ${donor.studentId}:`, error);
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
