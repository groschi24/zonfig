import { getSiteConfig } from '@/config';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { ProblemSection } from '@/components/ProblemSection';
import { FlowSection } from '@/components/FlowSection';
import { ValidationSection } from '@/components/ValidationSection';
import { CLISection } from '@/components/CLISection';
import { Features } from '@/components/Features';
import { CTA } from '@/components/CTA';
import { Footer } from '@/components/Footer';

export default async function Home() {
  const config = await getSiteConfig();

  return (
    <>
      <Header config={config} />
      <main>
        <Hero config={config} />
        <ProblemSection />
        <FlowSection />
        <ValidationSection />
        <CLISection />
        <Features />
        <CTA config={config} />
      </main>
      <Footer config={config} />
    </>
  );
}
