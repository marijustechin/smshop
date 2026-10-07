import type { Metadata } from 'next';
import { CatalogCategory } from '@/features/catalog';

export const metadata: Metadata = {
  title: 'Tortai — Šokolado meistrai',
  description:
    'Rankų darbo tortai: šventiniai, trifuliai ir klasikiniai — kepti nedidelėmis partijomis.',
  alternates: { canonical: '/tortai' },
};

const INTRO =
  'Rankų darbo tortai, kepti nedidelėmis partijomis iš atrinktų ingredientų — šventėms, dovanoms ir tiesiog geram rytui.';

export default function TortaiPage() {
  return <CatalogCategory slug="tortai" intro={INTRO} />;
}
