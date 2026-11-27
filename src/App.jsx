import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  LogOut,
  Users,
  UserPlus,
  Search,
  MessageCircle,
  Phone,
  RefreshCw,
  Trash2,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  X,
  Receipt,
  Dumbbell,
  Download,
  Building2,
  Mail,
  Clock,
  CalendarDays,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Bell,
  UserCheck,
  PauseCircle,
  Wallet,
  Rocket,
  KeyRound,
  ShieldCheck,
  Loader2,
  FileText,
  Pencil,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from './supabaseClient';

const APP_VERSION = '1.2.0';

const UPCOMING_FEATURES = [
  {
    id: 'feat_attendance',
    title: "Member's Attendance",
    stage: 'Pilot Next',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Fast check-in by phone or QR code, daily batch headcount, and alerts for members absent for 10+ days.',
    icon: UserCheck
  },
  {
    id: 'feat_staff_logins',
    title: 'Admin/Manager Logins',
    stage: 'Planned',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Separate staff access for front-desk managers or trainers to handle check-ins, joins, and renewals with role-based limits.',
    icon: ShieldCheck
  },
  {
    id: 'feat_notifications',
    title: 'Notifications Alert',
    stage: 'Pilot Next',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Email due alerts and daily owner digest for memberships entering the 5-day Yellow window or going Red.',
    icon: Bell
  },
  {
    id: 'feat_freeze',
    title: 'Membership Freeze / Pause',
    stage: 'Planned',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Pause plans during travel or recovery and automatically shift the expiry date forward.',
    icon: PauseCircle
  },
  {
    id: 'feat_pt',
    title: 'Personal Training (PT) & Batch Cap',
    stage: 'Planned',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Track PT session balances and monitor morning/evening batch capacity.',
    icon: Dumbbell
  },
  {
    id: 'feat_expenses',
    title: 'Expense & Utility Tracker',
    stage: 'Later',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Log rent, electricity, and maintenance alongside fee collections to view monthly net surplus.',
    icon: Wallet
  }
];

