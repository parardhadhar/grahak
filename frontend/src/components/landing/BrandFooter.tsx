'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

export default function BrandFooter() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({target:ref,offset:['start end','end end']});
  const y = useTransform(scrollYProgress,[0,1],[65,0]);
  return <footer ref={ref} className="brand-footer">
    <div className="footer-top"><div><p className="section-kicker">Your next chapter</p><h2>Good relationships<br/>start with <span>a conversation.</span></h2><p>A considered workspace for the business you’re building.</p></div><Link href="/signup" className="footer-cta" aria-label="Create your Grahak workspace"><ArrowUpRight size={34}/><span>Create your<br/>workspace</span></Link></div>
    <div className="footer-navigation"><div className="footer-about"><Link href="/" className="marketing-brand">GRAHAK.</Link><p>apna WhatsApp, ab organized.</p><span>Conversations. Context. Follow-through.</span></div><nav aria-label="Footer product navigation"><h3>Explore</h3><a href="#features">The workspace <ArrowUpRight size={13}/></a><a href="#use-cases">Made for your business <ArrowUpRight size={13}/></a><a href="#workflow">How it works <ArrowUpRight size={13}/></a></nav><nav aria-label="Footer account navigation"><h3>Your workspace</h3><Link href="/signup">Get started <ArrowUpRight size={13}/></Link><Link href="/login">Log in <ArrowUpRight size={13}/></Link><a href="#questions">Your questions, answered <ArrowUpRight size={13}/></a></nav></div>
    <div className="footer-wordmark" aria-hidden="true"><motion.span style={reduced?{}:{y}}>GRAHAK<span>.</span></motion.span></div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Grahak</span><span>Built around the way you work.</span><a href="#landing-content">Back to top <ArrowRight size={14}/></a></div>
  </footer>;
}
