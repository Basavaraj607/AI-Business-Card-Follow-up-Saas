// src/pages/BillingPage.tsx
import { useState, useEffect } from 'react';
import {
  CreditCard, Check, Zap, Building2, Rocket, Crown,
  Users, Mail, MessageSquare, Brain, Shield, BarChart3,
  ChevronRight, Sparkles, AlertCircle, Star, Lock,
  ArrowRight, Loader2, Clock, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth-context';
import { createClient } from '../lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanKey = 'free' | 'pro' | 'team' | 'enterprise';
type BillingCycle = 'monthly' | 'annual';

interface Plan {
  key: PlanKey;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  color: string;
  accentBg: string;
  accentText: string;
  badge?: string;
  icon: React.ElementType;
  limits: {
    contacts: number | 'unlimited';
    messages: number | 'unlimited';
    teamMembers: number | 'unlimited';
    aiCompositions: number | 'unlimited';
  };
  features: string[];
  cta: string;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

// ─── Plan Definitions ─────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    tagline: 'Perfect to get started',
    monthlyPrice: 0,
    annualPrice: 0,
    color: 'gray',
    accentBg: 'bg-gray-50',
    accentText: 'text-gray-700',
    icon: Zap,
    limits: { contacts: 25, messages: 50, teamMembers: 1, aiCompositions: 10 },
    features: [
      '25 contacts',
      '50 follow-up messages/mo',
      'Email channel only',
      'Basic OCR card scanning',
      '10 AI email compositions/mo',
      'Community support',
    ],
    cta: 'Current Plan',
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'For serious networkers',
    monthlyPrice: 19,
    annualPrice: 14,
    color: 'brand',
    accentBg: 'bg-brand-50',
    accentText: 'text-brand-700',
    badge: 'Most Popular',
    icon: Rocket,
    limits: { contacts: 500, messages: 1000, teamMembers: 1, aiCompositions: 200 },
    features: [
      '500 contacts',
      '1,000 follow-up messages/mo',
      'Email + SMS + WhatsApp',
      'Advanced AI card parsing',
      '200 AI compositions/mo',
      'Follow-up scheduler',
      'Lead scoring & status tracking',
      'Priority email support',
    ],
    cta: 'Upgrade to Pro',
  },
  {
    key: 'team',
    name: 'Team',
    tagline: 'For growing sales teams',
    monthlyPrice: 49,
    annualPrice: 39,
    color: 'violet',
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-700',
    icon: Users,
    limits: { contacts: 2000, messages: 5000, teamMembers: 10, aiCompositions: 1000 },
    features: [
      '2,000 contacts',
      '5,000 follow-up messages/mo',
      'All channels + LinkedIn',
      'Team workspace (up to 10)',
      'Unlimited AI compositions',
      'Batch card scanning (up to 50)',
      'Analytics dashboard',
      'CRM export (CSV / HubSpot)',
      'Slack integration',
      'Dedicated support',
    ],
    cta: 'Upgrade to Team',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom scale, full control',
    monthlyPrice: 0,
    annualPrice: 0,
    color: 'amber',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-700',
    icon: Crown,
    limits: { contacts: 'unlimited', messages: 'unlimited', teamMembers: 'unlimited', aiCompositions: 'unlimited' },
    features: [
      'Unlimited everything',
      'Unlimited team members',
      'Custom AI model fine-tuning',
      'Dedicated Supabase instance',
      'SSO / SAML authentication',
      'SLA guarantees (99.9% uptime)',
      'White-label options',
      'Custom integrations',
      'Dedicated account manager',
      'On-premise deployment',
    ],
    cta: 'Contact Sales',
  },
];

// ─── Mock invoice history ─────────────────────────────────────────────────────

