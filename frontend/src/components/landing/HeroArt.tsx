'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';

export default function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused,setPaused] = useState(false);
  const reduced = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateY = useSpring(pointerX,{stiffness:120,damping:22});
  const rotateX = useSpring(pointerY,{stiffness:120,damping:22});
  const {scrollYProgress}=useScroll({target:ref,offset:['start start','end start']});
  const y=useTransform(scrollYProgress,[0,1],[0,64]);
  return <div className="hero-art-perspective" onPointerMove={e => {
    if(reduced || e.pointerType==='touch')return;
    const bounds=e.currentTarget.getBoundingClientRect();
    pointerX.set(((e.clientX-bounds.left)/bounds.width-.5)*7);
    pointerY.set(-((e.clientY-bounds.top)/bounds.height-.5)*7);
  }} onPointerLeave={() => {pointerX.set(0);pointerY.set(0);}}>
    <motion.div ref={ref} className="hero-art" initial={{opacity:reduced?1:0,y:reduced?0:36,scale:reduced?1:.96}} animate={{opacity:1,y:0,scale:1}} transition={{duration:1.1,delay:reduced?0:.25,ease:[.16,1,.3,1]}} style={reduced?{}:{rotateX,rotateY,y}}>
      {reduced ? <Image src="/media/grahak-hero-poster.jpg" alt="Illustrative WhatsApp conversation and Grahak customer intelligence panel" fill priority sizes="(max-width:760px) 100vw, 48vw"/> : <>
        <video ref={videoRef} className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/media/grahak-hero-poster.jpg" aria-label="Illustrative Grahak product animation" onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onError={() => setPaused(true)}>
          <source src="/media/grahak-hero.mp4" type="video/mp4"/>
        </video>
        <button className="hero-playback" aria-label={paused?'Play hero animation':'Pause hero animation'} onClick={() => {
          if(paused) {void videoRef.current?.play().catch(() => setPaused(true));} else videoRef.current?.pause();
        }}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>
      </>}
    </motion.div>
  </div>;
}
