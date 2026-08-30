'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFeederStore } from '@/store/feeder-store';
import {
  User,
  Car,
  Shield,
  Phone,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoginScreen() {
  const login = useFeederStore(s => s.login);
  const [selectedRole, setSelectedRole] = useState<'passenger' | 'driver' | 'admin' | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState(false);

  function handleSendOtp() {
    if (phone.trim().length < 10) {
      setError(true);
      return;
    }
    setError(false);
    setOtpSent(true);
    // In production, this calls POST /auth/otp/send which triggers an SMS
  }

  function handleVerifyOtp() {
    if (otp.length < 4) {
      setError(true);
      return;
    }
    // In production, this calls POST /auth/otp/verify which returns a JWT
    login(selectedRole!);
  }

  function handleAdminLogin() {
    if (adminCode === 'msafiri2026') {
      login('admin');
    } else {
      setError(true);
    }
  }

  function reset() {
    setSelectedRole(null);
    setPhone('');
    setOtp('');
    setOtpSent(false);
    setAdminCode('');
    setError(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header with logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl mb-6"
        >
          <img src="/msafiri-logo.png" alt="msafiri" className="w-full h-full object-cover" />
        </motion.div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">msafiri</h1>
        <p className="text-sm text-muted-foreground mb-8">Ride · Connect · Journey</p>

        {/* Role selection */}
        {!selectedRole && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm space-y-3"
          >
            <p className="text-center text-sm text-muted-foreground mb-4">
              Who are you logging in as?
            </p>
            <RoleCard
              icon={<User className="w-5 h-5" />}
              title="Passenger"
              desc="Book a cab to or from the terminus"
              onClick={() => setSelectedRole('passenger')}
            />
            <RoleCard
              icon={<Car className="w-5 h-5" />}
              title="Driver"
              desc="See your assigned trips and passengers"
              onClick={() => setSelectedRole('driver')}
            />
            <RoleCard
              icon={<Shield className="w-5 h-5" />}
              title="Admin"
              desc="Operations console (restricted access)"
              onClick={() => setSelectedRole('admin')}
              variant="admin"
            />
          </motion.div>
        )}

        {/* Passenger / Driver login — phone + OTP */}
        {selectedRole && selectedRole !== 'admin' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full max-w-sm space-y-4"
          >
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs font-medium">
                {selectedRole === 'passenger' ? <User className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
                {selectedRole === 'passenger' ? 'Passenger' : 'Driver'} login
              </div>
            </div>

            {!otpSent ? (
              <>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone number
                  </Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(false); }}
                    placeholder="+254 712 345 678"
                    className="h-11"
                    autoFocus
                  />
                </div>
                {error && <p className="text-xs text-destructive">Enter a valid phone number</p>}
                <Button className="w-full h-11" onClick={handleSendOtp}>
                  Send OTP <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">
                    Enter the OTP sent to {phone}
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value); setError(false); }}
                    placeholder="••••••"
                    className="h-11 text-center text-lg tracking-[0.5em]"
                    autoFocus
                  />
                </div>
                {error && <p className="text-xs text-destructive">Enter the 4-6 digit code</p>}
                <Button className="w-full h-11" onClick={handleVerifyOtp}>
                  Verify & login <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                <p className="text-[10px] text-center text-muted-foreground">
                  Demo: any OTP works. In production, this is sent via SMS.
                </p>
              </>
            )}

            <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              ← Back to role selection
            </button>
          </motion.div>
        )}

        {/* Admin login — access code */}
        {selectedRole === 'admin' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full max-w-sm space-y-4"
          >
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs font-medium">
                <Shield className="w-3.5 h-3.5" /> Admin login
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Lock className="w-3 h-3" /> Access code
              </Label>
              <Input
                type="password"
                value={adminCode}
                onChange={(e) => { setAdminCode(e.target.value); setError(false); }}
                placeholder="Enter admin access code"
                className={cn('h-11', error && 'border-destructive')}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              />
            </div>
            {error && <p className="text-xs text-destructive">Incorrect access code</p>}
            <Button className="w-full h-11" onClick={handleAdminLogin}>
              Enter admin console <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              In production: separate subdomain + email/password + 2FA
            </p>
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              ← Back to role selection
            </button>
          </motion.div>
        )}
      </div>

      <div className="px-6 py-4 text-center text-[10px] text-muted-foreground">
        msafiri · Mombasa Terminus · Kenya Coast
      </div>
    </div>
  );
}

function RoleCard({ icon, title, desc, onClick, variant }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void; variant?: 'admin';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-4 rounded-2xl border bg-card transition-all hover:shadow-md hover:border-accent/30 text-left',
        variant === 'admin' && 'border-violet-200 bg-violet-50/30',
      )}
    >
      <div className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
        variant === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-primary/10 text-primary',
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
