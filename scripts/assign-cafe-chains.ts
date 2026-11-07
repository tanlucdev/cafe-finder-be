import { PrismaClient } from '@prisma/client';

const groups = [
  { name: 'Every Half Coffee Roasters', slug: 'every-half-coffee-roasters', cafes: ['every-half-ngo-van-nam', 'every-half-ho-con-rua', 'every-half-hoa-mai', 'every-half-coffee-roasters-pasteur', 'every-half-tu-xuong'] },
  { name: 'Faro Cafe', slug: 'faro-cafe', cafes: ['faro-cafe-ky-dong', 'faro-cafe-thao-dien'] },
  { name: 'Em có café', slug: 'em-co-cafe', cafes: ['em-co-cafe-nguyen-thai-binh', 'em-co-cafe'] },
  { name: 'Triệu Coffee & Tea', slug: 'trieu-coffee-tea', cafes: ['trieu-coffee-tea', 'trieu-coffee-tea-to-hien-thanh'] },
  { name: 'Unihub Coffee', slug: 'unihub-coffee', cafes: ['unihub-coffee', 'unihub-coffee-d2'] },
  { name: 'WorkFlow', slug: 'workflow', cafes: ['workflow-parc-mall', 'workflow-space-hai-ba-trung'] },
  { name: 'Slow Cafe', slug: 'slow-cafe', cafes: ['cafe-slow', 'slow-cafe-thao-dien'] },
  { name: 'ThiBa', slug: 'thiba', cafes: ['thiba-cafe', 'thiba-space'] },
] as const;

const prisma = new PrismaClient();

async function main() {
  let assigned = 0;
  let eligibleChains = 0;
  await prisma.$transaction(async (tx) => {
    for (const group of groups) {
      const cafes = await tx.cafe.findMany({ where: { slug: { in: [...group.cafes] } }, select: { id: true, slug: true, chainId: true, isPublished: true, isHidden: true } });
      const found = new Set(cafes.map((cafe) => cafe.slug));
      const missing = group.cafes.filter((slug) => !found.has(slug));
      if (missing.length) throw new Error(`${group.slug}: missing cafes: ${missing.join(', ')}`);

      const publicCafes = cafes.filter((cafe) => cafe.isPublished && !cafe.isHidden);
      if (publicCafes.length < 2) {
        await tx.cafe.updateMany({ where: { id: { in: cafes.map((cafe) => cafe.id) } }, data: { chainId: null } });
        await tx.chain.deleteMany({ where: { slug: group.slug } });
        console.log(`Skipped ${group.slug}: only ${publicCafes.length} public cafe.`);
        continue;
      }
      eligibleChains += 1;

      const chain = await tx.chain.upsert({ where: { slug: group.slug }, create: { name: group.name, slug: group.slug }, update: { name: group.name } });
      const conflicting = publicCafes.filter((cafe) => cafe.chainId && cafe.chainId !== chain.id);
      if (conflicting.length) throw new Error(`${group.slug}: cafes already belong to another chain: ${conflicting.map((cafe) => cafe.slug).join(', ')}`);
      await tx.cafe.updateMany({ where: { id: { in: publicCafes.map((cafe) => cafe.id) } }, data: { chainId: chain.id } });
      assigned += publicCafes.length;
    }
  });
  console.log(`Assigned ${assigned} cafes to ${eligibleChains} eligible chains.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
