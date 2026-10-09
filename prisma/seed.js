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

  // 2. Lokasi Riil: 8 Region → 27 Company → 63 Estate (Order 1–63)
  const { REAL_LOCATIONS } = require("./real-locations");

  const REGION_DEFS = [
    { code: "REG-SUM-1", name: "Region 1", ops: "SUMATERA", order: 1 },
    { code: "REG-SUM-2", name: "Region 2", ops: "SUMATERA", order: 2 },
    { code: "REG-SUM-1-NTHIP", name: "Region 1 Non THIP", ops: "SUMATERA", order: 3 },
    { code: "REG-SUM-2-NTHIP", name: "Region 2 Non THIP", ops: "SUMATERA", order: 4 },
    { code: "REG-KB-A", name: "Kalbar A", ops: "KALBAR", order: 5 },
    { code: "REG-KB-B", name: "Kalbar B", ops: "KALBAR", order: 6 },
    { code: "REG-KTM", name: "Kaltim", ops: "WILTIM", order: 7 },
    { code: "REG-PAP", name: "Papua", ops: "WILTIM", order: 8 },
  ];

  const regionMap = {};
  for (const r of REGION_DEFS) {
    const reg = await prisma.region.upsert({
      where: { code: r.code },
      update: { name: r.name, ops: r.ops, order: r.order, isActive: true },
      create: { code: r.code, name: r.name, ops: r.ops, order: r.order, isActive: true },
    });
    regionMap[r.name] = reg;
  }

  // 2b. Unique Companies
  const companyMap = {};
  const companySeen = new Set();
  let companyOrder = 1;

  for (const row of REAL_LOCATIONS) {
    if (!companySeen.has(row.company)) {
      companySeen.add(row.company);
      const reg = regionMap[row.region];
      const comp = await prisma.company.upsert({
        where: { code: row.company },
        update: {
          name: row.companyAlias,
          alias: row.companyAlias,
          ops: row.ops,
          order: companyOrder,
          regionId: reg ? reg.id : null,
          isActive: true,
        },
        create: {
          code: row.company,
          name: row.companyAlias,
          alias: row.companyAlias,
          ops: row.ops,
          order: companyOrder,
          regionId: reg ? reg.id : null,
          isActive: true,
        },
      });
      companyMap[row.company] = comp;
      companyOrder++;
    }
  }

  // 2c. 63 Estates
  let order1Estate = null;
  for (const row of REAL_LOCATIONS) {
    const comp = companyMap[row.company];
    if (!comp) continue;

    // Untuk THIP: pakai kode kolom Estate (MER, RAM, dst)
    // Untuk Non-THIP: pakai kode kolom EstateNew (JJP1, CRS, BSU1, dst)
    const estateCode = row.company === "THIP" ? row.estate : row.estateNew;
    const legacyCode = row.estate;

    const est = await prisma.estate.upsert({
      where: {
        companyId_code: {
          companyId: comp.id,
          code: estateCode,
        },
      },
      update: {
        name: row.estateAlias,
        ops: row.ops,
        region: row.region,
        group: row.group,
        estateNew: row.estateNew,
        legacyCode,
        order: row.order,
        isActive: true,
      },
      create: {
        companyId: comp.id,
        code: estateCode,
        name: row.estateAlias,
        ops: row.ops,
        region: row.region,
        group: row.group,
        estateNew: row.estateNew,
        legacyCode,
        order: row.order,
        isActive: true,
      },
    });

    if (row.order === 1) {
      order1Estate = est;
    }
  }

  // 2d. Seed Blocks untuk Estate Order 1 (MER - Meranti)
  if (order1Estate) {
    for (const [blockCode, name, plantingYear, areaHectares] of [
      ["A01", "Blok A01", 2012, 28.5],
      ["A02", "Blok A02", 2013, 31.2],
    ]) {
      await prisma.block.upsert({
        where: { estateId_blockCode: { estateId: order1Estate.id, blockCode } },
        update: { name, plantingYear, areaHectares, isActive: true },
        create: { estateId: order1Estate.id, blockCode, name, plantingYear, areaHectares, isActive: true },
      });
    }
  }

  // 2e. Hubungkan Proyek Aktif Eksisting ke Estate Order 1 (THIP - MER)
  const thipCompany = companyMap["THIP"];
  if (thipCompany && order1Estate) {
    const activeProject = await prisma.project.findFirst({
      where: { projectCode: "WM-THIP-2026-0001" },
      select: { id: true },
    });
    if (activeProject) {
      await prisma.project.update({
        where: { id: activeProject.id },
        data: {
          companyId: thipCompany.id,
          estateId: order1Estate.id,
        },
      });
    }

    // Pastikan ProjectCodeCounter THIP tersinkron
    await prisma.projectCodeCounter.upsert({
      where: { companyId_year: { companyId: thipCompany.id, year: 2026 } },
      update: { lastSeq: 1 },
      create: { companyId: thipCompany.id, year: 2026, lastSeq: 1 },
    });
  }

  // 2f. Hapus Data Dummy Lama (CMP01, EST01, REG01)
  try {
    const dummyComp = await prisma.company.findUnique({
      where: { code: "CMP01" },
      include: { estates: true, projects: true },
    });
    if (dummyComp && dummyComp.projects.length === 0) {
      for (const est of dummyComp.estates) {
        await prisma.block.deleteMany({ where: { estateId: est.id } });
        await prisma.estate.delete({ where: { id: est.id } });
      }
      await prisma.projectCodeCounter.deleteMany({ where: { companyId: dummyComp.id } });
      await prisma.company.delete({ where: { id: dummyComp.id } });
      console.log("🧹 Data dummy CMP01 dan EST01 berhasil dibersihkan");
    }

    const dummyReg = await prisma.region.findUnique({
      where: { code: "REG01" },
      include: { companies: true },
    });
    if (dummyReg && dummyReg.companies.length === 0) {
      await prisma.region.delete({ where: { id: dummyReg.id } });
      console.log("🧹 Data dummy REG01 berhasil dibersihkan");
    }

    await prisma.region.deleteMany({
      where: { code: "THIP", companies: { none: {} } },
    });
  } catch (err) {
    console.warn("Catatan pembersihan dummy:", err.message);
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
  const pic = { name: "Andi Pratama", roleTitle: "WM Field Engineer", companyIds: thipCompany ? [thipCompany.id] : [] };
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
