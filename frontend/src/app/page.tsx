'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowRight, Menu, X, MessageSquare, Check } from 'lucide-react';
import './landing.css';
import ProductStory from '@/components/landing/ProductStory';
import HeroArt from '@/components/landing/HeroArt';
import { ConversationExperience, ReadingProgress, WorkingDay, Questions } from '@/components/landing/Experience';
import FeatureShowcase from '@/components/landing/FeatureShowcase';
import BrandFooter from '@/components/landing/BrandFooter';

export default function LandingPage() {
  const [menu, setMenu] = useState(false);
  const reduced = useReducedMotion();
  const reveal = { initial: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.65 } };
  return <div className="marketing" data-theme="dark">
    <ReadingProgress />
    <a className="skip-link" href="#landing-content">Skip to content</a>
    <nav className="marketing-nav" aria-label="Main navigation">
      <Link className="marketing-brand" href="/">GRAHAK.</Link>
      <div className="marketing-links"><a href="#features">Features</a><a href="#workflow">How it works</a><a href="#pricing">Getting started</a></div>
      <div className="nav-actions">
        <Link className="login-link" href="/login">Log in</Link>
        <Link className="marketing-button small" href="/signup">Get started <ArrowUpRight size={16}/></Link>
        <button className="menu-button" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>
      </div>
    </nav>
    {menu && <div className="marketing-mobile-menu"><a href="#features" onClick={() => setMenu(false)}>Features</a><a href="#workflow" onClick={() => setMenu(false)}>How it works</a><a href="#pricing" onClick={() => setMenu(false)}>Getting started</a><Link href="/login">Log in</Link></div>}
    <main id="landing-content">
      <section className="marketing-hero">
        <motion.div className="hero-copy" {...reveal}>
          <p className="hero-eyebrow">For people who run businesses</p>
          <h1 className="kinetic-headline">{['Your customers','are already','talking.'].map((line,index) => <span className={index===2?'headline-line copper':'headline-line'} key={line}><motion.span initial={{y:reduced?0:'110%',opacity:reduced?1:0}} animate={{y:0,opacity:1}} transition={{duration:.85,delay:reduced?0:index*.12,ease:[.16,1,.3,1]}}>{line}</motion.span></span>)}</h1>
          <p className="hero-description">apna WhatsApp,<br/>ab organized.</p>
          <div className="hero-actions"><Link className="marketing-button" href="/signup">Get started <ArrowUpRight size={19}/></Link><a className="marketing-text-link" href="#product">Explore the workspace <ArrowRight size={18}/></a></div>
        </motion.div>
        <HeroArt />
      </section>

      <section id="problem" className="marketing-statement">
        <p>For the people doing the work.</p>
        <motion.h2 {...reveal}>From conversations<br/>to <span>customers.</span></motion.h2>
        <div className="statement-bottom"><p>The lead. The detail. The promise to call back. Grahak gives every customer conversation a place to go next.</p><a href="#features" aria-label="Explore Grahak features"><ArrowRight size={30}/></a></div>
      </section>

      <ConversationExperience />
      <ProductStory />

      <FeatureShowcase />

      <section id="workflow" className="marketing-workflow">
        <motion.h2 {...reveal}>Keep your conversations.<br/>Change your follow-through.</motion.h2>
        <div className="workflow-list">
          {[
            ['Create your workspace', 'Set up your business profile and make a home for your customer relationships.'],
            ['Connect WhatsApp', 'Link your account through the configured connection service. Your customer messages appear in Grahak.'],
            ['Know what comes next', 'Reply with context, add a note, and schedule the next follow-up.'],
          ].map(([title, text]) => <motion.article key={title} {...reveal}><Check size={20}/><h3>{title}</h3><p>{text}</p></motion.article>)}
        </div>
      </section>

      <WorkingDay />
      <Questions />
      <section id="pricing" className="marketing-final">
        <motion.div {...reveal}><p>A little more organized. A lot more possible.</p><h2>Make every<br/><span>conversation count.</span></h2><Link className="marketing-button" href="/signup">Get started <ArrowUpRight size={20}/></Link></motion.div>
        <div className="final-note"><MessageSquare size={28} strokeWidth={1.4}/><p>Built around the way you already work.</p><span>WhatsApp conversations.<br/>Customer context.<br/>A clear next step.</span></div>
      </section>
    </main>
    <BrandFooter />
  </div>;
}
