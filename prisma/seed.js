/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Seed awal WM PRJCT MNGMNT — idempotent (semua upsert pada kunci UNIQUE).
 * Jalankan: npm run db:seed
 */
const { Pool, neonConfig } = require("@neondatabase/serverless");
const { PrismaNeon } = require("@prisma/adapter-neon");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const ws = require("ws");

neonConfig.webSocketConstructor = ws;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Environment variable ${name} belum diset`);
    process.exit(1);
  }
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon(new Pool({ connectionString: requireEnv("DATABASE_URL") })),
});

// SKB 3 Menteri 2026 (ditetapkan 19/09/2025): 17 libur nasional + 8 cuti bersama
const HOLIDAYS_2026 = [
  ["2026-01-01", "Tahun Baru 2026 Masehi", "Libur Nasional"],
  ["2026-01-16", "Isra Mikraj Nabi Muhammad SAW", "Libur Nasional"],
  ["2026-02-16", "Cuti Bersama Tahun Baru Imlek 2577 Kongzili", "Cuti Bersama"],
  ["2026-02-17", "Tahun Baru Imlek 2577 Kongzili", "Libur Nasional"],
  ["2026-03-18", "Cuti Bersama Hari Suci Nyepi", "Cuti Bersama"],
  ["2026-03-19", "Hari Suci Nyepi (Tahun Baru Saka 1948)", "Libur Nasional"],
  ["2026-03-20", "Cuti Bersama Idul Fitri 1447 H", "Cuti Bersama"],
  ["2026-03-21", "Hari Raya Idul Fitri 1447 H", "Libur Nasional"],
  ["2026-03-22", "Hari Raya Idul Fitri 1447 H", "Libur Nasional"],
  ["2026-03-23", "Cuti Bersama Idul Fitri 1447 H", "Cuti Bersama"],
  ["2026-03-24", "Cuti Bersama Idul Fitri 1447 H", "Cuti Bersama"],
  ["2026-04-03", "Wafat Yesus Kristus", "Libur Nasional"],
  ["2026-04-05", "Hari Kebangkitan Yesus Kristus (Paskah)", "Libur Nasional"],
  ["2026-05-01", "Hari Buruh Internasional", "Libur Nasional"],
  ["2026-05-14", "Kenaikan Yesus Kristus", "Libur Nasional"],
  ["2026-05-15", "Cuti Bersama Kenaikan Yesus Kristus", "Cuti Bersama"],
  ["2026-05-27", "Hari Raya Idul Adha 1447 H", "Libur Nasional"],
  ["2026-05-28", "Cuti Bersama Idul Adha 1447 H", "Cuti Bersama"],
  ["2026-05-31", "Hari Raya Waisak 2570 BE", "Libur Nasional"],
  ["2026-06-01", "Hari Lahir Pancasila", "Libur Nasional"],
  ["2026-06-16", "Tahun Baru Islam 1448 H", "Libur Nasional"],
  ["2026-08-17", "Hari Proklamasi Kemerdekaan RI", "Libur Nasional"],
  ["2026-08-25", "Maulid Nabi Muhammad SAW", "Libur Nasional"],
  ["2026-12-24", "Cuti Bersama Hari Raya Natal", "Cuti Bersama"],
  ["2026-12-25", "Kelahiran Yesus Kristus (Natal)", "Libur Nasional"],
];

const UOMS = [
  ["m", "Meter"],
  ["m2", "Meter persegi"],
  ["m3", "Meter kubik"],
  ["unit", "Unit"],
  ["btg", "Batang"],
  ["kg", "Kilogram"],
  ["zak", "Zak (sak)"],
];

// [itemCode, name, uomCode, category, standardPrice, specification]
const ITEMS = [
  ["MAT-GAL-001", "Galian Tanah", "m3", "CONTRACTOR", 85000, "Galian tanah biasa kedalaman ≤ 2 m"],
  ["MAT-BTN-225", "Beton K-225", "m3", "MATERIAL", 1150000, "Ready mix mutu K-225"],
  ["MAT-BSI-D13", "Besi Beton D13", "btg", "MATERIAL", 125000, "Besi ulir D13 panjang 12 m"],
  ["MAT-SMN-050", "Semen Portland 50 kg", "zak", "MATERIAL", 72000, "PCC 50 kg"],
  ["FAB-PNT-100", "Daun Pintu Air Baja 1 m", "unit", "FABRICATION", 8500000, "Plat baja 8 mm + spindle"],
];

async function main() {
  // 1. Admin
  const email = requireEnv("SEED_ADMIN_EMAIL").trim().toLowerCase();
  const password = await bcrypt.hash(requireEnv("SEED_ADMIN_PASSWORD"), 12);
  await prisma.user.upsert({
    where: { email },
    update: { role: "SUPER_ADMIN", isActive: true },
    create: { email, name: "Super Admin", password, role: "SUPER_ADMIN" },
  });

  // 2. Lokasi: Region → Company → Estate → Block
  const region = await prisma.region.upsert({
    where: { code: "REG01" },
    update: {},
    create: { code: "REG01", name: "Sumatera" },
  });
  const company = await prisma.company.upsert({
    where: { code: "CMP01" },
    update: {},
    create: { code: "CMP01", name: "PT Contoh Agro Lestari", regionId: region.id },
  });
  const estate = await prisma.estate.upsert({
    where: { companyId_code: { companyId: company.id, code: "EST01" } },
    update: {},
    create: { companyId: company.id, code: "EST01", name: "Kebun Sungai Air", region: region.name },
  });
  for (const [blockCode, name, plantingYear, areaHectares] of [
    ["A01", "Blok A01", 2012, 28.5],
    ["A02", "Blok A02", 2013, 31.2],
  ]) {
    await prisma.block.upsert({
      where: { estateId_blockCode: { estateId: estate.id, blockCode } },
      update: {},
      create: { estateId: estate.id, blockCode, name, plantingYear, areaHectares },
    });
  }

  // 3. Folder category (wajib: Project.folderCategoryId NOT NULL)
  await prisma.folderCategory.upsert({
    where: { code: "WCS" },
    update: {},
    create: { code: "WCS", name: "Water Control Structure", description: "Bangunan pengendali air" },
  });

  // 4. UoM
  const uomIds = {};
  for (const [code, name] of UOMS) {
    const uom = await prisma.unitOfMeasurement.upsert({
      where: { code },
      update: {},
      create: { code, name },
    });
    uomIds[code] = uom.id;
  }

  // 5. Item (dirujuk template BOQ)
  for (const [itemCode, name, uomCode, category, standardPrice, specification] of ITEMS) {
    await prisma.item.upsert({
      where: { itemCode },
      update: {},
      create: { itemCode, name, category, uomId: uomIds[uomCode], standardPrice, specification },
    });
  }

  // 6. Vendor (tanpa kunci UNIQUE → cek nama dulu)
  for (const vendor of [
    { name: "CV Sumber Material Jaya", category: "MATERIAL", contactPerson: "Budi Santoso", phone: "081200000001" },
    { name: "PT Karya Konstruksi Air", category: "CONTRACTOR", contactPerson: "Siti Rahma", phone: "081200000002" },
  ]) {
    const existing = await prisma.vendor.findFirst({ where: { name: vendor.name }, select: { id: true } });
    if (!existing) await prisma.vendor.create({ data: vendor });
  }

  // 7. PIC (tanpa kunci UNIQUE → cek nama dulu)
  const pic = { name: "Andi Pratama", roleTitle: "WM Field Engineer", companyIds: [company.id] };
  const existingPic = await prisma.picOfficer.findFirst({ where: { name: pic.name }, select: { id: true } });
  if (!existingPic) await prisma.picOfficer.create({ data: pic });

  // 8. Struktur + Variant dengan template BOQ
  const structureType = await prisma.structureType.upsert({
    where: { name: "Pintu Air" },
    update: {},
    create: { name: "Pintu Air", description: "Bangunan pintu air pengatur muka air" },
  });
  const defaultBoqItems = [
    { itemCode: "MAT-GAL-001", name: "Galian Tanah", uom: "m3", qty: 24 },
    { itemCode: "MAT-BTN-225", name: "Beton K-225", uom: "m3", qty: 6.5 },
    { itemCode: "MAT-BSI-D13", name: "Besi Beton D13", uom: "btg", qty: 48 },
    { itemCode: "MAT-SMN-050", name: "Semen Portland 50 kg", uom: "zak", qty: 20 },
    { itemCode: "FAB-PNT-100", name: "Daun Pintu Air Baja 1 m", uom: "unit", qty: 1 },
  ];
  await prisma.structureVariant.upsert({
    where: { structureTypeId_code: { structureTypeId: structureType.id, code: "PA-SRG-1M" } },
    update: { defaultBoqItems },
    create: {
      structureTypeId: structureType.id,
      code: "PA-SRG-1M",
      name: "Pintu Air Sorong 1 m",
      description: "Pintu sorong lebar bukaan 1 m, konstruksi beton bertulang",
      defaultBoqItems,
    },
  });

  // 9. Hari libur 2026
  for (const [date, name, description] of HOLIDAYS_2026) {
    const holidayDate = new Date(`${date}T00:00:00.000Z`);
    await prisma.holiday.upsert({
      where: { holidayDate },
      update: { name, description, year: 2026 },
      create: { holidayDate, name, description, year: 2026 },
    });
  }

  console.log(`✅ Seed selesai: admin ${email}, ${HOLIDAYS_2026.length} hari libur 2026`);
}

main()
  .catch((error) => {
    console.error("❌ Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
