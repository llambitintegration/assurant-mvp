const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Query for team
    const team = await prisma.$queryRaw`
      SELECT id, name FROM teams WHERE name LIKE '%Assurant%' OR name LIKE '%P0003C%' LIMIT 5
    `;
    console.log('Team:', team);

    // Query all teams if specific not found
    const allTeams = await prisma.$queryRaw`
      SELECT id, name FROM teams LIMIT 10
    `;
    console.log('All Teams:', allTeams);

    // Query for user
    const user = await prisma.$queryRaw`
      SELECT id, email FROM users WHERE email = 'admin@llambit.io' LIMIT 1
    `;
    console.log('User:', user);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
