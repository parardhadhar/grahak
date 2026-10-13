'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, useMotionValueEvent, useReducedMotion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Sparkles, Bell, ArrowRight } from 'lucide-react';

const chapters = [
  { icon:MessageSquare, title:'The conversation.', body:'Every customer message has a home. Pick up the thread without searching through your phone.', detail:'Messages and replies, together.' },
  { icon:Sparkles, title:'The context.', body:'Review the customer’s needs, important details, notes, and suggested next steps alongside the conversation.', detail:'The details that make a reply matter.' },
  { icon:Bell, title:'The next step.', body:'Set a follow-up, return with context, and keep your promises to customers.', detail:'A clear action for every conversation.' },
];

export default function ProductStory() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [chapter, setChapter] = useState(0);
  const {scrollYProgress} = useScroll({target:ref, offset:['start start', 'end end']});
  const scale = useTransform(scrollYProgress,[0,.4,.7,1],[1,1.035,1.065,1]);
  const x = useTransform(scrollYProgress,[0,.5,1],[0,-30,0]);
  useMotionValueEvent(scrollYProgress,'change', value => {
    const next = Math.min(2,Math.floor(value*3));
    setChapter(previous => previous === next ? previous : next);
  });
  const active = chapters[chapter];
  const Icon = active.icon;
  return <section ref={ref} id="product" className={`product-story ${reduced ? 'reduced' : ''}`}>
    <div className="product-story-sticky">
      <div className="product-story-heading"><h2>From the first hello.<br/>To what happens next.</h2><p>Explore the workspace</p></div>
      <div className="product-story-layout">
        <div className="story-visual"><motion.div style={reduced ? {} : {scale,x}}><Image src="/brand/workspace-preview.png" width={1440} height={900} alt="Actual Grahak workspace showing example customer messages and follow-up details" sizes="(max-width:760px) 100vw, 72vw"/></motion.div><span className="story-caption">Actual workspace. Example data.</span></div>
        <div className="story-detail">
          <div className="story-chapter-buttons">{chapters.map((item,index) => <button key={item.title} onClick={() => setChapter(index)} aria-label={`Show ${item.title.toLowerCase()}`} aria-pressed={chapter===index} className={chapter===index?'active':''}><item.icon size={18}/></button>)}</div>
          <AnimatePresence mode="wait"><motion.div key={chapter} initial={{opacity:reduced?1:0,y:reduced?0:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-8}} transition={{duration:.25}}><Icon size={30} strokeWidth={1.4}/><h3>{active.title}</h3><p>{active.body}</p><span>{active.detail}</span></motion.div></AnimatePresence>
          <a href="/signup" className="story-start">Get started <ArrowRight size={18}/></a>
        </div>
      </div>
    </div>
  </section>;
}
