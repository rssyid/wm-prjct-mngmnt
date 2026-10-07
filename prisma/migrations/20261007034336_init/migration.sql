-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'WM_HO_SPECIALIST', 'MANAGEMENT_VIEWER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SURVEY', 'RAB_READY', 'WAITING_AFCE_AR', 'AFCE_AR_APPROVED', 'PROCUREMENT', 'EXECUTION', 'WAITING_BAST', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StatusIndicator" AS ENUM ('ON_TRACK', 'AT_RISK', 'DELAYED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('CAPEX_BUDGETED', 'OPEX_BUDGETED', 'PTA', 'UNBUDGETED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('POINT', 'LINE', 'POLYGON');

-- CreateEnum
CREATE TYPE "PackageCategory" AS ENUM ('MATERIAL', 'FABRICATION', 'CONTRACTOR', 'HEAVY_EQUIPMENT', 'SWAKELOLA');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('DRAFT', 'PR_SUBMITTED', 'PO_ISSUED', 'IN_DELIVERY', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AfceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('WAITING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalDocType" AS ENUM ('AR', 'PR', 'PO');

-- CreateEnum
CREATE TYPE "PackageDocType" AS ENUM ('PR', 'PO', 'DO', 'INVOICE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('BELUM_LUNAS', 'DALAM_PROSES', 'LUNAS');

-- CreateEnum
CREATE TYPE "EquipmentOwnership" AS ENUM ('OWNED', 'RENTAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PURGE', 'TRANSITION', 'LOGIN_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WM_HO_SPECIALIST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rememberToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "regionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "estateId" TEXT NOT NULL,
    "blockCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plantingYear" INTEGER,
    "areaHectares" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolderCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolderCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureVariant" (
    "id" TEXT NOT NULL,
    "structureTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultBoqItems" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PackageCategory" NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasurement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "holidayDate" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PicOfficer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleTitle" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "companyIds" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PicOfficer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PackageCategory" NOT NULL DEFAULT 'MATERIAL',
    "uomId" TEXT NOT NULL,
    "specification" TEXT,
    "standardPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "folderCategoryId" TEXT NOT NULL,
    "structureTypeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "estateId" TEXT NOT NULL,
    "structureVariantId" TEXT,
    "blockId" TEXT,
    "picId" TEXT,
    "picName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geoCoordinates" JSONB,
    "locationType" "LocationType" NOT NULL DEFAULT 'POINT',
    "budgetType" "BudgetType" NOT NULL DEFAULT 'CAPEX_BUDGETED',
    "totalBudgetAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "targetQuantity" DOUBLE PRECISION,
    "uom" TEXT,
    "targetStartDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "constructionPlanStartDate" TIMESTAMP(3),
    "constructionPlanEndDate" TIMESTAMP(3),
    "revisedEndDate" TIMESTAMP(3),
    "estCompletionDate" TIMESTAMP(3),
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "statusBeforeHold" "ProjectStatus",
    "statusIndicator" "StatusIndicator" NOT NULL DEFAULT 'ON_TRACK',
    "onHoldReason" TEXT,
    "cancellationReason" TEXT,
    "sitePlanUrl" TEXT,
    "drawingUrl" TEXT,
    "boqItems" JSONB,
    "surveyElevationData" JSONB,
    "socializationSignOff" JSONB,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCodeCounter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCodeCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfceDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noAr" TEXT,
    "arType" TEXT,
    "budgetType" TEXT,
    "approvedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "drawingReady" BOOLEAN NOT NULL DEFAULT false,
    "rabReady" BOOLEAN NOT NULL DEFAULT false,
    "mapReady" BOOLEAN NOT NULL DEFAULT false,
    "emailSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "emailSubmittedDate" TIMESTAMP(3),
    "isSupplementary" BOOLEAN NOT NULL DEFAULT false,
    "supplementaryAmount" DECIMAL(18,2),
    "mcaApprovalDate" TIMESTAMP(3),
    "currentAttempt" INTEGER NOT NULL DEFAULT 1,
    "status" "AfceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AfceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementaryAr" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "noAr" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "status" "AfceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementaryAr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalSnapshot" (
    "id" TEXT NOT NULL,
    "afceDocumentId" TEXT,
    "workPackageId" TEXT,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "documentType" "ApprovalDocType" NOT NULL,
    "approvalLevel" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "personName" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'WAITING',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "evidenceDocUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPackage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "category" "PackageCategory" NOT NULL DEFAULT 'MATERIAL',
    "vendorId" TEXT,
    "vendorName" TEXT,
    "picName" TEXT,
    "weightPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetQuantity" DOUBLE PRECISION,
    "uom" TEXT,
    "volumeAchieved" DOUBLE PRECISION,
    "noPrUspk" TEXT,
    "prUspkDate" TIMESTAMP(3),
    "noPoSpk" TEXT,
    "poSpkDate" TIMESTAMP(3),
    "contractOrPoAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "estDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'BELUM_LUNAS',
    "paidAmount" DECIMAL(18,2),
    "paidDate" TIMESTAMP(3),
    "planStartDate" TIMESTAMP(3),
    "planEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "status" "PackageStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageItem" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyPlanned" DECIMAL(18,3) NOT NULL,
    "qtyReceived" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "totalPrice" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDelivery" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "deliveryOrderNo" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDeliveryItem" (
    "id" TEXT NOT NULL,
    "packageDeliveryId" TEXT NOT NULL,
    "packageItemId" TEXT NOT NULL,
    "qtyReceived" DECIMAL(18,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageDeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageDocument" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "docType" "PackageDocType" NOT NULL,
    "docNumber" TEXT,
    "docDate" TIMESTAMP(3),
    "fileUrl" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weekNo" INTEGER NOT NULL,
    "progressPct" DOUBLE PRECISION NOT NULL,
    "volumeAchieved" DOUBLE PRECISION,
    "volumeUnit" TEXT,
    "workDescription" TEXT,
    "weatherCondition" TEXT,
    "waterLevelCm" DOUBLE PRECISION,
    "photos" JSONB,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeavyEquipmentLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL,
    "unitCode" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "ownership" "EquipmentOwnership" NOT NULL DEFAULT 'OWNED',
    "hmStart" DOUBLE PRECISION NOT NULL,
    "hmEnd" DOUBLE PRECISION NOT NULL,
    "hmHours" DOUBLE PRECISION NOT NULL,
    "fuelLiters" DOUBLE PRECISION,
    "workVolume" DOUBLE PRECISION,
    "volumeUnit" TEXT,
    "workDescription" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeavyEquipmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BastDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bastNumber" TEXT NOT NULL,
    "bastDate" TIMESTAMP(3) NOT NULL,
    "hoInspectorName" TEXT,
    "contractorRepName" TEXT,
    "notes" TEXT,
    "bastFileUrl" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BastDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_regionId_idx" ON "Company"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "Estate_companyId_code_key" ON "Estate"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Block_estateId_blockCode_key" ON "Block"("estateId", "blockCode");

-- CreateIndex
CREATE UNIQUE INDEX "FolderCategory_code_key" ON "FolderCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StructureType_name_key" ON "StructureType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StructureVariant_structureTypeId_code_key" ON "StructureVariant"("structureTypeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasurement_code_key" ON "UnitOfMeasurement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_holidayDate_key" ON "Holiday"("holidayDate");

-- CreateIndex
CREATE INDEX "Holiday_year_idx" ON "Holiday"("year");

-- CreateIndex
CREATE UNIQUE INDEX "Item_itemCode_key" ON "Item"("itemCode");

-- CreateIndex
CREATE INDEX "Item_uomId_idx" ON "Item"("uomId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectCode_key" ON "Project"("projectCode");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_statusIndicator_idx" ON "Project"("statusIndicator");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Project_estateId_idx" ON "Project"("estateId");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCodeCounter_companyId_year_key" ON "ProjectCodeCounter"("companyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "AfceDocument_projectId_key" ON "AfceDocument"("projectId");

-- CreateIndex
CREATE INDEX "SupplementaryAr_projectId_idx" ON "SupplementaryAr"("projectId");

-- CreateIndex
CREATE INDEX "ApprovalSnapshot_afceDocumentId_attemptNo_idx" ON "ApprovalSnapshot"("afceDocumentId", "attemptNo");

-- CreateIndex
CREATE INDEX "ApprovalSnapshot_workPackageId_idx" ON "ApprovalSnapshot"("workPackageId");

-- CreateIndex
CREATE INDEX "WorkPackage_projectId_idx" ON "WorkPackage"("projectId");

-- CreateIndex
CREATE INDEX "WorkPackage_vendorId_idx" ON "WorkPackage"("vendorId");

-- CreateIndex
CREATE INDEX "WorkPackage_status_idx" ON "WorkPackage"("status");

-- CreateIndex
CREATE INDEX "WorkPackage_deletedAt_idx" ON "WorkPackage"("deletedAt");

-- CreateIndex
CREATE INDEX "PackageItem_workPackageId_idx" ON "PackageItem"("workPackageId");

-- CreateIndex
CREATE INDEX "PackageItem_itemId_idx" ON "PackageItem"("itemId");

-- CreateIndex
CREATE INDEX "PackageDelivery_workPackageId_idx" ON "PackageDelivery"("workPackageId");

-- CreateIndex
CREATE INDEX "PackageDeliveryItem_packageDeliveryId_idx" ON "PackageDeliveryItem"("packageDeliveryId");

-- CreateIndex
CREATE INDEX "PackageDeliveryItem_packageItemId_idx" ON "PackageDeliveryItem"("packageItemId");

-- CreateIndex
CREATE INDEX "PackageDocument_workPackageId_idx" ON "PackageDocument"("workPackageId");

-- CreateIndex
CREATE INDEX "ProgressLog_projectId_idx" ON "ProgressLog"("projectId");

-- CreateIndex
CREATE INDEX "ProgressLog_workPackageId_idx" ON "ProgressLog"("workPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressLog_workPackageId_weekNo_key" ON "ProgressLog"("workPackageId", "weekNo");

-- CreateIndex
CREATE INDEX "HeavyEquipmentLog_projectId_idx" ON "HeavyEquipmentLog"("projectId");

-- CreateIndex
CREATE INDEX "HeavyEquipmentLog_workPackageId_idx" ON "HeavyEquipmentLog"("workPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "BastDocument_projectId_key" ON "BastDocument"("projectId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estate" ADD CONSTRAINT "Estate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureVariant" ADD CONSTRAINT "StructureVariant_structureTypeId_fkey" FOREIGN KEY ("structureTypeId") REFERENCES "StructureType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "UnitOfMeasurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_folderCategoryId_fkey" FOREIGN KEY ("folderCategoryId") REFERENCES "FolderCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_structureTypeId_fkey" FOREIGN KEY ("structureTypeId") REFERENCES "StructureType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_structureVariantId_fkey" FOREIGN KEY ("structureVariantId") REFERENCES "StructureVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_picId_fkey" FOREIGN KEY ("picId") REFERENCES "PicOfficer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCodeCounter" ADD CONSTRAINT "ProjectCodeCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfceDocument" ADD CONSTRAINT "AfceDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementaryAr" ADD CONSTRAINT "SupplementaryAr_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalSnapshot" ADD CONSTRAINT "ApprovalSnapshot_afceDocumentId_fkey" FOREIGN KEY ("afceDocumentId") REFERENCES "AfceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalSnapshot" ADD CONSTRAINT "ApprovalSnapshot_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDelivery" ADD CONSTRAINT "PackageDelivery_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDeliveryItem" ADD CONSTRAINT "PackageDeliveryItem_packageDeliveryId_fkey" FOREIGN KEY ("packageDeliveryId") REFERENCES "PackageDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDeliveryItem" ADD CONSTRAINT "PackageDeliveryItem_packageItemId_fkey" FOREIGN KEY ("packageItemId") REFERENCES "PackageItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDocument" ADD CONSTRAINT "PackageDocument_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeavyEquipmentLog" ADD CONSTRAINT "HeavyEquipmentLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeavyEquipmentLog" ADD CONSTRAINT "HeavyEquipmentLog_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BastDocument" ADD CONSTRAINT "BastDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BastDocument" ADD CONSTRAINT "BastDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
