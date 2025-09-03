import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App form', () => {
  const user = userEvent.setup();
  const originalAlert = window.alert;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    window.alert = vi.fn();
    console.log = vi.fn();
  });

  afterEach(() => {
    window.alert = originalAlert;   
    console.log = originalConsoleLog;
  });

  it('fills out and submits the form with country codes', async () => {
    render(<App />);

    // Select a schedule option (first radio)
    const radios = screen.getAllByRole('radio', { name: /4–5 PM/i });
    await user.click(radios[0]);

    // Fill child and parent info
    await user.type(screen.getByLabelText("Child's Full Name *"), 'Alice Johnson');
    await user.type(screen.getByLabelText('Parent/Guardian Name *'), 'Mary Johnson');
    await user.type(screen.getByLabelText('Email Address *'), 'mary@example.com');

    // Phone number with country code select (aria-label used)
    const phoneCountry = screen.getByLabelText('Phone country code');
    await user.selectOptions(phoneCountry, '+44'); // United Kingdom
    await user.type(screen.getByLabelText('Phone Number *'), '7123456789');

    // Emergency contact and phone
    await user.type(screen.getByLabelText('Emergency Contact Name *'), 'John Doe');
    const emergencyCountry = screen.getByLabelText('Emergency phone country code');
    await user.selectOptions(emergencyCountry, '+61'); // Australia
    await user.type(screen.getByLabelText('Emergency Contact Phone *'), '401234567');

    // Optional fields
    await user.type(screen.getByLabelText('Allergies or Medical Conditions'), 'None');
    await user.type(screen.getByLabelText('Special Instructions'), 'N/A');

    // Agree to terms (checkbox inside label)
    const termsCheckbox = screen.getByRole('checkbox');
    await user.click(termsCheckbox);

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Complete Registration/i });
    await user.click(submitBtn);

    // Assert alert was shown (wrap in waitFor to satisfy act)
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });

    // Assert console.log captured composed phone numbers (also in waitFor)
    await waitFor(() => {
      expect(console.log).toHaveBeenCalled();
      const calls: any[][] = (console.log as any).mock.calls ?? [];
      const payload = calls.find((call) => String(call[0]).includes('Form submitted:'))?.[1];
      expect(payload).toBeTruthy();
      expect(payload.phoneFull).toBe('+44 7123456789');
      expect(payload.emergencyPhoneFull).toBe('+61 401234567');
    });
  });
});
