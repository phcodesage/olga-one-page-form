import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Calendar, DollarSign, FileText, Loader2 } from 'lucide-react';
import { calculatePrice, type TimeBlock, type School, type BillingFrequency } from './utils/pricing';
import { QRCodeCanvas } from 'qrcode.react';

function App() {
  // Production: always post to Render backend
  const apiBase = 'https://olga-one-page-form.onrender.com';
  const [selectedOption, setSelectedOption] = useState('');
  const [formData, setFormData] = useState({
    childName: '',
    childDateOfBirth: '',
    childGrade: '',
    parentName: '',
    parentAddress: '',
    email: '',
    phoneCountry: '+1',
    phone: '',
    emergencyContact: '',
    emergencyPhoneCountry: '+1',
    emergencyPhone: '',
    allergies: '',
    specialInstructions: '',
    // Payment fields
    paymentMethod: 'zelle',
    // Zelle fields
    zellePayerName: '',
    zelleConfirmation: '',
    // Credit card fields
    cardNumber: '',
    cardExpiration: '',
    cardSecurityCode: '',
    cardZipCode: '',
    // Other payment notes
    paymentNotes: '',
  });

  // Pricing UI state
  const [daysPerWeek, setDaysPerWeek] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [timeBlock, setTimeBlock] = useState<TimeBlock>('4-6');
  // School selection removed from UI; default to 'Other' for pricing logic
  const school: School = 'Other';
  const [frequency, setFrequency] = useState<BillingFrequency>('monthly');
  const [extensionsEnabled, setExtensionsEnabled] = useState<boolean>(false);
  const [abacusEnabled, setAbacusEnabled] = useState<boolean>(false);
  const [chessPlan, setChessPlan] = useState<'none' | '1x' | '2x'>('none');
  // Independent registration add-on (+$90 one-time)
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(false);

  // Submission state
  const [submitted, setSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<{ child?: string; parent?: string; email?: string; total?: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || submitted) return;
    setIsSubmitting(true);
    const pricing = calculatePrice({ daysPerWeek, timeBlock, school, frequency, extensionsEnabled, abacusEnabled, registrationEnabled, chessPlan });
    const payload = {
      selectedOption,
      ...formData,
      phoneFull: `${formData.phoneCountry} ${formData.phone}`,
      emergencyPhoneFull: `${formData.emergencyPhoneCountry} ${formData.emergencyPhone}`,
      pricingInput: { daysPerWeek, timeBlock, school, frequency, extensionsEnabled, abacusEnabled, registrationEnabled, chessPlan },
      pricing,
      paymentMethod: formData.paymentMethod,
    } as const;

    console.log('Form submitted:', payload);

    try {
      const res = await fetch(`${apiBase}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form: payload,
          pricing,
          pricingInput: { daysPerWeek, timeBlock, school, frequency, extensionsEnabled, abacusEnabled, registrationEnabled, chessPlan },
          payment: {
            // Zelle fields
            zellePayerName: formData.zellePayerName,
            zelleConfirmation: formData.zelleConfirmation,
            // Credit card fields
            cardNumber: formData.cardNumber,
            cardExpiration: formData.cardExpiration,
            cardSecurityCode: formData.cardSecurityCode,
            cardZipCode: formData.cardZipCode,
            // General payment notes
            paymentNotes: formData.paymentNotes,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Email API error: ${res.status}`);
      }
      // Show thank-you screen with basic receipt details
      setReceipt({
        child: formData.childName,
        parent: formData.parentName,
        email: formData.email,
        total: pricing.totalForPeriod,
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to send email', err);
      alert('Submitted locally, but failed to send confirmation email. Please try again or contact us.');
      setIsSubmitting(false);
    }
  };

  const pricingOptions = [
    {
      id: '1day',
      title: '4–6 PM, 1 day a week',
      description: 'Great for trying us out',
      price: '$75/month'
    },
    {
      id: '2days',
      title: '4–6 PM, 2 days a week',
      description: 'Perfect for light afterschool support',
      price: '$150/month'
    },
    {
      id: '3days',
      title: '4–6 PM, 3 days a week',
      description: 'Balanced schedule for consistent learning',
      price: '$225/month'
    },
    {
      id: '4days',
      title: '4–6 PM, 4 days a week',
      description: 'More support throughout the week',
      price: '$300/month'
    },
    {
      id: '5days',
      title: '4–6 PM, 5 days a week',
      description: 'Full-week coverage',
      price: '$375/month',
      popular: true
    }
  ];

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard');
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const price = useMemo(() =>
    calculatePrice({ daysPerWeek, timeBlock, school, frequency, extensionsEnabled, abacusEnabled, registrationEnabled, chessPlan })
  , [daysPerWeek, timeBlock, school, frequency, extensionsEnabled, abacusEnabled, registrationEnabled, chessPlan]);

  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const qrPayload = useMemo(() => {
    const memo = `Afterschool - ${formData.childName || 'Child Name'} - ${formData.parentName || 'Parent Name'}`;
    return JSON.stringify({
      method: 'ZELLE',
      to: 'payments@exceedlearningcenterny.com',
      amount: Number(price.totalForPeriod.toFixed(2)),
      currency: 'USD',
      memo,
    });
  }, [formData.childName, formData.parentName, price.totalForPeriod]);

  const downloadQrPng = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zelle-payment-qr.png';
    a.click();
  };

  // Minimal country list with flags and dial codes (no external deps)
  const countries = [
    { code: 'US', flag: '🇺🇸', name: 'United States', dial: '+1' },
    { code: 'CA', flag: '🇨🇦', name: 'Canada', dial: '+1' },
    { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', dial: '+44' },
    { code: 'AU', flag: '🇦🇺', name: 'Australia', dial: '+61' },
    { code: 'IN', flag: '🇮🇳', name: 'India', dial: '+91' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-slate-800 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <img
            src="https://lirp.cdn-website.com/3bba8822/dms3rep/multi/opt/Exceed-learning-center-1920w.png"
            alt="Exceed Learning Center logo"
            className="mx-auto mb-4 h-16 md:h-20 w-auto"
          />
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Exceed Learning Center Registration Form</h1>
          <p className="text-slate-300 text-lg">Quality care and learning for your child</p>
        </div>
      </header>
      {/* Thank You Screen */}
      {submitted ? (
        <main className="max-w-3xl mx-auto px-4 py-16">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="mx-auto mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-rose-700 mb-3">Thank you for registering!</h2>
            <p className="text-gray-700 mb-6">We've received your submission and sent confirmation emails.</p>
            {receipt && (
              <div className="text-left inline-block bg-orange-50 border border-orange-200 rounded-lg p-6 w-full max-w-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Receipt</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li><span className="font-medium">Child:</span> {receipt.child || '-'}</li>
                  <li><span className="font-medium">Parent:</span> {receipt.parent || '-'}</li>
                  <li><span className="font-medium">Email:</span> {receipt.email || '-'}</li>
                  <li className="pt-2 border-t"><span className="font-medium">Total due this period:</span> ${receipt.total?.toFixed(2)}</li>
                </ul>
                <p className="text-xs text-gray-600 mt-3">Please send your Zelle payment to <span className="font-semibold">payments@exceedlearningcenterny.com</span> and include the memo: Afterschool - {formData.childName || 'Child Name'} - {formData.parentName || 'Parent Name'}</p>
              </div>
            )}
          </div>
        </main>
      ) : (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8 relative">
          <fieldset disabled={isSubmitting || submitted} className={isSubmitting ? 'opacity-60 pointer-events-none' : ''}>
          {/* Special Offer removed */}

          {/* Child Information (moved to top) */}
          <section className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-rose-700 mb-6">Child Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="childName" className="block text-sm font-medium text-gray-700 mb-2">
                  Child's Full Name *
                </label>
                <input
                  type="text"
                  id="childName"
                  name="childName"
                  value={formData.childName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="childDateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
                  Child's Date of Birth *
                </label>
                <input
                  type="date"
                  id="childDateOfBirth"
                  name="childDateOfBirth"
                  value={formData.childDateOfBirth}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="childGrade" className="block text-sm font-medium text-gray-700 mb-2">
                  Child's Grade *
                </label>
                <select
                  id="childGrade"
                  name="childGrade"
                  value={formData.childGrade}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                  required
                >
                  <option value="">Select grade</option>
                  <option value="Pre-K">Pre-K</option>
                  <option value="Kindergarten">Kindergarten</option>
                  <option value="1st Grade">1st Grade</option>
                  <option value="2nd Grade">2nd Grade</option>
                  <option value="3rd Grade">3rd Grade</option>
                  <option value="4th Grade">4th Grade</option>
                  <option value="5th Grade">5th Grade</option>
                  <option value="6th Grade">6th Grade</option>
                  <option value="7th Grade">7th Grade</option>
                  <option value="8th Grade">8th Grade</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="parentName" className="block text-sm font-medium text-gray-700 mb-2">
                  Parent/Guardian Name *
                </label>
                <input
                  type="text"
                  id="parentName"
                  name="parentName"
                  value={formData.parentName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="parentAddress" className="block text-sm font-medium text-gray-700 mb-2">
                  Parent Address *
                </label>
                <input
                  type="text"
                  id="parentAddress"
                  name="parentAddress"
                  value={formData.parentAddress}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                  placeholder="Street address, city, state, ZIP code"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <div className="flex gap-3">
                  <select
                    name="phoneCountry"
                    value={formData.phoneCountry}
                    onChange={handleInputChange}
                    className="px-3 py-3 border-2 border-orange-300 rounded-lg bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                    aria-label="Phone country code"
                  >
                    {countries.map(c => (
                      <option key={c.code} value={c.dial}>{`${c.flag} ${c.dial}`}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Name *
                </label>
                <input
                  type="text"
                  id="emergencyContact"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="emergencyPhone" className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Phone *
                </label>
                <div className="flex gap-3">
                  <select
                    name="emergencyPhoneCountry"
                    value={formData.emergencyPhoneCountry}
                    onChange={handleInputChange}
                    className="px-3 py-3 border-2 border-orange-300 rounded-lg bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                    aria-label="Emergency phone country code"
                  >
                    {countries.map(c => (
                      <option key={c.code} value={c.dial}>{`${c.flag} ${c.dial}`}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    id="emergencyPhone"
                    name="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none"
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-6 space-y-6">
              <div>
                <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-2">
                  Allergies or Medical Conditions
                </label>
                <textarea
                  id="allergies"
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none resize-vertical"
                  placeholder="Please list any allergies or medical conditions we should be aware of..."
                />
              </div>
              
              <div>
                <label htmlFor="specialInstructions" className="block text-sm font-medium text-gray-700 mb-2">
                  Special Instructions
                </label>
                <textarea
                  id="specialInstructions"
                  name="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 transition-colors duration-200 outline-none resize-vertical"
                  placeholder="Any additional information or special instructions for your child's care..."
                />
              </div>
            </div>
          </section>

          {/* Program Options */}
          <section className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-6">
              <Calendar className="w-6 h-6 text-rose-600 mr-3" />
              <h2 className="text-2xl font-bold text-rose-700">Choose Your Schedule</h2>
            </div>
            
            <div className="grid gap-4">
              {pricingOptions.map((option) => (
                <label key={option.id} className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="schedule"
                    value={option.id}
                    checked={selectedOption === option.id}
                    onChange={(e) => setSelectedOption(e.target.value)}
                    className="sr-only"
                    required
                  />
                  <div className={`border-2 rounded-lg p-4 transition-all duration-200 ${
                    selectedOption === option.id
                      ? 'border-rose-600 bg-rose-50 shadow-md'
                      : 'border-orange-300 hover:border-orange-400 hover:bg-orange-50'
                  } ${option.popular ? 'ring-2 ring-rose-200' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {option.title}
                          {option.popular && (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-600 text-white">
                              Most Popular
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-600 text-sm mb-2">{option.description}</p>
                        <p className="text-lg font-bold text-rose-700">{option.price}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedOption === option.id
                          ? 'border-rose-600 bg-rose-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedOption === option.id && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Pricing & Schedule (dynamic) */}
          <section className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-6">
              <DollarSign className="w-6 h-6 text-rose-600 mr-3" />
              <h2 className="text-2xl font-bold text-rose-700">Pricing & Schedule</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Extension Hours Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Extended Hours (Optional)</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border-2 border-orange-300 rounded-lg hover:border-orange-400 cursor-pointer">
                    <input
                      type="radio"
                      name="extensionHours"
                      value="none"
                      checked={!extensionsEnabled}
                      onChange={() => setExtensionsEnabled(false)}  
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-gray-900">No extended hours</span>
                  </label>
                  <label className="flex items-center justify-between gap-3 p-3 border-2 border-orange-300 rounded-lg hover:border-orange-400 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="extensionHours"
                        value="3-6"
                        checked={extensionsEnabled && timeBlock === '3-6'}
                        onChange={() => { setExtensionsEnabled(true); setTimeBlock('3-6'); }}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-gray-900">3-6 PM</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-rose-100 text-rose-700 border border-rose-200">$30 Additional fee</span>
                  </label>
                  <label className="flex items-center justify-between gap-3 p-3 border-2 border-orange-300 rounded-lg hover:border-orange-400 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="extensionHours"
                        value="4-7"
                        checked={extensionsEnabled && timeBlock === '4-7'}
                        onChange={() => { setExtensionsEnabled(true); setTimeBlock('4-7'); }}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-gray-900">4-7 PM</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-rose-100 text-rose-700 border border-rose-200">$30 Additional fee</span>
                  </label>
                  <label className="flex items-center justify-between gap-3 p-3 border-2 border-orange-300 rounded-lg hover:border-orange-400 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="extensionHours"
                        value="3-7"
                        checked={extensionsEnabled && timeBlock === '3-7'}
                        onChange={() => { setExtensionsEnabled(true); setTimeBlock('3-7'); }}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-gray-900">3-7 PM</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-rose-100 text-rose-700 border border-rose-200">$50 Additional fee</span>
                  </label>
                </div>
              </div>

              {/* Days per week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Days per Week</label>
                <select
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-100 outline-none"
                >
                  {[1,2,3,4,5].map(d => (
                    <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>
                  ))}
                </select>
                {/* School-specific discount hint removed */}
              </div>


              {/* Abacus add-on */}
              <div className="md:col-start-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-sm font-medium text-gray-700">Abacus classes</span>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={abacusEnabled} onChange={(e) => setAbacusEnabled(e.target.checked)} />
                    <span>Add Abacus <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-rose-100 text-rose-700 border border-rose-200">+$350/mo</span></span>
                  </label>
                </div>
                <p className="text-xs text-gray-600 mb-2">No 40% school or prepay discounts apply to Abacus.</p>
                <label className={`flex items-center gap-2 text-sm text-gray-700`}>
                  <input type="checkbox" checked={registrationEnabled} onChange={(e) => setRegistrationEnabled(e.target.checked)} />
                  <span>Add Registration <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700 border">+$90 one-time</span></span>
                </label>
              </div>

              {/* Chess add-on */}
              <div className="md:col-start-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-sm font-medium text-gray-700">Chess classes</span>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border-2 border-orange-300 rounded-lg hover:border-orange-400 cursor-pointer">
                    <input
                      type="radio"
                      name="chessPlan"
                      value="none"
                      checked={chessPlan === 'none'}
                      onChange={() => setChessPlan('none')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-gray-900">No chess</span>
                  </label>
                  <label className="flex items-center justify-between gap-3 p-3 border-2 border-orange-300 rounded-lg hover:border-orange-400 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="chessPlan"
                        value="1x"
                        checked={chessPlan === '1x'}
                        onChange={() => setChessPlan('1x')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-gray-900">1x/week</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-rose-100 text-rose-700 border border-rose-200">+$60/week</span>
                  </label>
                  <label className="flex items-center justify-between gap-3 p-3 border-2 border-orange-300 rounded-lg hover:border-orange-400 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="chessPlan"
                        value="2x"
                        checked={chessPlan === '2x'}
                        onChange={() => setChessPlan('2x')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-gray-900">2x/week</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-rose-100 text-rose-700 border border-rose-200">+$100/week</span>
                  </label>
                </div>
                <p className="text-xs text-gray-600 mt-2">No school or prepay discounts apply to Chess.</p>
              </div>

              {/* Billing frequency */}
              <div className="md:col-start-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Billing Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as BillingFrequency)}
                  className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-100 outline-none"
                >
                  <option value="weekly">Weekly (no prepay discount)</option>
                  <option value="monthly">Whole 1 Month — $10 off per week</option>
                  <option value="3months">3 Months — $25 off per week (3–5 days)</option>
                  <option value="6months">6 Months — $40 off per week (3–5 days)</option>
                  <option value="year">Full School Year (Sep–Jun) — $50 off per week (3–5 days)</option>
                </select>
                <p className="mt-2 text-xs text-gray-600">
                  Prepay discount this selection: <span className="font-semibold text-rose-700">${price.prepayDiscountWeekly.toFixed(2)}/week</span>.
                  {daysPerWeek < 3 && (frequency === '3months' || frequency === '6months' || frequency === 'year') && (
                    <span className="ml-1">Note: 3/6/Year discounts apply only for 3–5 days per week.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Weekly Breakdown</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li className="flex justify-between"><span>Base</span><span>${price.baseWeekly.toFixed(2)}</span></li>
                  <li className="flex justify-between"><span>Time add-ons</span><span>${price.addOnWeekly.toFixed(2)}</span></li>
                  {price.abacusWeekly > 0 && (
                    <li className="flex justify-between"><span>Abacus (no discounts)</span><span>${price.abacusWeekly.toFixed(2)}</span></li>
                  )}
                  {price.chessWeekly > 0 && (
                    <li className="flex justify-between"><span>Chess (no discounts)</span><span>${price.chessWeekly.toFixed(2)}</span></li>
                  )}
                  <li className="flex justify-between font-medium"><span>Subtotal (before discounts)</span><span>${(price.baseWeekly + price.addOnWeekly).toFixed(2)}</span></li>
                  <li className="flex justify-between"><span>School discount</span><span>- ${price.schoolDiscountWeekly.toFixed(2)}</span></li>
                  <li className="flex justify-between"><span>Prepay discount</span><span>- ${price.prepayDiscountWeekly.toFixed(2)}</span></li>
                </ul>
                <div className="mt-3 pt-3 border-t flex justify-between text-base font-bold text-rose-700">
                  <span>Final weekly</span>
                  <span>${price.finalWeekly.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Period Total</h3>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Weeks in period</span>
                  <span>{price.periodWeeks}</span>
                </div>
                {/* Afterschool + add-ons subtotals */}
                <div className="mt-2 flex justify-between text-sm text-gray-700">
                  <span>Afterschool subtotal</span>
                  <span>${(((price.baseWeekly + price.addOnWeekly) - price.schoolDiscountWeekly - price.prepayDiscountWeekly) * price.periodWeeks).toFixed(2)}</span>
                </div>
                {price.abacusWeekly > 0 && (
                  <div className="mt-2 flex justify-between text-sm text-gray-700">
                    <span>Abacus total</span>
                    <span>${(price.abacusWeekly * price.periodWeeks).toFixed(2)}</span>
                  </div>
                )}
                {price.chessWeekly > 0 && (
                  <div className="mt-2 flex justify-between text-sm text-gray-700">
                    <span>Chess total</span>
                    <span>${(price.chessWeekly * price.periodWeeks).toFixed(2)}</span>
                  </div>
                )}
                {price.registrationFee > 0 && (
                  <div className="mt-2 flex justify-between text-sm text-gray-700">
                    <span>One-time registration fee</span>
                    <span>${price.registrationFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t flex justify-between text-xl font-bold text-rose-700">
                  <span>Total</span>
                  <span>${price.totalForPeriod.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </section>


          {/* Payment Information */}
          <section className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-6">
              <DollarSign className="w-6 h-6 text-rose-600 mr-3" />
              <h2 className="text-2xl font-bold text-rose-700">Payment Information</h2>
            </div>

            {/* Payment Method Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method *</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="zelle"
                    checked={formData.paymentMethod === 'zelle'}
                    onChange={handleInputChange}
                    className="sr-only"
                    required
                  />
                  <div className={`border-2 rounded-lg p-3 text-center transition-all duration-200 ${
                    formData.paymentMethod === 'zelle'
                      ? 'border-rose-600 bg-rose-50 shadow-md'
                      : 'border-orange-300 hover:border-orange-400 hover:bg-orange-50'
                  }`}>
                    <div className="text-sm font-medium text-gray-900">Zelle</div>
                  </div>
                </label>
                <label className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="credit-card"
                    checked={formData.paymentMethod === 'credit-card'}
                    onChange={handleInputChange}
                    className="sr-only"
                    required
                  />
                  <div className={`border-2 rounded-lg p-3 text-center transition-all duration-200 ${
                    formData.paymentMethod === 'credit-card'
                      ? 'border-rose-600 bg-rose-50 shadow-md'
                      : 'border-orange-300 hover:border-orange-400 hover:bg-orange-50'
                  }`}>
                    <div className="text-sm font-medium text-gray-900">Credit Card</div>
                  </div>
                </label>
                <label className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={formData.paymentMethod === 'cash'}
                    onChange={handleInputChange}
                    className="sr-only"
                    required
                  />
                  <div className={`border-2 rounded-lg p-3 text-center transition-all duration-200 ${
                    formData.paymentMethod === 'cash'
                      ? 'border-rose-600 bg-rose-50 shadow-md'
                      : 'border-orange-300 hover:border-orange-400 hover:bg-orange-50'
                  }`}>
                    <div className="text-sm font-medium text-gray-900">Cash</div>
                  </div>
                </label>
                <label className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="check"
                    checked={formData.paymentMethod === 'check'}
                    onChange={handleInputChange}
                    className="sr-only"
                    required
                  />
                  <div className={`border-2 rounded-lg p-3 text-center transition-all duration-200 ${
                    formData.paymentMethod === 'check'
                      ? 'border-rose-600 bg-rose-50 shadow-md'
                      : 'border-orange-300 hover:border-orange-400 hover:bg-orange-50'
                  }`}>
                    <div className="text-sm font-medium text-gray-900">Check</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Zelle Payment Details */}
            {formData.paymentMethod === 'zelle' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Send to (Zelle email)</div>
                      <div className="text-lg font-bold text-rose-700">payments@exceedlearningcenterny.com</div>
                    </div>
                    <button type="button" onClick={() => handleCopy('payments@exceedlearningcenterny.com')} className="px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50">Copy</button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Amount (USD)</div>
                      <div className="text-lg font-bold text-rose-700">${price.totalForPeriod.toFixed(2)}</div>
                    </div>
                    <button type="button" onClick={() => handleCopy(price.totalForPeriod.toFixed(2))} className="px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50">Copy</button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Suggested memo</div>
                      <div className="text-sm font-medium text-gray-900 truncate">Afterschool - {formData.childName || 'Child Name'} - {formData.parentName || 'Parent Name'}</div>
                    </div>
                    <button type="button" onClick={() => handleCopy(`Afterschool - ${formData.childName || 'Child Name'} - ${formData.parentName || 'Parent Name'}`)} className="px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50">Copy</button>
                  </div>
                  <p className="text-xs text-gray-600">Please include the memo so we can match your payment quickly.</p>

                  {/* QR code with payment payload */}
                  <div className="mt-2">
                    <div className="text-sm text-gray-600 mb-2">Scan to copy payment details</div>
                    <div className="flex items-center gap-4">
                      <QRCodeCanvas value={qrPayload} size={144} includeMargin level="M" ref={qrRef as any} />
                      <button type="button" onClick={downloadQrPng} className="px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50">Download QR</button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">QR encodes: recipient email, amount, currency, and memo.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="zellePayerName" className="block text-sm font-medium text-gray-700 mb-2">Zelle account name (payer)</label>
                    <input id="zellePayerName" name="zellePayerName" value={formData.zellePayerName} onChange={handleInputChange} className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 outline-none" placeholder="Name shown on Zelle" />
                  </div>
                  <div>
                    <label htmlFor="zelleConfirmation" className="block text-sm font-medium text-gray-700 mb-2">Zelle confirmation number (optional)</label>
                    <input id="zelleConfirmation" name="zelleConfirmation" value={formData.zelleConfirmation} onChange={handleInputChange} className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 outline-none" placeholder="e.g., ABC12345" />
                  </div>
                  <p className="text-xs text-gray-600">Zelle is processed through your bank app. After sending, please submit this form.</p>
                </div>
              </div>
            )}

            {/* Credit Card Payment Details */}
            {formData.paymentMethod === 'credit-card' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Credit Card Information</h3>
                <p className="text-sm text-gray-700 mb-4">To pay by credit card, please write down your card information below. The admins will receive your credit card details and process the payment manually.</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-2">Card Number *</label>
                    <input
                      type="text"
                      id="cardNumber"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 outline-none"
                      placeholder="1234 5678 9012 3456"
                      required={formData.paymentMethod === 'credit-card'}
                    />
                  </div>
                  <div>
                    <label htmlFor="cardExpiration" className="block text-sm font-medium text-gray-700 mb-2">Expiration Date *</label>
                    <input
                      type="text"
                      id="cardExpiration"
                      name="cardExpiration"
                      value={formData.cardExpiration}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 outline-none"
                      placeholder="MM/YY"
                      required={formData.paymentMethod === 'credit-card'}
                    />
                  </div>
                  <div>
                    <label htmlFor="cardSecurityCode" className="block text-sm font-medium text-gray-700 mb-2">Security Code *</label>
                    <input
                      type="text"
                      id="cardSecurityCode"
                      name="cardSecurityCode"
                      value={formData.cardSecurityCode}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 outline-none"
                      placeholder="123"
                      required={formData.paymentMethod === 'credit-card'}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="cardZipCode" className="block text-sm font-medium text-gray-700 mb-2">ZIP Code *</label>
                    <input
                      type="text"
                      id="cardZipCode"
                      name="cardZipCode"
                      value={formData.cardZipCode}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 outline-none"
                      placeholder="12345"
                      required={formData.paymentMethod === 'credit-card'}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3">Your credit card information will be sent securely to our admins who will process the payment manually. Total amount: <span className="font-bold text-rose-700">${price.totalForPeriod.toFixed(2)}</span></p>
              </div>
            )}

            {/* Cash Payment Details */}
            {formData.paymentMethod === 'cash' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Cash Payment</h3>
                <p className="text-gray-700 mb-2">Total amount due: <span className="font-bold text-rose-700">${price.totalForPeriod.toFixed(2)}</span></p>
                <p className="text-sm text-gray-600">Please bring cash payment to the center. We will provide a receipt upon payment.</p>
              </div>
            )}

            {/* Check Payment Details */}
            {formData.paymentMethod === 'check' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Check Payment</h3>
                <p className="text-gray-700 mb-2">Total amount due: <span className="font-bold text-rose-700">${price.totalForPeriod.toFixed(2)}</span></p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Make check payable to: <span className="font-semibold">Exceed Learning Center</span></p>
                  <p>Memo: Afterschool - {formData.childName || 'Child Name'} - {formData.parentName || 'Parent Name'}</p>
                  <p className="mt-2">Please mail or bring the check to our center.</p>
                </div>
              </div>
            )}

            {/* Payment Notes (for all methods) */}
            <div className="mt-6">
              <label htmlFor="paymentNotes" className="block text-sm font-medium text-gray-700 mb-2">Payment Notes (optional)</label>
              <textarea
                id="paymentNotes"
                name="paymentNotes"
                value={formData.paymentNotes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-rose-600 focus:ring-2 focus:ring-rose-100 outline-none resize-vertical"
                placeholder="Any additional payment-related notes or instructions"
              />
            </div>
          </section>

          {/* Terms and Conditions */}
          <section className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-6">
              <FileText className="w-6 h-6 text-rose-600 mr-3" />
              <h2 className="text-2xl font-bold text-rose-700">Terms and Conditions</h2>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-rose-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Cancellation requires 30-day advance notice to avoid charges for the following month.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-rose-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Monthly payments must be completed by the 5th of every month to avoid late charges.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-rose-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Late payments may result in additional fees and temporary suspension of services.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-rose-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>No refunds for payments made.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-rose-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>No-shows or cancellations made less than 24 hours before a session will be charged the full session amount. No make-up lessons.</span>
                </li>
              </ul>
              
              <div className="mt-6 p-4 bg-white rounded-lg border">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 mr-3 w-4 h-4 text-rose-600 border-2 border-orange-300 rounded focus:ring-rose-500"
                  />
                  <span className="text-sm text-gray-700">
                    I have read and agree to the terms and conditions outlined above. I understand the payment schedule and cancellation policy.
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex flex-col items-center text-center">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={`inline-flex items-center justify-center px-6 py-3 rounded-lg text-white font-semibold transition-colors ${isSubmitting ? 'bg-green-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6 mr-3" />
                  Complete Registration
                </>
              )}
            </button>
            <p className="text-sm text-gray-600 mt-4">
              By submitting this form, you're enrolling your child in our afterschool program.
            </p>
          </div>
          </fieldset>
          {isSubmitting && (
            <div className="absolute inset-0 rounded-xl" aria-hidden>
              {/* Transparent overlay to block clicks even if CSS classes fail somewhere */}
            </div>
          )}
        </form>
      </main>
      )}

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-8 px-4 mt-16">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-300">Questions? Contact our support team at</p>
          <p className="mt-1">
            <a href="mailto:help@exceedlearningcenterny.com" className="text-orange-300 underline">help@exceedlearningcenterny.com</a>
          </p>
          <p className="mt-1 text-slate-300">Or call <a href="tel:15162263173" className="text-orange-300 underline">516‑226‑3173</a></p>
        </div>
      </footer>
    </div>
  );
}

export default App;