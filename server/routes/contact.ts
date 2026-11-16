import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDatabaseAdapter } from '../db/adapter';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { config } from '../config/env';

const router = Router();
const contactLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: () => (config.isTest ? 200 : 20),
  keyPrefix: 'contact_inquiry',
  message: 'Too many inquiries submitted. Please wait before sending another message.',
});

// 1. POST Submit Public Contact Inquiry
router.post('/', contactLimiter, optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const adapter = getDatabaseAdapter();
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    if (String(name).length > 120 || String(subject || '').length > 200 || String(message).length > 3000) {
      return res.status(400).json({ error: 'Input exceeds allowed character limits.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const inquiryId = 'inq_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const userId = req.user?.id || null;

    await adapter.execute(`
      INSERT INTO contact_inquiries (id, name, email, subject, message, user_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'new')
    `, [
      inquiryId,
      name.trim(),
      email.trim().toLowerCase(),
      (subject || 'General Inquiry').trim(),
      message.trim(),
      userId
    ]);

    return res.status(201).json({
      success: true,
      message: 'Thank you for reaching out! A STROOM community curator will get back to you within 24 hours.',
      inquiryId,
    });
  } catch (err: any) {
    console.error('Error submitting contact inquiry:', err);
    return res.status(500).json({ error: 'Failed to submit inquiry. Please try again.' });
  }
});

// 2. GET Organized FAQ Categories & Questions
router.get('/faqs', (req, res) => {
  const faqs = [
    {
      category: 'About STROOM',
      items: [
        {
          id: 'faq_1',
          question: 'What is STROOM and how does it work?',
          answer: 'STROOM (Strangers Room) is a social discovery and real-world community platform. We curate themed group experiences — like turf sports leagues, board game nights, cultural workshops, and café meetups — specifically designed for strangers to connect comfortably without superficial awkwardness.'
        },
        {
          id: 'faq_2',
          question: 'Can I come alone to a STROOM event?',
          answer: 'Yes! In fact, over 80% of STROOM participants attend solo. Every event is structured with natural icebreakers, team allocations, and friendly hosts so you walk in as a stranger and walk out with a squad.'
        },
        {
          id: 'faq_3',
          question: 'Which cities is STROOM currently active in?',
          answer: 'STROOM is officially launched in Hyderabad (Flagship Hub) and Pune (Phase 2 Hub). Expansion into Bangalore and Mumbai is currently underway with active waitlists.'
        }
      ]
    },
    {
      category: 'Events & Experiences',
      items: [
        {
          id: 'faq_4',
          question: 'What types of events does STROOM host?',
          answer: 'STROOM hosts a diverse range of offline experiences including turf sports, box cricket, board gaming, book clubs, specialty coffee cupping, tech roundtables, and creative art sessions.'
        },
        {
          id: 'faq_5',
          question: 'How do group formations work at events?',
          answer: 'Hosts facilitate structured group activities, team rotations, and casual mixers to ensure everyone gets to interact with multiple members in a welcoming and pressure-free environment.'
        },
        {
          id: 'faq_6',
          question: 'How many people attend each event?',
          answer: 'We maintain strict capacity caps (typically 40 to 60 seats) at every venue to ensure the atmosphere remains intimate, high-energy, and interactive for everyone present.'
        }
      ]
    },
    {
      category: 'Registrations & Digital Passes',
      items: [
        {
          id: 'faq_7',
          question: 'How do I receive my event entry pass?',
          answer: 'Upon registering, an authentic STROOM Digital Pass is generated instantly with your unique pass code (e.g. STR-HYD-7821) and scannable QR token. You can save it to your phone or view it anytime in your Participant Hub.'
        },
        {
          id: 'faq_8',
          question: 'What happens at door check-in?',
          answer: 'Our reception staff scans your digital QR pass at the entrance. Your pass is verified against the live database, stamped into your STROOM Passport, and you receive your welcome team badge or event kit.'
        }
      ]
    },
    {
      category: 'Payments & Refunds',
      items: [
        {
          id: 'faq_9',
          question: 'Are there free events on STROOM?',
          answer: 'Yes! Many of our café mixers, book exchanges, acoustic jams, and tech roundtables are completely free to attend. Sports turfs and curated flagship events have a nominal pass fee that covers venue slot hire, equipment, and welcome beverages.'
        },
        {
          id: 'faq_10',
          question: 'What is the cancellation policy?',
          answer: 'You may cancel your registration up to 24 hours before event commencement directly from your Participant Hub for a full credit or refund voucher.'
        }
      ]
    },
    {
      category: 'Community Membership',
      items: [
        {
          id: 'faq_11',
          question: 'Is membership free?',
          answer: 'Yes! Joining STROOM and participating in community channels is completely free. You only pay for specific ticketed venue events you choose to attend.'
        },
        {
          id: 'faq_12',
          question: 'How do I start my own STROOM circle or host an event?',
          answer: 'Community members can submit an event proposal using our "Host an Event" form. Our curation team will review the proposal, assist with venue booking, and publish the event across the platform.'
        }
      ]
    },
    {
      category: 'Partner Collaborations',
      items: [
        {
          id: 'faq_13',
          question: 'How can cafes, turfs, and lounges partner with STROOM?',
          answer: 'We collaborate with verified local venues to host regular community meetups and curated gatherings. We bring organized, courteous groups during off-peak and weekend slots. You can apply via our "Partner With Us" portal.'
        }
      ]
    }
  ];

  return res.json({ faqs });
});

export default router;
