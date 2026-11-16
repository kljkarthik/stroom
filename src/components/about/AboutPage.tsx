import React from 'react';
import { StroomLogo } from '../common/StroomLogo';
import {
  Users,
  Target,
  Handshake,
  Heart,
  Sparkles,
  MapPin,
  Trophy,
  Coffee,
  Shield,
  ArrowRight,
  Flame,
  CheckCircle2,
  Compass,
  Award
} from 'lucide-react';

interface AboutPageProps {
  onGoToDiscover: () => void;
  onGoToCommunities: () => void;
  onGoToPartner: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  onGoToDiscover,
  onGoToCommunities,
  onGoToPartner,
}) => {
  return (
    <div className="min-h-screen bg-stroom-ivory text-stroom-black pb-24">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-stroom-cream to-stroom-ivory border-b border-stroom-borderLight pt-16 pb-14 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stroom-orange/10 border border-stroom-orange/30 text-stroom-deep text-xs font-black uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5 text-stroom-orange" />
            <span>The STROOM Philosophy</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-stroom-black tracking-tight uppercase leading-tight">
            Where Strangers Become <span className="text-stroom-orange">Stories</span>.
          </h1>

          <p className="mt-6 text-stroom-charcoal/90 text-base sm:text-lg max-w-2xl mx-auto font-medium leading-relaxed">
            STROOM (Strangers Room) is built on a simple conviction: meaningful connections often begin when strangers share an experience.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onGoToDiscover}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs sm:text-sm shadow-brand hover:brightness-105 active:scale-98 transition-all flex items-center gap-2"
            >
              <span>Explore Experiences</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onGoToCommunities}
              className="px-6 py-3 rounded-2xl bg-white border border-stroom-borderLight text-stroom-black font-black text-xs sm:text-sm hover:border-stroom-orange shadow-xs transition-all flex items-center gap-2"
            >
              <Users className="w-4 h-4 text-stroom-orange" />
              <span>Browse Communities</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 Pillars Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/50 transition-all text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-stroom-black uppercase">Meet New People</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              Step outside existing social silos and connect with vibrant individuals in your neighborhood.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/50 transition-all text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-3">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-stroom-black uppercase">Discover Common Interests</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              Bond naturally over turf sports, board games, cinema, cafes, and outdoor thrills.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/50 transition-all text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-3">
              <Handshake className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-stroom-black uppercase">Build Real Connections</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              No awkward small talk or digital screen fatigue. In-person engagement creates genuine warmth.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-sm hover:border-stroom-orange/50 transition-all text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-orange flex items-center justify-center mb-3">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-stroom-black uppercase">Turn Meetups into Friendships</h3>
            <p className="mt-2 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
              What starts as strangers sitting across a table turns into lifelong memories and stories.
            </p>
          </div>
        </div>
      </section>

      {/* The Story / Narrative */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-stroom-borderLight shadow-xs space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stroom-cream text-stroom-deep text-[11px] font-black uppercase tracking-wider">
            Our Origin Story
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-stroom-black uppercase tracking-tight">
            Why STROOM Exists
          </h2>
          <div className="text-stroom-charcoal text-sm sm:text-base leading-relaxed space-y-4 font-medium">
            <p>
              In modern cities, people are more digitally connected than ever, yet real-world community has become remarkably scarce. We spend hours scrolling feeds, but rarely sit down across from someone new with genuine curiosity.
            </p>
            <p>
              STROOM was born in Hyderabad with an audacious belief: <strong>human connection thrives when people share an activity they genuinely care about.</strong>
            </p>
            <p>
              Instead of forced networking or superficial speed-dating, we pioneered experience-first social spaces. We started with our flagship turf leagues—bringing sports fans together on the pitch to compete, strategize, and celebrate together. We quickly expanded into curated café crawls, retro gaming tournaments, sunrise cycling trails, and indie film mixers.
            </p>
            <p>
              Today, STROOM is active across Hyderabad and Pune, with Bangalore and Mumbai launching next. Every weekend, hundreds of strangers walk in, and walk out as friends with stories to tell.
            </p>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <h2 className="text-2xl sm:text-3xl font-black text-stroom-black uppercase tracking-tight text-center mb-10">
          Our Guiding Values
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stroom-orange/10 text-stroom-orange flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-stroom-black uppercase">Belonging From Day One</h3>
              <p className="mt-1.5 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
                Whether attending your first solo event or coming with a friend, our community hosts ensure you feel welcome, included, and respected.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stroom-orange/10 text-stroom-orange flex items-center justify-center flex-shrink-0">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-stroom-black uppercase">Real-World First</h3>
              <p className="mt-1.5 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
                We believe life happens in physical rooms with real human laughter, shared meals, and spontaneous moments that screens can never replace.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stroom-orange/10 text-stroom-orange flex items-center justify-center flex-shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-stroom-black uppercase">Shared Excitement</h3>
              <p className="mt-1.5 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
                Energy multiplies when experienced together. From the thrill of a match point to solving a team trivia puzzle, we celebrate every win.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stroom-borderLight shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stroom-orange/10 text-stroom-orange flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-stroom-black uppercase">Safety & Trust</h3>
              <p className="mt-1.5 text-xs text-stroom-charcoal/80 font-medium leading-relaxed">
                Verified passes, zero tolerance for harassment, certified venues, and dedicated hosts keep every STROOM experience secure and dependable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Launch Cities */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="bg-stroom-black rounded-3xl p-8 sm:p-12 text-white border border-stone-800">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-stroom-orange text-white shadow-brand">
              City Presence
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3 uppercase tracking-tight">
              Our Active Hubs
            </h2>
            <p className="mt-2 text-stone-300 text-xs sm:text-sm font-medium">
              STROOM operates in key metropolitan clusters, partnering with top neighborhood venues.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black text-white">Hyderabad</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-stroom-orange text-white">
                  Flagship Hub
                </span>
              </div>
              <p className="text-xs text-stone-300 font-medium leading-relaxed">
                Active in Madhapur, Jubilee Hills, Gachibowli, and Financial District. Home to our flagship turf leagues, sports meetups, and cafe circles.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black text-white">Pune</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-600 text-white">
                  Active Hub
                </span>
              </div>
              <p className="text-xs text-stone-300 font-medium leading-relaxed">
                Active in Koregaon Park, Baner, and FC Road. Popular for youth cafe culture, cinema discussions, cycling expeditions, and music jams.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-xs font-bold text-stone-400">
              Upcoming Q1 2027 Expansion: <span className="text-stroom-orange font-black">Bangalore (Indiranagar/Koramangala)</span> & <span className="text-stroom-orange font-black">Mumbai (Bandra/Andheri)</span>
            </p>
          </div>
        </div>
      </section>

      {/* Final Partner CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 text-center">
        <div className="bg-stroom-cream/60 rounded-3xl p-8 sm:p-10 border border-stroom-borderLight">
          <h2 className="text-2xl font-black text-stroom-black uppercase">Own a venue or want to collaborate?</h2>
          <p className="mt-2 text-xs sm:text-sm text-stroom-charcoal/80 max-w-xl mx-auto font-medium">
            Partner with STROOM to host vibrant community events, fill your venue during off-peak hours, and engage high-value local audiences.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={onGoToPartner}
              className="px-6 py-2.5 rounded-xl bg-stroom-black text-white hover:bg-stone-800 text-xs font-black shadow-md transition-all"
            >
              Partner With Us
            </button>
            <button
              onClick={onGoToDiscover}
              className="px-6 py-2.5 rounded-xl bg-stroom-orange text-white hover:brightness-105 text-xs font-black shadow-brand transition-all"
            >
              Explore Experiences
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
