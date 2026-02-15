import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { OrganizationJsonLd, FAQJsonLd } from '@/components/JsonLd';
import {
  HeroSection,
  CreateModeSection,
  MyBricksModeSection,
  HowItWorksSection,
  FeaturesSection,
  FAQSection,
  CTASection,
} from '@/components/sections';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'marketing.faq' });
  const faqItems = ['1', '2', '3', '4', '5', '6'].map((key) => ({
    q: t(`${key}.q`),
    a: t(`${key}.a`),
  }));

  return (
    <>
      <OrganizationJsonLd />
      <FAQJsonLd items={faqItems} />
      <Navigation />
      <main>
        <HeroSection />
        <CreateModeSection />
        <MyBricksModeSection />
        <HowItWorksSection />
        <FeaturesSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
