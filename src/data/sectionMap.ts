/**
 * Maps data-section attribute values → source file paths.
 * Used by the edit API to locate which file to modify.
 */

const componentSections: Record<string, string> = {
  'header-top': 'src/components/sections/HeaderTop.astro',
  'navigation': 'src/components/sections/Navigation.astro',
  'hero': 'src/components/sections/Hero.astro',
  'process': 'src/components/sections/Process.astro',
  'about': 'src/components/sections/About.astro',
  'why-choose': 'src/components/sections/WhyChoose.astro',
  'services': 'src/components/sections/Services.astro',
  'faq': 'src/components/sections/FAQ.astro',
  'cta': 'src/components/sections/CTA.astro',
  'testimonials': 'src/components/sections/Testimonials.astro',
  'blog-preview': 'src/components/sections/BlogPreview.astro',
  'map': 'src/components/sections/Map.astro',
  'footer': 'src/components/sections/Footer.astro',
  'team': 'src/components/sections/Team.astro',
  'pricing': 'src/components/sections/Pricing.astro',
  'counter': 'src/components/sections/Counter.astro',
  'contact-form': 'src/components/sections/ContactForm.astro',
  'blog-sidebar': 'src/components/sections/BlogSidebar.astro',
  'breadcrumb': 'src/components/sections/Breadcrumb.astro',
};

const pageSections = new Set([
  'blog-content',
  'landing-hero',
  'landing-about',
  'landing-services',
  'landing-cta',
  'landing-team',
  'landing-testimonials',
  'landing-faq',
  'landing-blog',
  'services-page',
  'why-choose-service',
  'team-page',
  'faq-page',
  'portfolio-grid',
  'portfolio-details-content',
  'service-details',
  'service-search',
  'service-menu',
  'service-brochure',
  'service-contact',
  'service-main-image',
  'service-description',
  'service-detail-boxes',
  'service-checklist',
  'service-faq',
]);

const pageFileMap: Record<string, string> = {
  '/': 'src/pages/index.astro',
  '/about/': 'src/pages/about.astro',
  '/service/': 'src/pages/service.astro',
  '/service-details/': 'src/pages/service-details.astro',
  '/contact/': 'src/pages/contact.astro',
  '/faq/': 'src/pages/faq.astro',
  '/team/': 'src/pages/team.astro',
  '/pricing/': 'src/pages/pricing.astro',
  '/portfolio/': 'src/pages/portfolio.astro',
  '/portfolio-details/': 'src/pages/portfolio-details.astro',
  '/blog/': 'src/pages/blog.astro',
  '/blog-2column/': 'src/pages/blog-2column.astro',
  '/blog-grid/': 'src/pages/blog-grid.astro',
  '/blog-details/': 'src/pages/blog-details.astro',
  '/landing/': 'src/pages/landing.astro',
};

function normalizePath(path: string): string {
  let p = path.replace(/\/+$/, '');
  if (!p.startsWith('/')) p = '/' + p;
  return p + '/';
}

export function resolveFilePath(section: string, currentPage: string): string | null {
  if (componentSections[section]) return componentSections[section];
  if (pageSections.has(section)) {
    const page = normalizePath(currentPage);
    return pageFileMap[page] || null;
  }
  return null;
}

export { componentSections, pageSections, pageFileMap };
