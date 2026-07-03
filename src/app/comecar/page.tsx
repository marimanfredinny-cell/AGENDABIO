import { store } from '@/lib/store';
import { PLANS } from '@/lib/plans';
import Onboarding from '@/components/Onboarding';

export default async function ComecarPage() {
  const specialties = await store.listSpecialties();
  return (
    <Onboarding
      plans={PLANS}
      specialties={specialties.map((s) => ({ slug: s.slug, label: s.label, council: s.council }))}
    />
  );
}
