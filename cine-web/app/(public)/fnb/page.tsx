import FnbCatalog from "@/components/fnb-catalog";
import { getCachedFnbCatalog } from "@/lib/public-catalog";

export const revalidate = 60;

export default async function FnbPage() {
  const { categories, items, variants, cinemas } = await getCachedFnbCatalog();

  return (
    <FnbCatalog
      categories={categories}
      items={items}
      variants={variants}
      cinemas={cinemas}
    />
  );
}
