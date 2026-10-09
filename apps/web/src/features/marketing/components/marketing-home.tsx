import { SECTION } from '../content';
import { DemoSection } from './demo-section';
import { FinalCta } from './final-cta';
import { HomeFooter } from './home-footer';
import { HomeHero } from './home-hero';
import { HomeNav } from './home-nav';
import { ModulesSection } from './modules-section';
import { SolutionsSection } from './solutions-section';
import { ValueStrip } from './value-strip';
import { WalkthroughSection } from './walkthrough-section';
import { WorkflowSection } from './workflow-section';

const DEMO = { href: `#${SECTION.demo}`, label: 'Request a Demo' };
const SIGN_IN = { href: '/login', label: 'Sign in' };
const DASHBOARD = { href: '/', label: 'Open dashboard' };

/** The public home page. Signed-in visitors get a way back into the app instead of the sign-in prompts. */
export function MarketingHome({ signedIn }: { signedIn: boolean }) {
  const primary = signedIn ? DASHBOARD : DEMO;

  return (
    <div className="min-h-dvh bg-background" data-smooth-scroll>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2 font-medium text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <HomeNav primary={primary} secondary={signedIn ? null : SIGN_IN} />
      <main id="main">
        <HomeHero primary={primary} secondary={{ href: `#${SECTION.modules}`, label: 'Explore the Platform' }} />
        <ValueStrip />
        <ModulesSection />
        <WorkflowSection />
        <SolutionsSection />
        <WalkthroughSection />
        <DemoSection signedIn={signedIn} />
        <FinalCta primary={primary} secondary={signedIn ? { href: `#${SECTION.modules}`, label: 'Explore modules' } : SIGN_IN} />
      </main>
      <HomeFooter signedIn={signedIn} />
    </div>
  );
}
