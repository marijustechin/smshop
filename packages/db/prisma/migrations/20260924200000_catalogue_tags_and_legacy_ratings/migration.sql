-- AlterTable
ALTER TABLE "catalog_products" DROP COLUMN "shortDescription",
ADD COLUMN     "ratingAverage" DECIMAL(2,1),
ADD COLUMN     "ratingCount" INTEGER,
ADD COLUMN     "ratingImportedAt" TIMESTAMP(3),
ADD COLUMN     "ratingSourceUrl" TEXT;

-- CreateTable
CREATE TABLE "catalog_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CatalogProductToCatalogTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CatalogProductToCatalogTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_tags_slug_key" ON "catalog_tags"("slug");

-- CreateIndex
CREATE INDEX "_CatalogProductToCatalogTag_B_index" ON "_CatalogProductToCatalogTag"("B");

-- AddForeignKey
ALTER TABLE "_CatalogProductToCatalogTag" ADD CONSTRAINT "_CatalogProductToCatalogTag_A_fkey" FOREIGN KEY ("A") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CatalogProductToCatalogTag" ADD CONSTRAINT "_CatalogProductToCatalogTag_B_fkey" FOREIGN KEY ("B") REFERENCES "catalog_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: verified legacy ratings imported from the old public product pages.
-- Source of truth: each old product page's JSON-LD `aggregateRating`
-- (ratingValue / ratingCount). Product slugs and names match the catalogue
-- records exactly. Read-only provenance; never employee-edited. The UPDATE is
-- a no-op where the product does not exist (e.g. fresh databases), which is
-- intentional: this is a one-time historical import, not a seed.
UPDATE "catalog_products" SET
    "ratingAverage" = 4.3,
    "ratingCount" = 23,
    "ratingSourceUrl" = 'https://www.sokoladomeistrai.lt/karaliskasis-tortas/',
    "ratingImportedAt" = '2026-09-24T00:00:00Z'
WHERE "slug" = 'karaliskasis-tortas';

UPDATE "catalog_products" SET
    "ratingAverage" = 5.0,
    "ratingCount" = 30,
    "ratingSourceUrl" = 'https://www.sokoladomeistrai.lt/tortas-kurmio-kalniukas/',
    "ratingImportedAt" = '2026-09-24T00:00:00Z'
WHERE "slug" = 'tortas-kurmio-kalniukas';

UPDATE "catalog_products" SET
    "ratingAverage" = 4.9,
    "ratingCount" = 61,
    "ratingSourceUrl" = 'https://www.sokoladomeistrai.lt/tortas-traskioji-vysnaite/',
    "ratingImportedAt" = '2026-09-24T00:00:00Z'
WHERE "slug" = 'tortas-traskioji-vysnaite';

UPDATE "catalog_products" SET
    "ratingAverage" = 4.9,
    "ratingCount" = 46,
    "ratingSourceUrl" = 'https://www.sokoladomeistrai.lt/tortas-violeta/',
    "ratingImportedAt" = '2026-09-24T00:00:00Z'
WHERE "slug" = 'tortas-violeta';

UPDATE "catalog_products" SET
    "ratingAverage" = 4.8,
    "ratingCount" = 10,
    "ratingSourceUrl" = 'https://www.sokoladomeistrai.lt/triufelinis-tortas-su-vysniomis/',
    "ratingImportedAt" = '2026-09-24T00:00:00Z'
WHERE "slug" = 'triufelinis-tortas-su-vysniomis';