function calculateDaysLeft(expiryDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getMemberStatus(expiryDateStr) {
  const days = calculateDaysLeft(expiryDateStr);
  if (days < 0) {
    return {
      status: 'RED',
      label: `Overdue (${Math.abs(days)}d ago)`,
      badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200',
      dotColor: 'bg-rose-500'
    };
  }
  if (days <= 5) {
    return {
      status: 'YELLOW',
      label: days === 0 ? 'Expires Today' : `Due in ${days}d`,
      badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
      dotColor: 'bg-amber-500'
    };
  }
  return {
    status: 'GREEN',
    label: `${days} days left`,
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500'
  };
}

function getWhatsAppLink(member, gymName, type = 'reminder', extra = {}) {
  let cleanPhone = (member.phone || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

  let message = '';
  if (type === 'welcome') {
    message = `Hello ${member.name}! \n\nWelcome to *${gymName}*! Your membership is now active.\n• Batch: *${member.batch || 'General Access'}*\n• Valid Till: *${member.expiryDate}*\n• Paid: *₹${member.feeAmount}* (${member.paymentMode || 'UPI'})\n\nLet's get to work!`;
  } else if (type === 'renewal') {
    message = `Hello ${member.name}! \n\nYour membership at *${gymName}* has been renewed.\n• Plan: *${extra.planLabel || `${member.planMonths} Month(s)`}*\n• New Expiry: *${member.expiryDate}*\n• Paid: *₹${member.feeAmount}* (${member.paymentMode || 'UPI'})\n\nThank you for training with us!`;
  } else {
    message = `Hello ${member.name}! \n\nThis is a friendly reminder from *${gymName}*.\nYour gym membership fee of *₹${member.feeAmount}* is due on *${member.expiryDate}*.\n\nKindly renew via UPI or Cash to continue workouts`;
  }

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function formatMonthLabel(ym) {
  if (ym === 'ALL') return 'All Records';
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export default function App() {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  useEffect(() => {
    const seenVersion = localStorage.getItem('gym_register_version');
    if (!seenVersion) {
      localStorage.setItem('gym_register_version', APP_VERSION);
      return;
    }
    if (seenVersion !== APP_VERSION) {
      setShowUpdateBanner(true);
    }
  }, []);

  const handleApplyUpdate = () => {
    localStorage.setItem('gym_register_version', APP_VERSION);
    setShowUpdateBanner(false);
    window.location.reload();
  };
  // Auth & Session State
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [gymProfile, setGymProfile] = useState(null);

  // Auth Screens: 'login' | 'register' | 'verify_otp'
  const [authScreen, setAuthScreen] = useState('login');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState('otp'); // 'otp' | 'password'
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');

  // Login Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Gym Fields
  const [regGymName, setRegGymName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regGst, setRegGst] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // OTP Verification State
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpType, setOtpType] = useState('email'); // 'signup' | 'email'
  const [showPassword, setShowPassword] = useState(false);

  // App Data State
  const [members, setMembers] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState('my_gym');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [votedFeatures, setVotedFeatures] = useState(() => {
    const saved = localStorage.getItem('gym_feature_votes');
    return saved ? JSON.parse(saved) : ['feat_attendance', 'feat_notifications'];
  });

  // Dynamic Gym Batches (Synced per Gym via Supabase)
      const DEFAULT_BATCHES = ['Morning (6 AM - 10 AM)', 'Evening (4 PM - 9 PM)', 'General Access'];
      const [batches, setBatches] = useState(DEFAULT_BATCHES);
      const [isAddingBatch, setIsAddingBatch] = useState(false);
      const [newBatchName, setNewBatchName] = useState('');

      useEffect(() => {
        if (Array.isArray(gymProfile?.batches) && gymProfile.batches.length > 0) {
          setBatches(gymProfile.batches);
        } else {
          setBatches(DEFAULT_BATCHES);
        }
      }, [gymProfile?.id, gymProfile?.batches]);

      const persistBatchesToSupabase = async (nextBatches) => {
        setBatches(nextBatches);
        if (!gymProfile?.id) return;

        const { data, error } = await supabase
          .from('gyms')
          .update({ batches: nextBatches })
          .eq('id', gymProfile.id)
          .select()
          .single();

        if (error) {
          showToast('Failed to sync slot: ' + error.message);
          return;
        }
        if (data && typeof setGymProfile === 'function') {
          setGymProfile(data);
        }
      };

      const handleAddCustomBatch = async (e) => {
        e.preventDefault();
        const trimmed = newBatchName.trim();
        if (!trimmed) return;
        if (batches.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
          showToast('This batch already exists.');
          return;
        }
        const nextBatches = [...batches, trimmed];
        setNewBatchName('');
        setIsAddingBatch(false);
        await persistBatchesToSupabase(nextBatches);
        showToast(`Added slot: ${trimmed}`);
      };

      const handleDeleteBatch = async (batchToDelete) => {
        if (batches.length <= 1) {
          showToast('You must keep at least one batch slot.');
          return;
        }
        const memberCount = members.filter((m) => (m.batch || 'General Access') === batchToDelete).length;
        if (memberCount > 0) {
          const confirmRemove = window.confirm(
            `"${batchToDelete}" currently has ${memberCount} member(s). Removing it from list will not delete those members, but it will no longer appear in new selections. Proceed?`
          );
          if (!confirmRemove) return;
        }
        const nextBatches = batches.filter((b) => b !== batchToDelete);
        await persistBatchesToSupabase(nextBatches);
        showToast(`Removed slot: ${batchToDelete}`);
      };
  
  // Modals & Notifications
  const [renewModalMember, setRenewModalMember] = useState(null);
  const [historyModalMember, setHistoryModalMember] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [welcomeModalData, setWelcomeModalData] = useState(null);
const [customWelcomeText, setCustomWelcomeText] = useState('');

  // Renewal Form State
  const [renewPlanMonths, setRenewPlanMonths] = useState(1);
  const [renewAmount, setRenewAmount] = useState(800);
  const [renewMode, setRenewMode] = useState('UPI');
  const [renewIsCustomDate, setRenewIsCustomDate] = useState(false);
  const [renewCustomExpiry, setRenewCustomExpiry] = useState('');
  // Edit Member Modal State
  const [editModalMember, setEditModalMember] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBatch, setEditBatch] = useState('Morning (6 AM - 10 AM)');
  const [editGender, setEditGender] = useState('Male');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editFeeAmount, setEditFeeAmount] = useState(800);
  const [editPaymentMode, setEditPaymentMode] = useState('UPI');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  useEffect(() => {
    localStorage.setItem('gym_feature_votes', JSON.stringify(votedFeatures));
  }, [votedFeatures]);

  // Listen to Supabase Auth Session
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(currentSession);
        setAuthLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (mounted) {
        setSession(newSession);
        if (event === 'PASSWORD_RECOVERY') {
          setIsResettingPassword(true);
        }
        if (!newSession) {
          setGymProfile(null);
          setMembers([]);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load (or auto-create) Gym Profile & Members once authenticated
  useEffect(() => {
    if (!session?.user) return;
    let isMounted = true;
    let isCreatingGym = false;

    async function loadGymAndMembers() {
      setDataLoading(true);
      const user = session.user;

      // 1. Check if gym row already exists for this owner
      let { data: existingGym, error: gymError } = await supabase
        .from('gyms')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      // 2. If not found yet (first login after signup OTP), create it using saved signup details
      if (!existingGym && !gymError && !isCreatingGym) {
        isCreatingGym = true;
        const savedPending = localStorage.getItem('pending_gym_registration');
        const pendingObj = savedPending ? JSON.parse(savedPending) : {};
        const meta = user.user_metadata || {};

        const newGymPayload = {
          owner_id: user.id,
          gym_name: pendingObj.gym_name || meta.gym_name || 'My Gym',
          owner_name: pendingObj.owner_name || meta.owner_name || 'Gym Owner',
          email: user.email || pendingObj.email || '',
          phone: pendingObj.phone || meta.phone || '',
          gst_number: pendingObj.gst_number || meta.gst_number || ''
        };

        const { data: createdGym, error: createError } = await supabase
          .from('gyms')
          .insert([newGymPayload])
          .select()
          .maybeSingle();

        if (!createError && createdGym) {
          existingGym = createdGym;
          localStorage.removeItem('pending_gym_registration');
        } else if (createError) {
          const { data: retryGym } = await supabase
            .from('gyms')
            .select('*')
            .eq('owner_id', user.id)
            .maybeSingle();
          existingGym = retryGym;
        }
        isCreatingGym = false;
      }

      if (!isMounted) return;
      setGymProfile(existingGym || null);

      // 3. Load this gym's members
      if (existingGym) {
        const { data: memberRows, error: memError } = await supabase
          .from('members')
          .select('*')
          .eq('gym_id', existingGym.id)
          .order('created_at', { ascending: false });

        if (!isMounted) return;

        if (!memError && Array.isArray(memberRows)) {
          const normalized = memberRows.map((row) => ({
            id: row.id,
            name: row.name,
            phone: row.phone,
            email: row.email || '',
            batch: row.batch || 'General Access',
            planMonths: row.plan_months ?? 1,
            feeAmount: Number(row.fee_amount ?? 0),
            startDate: row.start_date || new Date().toISOString().split('T')[0],
            expiryDate: row.expiry_date || new Date().toISOString().split('T')[0],
            paymentMode: row.payment_mode || 'UPI',
            emergencyContact: row.emergency_contact || '',
            bloodGroup: row.blood_group || '',
            gender: row.gender || '',
            notes: row.notes || '',
            history: Array.isArray(row.history) ? row.history : []
          }));
          setMembers(normalized);
        }
      }

      if (isMounted) setDataLoading(false);
    }

    loadGymAndMembers();
    return () => {
      isMounted = false;
    };
  }, [session]);

  // --- AUTH HANDLERS ---

  const handleRegisterGym = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthInfo('');

    if (regPhone.length !== 10) {
      setAuthError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (regPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthSubmitting(true);

    const pendingData = {
      gym_name: regGymName.trim(),
      owner_name: regOwnerName.trim(),
      phone: regPhone.trim(),
      email: regEmail.trim().toLowerCase(),
      gst_number: regGst.trim().toUpperCase()
    };

    localStorage.setItem('pending_gym_registration', JSON.stringify(pendingData));

    const { data, error } = await supabase.auth.signUp({
      email: pendingData.email,
      password: regPassword,
      options: {
        data: pendingData
      }
    });

    setAuthSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    // If Supabase returned an active session immediately (when email confirmation is OFF)
    if (data?.session) {
      showToast('Gym registered and signed in!');
      return;
    }

    // Standard flow: OTP sent to email
    setOtpEmail(pendingData.email);
    setOtpType('signup');
    setOtpCode('');
    setAuthInfo(`A 6-digit verification OTP has been sent to ${pendingData.email}.`);
    setAuthScreen('verify_otp');
  };

  const handleForgotPassword = async () => {
    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setAuthError('Please enter your registered email address first.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError('');
    setAuthInfo('');
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    setAuthSubmitting(false);
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthInfo(`Password reset instructions have been sent to ${cleanEmail}.`);
    }
  };

  const handleUpdateNewPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setAuthError('New password must be at least 6 characters.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError('');

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    setAuthSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setIsResettingPassword(false);
    setNewPassword('');
    showToast('Password updated successfully!');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthInfo('');
    const cleanEmail = loginEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setAuthError('Please enter your registered email address.');
      return;
    }

    setAuthSubmitting(true);

    if (loginMethod === 'password') {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: loginPassword
      });
      setAuthSubmitting(false);

      if (error) {
        setAuthError(error.message);
        return;
      }
      showToast('Signed in successfully!');
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false
        }
      });
      setAuthSubmitting(false);

      if (error) {
        if (error.message.toLowerCase().includes('signups not allowed')) {
          setAuthError('No gym registered with this email. Tap "Register My Gym" below.');
        } else {
          setAuthError(error.message);
        }
        return;
      }

      setOtpEmail(cleanEmail);
      setOtpType('email');
      setOtpCode('');
      setAuthInfo(`Login OTP sent to ${cleanEmail}. Check your inbox or spam folder.`);
      setAuthScreen('verify_otp');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (otpCode.trim().length < 6) {
      setAuthError('Please enter the 6-digit OTP sent to your email.');
      return;
    }

    setAuthSubmitting(true);

    const { error } = await supabase.auth.verifyOtp({
      email: otpEmail,
      token: otpCode.trim(),
      type: otpType
    });

    setAuthSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    showToast(otpType === 'signup' ? 'Gym Verified & Registered!' : 'Logged in successfully!');
  };

  const handleResendOtp = async () => {
    setAuthError('');
    setAuthInfo('');
    setAuthSubmitting(true);

    let res;
    if (otpType === 'signup') {
      res = await supabase.auth.resend({
        type: 'signup',
        email: otpEmail
      });
    } else {
      res = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: { shouldCreateUser: false }
      });
    }

    setAuthSubmitting(false);
    if (res.error) {
      setAuthError(res.error.message);
    } else {
      setAuthInfo(`New OTP sent to ${otpEmail}.`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthScreen('login');
    setAuthError('');
    setAuthInfo('');
    showToast('Logged out securely.');
  };

  // --- ANALYTICS & MEMBERS ---

  const monthOptions = useMemo(() => {
    const monthsSet = new Set();
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(ym);
    }
    members.forEach((m) => {
      (m.history || []).forEach((tx) => {
        if (tx.date && tx.date.length >= 7) {
          monthsSet.add(tx.date.substring(0, 7));
        }
      });
    });

    const sorted = Array.from(monthsSet).sort((a, b) => (a < b ? 1 : -1));
    return [
      ...sorted.map((ym) => ({ value: ym, label: formatMonthLabel(ym) })),
      { value: 'ALL', label: 'All Records' }
    ];
  }, [members]);

  const monthlyAnalytics = useMemo(() => {
    let joinedCount = 0;
    let joinedAmount = 0;
    let renewedCount = 0;
    let renewedAmount = 0;
    let upiTotal = 0;
    let cashTotal = 0;

    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    members.forEach((m) => {
      const { status } = getMemberStatus(m.expiryDate);
      if (status === 'GREEN') greenCount++;
      if (status === 'YELLOW') yellowCount++;
      if (status === 'RED') redCount++;

      (m.history || []).forEach((tx) => {
        const txMonth = tx.date ? tx.date.substring(0, 7) : '';
        const match = selectedMonth === 'ALL' || txMonth === selectedMonth;

        if (match) {
          const amt = Number(tx.amount || 0);
          if (tx.type === 'RENEW') {
            renewedCount++;
            renewedAmount += amt;
          } else {
            joinedCount++;
            joinedAmount += amt;
          }

          if (tx.mode === 'Cash') {
            cashTotal += amt;
          } else {
            upiTotal += amt;
          }
        }
      });
    });

    return {
      totalMembers: members.length,
      greenCount,
      yellowCount,
      redCount,
      joinedCount,
      joinedAmount,
      renewedCount,
      renewedAmount,
      totalMonthRevenue: joinedAmount + renewedAmount,
      upiTotal,
      cashTotal
    };
  }, [members, selectedMonth]);

  const handleExportCSV = () => {
    const rows = [
      ['Date', 'Member Name', 'Phone', 'Batch', 'Type', 'Plan', 'Amount (INR)', 'Payment Mode']
    ];

    members.forEach((m) => {
      (m.history || []).forEach((h) => {
        const txMonth = h.date ? h.date.substring(0, 7) : '';
        if (selectedMonth === 'ALL' || txMonth === selectedMonth) {
          rows.push([
            h.date,
            `"${m.name}"`,
            m.phone,
            `"${m.batch || 'General Access'}"`,
            h.type || 'JOIN',
            `"${h.plan}"`,
            h.amount,
            h.mode
          ]);
        }
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    const safeGym = (gymProfile?.gym_name || 'Gym').replace(/\s+/g, '_');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${safeGym}_Ledger_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported Ledger for ${selectedMonth}!`);
  };

  const handleQuickStatusJump = (statusKey) => {
    setFilterType(statusKey);
    setActiveTab('register');
  };

  const toggleFeatureVote = (featureId, title) => {
    setVotedFeatures((prev) => {
      const exists = prev.includes(featureId);
      const next = exists ? prev.filter((id) => id !== featureId) : [...prev, featureId];
      showToast(exists ? `Unmarked ${title}` : `Prioritized ${title}`);
      return next;
    });
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone.includes(searchQuery) ||
        (m.batch && m.batch.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      const { status } = getMemberStatus(m.expiryDate);
      if (filterType === 'GREEN') return status === 'GREEN';
      if (filterType === 'YELLOW') return status === 'YELLOW';
      if (filterType === 'RED') return status === 'RED';
      return true;
    });
  }, [members, searchQuery, filterType]);

  const handleAddMember = async (newRecord) => {
    if (!gymProfile?.id) {
      showToast('Gym profile is still loading. Please try again in a second.');
      return;
    }

    const { error } = await supabase.from('members').insert([
      {
        id: newRecord.id,
        gym_id: gymProfile.id,
        name: newRecord.name,
        phone: newRecord.phone,
        email: newRecord.email,
        batch: newRecord.batch,
        blood_group: newRecord.bloodGroup,
        gender: newRecord.gender,
        emergency_contact: newRecord.emergencyContact,
        start_date: newRecord.startDate,
        plan_months: newRecord.planMonths,
        fee_amount: newRecord.feeAmount,
        expiry_date: newRecord.expiryDate,
        payment_mode: newRecord.paymentMode,
        notes: newRecord.notes,
        history: newRecord.history
      }
    ]);

    if (error) {
      showToast('Failed to save member: ' + error.message);
      return;
    }

    setMembers((prev) => [newRecord, ...prev]);
    setActiveTab('register');
    showToast(`Saved ${newRecord.name} to Register!`);
    const defaultMsg = `Hello ${newRecord.name}! \n\nWelcome to *${gymProfile.gym_name || 'My Gym'}*! Your membership is now active.\n• Batch: *${newRecord.batch || 'General Access'}*\n• Valid Till: *${newRecord.expiryDate}*\n• Paid: *₹${newRecord.feeAmount}* (${newRecord.paymentMode || 'UPI'})\n\nLet's get to work!`;
setCustomWelcomeText(defaultMsg);
setWelcomeModalData(newRecord);
  };

  const openRenewModal = (member) => {
    setRenewModalMember(member);
    setRenewPlanMonths(1);
    setRenewAmount(800);
    setRenewMode('UPI');
    setRenewIsCustomDate(false);

    const base = new Date(member.expiryDate) < new Date() ? new Date() : new Date(member.expiryDate);
    const target = new Date(base);
    target.setMonth(target.getMonth() + 1);
    setRenewCustomExpiry(target.toISOString().split('T')[0]);
  };

  const handleExecuteRenewal = async (e) => {
    e.preventDefault();
    if (!renewModalMember || !gymProfile?.id) return;

    let finalExpiryStr = '';
    if (renewIsCustomDate && renewCustomExpiry) {
      finalExpiryStr = renewCustomExpiry;
    } else {
      const baseExpiry = new Date(renewModalMember.expiryDate) < new Date()
        ? new Date()
        : new Date(renewModalMember.expiryDate);
      const newExpiry = new Date(baseExpiry);
      newExpiry.setMonth(newExpiry.getMonth() + parseInt(renewPlanMonths, 10));
      finalExpiryStr = newExpiry.toISOString().split('T')[0];
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const newTx = {
      id: `tx_${Date.now()}`,
      date: todayStr,
      type: 'RENEW',
      plan: renewIsCustomDate ? `Custom (until ${finalExpiryStr})` : `${renewPlanMonths} Mo`,
      amount: Number(renewAmount),
      mode: renewMode
    };

    const updatedHistory = [newTx, ...(renewModalMember.history || [])];

    const { error } = await supabase
      .from('members')
      .update({
        plan_months: renewIsCustomDate ? renewModalMember.planMonths : parseInt(renewPlanMonths, 10),
        fee_amount: Number(renewAmount),
        expiry_date: finalExpiryStr,
        payment_mode: renewMode,
        history: updatedHistory
      })
      .eq('id', renewModalMember.id)
      .eq('gym_id', gymProfile.id);

    if (error) {
      showToast('Renewal update failed: ' + error.message);
      return;
    }

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === renewModalMember.id) {
          return {
            ...m,
            planMonths: renewIsCustomDate ? m.planMonths : parseInt(renewPlanMonths, 10),
            feeAmount: Number(renewAmount),
            expiryDate: finalExpiryStr,
            paymentMode: renewMode,
            history: updatedHistory
          };
        }
        return m;
      })
    );

    setRenewModalMember(null);
    showToast(`Renewed for ${renewModalMember.name}!`);
    const updatedMemberForWa = {
  ...renewModalMember,
  planMonths: renewIsCustomDate ? renewModalMember.planMonths : parseInt(renewPlanMonths, 10),
  feeAmount: Number(renewAmount),
  expiryDate: finalExpiryStr,
  paymentMode: renewMode,
};
const planLabel = renewIsCustomDate
  ? `Custom (until ${finalExpiryStr})`
  : `${parseInt(renewPlanMonths, 10)} Month${parseInt(renewPlanMonths, 10) > 1 ? 's' : ''}`;
const waUrl = getWhatsAppLink(updatedMemberForWa, displayGymName, 'renewal', { planLabel });
window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteMember = async (memberId, memberName) => {
    if (!gymProfile?.id) return;
    const confirmed = window.confirm(`Remove ${memberName} from the register?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', memberId)
      .eq('gym_id', gymProfile.id);

    if (error) {
      showToast('Could not delete member: ' + error.message);
      return;
    }

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    showToast(`${memberName} removed.`);
  };

const openEditModal = (member) => {
    setEditModalMember(member);
    setEditName(member.name || '');
    setEditPhone(member.phone || '');
    setEditEmail(member.email || '');
    setEditBatch(member.batch || 'Morning (6 AM - 10 AM)');
    setEditGender(member.gender || 'Male');
    setEditExpiryDate(member.expiryDate || new Date().toISOString().split('T')[0]);
    setEditFeeAmount(member.feeAmount ?? 800);
    setEditPaymentMode(member.paymentMode || 'UPI');
  };

  const handleSaveEditMember = async (e) => {
    e.preventDefault();
    if (!editModalMember || !gymProfile?.id) return;

    const cleanPhone = editPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number.');
      return;
    }

    const updatedFields = {
      name: editName.trim(),
      phone: cleanPhone,
      email: editEmail.trim(),
      batch: editBatch,
      gender: editGender,
      expiry_date: editExpiryDate,
      fee_amount: Number(editFeeAmount),
      payment_mode: editPaymentMode
    };

    const { error } = await supabase
      .from('members')
      .update(updatedFields)
      .eq('id', editModalMember.id)
      .eq('gym_id', gymProfile.id);

    if (error) {
      showToast('Failed to update member: ' + error.message);
      return;
    }

    setMembers((prev) =>
      prev.map((m) =>
        m.id === editModalMember.id
          ? {
              ...m,
              name: updatedFields.name,
              phone: updatedFields.phone,
              email: updatedFields.email,
              batch: updatedFields.batch,
              gender: updatedFields.gender,
              expiryDate: updatedFields.expiry_date,
              feeAmount: updatedFields.fee_amount,
              paymentMode: updatedFields.payment_mode
            }
          : m
      )
    );

    const savedName = updatedFields.name;
    setEditModalMember(null);
    showToast(`Updated ${savedName}'s details!`);
  };

  // --- LOADING SCREEN ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-white">
          <Loader2 size={32} className="animate-spin text-emerald-400" />
          <p className="text-xs font-medium text-slate-300">Loading Gym Portal...</p>
        </div>
      </div>
    );
  }

  // --- AUTH GATE (LOGIN / REGISTER GYM / VERIFY OTP) ---
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="w-full max-w-sm bg-zinc-950 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-white">

        {/* Brand Header */}
     <div className="text-center space-y-1">
       <div className="w-28 h-28 bg-black rounded-2xl mx-auto -mt-1 -mb-1 flex items-center justify-center overflow-hidden">
         <img src="/icon-512.png" alt="Gym Register" className="w-full h-full object-cover" />
       </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {authScreen === 'login' && 'Gym Register'}
            {authScreen === 'register' && 'Register My Gym'}
            {authScreen === 'verify_otp' && 'Verify Email OTP'}
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            {authScreen === 'login' && 'Sign in to manage members'}
            {authScreen === 'register' && 'Create your gym account to start your register'}
            {authScreen === 'verify_otp' && `Enter the 6-digit code sent to ${otpEmail}`}
          </p>
        </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {authInfo && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>{authInfo}</span>
            </div>
          )}

         {/* SCREEN 1: LOGIN */}
          {authScreen === 'login' && (
            <div className="space-y-4">
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Registered Email ID
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="owner@yourgym.in"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {loginMethod === 'password' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={authSubmitting}
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          required
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
                  </div>
                )}

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod(loginMethod === 'otp' ? 'password' : 'otp');
                      setAuthError('');
                      setAuthInfo('');
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {loginMethod === 'otp'
                      ? 'Sign in with Password instead'
                      : 'Sign in with OTP code instead'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition"
                >
                  {authSubmitting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : loginMethod === 'otp' ? (
                    <KeyRound size={15} />
                  ) : (
                    <Lock size={15} />
                  )}
                  <span>{loginMethod === 'otp' ? 'Send Login OTP to Email' : 'Sign In'}</span>
                </button>
              </form>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-center">
                <p className="text-xs text-slate-400 font-medium">New gym owner?</p>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError('');
                    setAuthInfo('');
                    setAuthScreen('register');
                  }}
                  className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Building2 size={15} className="text-emerald-600" />
                  <span>Register My Gym</span>
                </button>
              </div>
            </div>
          )}


          {/* SCREEN 2: REGISTER MY GYM */}
          {authScreen === 'register' && (
            <form onSubmit={handleRegisterGym} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Gym Name *</label>
                <input
                  type="text"
                  required
                  value={regGymName}
                  onChange={(e) => setRegGymName(e.target.value)}
                  placeholder="e.g. IronCore Fitness Club"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Owner Name *</label>
                  <input
                    type="text"
                    required
                    value={regOwnerName}
                    onChange={(e) => setRegOwnerName(e.target.value)}
                    placeholder="e.g. Coach Vikram"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    maxLength={10}
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Email ID (For OTP) *</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="owner@yourgym.in"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">GST Number (Optional)</label>
                <input
                  type="text"
                  value={regGst}
                  onChange={(e) => setRegGst(e.target.value.toUpperCase())}
                  placeholder="e.g. 19ABCDE1234F1Z5"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Create Password *</label>
                <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={6}
          value={regPassword}
          onChange={(e) => setRegPassword(e.target.value)}
          placeholder="Min. 6 characters"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
              >
                {authSubmitting ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                <span>Register & Send Email OTP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthError('');
                  setAuthInfo('');
                  setAuthScreen('login');
                }}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1"
              >
                <ArrowLeft size={13} />
                <span>Already registered? Back to Sign In</span>
              </button>
            </form>
          )}

          {/* SCREEN 3: VERIFY EMAIL OTP */}
          {authScreen === 'verify_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 text-center">
                  6-Digit Email OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-center text-lg font-black tracking-[0.4em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition"
              >
                {authSubmitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>Verify OTP & Open Dashboard</span>
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError('');
                    setAuthInfo('');
                    setAuthScreen('login');
                  }}
                  className="text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Change Email
                </button>
                <button
                  type="button"
                  disabled={authSubmitting}
                  onClick={handleResendOtp}
                  className="text-emerald-700 hover:text-emerald-800 font-bold"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- MAIN AUTHENTICATED APP ---
  const displayGymName = gymProfile?.gym_name || 'My Gym';
  const displayOwnerName = gymProfile?.owner_name || 'Owner';

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center text-slate-800 font-sans selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-2xl relative border-x border-slate-200">

{/* Set New Password Overlay (Triggered by Email Recovery Link) */}
        {isResettingPassword && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <div className="w-11 h-11 bg-emerald-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/30">
                  <KeyRound size={22} />
                </div>
                <h2 className="text-lg font-black text-slate-900">Create New Password</h2>
                <p className="text-xs text-slate-500">Set a new secure password for your gym account</p>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateNewPassword} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Min. 6 characters"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
                >
                  {authSubmitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  <span>Update Password & Continue</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Top Header - Centered & Balanced */}
        <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md text-white pl-3.5 pr-4 py-0 shadow-lg border-b border-zinc-800 grid grid-cols-[auto_1fr_auto] items-center gap-2">
      {/* Left: Flush Top-to-Bottom Logo */}
      <div className="h-12 w-12 bg-black flex items-center justify-center overflow-hidden shrink-0">
        <img src="/icon-512.png" alt="Gym Register" className="w-full h-full object-cover" />
      </div>

      {/* Center: Brand Name & Gym Workspace */}
      <div className="flex flex-col items-center justify-center text-center min-w-0">
        <h1 className="text-sm font-bold tracking-tight text-white leading-tight truncate">
          Gym Register
        </h1>
        <p className="text-[11px] font-medium text-slate-400 flex items-center justify-center gap-1.5 leading-none mt-0.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0"></span>
          <span className="font-semibold text-slate-200 truncate">{displayGymName}</span>
        </p>
      </div>

      {/* Right: Logout Action */}
      <button
        onClick={handleLogout}
        title="Log Out"
        className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/40 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 transition active:scale-95 flex items-center justify-center shrink-0"
      >
        <LogOut size={16} />
      </button>
    </header>

        {/* Global Toast */}
        {toastMessage && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 border border-slate-700">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-24">
          {dataLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin text-emerald-600" />
              <p className="text-xs font-medium">Syncing your gym register...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: MY GYM */}
              {activeTab === 'my_gym' && (
                <div className="p-4 space-y-4">
                  <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Gym Profile</span>
                        <h2 className="text-lg font-black">{displayGymName}</h2>
                        <p className="text-xs text-slate-300">{gymProfile?.email}</p>
                        {gymProfile?.phone && (
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">+91 {gymProfile.phone}</p>
                        )}
                      </div>
                      <Building2 size={24} className="text-emerald-400" />
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-300">
                      <span>Owner: <strong className="text-white">{displayOwnerName}</strong></span>
                      {gymProfile?.gst_number ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
                          <FileText size={11} />
                          GST: {gymProfile.gst_number}
                        </span>
                      ) : (
                        <span>Total Members: <strong className="text-emerald-400">{monthlyAnalytics.totalMembers}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <CalendarDays size={16} className="text-emerald-600" />
                      <span>Month:</span>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {monthOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleExportCSV}
                      title="Export monthly ledger to CSV"
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[11px] font-bold shadow-sm transition"
                    >
                      <Download size={13} />
                      <span>CSV Ledger</span>
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {selectedMonth === 'ALL' ? 'All-Time Revenue' : `${formatMonthLabel(selectedMonth)} Collections`}
                      </span>
                      <span className="text-lg font-black text-emerald-600">
                        ₹{monthlyAnalytics.totalMonthRevenue.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">New Joins</span>
                        <div className="flex justify-between items-baseline">
                          <span className="font-black text-slate-900">{monthlyAnalytics.joinedCount} Joined</span>
                          <span className="font-bold text-emerald-700">₹{monthlyAnalytics.joinedAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Renewals</span>
                        <div className="flex justify-between items-baseline">
                          <span className="font-black text-slate-900">{monthlyAnalytics.renewedCount} Renewed</span>
                          <span className="font-bold text-emerald-700">₹{monthlyAnalytics.renewedAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] pt-1 text-slate-500 border-t border-slate-100">
                      <span>UPI Received: <strong className="text-slate-800">₹{monthlyAnalytics.upiTotal.toLocaleString('en-IN')}</strong></span>
                      <span>Cash Received: <strong className="text-slate-800">₹{monthlyAnalytics.cashTotal.toLocaleString('en-IN')}</strong></span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                      Live Member Status
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      <div
                        onClick={() => handleQuickStatusJump('GREEN')}
                        className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl cursor-pointer hover:bg-emerald-100/70 transition space-y-1 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <ArrowRight size={12} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <div className="text-xl font-black text-emerald-900">{monthlyAnalytics.greenCount}</div>
                        <div className="text-[10px] font-bold text-emerald-700">Paid & Active</div>
                      </div>

                      <div
                        onClick={() => handleQuickStatusJump('YELLOW')}
                        className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl cursor-pointer hover:bg-amber-100/70 transition space-y-1 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                          <ArrowRight size={12} className="text-amber-500 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <div className="text-xl font-black text-amber-900">{monthlyAnalytics.yellowCount}</div>
                        <div className="text-[10px] font-bold text-amber-700">Due in ≤ 5d</div>
                      </div>

                      <div
                        onClick={() => handleQuickStatusJump('RED')}
                        className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl cursor-pointer hover:bg-rose-100/70 transition space-y-1 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                          <ArrowRight size={12} className="text-rose-500 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <div className="text-xl font-black text-rose-900">{monthlyAnalytics.redCount}</div>
                        <div className="text-[10px] font-bold text-rose-700">Overdue (Red)</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Slot / Batch Distribution
                        </span>
                        <span className="text-[10px] text-slate-400">Customise timings to match your gym</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddingBatch(!isAddingBatch)}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                      >
                        {isAddingBatch ? 'Cancel' : '+ Add Slot'}
                      </button>
                    </div>

                    {isAddingBatch && (
                      <form onSubmit={handleAddCustomBatch} className="flex gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ladies Batch (10 AM - 11:30 AM)"
                          value={newBatchName}
                          onChange={(e) => setNewBatchName(e.target.value)}
                          className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          Save
                        </button>
                      </form>
                    )}

                    <div className="divide-y divide-slate-100 text-xs">
                      {Array.isArray(batches) &&
  batches.map((b, index) => {
    const label = typeof b === 'string' ? b : b?.name || b?.label || 'General Access';
    const count = members.filter((m) => (m.batch || 'General Access') === label).length;
    return (
      <div
        key={`${label}-${index}`}
        className="py-2 flex justify-between items-center text-slate-700 group"
      >
        <span className="flex items-center gap-2">
          <Clock size={13} className="text-slate-400 shrink-0" />
          <span className="font-medium text-slate-800">{label}</span>
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
            {count} {count === 1 ? 'member' : 'members'}
          </span>
          <button
            type="button"
            onClick={() => handleDeleteBatch(label)}
            title={`Delete ${label}`}
            className="text-slate-300 hover:text-rose-600 p-1 rounded transition"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  })}
                  
                    </div>
                  </div>
                  {/* Creator Footer */}
            <div className="pt-8 pb-20 text-center">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Built by <span className="text-emerald-600 font-bold">Bobby Jaiswal</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Gym Register • v{APP_VERSION} Pilot</p>
            </div>
          </div>
              )}

              {/* TAB 2: REGISTER */}
              {activeTab === 'register' && (
                <div className="p-4 space-y-4">
                  <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, phone, or batch..."
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-xs">
                    {[
                      { key: 'ALL', label: `All (${members.length})` },
                      { key: 'GREEN', label: `Active (${monthlyAnalytics.greenCount})` },
                      { key: 'YELLOW', label: `Due in 5d (${monthlyAnalytics.yellowCount})` },
                      { key: 'RED', label: `Overdue (${monthlyAnalytics.redCount})` }
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setFilterType(item.key)}
                        className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap text-[11px] transition ${
                          filterType === item.key
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {filteredMembers.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-3">
                        <Users size={32} className="mx-auto text-slate-300" />
                        <p className="text-xs font-semibold">
                          {members.length === 0 ? 'Your gym register is empty' : 'No members match this filter'}
                        </p>
                        {members.length === 0 && (
                          <button
                            onClick={() => setActiveTab('new_member')}
                            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm"
                          >
                            + Add First Member
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredMembers.map((member) => {
                        const status = getMemberStatus(member.expiryDate);
                        return (
                          <div
                            key={member.id}
                            className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-2.5 transition hover:border-slate-300"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h3 className="text-sm font-bold text-slate-900">{member.name}</h3>
                                  
{member.gender && (
  <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">
    {member.gender}
  </span>
)}
<button
  type="button"
  onClick={() => openEditModal(member)}
  title="Edit Member"
  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
>
  <Pencil size={11} />
</button>
                                
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-slate-500 font-mono">{member.phone}</span>
                                  <a
                                    href={`tel:${member.phone}`}
                                    title="Call Member"
                                    className="text-slate-400 hover:text-emerald-600 p-0.5 rounded"
                                  >
                                    <Phone size={12} />
                                  </a>
                                </div>
                                {member.email && (
                                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Mail size={10} />
                                    {member.email}
                                  </p>
                                )}
                              </div>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${status.badgeStyle}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`}></span>
                                {status.label}
                              </span>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-[11px] border border-slate-100">
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Slot</span>
                                <span className="font-bold text-slate-800 truncate block">{(member.batch || 'General').split(' (')[0]}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Fee ({member.paymentMode || 'UPI'})</span>
                                <span className="font-bold text-slate-800">₹{member.feeAmount}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[9px] uppercase font-bold">Expires On</span>
                                <span className="font-bold text-slate-800">{member.expiryDate}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                              <a
                                href={getWhatsAppLink(member, displayGymName)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                              >
                                <MessageCircle size={14} />
                                <span>Remind</span>
                              </a>

                              <button
                                onClick={() => openRenewModal(member)}
                                className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                              >
                                <RefreshCw size={13} />
                                <span>Renew</span>
                              </button>

                              <button
                                onClick={() => setHistoryModalMember(member)}
                                title="Member Ledger"
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                              >
                                <IndianRupee size={13} />
                              </button>

                              <button
                                onClick={() => handleDeleteMember(member.id, member.name)}
                                title="Remove Member"
                                className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-xl transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: ADD MEMBER */}
              {activeTab === 'new_member' && (
                <div className="p-4 space-y-4">
                  <div>
                    <h2 className="text-base font-black text-slate-900">Add New Member</h2>
                    <p className="text-xs text-slate-500">Record profile, slot & collect membership fee</p>
                  </div>

                  <AddMemberForm
                    batches={batches}
                    onSave={handleAddMember}
                    onCancel={() => setActiveTab('register')}
                  />
                </div>
              )}

              {/* TAB 4: UPCOMING FEATURES */}
              {activeTab === 'upcoming' && (
                <div className="p-4 space-y-4">
                  <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Pilot Roadmap</span>
                      <Rocket size={18} className="text-emerald-400" />
                    </div>
                    <h2 className="text-base font-black">Upcoming Features</h2>
                    <p className="text-xs text-slate-300">
                      Tap any item to flag what to build next for your local gym pilot.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {UPCOMING_FEATURES.map((feat) => {
                      const IconComponent = feat.icon;
                      const isPrioritized = votedFeatures.includes(feat.id);

                      return (
                        <div
                          key={feat.id}
                          onClick={() => toggleFeatureVote(feat.id, feat.title)}
                          className={`p-3.5 rounded-2xl border shadow-sm cursor-pointer transition space-y-2 ${
                            isPrioritized
                              ? 'bg-emerald-50/50 border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                                <IconComponent size={16} />
                              </div>
                              <div>
                                <h3 className="text-xs font-black text-slate-900">{feat.title}</h3>
                                <span className={`inline-block mt-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full border ${feat.badgeClass}`}>
                                  {feat.stage}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 ${
                                isPrioritized
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}
                            >
                              {isPrioritized ? 'Priority ✓' : 'Flag'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed">{feat.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-2 flex justify-around items-center z-40">
          <button
            onClick={() => setActiveTab('my_gym')}
            className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition ${
              activeTab === 'my_gym' ? 'text-emerald-700 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Building2 size={18} />
            <span className="text-[10px]">My Gym</span>
          </button>

          <button
            onClick={() => setActiveTab('register')}
            className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition ${
              activeTab === 'register' ? 'text-emerald-700 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users size={18} />
            <span className="text-[10px]">Members</span>
          </button>

          <button
            onClick={() => setActiveTab('new_member')}
            className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition ${
              activeTab === 'new_member' ? 'text-emerald-700 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <UserPlus size={18} />
            <span className="text-[10px]">Add Member</span>
          </button>

          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition ${
              activeTab === 'upcoming' ? 'text-emerald-700 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Rocket size={18} />
            <span className="text-[10px]">Upcoming</span>
          </button>
        </nav>

        {/* Renew Membership Modal */}
        {renewModalMember && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 text-base">Renew Membership</h3>
                  <p className="text-xs text-slate-500">{renewModalMember.name} • {renewModalMember.phone}</p>
                </div>
                <button
                  onClick={() => setRenewModalMember(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleExecuteRenewal} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Select Renewal Duration</label>
                    <button
                      type="button"
                      onClick={() => setRenewIsCustomDate(!renewIsCustomDate)}
                      className={`text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg border transition ${
                        renewIsCustomDate
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Calendar size={12} />
                      <span>{renewIsCustomDate ? 'Switch to Preset' : 'Custom Date'}</span>
                    </button>
                  </div>

                  {!renewIsCustomDate ? (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { m: 1, lbl: '1 Mo', amt: 800 },
                        { m: 3, lbl: '3 Mo', amt: 2200 },
                        { m: 6, lbl: '6 Mo', amt: 4000 },
                        { m: 12, lbl: '1 Yr', amt: 7500 }
                      ].map((p) => (
                        <button
                          type="button"
                          key={p.m}
                          onClick={() => {
                            setRenewPlanMonths(p.m);
                            setRenewAmount(p.amt);
                          }}
                          className={`py-2 text-xs font-bold rounded-xl border transition ${
                            renewPlanMonths === p.m
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {p.lbl}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Set Specific Expiry Date</label>
                      <input
                        type="date"
                        required
                        value={renewCustomExpiry}
                        onChange={(e) => setRenewCustomExpiry(e.target.value)}
                        className="w-full bg-slate-50 border border-emerald-400 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Fee Received (₹)</label>
                    <div className="relative">
                      <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        required
                        value={renewAmount}
                        onChange={(e) => setRenewAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                    <select
                      value={renewMode}
                      onChange={(e) => setRenewMode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs flex justify-between items-center">
                  <span className="text-emerald-800 font-medium">New Expiry Date:</span>
                  <span className="font-black text-emerald-900">
                    {renewIsCustomDate
                      ? (renewCustomExpiry || 'Pick Date')
                      : (() => {
                          const base = new Date(renewModalMember.expiryDate) < new Date()
                            ? new Date()
                            : new Date(renewModalMember.expiryDate);
                          const t = new Date(base);
                          t.setMonth(t.getMonth() + parseInt(renewPlanMonths, 10));
                          return t.toISOString().split('T')[0];
                        })()}
                  </span>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRenewModalMember(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition"
                  >
                    Confirm Renewal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

{/* Welcome Message Preview / Skip Modal */}
        {welcomeModalData && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <MessageCircle size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">Send Welcome Message?</h3>
                    <p className="text-[11px] text-slate-500">{welcomeModalData.name} • +91 {welcomeModalData.phone}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWelcomeModalData(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Message Preview
                  </label>
                  <span className="text-[10px] text-slate-400">Editable before sending</span>
                </div>
                <textarea
                  rows={6}
                  value={customWelcomeText}
                  onChange={(e) => setCustomWelcomeText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-sans focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setWelcomeModalData(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    let cleanPhone = (welcomeModalData.phone || '').replace(/\D/g, '');
                    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
                    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customWelcomeText)}`;
                    window.open(waUrl, '_blank', 'noopener,noreferrer');
                    setWelcomeModalData(null);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
                >
                  <MessageCircle size={14} />
                  <span>Send via WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        )}

{/* Member Payment History Sheet */}
        {historyModalMember && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 text-base">{historyModalMember.name}'s Ledger</h3>
                  <p className="text-xs text-slate-500">Transaction & Renewal History</p>
                </div>
                <button
                  onClick={() => setHistoryModalMember(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {historyModalMember.history?.map((h) => (
                  <div key={h.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{h.plan} ({h.type || 'TX'})</p>
                      <p className="text-[10px] text-slate-400">{h.date} • {h.mode}</p>
                    </div>
                    <span className="font-black text-emerald-700">₹{h.amount}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setHistoryModalMember(null)}
                className="w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Close Ledger
              </button>
            </div>
          </div>
        )}

        {/* Edit Member Modal */}
        {editModalMember && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 text-base">Edit Member</h3>
                  <p className="text-xs text-slate-500">Update profile details & validity</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalMember(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEditMember} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">10-Digit Mobile</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-2 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                    <select
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Workout Batch</label>
                    <select
                   value={editBatch}
                   onChange={(e) => setEditBatch(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                 >
                   {batches.map((b) => (
                     <option key={b} value={b}>{b}</option>
                   ))}
                 </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      required
                      value={editExpiryDate}
                      onChange={(e) => setEditExpiryDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email ID (Optional)</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Fee (₹)</label>
                    <div className="relative">
                      <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        required
                        value={editFeeAmount}
                        onChange={(e) => setEditFeeAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                    <select
                      value={editPaymentMode}
                      onChange={(e) => setEditPaymentMode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalMember(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
{/* App Update Notification Banner */}
      {showUpdateBanner && (
        <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl bg-zinc-950/95 border border-emerald-500/40 p-4 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-white">
          <div className="text-xs">
            <p className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Update Available (v{APP_VERSION})
            </p>
            <p className="text-slate-400 mt-0.5">A new version of Gym Register is ready.</p>
          </div>
          <button
            onClick={handleApplyUpdate}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black text-xs font-bold rounded-lg shrink-0 transition shadow-sm"
          >
            Reload
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

function AddMemberForm({ onSave, onCancel, batches = [] }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [batch, setBatch] = useState(batches[0] || 'General Access');
  const [gender, setGender] = useState('Male');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [planMonths, setPlanMonths] = useState(1);
  const [feeAmount, setFeeAmount] = useState(800);
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [saving, setSaving] = useState(false);

  const [isCustomExpiry, setIsCustomExpiry] = useState(false);
  const [customExpiryDate, setCustomExpiryDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });

  const plans = [
    { m: 1, lbl: '1 Month', fee: 800 },
    { m: 3, lbl: '3 Months', fee: 2200 },
    { m: 6, lbl: '6 Months', fee: 4000 },
    { m: 12, lbl: '1 Year', fee: 7500 }
  ];

  const handlePlanSelect = (m, fee) => {
    setPlanMonths(m);
    setFeeAmount(fee);
    setIsCustomExpiry(false);

    const expiry = new Date(startDate);
    expiry.setMonth(expiry.getMonth() + parseInt(m, 10));
    setCustomExpiryDate(expiry.toISOString().split('T')[0]);
  };

  const handleStartDateChange = (newDate) => {
    setStartDate(newDate);
    if (!isCustomExpiry) {
      const expiry = new Date(newDate);
      expiry.setMonth(expiry.getMonth() + parseInt(planMonths, 10));
      setCustomExpiryDate(expiry.toISOString().split('T')[0]);
    }
  };

  const getComputedExpiry = () => {
    if (isCustomExpiry && customExpiryDate) return customExpiryDate;
    const expiry = new Date(startDate);
    expiry.setMonth(expiry.getMonth() + parseInt(planMonths, 10));
    return expiry.toISOString().split('T')[0];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (phone.length !== 10) {
      alert('Please enter a valid 10-digit Indian phone number.');
      return;
    }

    setSaving(true);
    const expiryStr = getComputedExpiry();
    const newId = `mem_${Date.now()}`;
    const newRecord = {
      id: newId,
      name: name.trim(),
      phone,
      email: email.trim(),
      batch,
      gender,
      emergencyContact,
      startDate,
      planMonths: isCustomExpiry ? 0 : parseInt(planMonths, 10),
      feeAmount: Number(feeAmount),
      expiryDate: expiryStr,
      paymentMode,
      notes: '',
      history: [
        {
          id: `tx_${Date.now()}`,
          date: startDate,
          type: 'JOIN',
          plan: isCustomExpiry ? `Custom (until ${expiryStr})` : `${planMonths} Month${planMonths > 1 ? 's' : ''}`,
          amount: Number(feeAmount),
          mode: paymentMode
        }
      ]
    };

    await onSave(newRecord);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3.5">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
        <input
          type="text"
          required
          placeholder="e.g. Vikram Malhotra"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">10-Digit Mobile</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">+91</span>
            <input
              type="tel"
              maxLength={10}
              required
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-2 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Member Email (Optional)</label>
          <input
            type="email"
            placeholder="name@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Workout Batch / Slot</label>
          <select
         value={batch}
         onChange={(e) => setBatch(e.target.value)}
         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
       >
         {(batches.length > 0 ? batches : ['General Access']).map((b) => (
           <option key={b} value={b}>{b}</option>
         ))}
       </select>
        </div>

        <div>
  <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
  <select
    value={gender}
    onChange={(e) => setGender(e.target.value)}
    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
  >
    <option value="Male">Male</option>
    <option value="Female">Female</option>
    <option value="Other">Other</option>
  </select>
</div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">Joining Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => handleStartDateChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs font-bold text-slate-700">Select Duration Plan</label>
          <button
            type="button"
            onClick={() => setIsCustomExpiry(!isCustomExpiry)}
            className={`text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg border transition ${
              isCustomExpiry
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Calendar size={12} />
            <span>{isCustomExpiry ? 'Use Preset' : 'Custom Expiry Date'}</span>
          </button>
        </div>

        {!isCustomExpiry ? (
          <div className="grid grid-cols-4 gap-1.5">
            {plans.map((p) => (
              <button
                type="button"
                key={p.m}
                onClick={() => handlePlanSelect(p.m, p.fee)}
                className={`py-2 text-xs font-bold rounded-xl border transition ${
                  planMonths === p.m
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {p.lbl}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-xl border border-emerald-300 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-600 block">Pick Exact Expiry Date</span>
            <input
              type="date"
              required
              value={customExpiryDate}
              onChange={(e) => setCustomExpiryDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-xs flex justify-between items-center">
        <span className="text-emerald-800 font-medium">Calculated Expiry Date:</span>
        <span className="font-black text-emerald-900">{getComputedExpiry()}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Fee Collected (₹)</label>
          <div className="relative">
            <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="number"
              required
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
        </div>
      </div>

      <div className="pt-2 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition"
        >
          {saving ? 'Saving...' : 'Save to Register'}
        </button>
      </div>
    </form>
  );
}