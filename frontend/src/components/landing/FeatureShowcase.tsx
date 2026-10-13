'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, Bell, Check, MessageSquare, Search, Sparkles } from 'lucide-react';

const features = [
  { icon: MessageSquare, title: 'One inbox. The whole conversation.', text: 'Customer messages and conversation history stay together. Spend less time looking for the last message and more time giving a useful reply.', label: 'Your conversations', action: 'Explore the inbox' },
  { icon: Search, title: 'The details make the difference.', text: 'Find the customer, read their notes, and review the conversation summary. The context is there when you need to pick things up again.', label: 'Customer context', action: 'Explore customer records' },
  { icon: Bell, title: 'Give every lead a next step.', text: 'Set a follow-up while the conversation is fresh. Keep a clear view of what is due and mark it done when you have followed through.', label: 'Follow-ups', action: 'Explore follow-ups' },
];

export default function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [35, -35]);
  const Icon = features[active].icon;
  return <section id="features" className="feature-showcase" ref={ref}>
    <div className="showcase-title"><div><p className="section-kicker">A workspace that works with you</p><h2>Keep the context.<br/><span>Move the conversation forward.</span></h2></div><p>Three everyday essentials, connected around the customer. Choose a feature to take a closer look.</p></div>
    <div className="showcase-grid">
      <div className="showcase-options" role="group" aria-label="Explore product features">{features.map(({icon:FeatureIcon,title,text},index)=><button className={active===index?'selected':''} key={title} aria-pressed={active===index} onClick={()=>setActive(index)}><span className="showcase-option-number">0{index+1}</span><div><div className="showcase-option-title"><FeatureIcon size={20}/><h3>{title}</h3><ArrowUpRight size={18}/></div><p>{text}</p>{active===index&&<motion.span className="showcase-option-line" layoutId="feature-line" transition={{type:'spring',stiffness:200,damping:25}}/>}</div></button>)}</div>
      <motion.div className="showcase-preview" style={reduced?{}:{y}}>
        <div className="showcase-preview-top"><span className="preview-logo">G.</span><span>Grahak workspace</span><span className="preview-status"><span/> Example preview</span></div>
        <AnimatePresence mode="wait"><motion.div key={active} className="showcase-preview-content" initial={{opacity:reduced?1:0,y:reduced?0:16,filter:reduced?'blur(0px)':'blur(4px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} exit={{opacity:0,y:reduced?0:-12}} transition={{duration:.3}}>
          <div className="preview-section-heading"><Icon size={19}/><h3>{features[active].label}</h3></div>
          {active===0?<><div className="preview-search"><Search size={15}/> Search conversations <kbd>⌘ K</kbd></div>{[['AS','Ananya Sharma','Can you share your wedding packages?','09:41','New lead'],['RM','Rohan Mehta','Tuesday works. Let’s confirm a time.','08:32','Customer'],['PV','Priya Verma','Thank you! Looking forward to Saturday.','Yesterday','Follow-up']].map(([initial,name,message,time,tag],index)=><motion.div className="preview-inbox-row" key={name} initial={{opacity:0,x:reduced?0:14}} animate={{opacity:1,x:0}} transition={{delay:reduced?0:index*.1}}><span className="preview-avatar">{initial}</span><div><strong>{name}</strong><p>{message}</p><span className="preview-tag">{tag}</span></div><small>{time}</small></motion.div>)}</>:active===1?<><div className="preview-customer"><span className="preview-avatar large">AS</span><div><h4>Ananya Sharma</h4><p>Wedding photography enquiry</p></div><span className="preview-tag">New lead</span></div><div className="preview-fields"><div><span>Interested in</span><strong>Full-day wedding photography</strong></div><div><span>Event date</span><strong>12 October</strong></div><div><span>Budget discussed</span><strong>₹25,000 approx.</strong></div></div><div className="preview-summary"><Sparkles size={17}/><div><strong>Conversation summary</strong><p>Interested in wedding coverage. Share package options and confirm availability for the date.</p></div></div></>:<><div className="preview-due"><span>Coming up</span><strong>Your next steps, in view.</strong></div>{[['Send wedding packages','Ananya Sharma','Tomorrow · 10:00 AM'],['Confirm consultation','Rohan Mehta','Tuesday · 11:30 AM'],['Check appointment details','Priya Verma','Saturday · 09:00 AM']].map(([title,name,time],index)=><motion.div className="preview-task" key={title} initial={{opacity:0,y:reduced?0:12}} animate={{opacity:1,y:0}} transition={{delay:reduced?0:index*.1}}><span className="preview-task-check"><Check size={13}/></span><div><strong>{title}</strong><p>{name}</p></div><small>{time}</small></motion.div>)}</>}
        </motion.div></AnimatePresence>
        <div className="showcase-preview-bottom"><span>Illustrative customer data</span><Link href="/signup">{features[active].action}<ArrowUpRight size={15}/></Link></div>
      </motion.div>
    </div>
  </section>;
}