const MOCK_INVOICES: Invoice[] = [
  { id: 'INV-0003', date: '2026-06-01', amount: 19, status: 'paid',    description: 'Pro Plan — June 2026' },
  { id: 'INV-0002', date: '2026-05-01', amount: 19, status: 'paid',    description: 'Pro Plan — May 2026' },
  { id: 'INV-0001', date: '2026-04-01', amount: 19, status: 'paid',    description: 'Pro Plan — April 2026' },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function PlanBadge({ text, color }: { text: string; color: string }) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-400 text-white',
    violet: 'bg-violet-500 text-white',
    amber: 'bg-amber-500 text-white',
    gray: 'bg-gray-200 text-gray-600',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${colors[color] ?? colors.gray}`}>
      {text}
    </span>
  );
}

function LimitStat({ label, value, icon: Icon }: { label: string; value: number | 'unlimited'; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Icon size={14} className="text-gray-400 shrink-0" />
      <span className="font-semibold text-gray-900">
        {value === 'unlimited' ? '∞' : value.toLocaleString()}
      </span>
      <span>{label}</span>
    </div>
  );
}

// ─── Upgrade Modal ────────────────────────────────────────────────────────────

interface UpgradeModalProps {
  plan: Plan;
  cycle: BillingCycle;
  onClose: () => void;
}

function UpgradeModal({ plan, cycle, onClose }: UpgradeModalProps) {
  const [step, setStep] = useState<'confirm' | 'payment' | 'success'>('confirm');
  const [processing, setProcessing] = useState(false);

  const price = cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;

  const handlePayment = async () => {
    setProcessing(true);
    // Simulate payment processing
    await new Promise(r => setTimeout(r, 2200));
    setStep('success');
    setProcessing(false);
  };

  const PlanIcon = plan.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">

        {step === 'confirm' && (
          <>
            <div className={`${plan.accentBg} px-6 py-5 border-b border-gray-100`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${plan.accentBg} border border-gray-200 flex items-center justify-center`}>
                  <PlanIcon size={20} className={plan.accentText} />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Upgrade to {plan.name}</h2>
                  <p className="text-xs text-gray-500">{plan.tagline}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Price summary */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    {plan.name} Plan · {cycle === 'annual' ? 'Annual' : 'Monthly'}
                  </p>
                  {cycle === 'annual' && (
                    <p className="text-xs text-brand-600 font-semibold mt-0.5">
                      Save ${(plan.monthlyPrice - plan.annualPrice) * 12}/year
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-900">${price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                  {cycle === 'annual' && (
                    <p className="text-xs text-gray-400 line-through">${plan.monthlyPrice}/mo</p>
                  )}
                </div>
              </div>

              {/* Key unlocks */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What you unlock</p>
                {plan.features.slice(0, 5).map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check size={14} className="text-brand-500 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
                <Shield size={14} className="text-gray-400 shrink-0" />
                Secured by Stripe · Cancel anytime · No hidden fees
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => setStep('payment')}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <CreditCard size={15} />
                Continue to Payment
              </button>
            </div>
          </>
        )}

        {step === 'payment' && (
          <>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Payment Details</h2>
              <button onClick={() => setStep('confirm')} className="text-xs text-brand-600 font-semibold hover:underline">
                ← Back
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="input-group">
                <label className="input-label">Card Number</label>
                <div className="input flex items-center gap-2 text-gray-400">
                  <CreditCard size={16} />
                  <span className="text-sm">•••• •••• •••• 4242</span>
                  <span className="ml-auto text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">VISA</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="input-group">
                  <label className="input-label">Expiry</label>
                  <input className="input" placeholder="MM / YY" />
                </div>
                <div className="input-group">
                  <label className="input-label">CVC</label>
                  <input className="input" placeholder="•••" type="password" maxLength={4} />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Name on card</label>
                <input className="input" placeholder="John Smith" />
              </div>

              <div className="bg-brand-50 rounded-xl p-3 flex items-center gap-2 text-xs text-brand-700">
                <Lock size={12} className="shrink-0" />
                Your payment is encrypted and processed securely via Stripe.
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={handlePayment}
                disabled={processing}
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
              >
                {processing
                  ? <><Loader2 size={18} className="animate-spin" />Processing…</>
                  : <><Shield size={16} />Pay ${price}/mo · Start {plan.name}</>
                }
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center mb-5">
              <Check size={36} className="text-brand-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">You're on {plan.name}! 🎉</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your account has been upgraded. All {plan.name} features are now active.
            </p>
            <button
              onClick={() => { toast.success(`Welcome to ${plan.name}!`); onClose(); }}
              className="btn-primary px-8"
            >
              Start Using {plan.name} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function BillingPage() {
  const { user, tenantId } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<PlanKey>('free');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [upgrading, setUpgrading] = useState<Plan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const supabase = createClient();

  // ── Load current plan from DB ────────────────────────────────────────────
  useEffect(() => {
    const fetchPlan = async () => {
      if (!tenantId) return;
      try {
        const { data } = await supabase
          .from('tenants')
          .select('plan')
          .eq('id', tenantId)
          .maybeSingle();

        if (data?.plan) setCurrentPlan(data.plan as PlanKey);
      } catch (err) {
        console.warn('Failed to load plan:', err);
      } finally {
        setLoadingPlan(false);
      }
    };
    fetchPlan();
  }, [tenantId]);

  const activePlan = PLANS.find(p => p.key === currentPlan) ?? PLANS[0];
  const annualSavings = PLANS.filter(p => p.monthlyPrice > 0)
    .reduce((s, p) => s + (p.monthlyPrice - p.annualPrice) * 12, 0);

  const handleUpgrade = (plan: Plan) => {
    if (plan.key === currentPlan) return;
    if (plan.key === 'enterprise') {
      toast.success('Our team will reach out shortly!');
      return;
    }
    setUpgrading(plan);
  };

  const planOrder: PlanKey[] = ['free', 'pro', 'team', 'enterprise'];
  const isDowngrade = (planKey: PlanKey) =>
    planOrder.indexOf(planKey) < planOrder.indexOf(currentPlan);

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading billing information…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl page-enter">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <CreditCard size={24} className="text-brand-500" />
            Billing & Plans
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your subscription, usage, and payment details.
          </p>
        </div>
      </div>

      {/* ── Current Plan Banner ─────────────────────────────────────────────── */}
      <div className={`card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-2
        ${currentPlan === 'pro'        ? 'border-brand-200 bg-brand-50/30'    : ''}
        ${currentPlan === 'team'       ? 'border-violet-200 bg-violet-50/20'  : ''}
        ${currentPlan === 'enterprise' ? 'border-amber-200 bg-amber-50/20'    : ''}
        ${currentPlan === 'free'       ? 'border-gray-200'                    : ''}
      `}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activePlan.accentBg}`}>
            <activePlan.icon size={22} className={activePlan.accentText} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-bold text-gray-900 text-lg">{activePlan.name} Plan</h2>
              {currentPlan !== 'free' && (
                <span className="text-[10px] bg-brand-400 text-white px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{activePlan.tagline}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Usage meters */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <LimitStat label="contacts" value={activePlan.limits.contacts} icon={Users} />
            <LimitStat label="messages/mo" value={activePlan.limits.messages} icon={Mail} />
            <LimitStat label="team members" value={activePlan.limits.teamMembers} icon={Users} />
            <LimitStat label="AI compositions" value={activePlan.limits.aiCompositions} icon={Brain} />
          </div>

          {currentPlan === 'free' && (
            <button
              onClick={() => handleUpgrade(PLANS.find(p => p.key === 'pro')!)}
              className="btn-primary shrink-0 flex items-center gap-2"
            >
              <Rocket size={15} />
              Upgrade Now
            </button>
          )}
          {currentPlan !== 'free' && currentPlan !== 'enterprise' && (
            <div className="text-right shrink-0">
              <p className="text-2xl font-black text-gray-900">
                ${activePlan.monthlyPrice}<span className="text-sm font-normal text-gray-500">/mo</span>
              </p>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={10} />
                Next renewal: Jul 1, 2026
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Usage Progress ───────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-brand-500" />
          Usage This Month
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Contacts',          used: 12,  limit: activePlan.limits.contacts,          icon: Users,          color: 'bg-brand-400' },
            { label: 'Messages Sent',     used: 31,  limit: activePlan.limits.messages,          icon: Mail,           color: 'bg-blue-400'  },
            { label: 'AI Compositions',   used: 8,   limit: activePlan.limits.aiCompositions,    icon: Brain,          color: 'bg-violet-400'},
            { label: 'Follow-ups Sent',   used: 5,   limit: activePlan.limits.messages,          icon: MessageSquare,  color: 'bg-amber-400' },
          ].map(({ label, used, limit, icon: Icon, color }) => {
            const pct = limit === 'unlimited' ? 20 : Math.round((used / (limit as number)) * 100);
            const isNearLimit = pct >= 80;
            return (
              <div key={label} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-gray-600">
                    <Icon size={13} className="text-gray-400" />
                    {label}
                  </div>
                  <span className={`font-bold ${isNearLimit ? 'text-red-600' : 'text-gray-700'}`}>
                    {used} / {limit === 'unlimited' ? '∞' : limit}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isNearLimit ? 'bg-red-400' : color}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                {isNearLimit && (
                  <p className="text-[10px] text-red-500 font-semibold flex items-center gap-1">
                    <AlertCircle size={10} /> Near limit — upgrade to continue
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Billing Cycle Toggle ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-bold text-gray-900">Choose Your Plan</h2>

        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2
              ${billingCycle === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Annual
            <span className="text-[10px] bg-brand-400 text-white px-2 py-0.5 rounded-full font-bold">
              Save up to 30%
            </span>
          </button>
        </div>
      </div>

      {/* ── Plan Cards Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const isCurrent    = plan.key === currentPlan;
          const isEnterprise = plan.key === 'enterprise';
          const downgrade    = isDowngrade(plan.key);
          const price        = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
          const PlanIcon     = plan.icon;

          const borderColor = isCurrent ? {
            free: 'border-gray-300',
            pro: 'border-brand-400',
            team: 'border-violet-400',
            enterprise: 'border-amber-400',
          }[plan.key] : 'border-gray-100 hover:border-gray-200';

          return (
            <div
              key={plan.key}
              className={`card flex flex-col border-2 transition-all duration-200
                ${borderColor}
                ${plan.badge ? 'shadow-lg shadow-brand-400/10' : ''}
              `}
            >
              {/* Card Header */}
              <div className="p-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${plan.accentBg} flex items-center justify-center`}>
                    <PlanIcon size={20} className={plan.accentText} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {plan.badge && <PlanBadge text={plan.badge} color={plan.color} />}
                    {isCurrent && <PlanBadge text="Current" color="gray" />}
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 text-base">{plan.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{plan.tagline}</p>

                {/* Price */}
                <div className="mt-4">
                  {isEnterprise ? (
                    <div>
                      <p className="text-2xl font-black text-gray-900">Custom</p>
                      <p className="text-xs text-gray-500 mt-0.5">Contact us for pricing</p>
                    </div>
                  ) : plan.monthlyPrice === 0 ? (
                    <div>
                      <p className="text-2xl font-black text-gray-900">Free</p>
                      <p className="text-xs text-gray-500 mt-0.5">Forever</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-end gap-1">
                        <p className="text-3xl font-black text-gray-900">${price}</p>
                        <p className="text-sm text-gray-500 mb-1">/mo</p>
                      </div>
                      {billingCycle === 'annual' && (
                        <p className="text-xs text-brand-600 font-semibold">
                          Billed ${price * 12}/year · Save ${(plan.monthlyPrice - price) * 12}
                        </p>
                      )}
                      {billingCycle === 'monthly' && (
                        <p className="text-xs text-gray-400">Billed monthly</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Features list */}
              <div className="px-5 pb-4 flex-1 space-y-2">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2 text-xs text-gray-600">
                    <Check size={13} className="text-brand-500 mt-0.5 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <div className="p-4 pt-0">
                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                    ${isCurrent
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : downgrade
                        ? 'border border-gray-200 text-gray-600 hover:bg-gray-50 bg-white'
                        : isEnterprise
                          ? 'bg-amber-400 text-white hover:bg-amber-500'
                          : plan.key === 'team'
                            ? 'bg-violet-500 text-white hover:bg-violet-600'
                            : 'btn-primary'
                    }`}
                >
                  {isCurrent ? (
                    <><Check size={14} /> {plan.cta}</>
                  ) : isEnterprise ? (
                    <><ExternalLink size={14} /> {plan.cta}</>
                  ) : downgrade ? (
                    <>{plan.cta}</>
                  ) : (
                    <><ChevronRight size={14} /> {plan.cta}</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Feature Comparison Table ───────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Star size={16} className="text-brand-500" />
            Feature Comparison
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left p-4 font-semibold text-gray-600 w-48">Feature</th>
                {PLANS.map(p => (
                  <th key={p.key} className={`p-4 font-bold text-center
                    ${p.key === currentPlan ? 'text-brand-700' : 'text-gray-700'}`}>
                    {p.name}
                    {p.key === currentPlan && (
                      <span className="ml-1 text-[9px] bg-brand-400 text-white px-1.5 py-0.5 rounded-full">YOU</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: 'Contacts',          values: ['25', '500', '2,000', '∞'] },
                { label: 'Messages/mo',       values: ['50', '1,000', '5,000', '∞'] },
                { label: 'AI Compositions',   values: ['10', '200', '∞', '∞'] },
                { label: 'Team Members',      values: ['1', '1', '10', '∞'] },
                { label: 'Email',             values: [true, true, true, true] },
                { label: 'SMS',               values: [false, true, true, true] },
                { label: 'WhatsApp',          values: [false, true, true, true] },
                { label: 'LinkedIn',          values: [false, false, true, true] },
                { label: 'Batch Scanning',    values: [false, false, true, true] },
                { label: 'Analytics',         values: [false, false, true, true] },
                { label: 'CRM Export',        values: [false, false, true, true] },
                { label: 'SSO / SAML',        values: [false, false, false, true] },
                { label: 'White Label',       values: [false, false, false, true] },
                { label: 'SLA Guarantee',     values: [false, false, false, true] },
              ].map(row => (
                <tr key={row.label} className="hover:bg-gray-50/50">
                  <td className="p-4 font-medium text-gray-600">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className={`p-4 text-center
                      ${PLANS[i]?.key === currentPlan ? 'bg-brand-50/20' : ''}`}>
                      {typeof v === 'boolean' ? (
                        v
                          ? <Check size={16} className="text-brand-500 mx-auto" />
                          : <Lock size={14} className="text-gray-300 mx-auto" />
                      ) : (
                        <span className="font-semibold text-gray-700">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Invoice History ───────────────────────────────────────────────────── */}
      {currentPlan !== 'free' && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 size={16} className="text-brand-500" />
              Invoice History
            </h3>
            <button className="btn-secondary btn-sm flex items-center gap-1.5">
              <ExternalLink size={13} />
              Billing Portal
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {MOCK_INVOICES.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <CreditCard size={14} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{inv.description}</p>
                    <p className="text-xs text-gray-400">{inv.id} · {new Date(inv.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full
                    ${inv.status === 'paid' ? 'bg-brand-50 text-brand-700' : ''}
                    ${inv.status === 'pending' ? 'bg-amber-50 text-amber-700' : ''}
                    ${inv.status === 'failed' ? 'bg-red-50 text-red-700' : ''}
                  `}>
                    {inv.status.toUpperCase()}
                  </span>
                  <p className="text-sm font-bold text-gray-900 w-16 text-right">${inv.amount}.00</p>
                  <button className="btn-ghost btn-sm text-gray-400">
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Enterprise CTA ─────────────────────────────────────────────────────── */}
      <div className="card p-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Need a custom plan?</h3>
            <p className="text-sm text-gray-300 mt-0.5">
              Unlimited contacts, custom integrations, SSO, and a dedicated account manager.
            </p>
          </div>
        </div>
        <button
          onClick={() => toast.success('Our team will reach out within 24 hours!')}
          className="btn shrink-0 bg-white text-gray-900 hover:bg-gray-100 font-bold flex items-center gap-2"
        >
          <Sparkles size={15} />
          Talk to Sales
        </button>
      </div>

      {/* ── Upgrade Modal ─────────────────────────────────────────────────────── */}
      {upgrading && (
        <UpgradeModal
          plan={upgrading}
          cycle={billingCycle}
          onClose={() => setUpgrading(null)}
        />
      )}
    </div>
  );
}

export default BillingPage;
