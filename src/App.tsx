import React, { useState } from 'react';
import { CheckCircle2, Calendar, DollarSign, FileText } from 'lucide-react';

function App() {
  const [selectedOption, setSelectedOption] = useState('');
  const [formData, setFormData] = useState({
    childName: '',
    parentName: '',
    email: '',
    phoneCountry: '+1',
    phone: '',
    emergencyContact: '',
    emergencyPhoneCountry: '+1',
    emergencyPhone: '',
    allergies: '',
    specialInstructions: ''
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log('Form submitted:', {
      selectedOption,
      ...formData,
      phoneFull: `${formData.phoneCountry} ${formData.phone}`,
      emergencyPhoneFull: `${formData.emergencyPhoneCountry} ${formData.emergencyPhone}`,
    });
    alert('Thank you for your registration! We will contact you shortly.');
  };

  const pricingOptions = [
    {
      id: '2days',
      title: '4–5 PM, 2 days a week',
      description: 'Perfect for light afterschool support',
      price: '$120/month'
    },
    {
      id: '3days',
      title: '4–5 PM, 3 days a week',
      description: 'Balanced schedule for consistent learning',
      price: '$160/month'
    },
    {
      id: '4days',
      title: '4–5 PM, 4 days a week — get 5th day free',
      description: 'Best value with bonus day included',
      price: '$200/month',
      popular: true
    }
  ];

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
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Afterschool Program Signup</h1>
          <p className="text-slate-300 text-lg">Quality care and learning for your child</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Special Offer Notice */}
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-4">
              <CheckCircle2 className="w-6 h-6 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-rose-700 mb-2">
              Searingtown Elementary School Special
            </h2>
            <p className="text-xl font-semibold text-orange-800">50% Off First Month!</p>
            <p className="text-orange-700 mt-2">Exclusive discount for Searingtown families</p>
          </div>

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

          {/* Child Information */}
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

          {/* Payment Information (temporarily hidden) */}
          {false && (
            <section className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-6">
                <DollarSign className="w-6 h-6 text-rose-600 mr-3" />
                <h2 className="text-2xl font-bold text-rose-700">Payment Information</h2>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Zelle Payment Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
                    <span className="text-gray-700 font-medium">Zelle Number:</span>
                    <span className="text-xl font-bold text-rose-700">718-683-1750</span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">
                    <strong>Instructions:</strong> Connect to Zelle account of Olga. If any verification is requested during the transfer, please message Olga directly for assistance.
                  </p>
                </div>
              </div>
            </section>
          )}

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
                  <span>Monthly payments must be completed by the 15th of every month to avoid late charges.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-rose-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  <span>Late payments may result in additional fees and temporary suspension of services.</span>
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
          <div className="text-center">
            <button
              type="submit"
              className="inline-flex items-center px-12 py-4 bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-700 hover:to-orange-600 text-white font-bold text-lg rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-rose-300"
            >
              <CheckCircle2 className="w-6 h-6 mr-3" />
              Complete Registration
            </button>
            <p className="text-sm text-gray-600 mt-4">
              By submitting this form, you're enrolling your child in our afterschool program.
            </p>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-8 px-4 mt-16">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-300">
            Questions? Contact Olga at <strong className="text-orange-300">718-683-1750</strong>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;