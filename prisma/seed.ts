import { PrismaClient, PriceRange } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Tạo admin user
  const adminHash = await bcrypt.hash('admin123456', 10);
  await prisma.user.upsert({
    where: { email: 'admin@cafefinder.vn' },
    update: {},
    create: {
      email: 'admin@cafefinder.vn',
      passwordHash: adminHash,
      displayName: 'Admin',
      role: 'ADMIN',
    },
  });

  // Seed cafes mẫu
  const cafes = [
    {
      name: 'The Workshop Coffee',
      slug: 'the-workshop-coffee',
      address: '27 Ngô Đức Kế, Phường Bến Nghé, Quận 1',
      district: 'Quận 1',
      lat: 10.7761,
      lng: 106.7026,
      priceRange: PriceRange.price_100k_150k,
      oneLiner: 'Không gian công nghiệp ấn tượng, cà phê specialty đỉnh cao',
      vibe: ['Industrial', 'Cozy', 'Artsy'],
      purpose: ['Work', 'Study', 'Coffee'],
      rating: 4.5,
      coverImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
      images: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
    {
      name: 'Cộng Cà Phê',
      slug: 'cong-ca-phe-q1',
      address: '26 Lý Tự Trọng, Phường Bến Nghé, Quận 1',
      district: 'Quận 1',
      lat: 10.7745,
      lng: 106.7021,
      priceRange: PriceRange.price_50k_100k,
      oneLiner: 'Phong cách retro Hà Nội, cà phê cốt dừa nổi tiếng',
      vibe: ['Retro', 'Vintage', 'Cozy'],
      purpose: ['Chill', 'Date', 'Coffee'],
      rating: 4.2,
      coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
      images: ['https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
    {
      name: 'Nhà Của Nắng',
      slug: 'nha-cua-nang',
      address: '12 Trần Cao Vân, Phường 6, Quận 3',
      district: 'Quận 3',
      lat: 10.7832,
      lng: 106.6897,
      priceRange: PriceRange.price_50k_100k,
      oneLiner: 'Không gian xanh mát, ánh sáng tự nhiên tràn ngập',
      vibe: ['Cozy', 'Green', 'Bright'],
      purpose: ['Work', 'Study', 'Chill'],
      rating: 4.4,
      coverImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
      images: ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
    {
      name: 'Tranquil Books & Coffee',
      slug: 'tranquil-books-coffee',
      address: '195/46 Nguyễn Đình Chiểu, Phường 6, Quận 3',
      district: 'Quận 3',
      lat: 10.7821,
      lng: 106.6882,
      priceRange: PriceRange.price_50k_100k,
      oneLiner: 'Kết hợp sách và cà phê, thiên đường của người yêu đọc sách',
      vibe: ['Cozy', 'Quiet', 'Bookish'],
      purpose: ['Study', 'Work', 'Read'],
      rating: 4.6,
      coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
      images: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
    {
      name: 'L\'Usine Le Loi',
      slug: 'lusine-le-loi',
      address: '151/1 Đồng Khởi, Phường Bến Nghé, Quận 1',
      district: 'Quận 1',
      lat: 10.7752,
      lng: 106.7038,
      priceRange: PriceRange.price_100k_150k,
      oneLiner: 'Concept store + cafe sang trọng giữa lòng thành phố',
      vibe: ['Chic', 'Modern', 'Artsy'],
      purpose: ['Date', 'Meeting', 'Coffee'],
      rating: 4.3,
      coverImage: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800',
      images: ['https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
    {
      name: 'Shin Coffee',
      slug: 'shin-coffee-q3',
      address: '82 Lê Văn Hưu, Phường Võ Thị Sáu, Quận 3',
      district: 'Quận 3',
      lat: 10.7844,
      lng: 106.6934,
      priceRange: PriceRange.price_50k_100k,
      oneLiner: 'Không gian nhỏ xinh, cà phê ngon, nhạc hay',
      vibe: ['Cozy', 'Minimal', 'Quiet'],
      purpose: ['Study', 'Work', 'Chill'],
      rating: 4.5,
      coverImage: 'https://images.unsplash.com/photo-1442975631134-94ac0c48e5c8?w=800',
      images: ['https://images.unsplash.com/photo-1442975631134-94ac0c48e5c8?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
    {
      name: 'Vietcetera Coffee Bar',
      slug: 'vietcetera-coffee-bar',
      address: '20 Bis Nguyễn Thị Minh Khai, Phường Đa Kao, Quận 1',
      district: 'Quận 1',
      lat: 10.7895,
      lng: 106.6983,
      priceRange: PriceRange.price_100k_150k,
      oneLiner: 'Media brand gặp specialty coffee, không gian sang trọng hiện đại',
      vibe: ['Modern', 'Chic', 'Trendy'],
      purpose: ['Meeting', 'Work', 'Coffee'],
      rating: 4.4,
      coverImage: 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=800',
      images: ['https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
    {
      name: 'Rosemary Coffee Garden',
      slug: 'rosemary-coffee-garden',
      address: '48 Phạm Viết Chánh, Phường 19, Bình Thạnh',
      district: 'Bình Thạnh',
      lat: 10.8012,
      lng: 106.7168,
      priceRange: PriceRange.price_50k_100k,
      oneLiner: 'Vườn cà phê xanh mát, yên tĩnh giữa lòng Bình Thạnh',
      vibe: ['Garden', 'Green', 'Cozy', 'Peaceful'],
      purpose: ['Chill', 'Date', 'Study'],
      rating: 4.3,
      coverImage: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800',
      images: ['https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
    {
      name: 'Katinat Saigon Kafe',
      slug: 'katinat-saigon-kafe-q1',
      address: '39 Ngô Đức Kế, Phường Bến Nghé, Quận 1',
      district: 'Quận 1',
      lat: 10.7755,
      lng: 106.7022,
      priceRange: PriceRange.under_50k,
      oneLiner: 'Chuỗi cà phê Việt Nam thân thiện với túi tiền, nhiều vị sáng tạo',
      vibe: ['Casual', 'Bright', 'Modern'],
      purpose: ['Chill', 'Coffee', 'Date'],
      rating: 4.1,
      coverImage: 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800',
      images: ['https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
    {
      name: 'Blackbird Coffee',
      slug: 'blackbird-coffee-q4',
      address: '15 Hoàng Diệu, Phường 13, Quận 4',
      district: 'Quận 4',
      lat: 10.7614,
      lng: 106.7028,
      priceRange: PriceRange.price_50k_100k,
      oneLiner: 'Specialty coffee đỉnh, không gian tối giản đẹp như tranh',
      vibe: ['Minimal', 'Dark', 'Cozy', 'Artsy'],
      purpose: ['Coffee', 'Work', 'Study'],
      rating: 4.7,
      coverImage: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800',
      images: ['https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800'],
      imageOrientations: ['landscape'],
      isPublished: true,
    },
  ];

  for (const cafe of cafes) {
    await prisma.cafe.upsert({
      where: { slug: cafe.slug },
      update: {},
      create: cafe,
    });
  }

  console.log('✅ Seed hoàn thành: 1 admin + 10 cafes');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
