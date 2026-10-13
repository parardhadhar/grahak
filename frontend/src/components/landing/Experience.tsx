'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { ArrowRight, Check, CheckCheck, MessageCircle, Pause, Play, Sparkles } from 'lucide-react';

const stories = [
  { name: 'Photographers', initial: 'AS', person: 'Ananya Sharma', service: 'Wedding photography', message: 'Hi! Are you available for a wedding on 12 October? Our budget is around ₹25,000.', detail: '12 October · ₹25,000 budget', next: 'Send packages and check availability', description: 'Keep the date, the brief, and the budget together. Give every enquiry a thoughtful reply.' },
  { name: 'Consultants', initial: 'RM', person: 'Rohan Mehta', service: 'Business consultation', message: 'We’re opening a second studio. Can we discuss an operations review next Tuesday?', detail: 'Next Tuesday · Operations review', next: 'Share available consultation slots', description: 'Pick up the conversation with the context already in front of you, from the first enquiry to the next meeting.' },
  { name: 'Salons', initial: 'PV', person: 'Priya Verma', service: 'Bridal appointment', message: 'Hello! I’d like to know about your bridal packages. Can I come in for a consultation on Saturday?', detail: 'Saturday · Bridal consultation', next: 'Share packages and confirm a time', description: 'Remember the occasion, keep notes on preferences, and follow up on the details that matter.' },
  { name: 'Repair shops', initial: 'KP', person: 'Karan Patel', service: 'Laptop repair', message: 'My laptop keeps shutting down. Can I bring it in tomorrow? I need it back for work this week.', detail: 'Tomorrow · Laptop inspection', next: 'Confirm a drop-off time', description: 'Keep customer requests and service conversations together, so the next update is easy to find.' },
];

export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  return <motion.div className="reading-progress" style={{ scaleX }} aria-hidden="true"/>;
}

export function ConversationExperience() {
  const [selected, setSelected] = useState(0);
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const visible = useInView(ref, { amount: .25 });
  const reduced = useReducedMotion();
  const story = stories[selected];
  useEffect(() => {
    if (!visible || paused || reduced) return;
    const timer = setInterval(() => setStage(value => (value + 1) % 4), 2300);
    return () => clearInterval(timer);
  }, [visible, paused, reduced]);
  const currentStage = reduced ? 3 : stage;
  return <section ref={ref} className="conversation-experience" id="use-cases">
    <div className="experience-heading"><p className="section-kicker">Made for your kind of business</p><h2>Real conversations.<br/><span>Real possibilities.</span></h2><p>A customer says hello. You see the bigger picture. Explore an example from your everyday work.</p></div>
    <div className="industry-tabs" role="group" aria-label="Choose an example business">{stories.map((item, index) => <button key={item.name} aria-pressed={selected === index} onClick={() => { setSelected(index); setStage(0); }}>{selected === index && <motion.span className="industry-active" layoutId="industry-active" transition={{ type:'spring', stiffness:300, damping:30 }}/>}<span>{item.name}</span><ArrowRight size={16}/></button>)}</div>
    <div className="experience-stage">
      <div className="demo-chat"><div className="demo-window-label"><MessageCircle size={16}/> A conversation begins <span>Illustrative example</span></div><div className="demo-person"><span className="demo-avatar">{story.initial}</span><div><strong>{story.person}</strong><small>Customer enquiry</small></div></div>
        <AnimatePresence mode="wait"><motion.div key={selected} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:reduced?0:.35}} className="demo-chat-body"><div className="demo-bubble">{story.message}<small>09:41</small></div><motion.div className="demo-reply" animate={{opacity:currentStage >= 1?1:.25,y:currentStage >= 1?0:8}}>Thanks for getting in touch. Let me help you with that.<small>09:42 <CheckCheck size={14}/></small></motion.div><p className="demo-context">{story.description}</p></motion.div></AnimatePresence>
      </div>
      <div className="demo-connector" aria-hidden="true"><motion.span animate={reduced?{}:{x:[-16,16,-16],opacity:[.3,1,.3]}} transition={{duration:3,repeat:Infinity}}><ArrowRight/></motion.span></div>
      <div className="demo-intelligence"><div className="demo-window-label"><Sparkles size={16}/> Grahak intelligence</div><AnimatePresence mode="wait"><motion.div key={selected} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><span className="demo-tag">New lead</span><h3>{story.person}</h3><p>{story.service}</p><div className="demo-extraction"><motion.div animate={{opacity:currentStage>=1?1:.3}}><Check size={17}/><span>Customer context<strong>{story.detail}</strong></span></motion.div><motion.div animate={{opacity:currentStage>=2?1:.3}}><Sparkles size={17}/><span>A clear next step<strong>{story.next}</strong></span></motion.div><motion.div className="demo-followup" animate={{opacity:currentStage>=3?1:.3,scale:currentStage>=3?1:.98}}><CheckCheck size={18}/><span>Ready for your follow-up</span></motion.div></div></motion.div></AnimatePresence></div>
    </div>
    <div className="demo-controls"><div>{['Capture','Understand','Organize','Follow through'].map((label,index)=><button key={label} aria-pressed={currentStage===index} onClick={()=>{setStage(index);setPaused(true);}}><span className={currentStage>=index?'complete':''}/>{label}</button>)}</div><button className="demo-play" onClick={()=>setPaused(!paused)} aria-label={paused?'Play product demo':'Pause product demo'}>{paused?<Play size={15}/>:<Pause size={15}/>}</button></div>
  </section>;
}

export function WorkingDay() {
  const reduced = useReducedMotion();
  return <section className="working-day"><div><p className="section-kicker">Less searching. More doing.</p><h2>A better day<br/>starts with<br/><span>a clear next step.</span></h2><p className="day-intro">From the first message to the last follow-up, keep the small details that build lasting relationships.</p></div><div className="day-timeline">{[
    ['09:00','Start with what matters','Open your inbox and see new conversations alongside your customer records.'],
    ['11:30','Pick up where you left off','Read the conversation, review the summary, and reply with the full context.'],
    ['15:00','Make the next step clear','Add a note, tag the customer, or schedule a follow-up while the details are fresh.'],
    ['18:00','Close the day with clarity','Review your due follow-ups and mark completed work as done.'],
  ].map(([time,title,text],index)=><motion.article key={time} initial={{opacity:reduced?1:.2,x:reduced?0:24}} whileInView={{opacity:1,x:0}} viewport={{amount:.8}} transition={{duration:.6}}><span className="timeline-point"/><span className="day-time">{time} <span>/ 0{index+1}</span></span><h3>{title}</h3><p>{text}</p></motion.article>)}</div></section>;
}

export function Questions() {
  return <section id="questions" className="marketing-questions"><div><p className="section-kicker">Before you begin</p><h2>A few things<br/><span>worth knowing.</span></h2></div><div>{[
    ['What does Grahak organize?','Customer conversations, contact records, notes, tags, and follow-ups live together in your workspace. You can search for a customer and return to the context of your last conversation.'],
    ['How does WhatsApp connect?','Create your workspace, then open Settings to link your WhatsApp account through the configured connection service. Your connection status stays visible in the app.'],
    ['What does the AI help with?','When enabled, AI helps summarize conversations and identify useful customer details. Review its suggestions alongside the original messages before you act.'],
    ['Does Grahak send replies for me?','You stay in control of customer replies. Follow-ups help you remember the next step; scheduling one does not automatically send a WhatsApp message.'],
  ].map(([question,answer])=><article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div></section>;
}
