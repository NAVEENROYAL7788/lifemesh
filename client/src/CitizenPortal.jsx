import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TRANSLATIONS } from './translations.js';
import {
  Heart,
  Baby,
  Activity,
  Waves,
  Utensils,
  Mic,
  Volume2,
  Bell,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Send,
  Radio,
  ShieldCheck,
  QrCode,
  ArrowRight,
  RefreshCw,
  Clock,
  Camera,
  CameraOff,
  Video
} from 'lucide-react';

export default function CitizenPortal({ onSwitchToRescuer }) {
  const [lang, setLang] = useState('en');
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Accessibility modes
  const [accessMode, setAccessMode] = useState('STANDARD'); // STANDARD | ELDERLY | BLIND | DEAF | MUTE
  const [visualFlash, setVisualFlash] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);

  // Form inputs
  const [sourceNode, setSourceNode] = useState('ward-1');
  const [message, setMessage] = useState('');
  const [medicalMode, setMedicalMode] = useState('general');
  const [conditionNotes, setConditionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live incoming rescue state & active case
  const [activeCase, setActiveCase] = useState(null);
  const [replies, setReplies] = useState([]);
  const [tokenQrUrl, setTokenQrUrl] = useState('');
  const [claimStatus, setClaimStatus] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Feature: Silent-Distress 15-Second Heartbeat Monitor
  const [heartbeatActive, setHeartbeatActive] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const timerRef = useRef(null);

  // Feature: Web Audio Acoustic SOS Beacon
  const [acousticActive, setAcousticActive] = useState(false);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);

  // Feature: 100% OFFLINE SIGN-LANGUAGE CAMERA SOS
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [detectedGesture, setDetectedGesture] = useState(null);
  const [gestureProgress, setGestureProgress] = useState(0); // 0 to 100%
  const [modelLoading, setModelLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const animationFrameId = useRef(null);
  const holdStartTimeRef = useRef(null);
  const currentGestureRef = useRef(null);

  // Speak helper for Blind Mode
  const speak = (text) => {
    if (accessMode === 'BLIND' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Trigger deaf visual flash & device vibration
  const triggerAlertFeedback = () => {
    setVisualFlash(true);
    setTimeout(() => setVisualFlash(false), 2000);
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  };

  // Silent-Distress Countdown Loop
  useEffect(() => {
    if (heartbeatActive) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleTriggerSilentDistress();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(15);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [heartbeatActive, sourceNode]);

  const handleStartHeartbeat = () => {
    setHeartbeatActive(true);
    setCountdown(15);
    speak("Silent Distress Monitor activated. Tap I'm OK within 15 seconds to check in.");
  };

  const handleImOk = () => {
    setCountdown(15);
    triggerAlertFeedback();
    speak("Check in verified. Heartbeat timer reset to 15 seconds.");
  };

  const handleStopHeartbeat = () => {
    setHeartbeatActive(false);
    setCountdown(15);
    speak("Silent Distress Monitor deactivated.");
  };

  const handleTriggerSilentDistress = async () => {
    try {
      const res = await fetch(`/api/nodes/${sourceNode}/silent-distress`, { method: 'POST' });
      const data = await res.json();
      if (data.case_record) {
        setActiveCase(data.case_record);
        if (data.ration_token) generateQr(data.ration_token);
      }
      triggerAlertFeedback();
      speak("Emergency! Silent distress alert triggered automatically due to missed check in. Priority Red SOS dispatched.");
    } catch (err) {
      console.error(err);
    }
  };

  // Acoustic SOS Beacon
  const handleToggleAcousticBeacon = () => {
    if (acousticActive) {
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch (e) {}
        oscRef.current = null;
      }
      setAcousticActive(false);
      speak("Acoustic SOS Beacon stopped.");
    } else {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        oscRef.current = osc;
        setAcousticActive(true);
        speak("Acoustic SOS audio beacon activated. Audible distress frequency broadcasting.");
      } catch (err) {
        alert("Acoustic audio not supported on this browser.");
      }
    }
  };

  // 100% OFFLINE MEDIAPIPE GESTURE DETECTION
  const initOfflineMediaPipe = async () => {
    if (handLandmarkerRef.current) return handLandmarkerRef.current;
    setModelLoading(true);
    try {
      // 100% LOCAL WASM + MODEL FILES (ZERO NETWORK CALLS IN AIRPLANE MODE)
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/mediapipe/hand_landmarker.task",
          delegate: "CPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });
      handLandmarkerRef.current = handLandmarker;
      setModelLoading(false);
      return handLandmarker;
    } catch (err) {
      console.error("MediaPipe local init error:", err);
      setModelLoading(false);
      setCameraError("Local vision model unavailable. Use 1-Tap Pictograms instead.");
      return null;
    }
  };

  const handleToggleCameraSign = async () => {
    if (cameraActive) {
      // Turn off camera
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
      setCameraActive(false);
      setDetectedGesture(null);
      setGestureProgress(0);
      return;
    }

    // Graceful LAN HTTP fallback check
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera Sign-SOS requires localhost/HTTPS — use 1-Tap Pictograms on phone over plain HTTP LAN, or open Citizen Mode on Laptop localhost.");
      return;
    }

    setCameraError(null);
    try {
      const landmarker = await initOfflineMediaPipe();
      if (!landmarker) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: "user" }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        speak("Offline Sign-Language Camera active. Hold gesture for 1.5 seconds to trigger.");
        startGestureTracking();
      }
    } catch (err) {
      setCameraError(`Camera access not granted: ${err.message}. Please use 1-Tap Pictograms below.`);
    }
  };

  const classifyHandGesture = (landmarks) => {
    if (!landmarks || landmarks.length === 0) return null;
    const pts = landmarks[0];

    // Check finger extended status comparing tip y vs pip y (lower y = extended upwards)
    const isIndexExtended = pts[8].y < pts[6].y;
    const isMiddleExtended = pts[12].y < pts[10].y;
    const isRingExtended = pts[16].y < pts[14].y;
    const isPinkyExtended = pts[20].y < pts[18].y;
    const isThumbExtended = Math.abs(pts[4].x - pts[2].x) > 0.05 && pts[4].y < pts[3].y;

    // Count extended fingers (excluding thumb)
    const extendedCount = [isIndexExtended, isMiddleExtended, isRingExtended, isPinkyExtended].filter(Boolean).length;

    // 1. Peace Sign: Index + Middle up, Ring + Pinky curled
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return {
        id: 'PEACE_SIGN',
        label: 'Peace Sign (2 Fingers Up)',
        actionLabel: 'Mute Pregnancy Rescue SOS',
        medical_mode: 'pregnancy',
        message: 'Mute pregnant woman requesting urgent medical rescue (Sign SOS)'
      };
    }

    // 2. Open Palm: All 4+ fingers up
    if (extendedCount >= 4) {
      return {
        id: 'OPEN_PALM',
        label: 'Open Palm (5 Fingers Up)',
        actionLabel: 'Trapped Rising Floodwaters SOS',
        medical_mode: 'trapped',
        message: 'URGENT HELP — trapped by rising floodwater (Sign SOS)'
      };
    }

    // 3. Closed Fist: All fingers curled down
    if (extendedCount === 0 && !isThumbExtended) {
      return {
        id: 'CLOSED_FIST',
        label: 'Closed Fist (0 Fingers Up)',
        actionLabel: 'Cardiac Emergency SOS',
        medical_mode: 'cardiac',
        message: 'CARDIAC EMERGENCY — severe chest pain (Sign SOS)'
      };
    }

    // 4. Thumbs Up: Thumb pointing up, other 4 curled
    if (isThumbExtended && pts[4].y < pts[3].y && extendedCount === 0) {
      return {
        id: 'THUMBS_UP',
        label: 'Thumbs Up',
        actionLabel: "Reset 'I'M OK!' Heartbeat",
        isHeartbeatReset: true
      };
    }

    return null;
  };

  const startGestureTracking = () => {
    const processFrame = () => {
      if (!videoRef.current || !canvasRef.current || !handLandmarkerRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const startTimeMs = performance.now();
        const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          // Draw skeleton
          const pts = results.landmarks[0];
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 3;
          ctx.fillStyle = '#EF4444';

          for (const pt of pts) {
            ctx.beginPath();
            ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, 2 * Math.PI);
            ctx.fill();
          }

          const gesture = classifyHandGesture(results.landmarks);
          if (gesture) {
            if (currentGestureRef.current?.id === gesture.id) {
              const elapsed = Date.now() - holdStartTimeRef.current;
              const pct = Math.min(100, Math.round((elapsed / 1500) * 100));
              setGestureProgress(pct);

              if (elapsed >= 1500) {
                // Trigger action!
                holdStartTimeRef.current = Date.now() + 5000; // debounce
                setGestureProgress(100);

                if (gesture.isHeartbeatReset) {
                  handleImOk();
                  speak("Thumbs Up gesture recognized! I'm OK heartbeat reset.");
                } else {
                  handleSendSOS({
                    source_node_id: sourceNode,
                    message: gesture.message,
                    medical_mode: gesture.medical_mode,
                    condition_notes: 'Sign-Language camera detected distress pulse (Mute Mode)',
                    accessibility_mode: 'mute_sign'
                  });
                  speak(`Gesture verified! Dispatched ${gesture.actionLabel}`);
                }
              }
            } else {
              currentGestureRef.current = gesture;
              holdStartTimeRef.current = Date.now();
              setDetectedGesture(gesture);
              setGestureProgress(5);
            }
          } else {
            currentGestureRef.current = null;
            setDetectedGesture(null);
            setGestureProgress(0);
          }
        } else {
          currentGestureRef.current = null;
          setDetectedGesture(null);
          setGestureProgress(0);
        }
      }

      animationFrameId.current = requestAnimationFrame(processFrame);
    };

    animationFrameId.current = requestAnimationFrame(processFrame);
  };

  // Voice recognition helper
  const handleToggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice speech recognition not supported in this browser. Please type or use pictograms.');
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    recognition.continuous = false;

    if (!voiceListening) {
      setVoiceListening(true);
      speak('Listening for your emergency message. Speak now.');
      recognition.start();
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
        setVoiceListening(false);
        speak(`Captured: ${transcript}`);
      };
      recognition.onerror = () => {
        setVoiceListening(false);
      };
      recognition.onend = () => {
        setVoiceListening(false);
      };
    }
  };

  // Generate QR code for Ration Token
  const generateQr = async (token) => {
    if (!token) return;
    try {
      const dataStr = JSON.stringify({
        tokenId: token.tokenId,
        supplies: token.allocated_supplies,
        sig: token.ed25519_signature?.slice(0, 16) + '...'
      });
      const url = await QRCode.toDataURL(dataStr, { margin: 1, width: 180, color: { dark: '#0F172A', light: '#FFFFFF' } });
      setTokenQrUrl(url);
    } catch (e) {
      console.error(e);
    }
  };

  // Listen to SSE stream for live two-way updates from Rescuer
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.addEventListener('rescuer_reply', (e) => {
      try {
        const reply = JSON.parse(e.data);
        if (!activeCase || reply.case_id === activeCase.case_id || reply.source_node_id === sourceNode) {
          setReplies(prev => [reply, ...prev]);
          triggerAlertFeedback();
          speak(`New message from rescuer: ${reply.text}. Estimated arrival in ${reply.eta_minutes} minutes.`);
        }
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener('ration_updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (activeCase && activeCase.ration_token?.tokenId === data.tokenId) {
          setActiveCase(prev => ({
            ...prev,
            ration_token: data.token
          }));
          triggerAlertFeedback();
          speak('Your ration token was successfully verified and redeemed at the distribution hub.');
        }
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [activeCase, sourceNode, accessMode]);

  // Submit SOS
  const handleSendSOS = async (customPayload = null) => {
    setSubmitting(true);
    setClaimStatus(null);
    try {
      const body = customPayload || {
        source_node_id: sourceNode,
        message: message || 'Emergency rescue assistance required.',
        medical_mode: medicalMode,
        condition_notes: conditionNotes,
        accessibility_mode: accessMode
      };

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.status === 'DELIVERED_AND_TRIAGED') {
        setActiveCase(data.case_record);
        if (data.ration_token) {
          generateQr(data.ration_token);
        }
        triggerAlertFeedback();
        speak(`Emergency SOS successfully signed and delivered. Triage priority tag is ${data.case_record.triage_tag}. Rescuer team alerted.`);
      } else if (data.status === 'BUFFERED_OFFLINE') {
        alert('Mesh is currently partitioned! Packet safely stored in node queue and will be synced via Rescue Boat Data Mule.');
        speak('Network partition detected. Your message is safely buffered for rescue boat sync.');
      }
    } catch (err) {
      alert(`SOS dispatch error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 1-Tap Pictogram Preset SOS
  const handlePictogramTap = (mode, msg, defaultNotes) => {
    setMedicalMode(mode);
    setMessage(msg);
    setConditionNotes(defaultNotes);
    handleSendSOS({
      source_node_id: sourceNode,
      message: msg,
      medical_mode: mode,
      condition_notes: defaultNotes,
      accessibility_mode: accessMode
    });
  };

  // Claim Ration Token
  const handleClaimRation = async () => {
    if (!activeCase?.ration_token?.tokenId) return;
    try {
      const res = await fetch(`/api/rations/${activeCase.ration_token.tokenId}/redeem`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.status === 409 || data.double_claim_blocked) {
        setClaimStatus('DOUBLE_CLAIM_BLOCKED');
        triggerAlertFeedback();
        speak('Security alert: Double claim prevented. This ration token was already redeemed.');
      } else if (data.success) {
        setClaimStatus('SUCCESS');
        setActiveCase(prev => ({
          ...prev,
          ration_token: data.token
        }));
        triggerAlertFeedback();
        speak('Ration successfully claimed and verified with cryptographic signature.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const isElderly = accessMode === 'ELDERLY';

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 transition-all ${visualFlash ? 'ring-8 ring-red-500 bg-red-50/80' : ''}`}>
      {/* Top Header & Role Switcher */}
      <header className="max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="text-xs font-mono-code text-emerald-800 uppercase tracking-wider font-extrabold">
              OFFLINE LAN CITIZEN PORTAL • ZERO-PASSWORD ACCESS
            </span>
          </div>
          <h1 className={`${isElderly ? 'text-4xl' : 'text-3xl'} font-extrabold text-slate-900 tracking-tight mt-1`}>
            {t.app_title}
          </h1>
          <p className="text-sm text-slate-600 font-medium">{t.zero_pass_subtitle}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleToggleAcousticBeacon}
            className={`min-h-[52px] px-4 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-sm ${
              acousticActive
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
            }`}
            title="Acoustic audio chirp when mesh radios fail"
          >
            <Radio className="w-4 h-4 text-red-600" />
            <span className="hidden sm:inline">{acousticActive ? 'Stop Siren' : 'Acoustic SOS'}</span>
          </button>

          {/* Language Selector */}
          <div className="flex bg-white border border-slate-300 rounded-xl p-1 text-xs shadow-sm min-h-[52px] items-center">
            {[
              { id: 'en', label: 'English' },
              { id: 'ta', label: 'தமிழ்' },
              { id: 'tanglish', label: 'Tanglish' }
            ].map(l => (
              <button
                key={l.id}
                onClick={() => {
                  setLang(l.id);
                  speak(`Language switched to ${l.label}`);
                }}
                className={`px-3 py-2 rounded-lg font-bold transition ${
                  lang === l.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            onClick={onSwitchToRescuer}
            className="min-h-[52px] px-4 py-2 bg-white hover:bg-slate-100 text-blue-700 border border-blue-300 rounded-xl text-xs font-extrabold flex items-center transition shadow-sm"
          >
            <span>{t.switch_role}</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto mt-6 space-y-6">
        {/* Silent-Distress 15-Second Heartbeat Monitor */}
        <div className="bg-white border-2 border-blue-300 rounded-3xl p-5 shadow-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm ${
                heartbeatActive
                  ? (countdown <= 5 ? 'bg-red-600 text-white animate-ping' : 'bg-blue-100 text-blue-700 border border-blue-300')
                  : 'bg-slate-100 text-slate-500'
              }`}>
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center">
                  Silent-Distress Heartbeat Monitor
                  <span className="ml-2 text-xs font-mono-code px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-300 font-bold">
                    15s FAILSAFE
                  </span>
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  {heartbeatActive
                    ? `Auto-fires signed RED distress SOS if unanswered within ${countdown}s`
                    : 'Failsafe for unconscious or trapped victims during rising waters.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {!heartbeatActive ? (
                <button
                  onClick={handleStartHeartbeat}
                  className="min-h-[52px] px-5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-sm transition shadow-md"
                >
                  Start 15s Heartbeat
                </button>
              ) : (
                <>
                  <button
                    onClick={handleImOk}
                    className="min-h-[52px] px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-base transition shadow-lg flex items-center space-x-2 animate-bounce"
                  >
                    <span>I'M OK! ({countdown}s)</span>
                  </button>
                  <button
                    onClick={handleStopHeartbeat}
                    className="min-h-[52px] px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition border border-slate-300"
                  >
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Accessibility Control Bar */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-extrabold text-slate-800 flex items-center">
              <Eye className="w-4 h-4 mr-1.5 text-blue-600" /> {t.accessibility_title}
            </span>
            <span className="text-xs font-mono-code text-blue-700 font-bold">ACTIVE: {accessMode}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'ELDERLY', label: t.mode_elderly, icon: Heart, color: 'text-amber-600' },
              { id: 'BLIND', label: t.mode_blind, icon: Volume2, color: 'text-emerald-600' },
              { id: 'DEAF', label: t.mode_deaf, icon: Bell, color: 'text-red-600' },
              { id: 'MUTE', label: t.mode_mute, icon: Activity, color: 'text-blue-600' }
            ].map(m => {
              const Icon = m.icon;
              const isActive = accessMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    const nextMode = isActive ? 'STANDARD' : m.id;
                    setAccessMode(nextMode);
                    if (nextMode === 'BLIND') speak('Blind mode enabled. Spoken instructions active.');
                  }}
                  className={`min-h-[52px] p-3.5 rounded-2xl border-2 flex items-center space-x-3 transition text-left shadow-sm ${
                    isActive
                      ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-6 h-6 shrink-0 ${m.color}`} />
                  <span className={`${isElderly ? 'text-base font-extrabold' : 'text-xs font-bold'}`}>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1-Tap Pictogram Emergency Grid */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="mb-4">
            <h2 className={`${isElderly ? 'text-2xl' : 'text-base'} font-extrabold text-slate-900 uppercase tracking-wider flex items-center`}>
              <Radio className="w-5 h-5 mr-2 text-red-600 animate-pulse" />
              {t.emergency_title}
            </h2>
            <p className="text-xs text-slate-600 font-medium">{t.emergency_subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
            {[
              {
                id: 'cardiac',
                mode: 'cardiac',
                title: t.cardiac,
                msg: 'Emergency! Severe chest pain and breathing difficulty (Nenju vali). Patient breathless.',
                notes: 'Suspected acute coronary syndrome, immediate oxygen and ECG needed',
                icon: Heart,
                btnColor: 'bg-red-600 hover:bg-red-700 text-white',
                border: 'border-red-700'
              },
              {
                id: 'pregnancy',
                mode: 'pregnancy',
                title: t.pregnancy,
                msg: 'Full-term pregnant mother in severe labour pain (Prasavam vali). Water broke, trapped in flood.',
                notes: 'G2P1, 39 weeks, contractions 3 mins apart, stretcher/boat required',
                icon: Baby,
                btnColor: 'bg-pink-600 hover:bg-pink-700 text-white',
                border: 'border-pink-700'
              },
              {
                id: 'diabetic',
                mode: 'diabetic',
                title: t.diabetic,
                msg: 'Diabetic patient unconscious/severe hypoglycemia (Sugar low mayakkam). Need insulin.',
                notes: 'Type 1 diabetic, blood glucose low, glucagon / insulin needed',
                icon: Activity,
                btnColor: 'bg-amber-600 hover:bg-amber-700 text-white',
                border: 'border-amber-700'
              },
              {
                id: 'trapped',
                mode: 'trapped',
                title: t.trapped,
                msg: 'Water level rising to 1st floor! Family with baby trapped on rooftop. Rescue boat needed urgently.',
                notes: '4 people stranded, water current rapid, no roof shelter',
                icon: Waves,
                btnColor: 'bg-blue-600 hover:bg-blue-700 text-white',
                border: 'border-blue-700'
              },
              {
                id: 'supplies',
                mode: 'general',
                title: t.supplies,
                msg: 'Drinking water and food supplies completely exhausted. 5 elderly people dehydrated.',
                notes: 'Clean drinking water and emergency nutrition ration pack needed',
                icon: Utensils,
                btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                border: 'border-emerald-700'
              }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  disabled={submitting}
                  onClick={() => handlePictogramTap(item.mode, item.msg, item.notes)}
                  className={`min-h-[110px] p-4 rounded-2xl ${item.btnColor} border ${item.border} flex flex-col items-center justify-center text-center shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50`}
                >
                  <Icon className={`${isElderly ? 'w-10 h-10' : 'w-8 h-8'} mb-2`} />
                  <span className={`${isElderly ? 'text-base font-extrabold' : 'text-xs font-bold'} leading-snug`}>
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 100% OFFLINE SIGN-LANGUAGE CAMERA SOS (MUTE ACCESSIBILITY CARD) */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className={`${isElderly ? 'text-xl' : 'text-base'} font-extrabold text-slate-900 flex items-center`}>
                <Camera className="w-5 h-5 mr-2 text-blue-600" />
                100% Offline Sign-Language Camera SOS
              </h3>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                On-device MediaPipe vision running completely in Airplane Mode. Detects 4 hand signs with a 1.5-second hold progress bar.
              </p>
            </div>
            <button
              onClick={handleToggleCameraSign}
              className={`min-h-[52px] px-5 py-2.5 rounded-2xl text-xs font-extrabold flex items-center space-x-2 transition shadow-sm ${
                cameraActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {cameraActive ? <CameraOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              <span>{cameraActive ? 'Turn Off Camera' : 'Start Sign-SOS Camera'}</span>
            </button>
          </div>

          {cameraError && (
            <div className="p-4 bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold rounded-2xl">
              {cameraError}
            </div>
          )}

          {/* Gesture Cheat Sheet */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <strong className="text-slate-900 block font-bold">✌️ Peace Sign (2 Up)</strong>
              <span className="text-slate-600">Pregnancy Rescue SOS</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <strong className="text-slate-900 block font-bold">✋ Open Palm (5 Up)</strong>
              <span className="text-slate-600">Trapped Floodwater SOS</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <strong className="text-slate-900 block font-bold">✊ Closed Fist (0 Up)</strong>
              <span className="text-slate-600">Cardiac Emergency SOS</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <strong className="text-slate-900 block font-bold">👍 Thumbs Up</strong>
              <span className="text-slate-600">Reset "I'M OK!" Timer</span>
            </div>
          </div>

          {/* Camera Viewport with Landmark Overlay */}
          {cameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video max-w-lg mx-auto shadow-inner border border-slate-300">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full transform -scale-x-100 pointer-events-none"
              />

              {/* Hold Progress Bar Overlay */}
              {detectedGesture && (
                <div className="absolute bottom-4 inset-x-4 bg-slate-900/90 text-white p-3 rounded-xl backdrop-blur-sm space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Detected: {detectedGesture.label}</span>
                    <span className="text-blue-400 font-mono-code">{gestureProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-100 rounded-full"
                      style={{ width: `${gestureProgress}%` }}
                    ></div>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-semibold">
                    Holding triggers: {detectedGesture.actionLabel}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Custom Input & Voice Option */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={`${isElderly ? 'text-lg' : 'text-sm'} font-extrabold uppercase tracking-wider text-slate-800`}>
              {t.or_type}
            </h3>
            <button
              onClick={handleToggleVoiceInput}
              className={`min-h-[52px] px-4 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
                voiceListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Mic className="w-4 h-4 text-blue-600" />
              <span>{voiceListening ? 'Listening...' : 'Voice Input (Mic)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Your Shelter / Ward Location:</label>
              <select
                value={sourceNode}
                onChange={e => setSourceNode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="ward-1">Ward-1 Velachery Shelter</option>
                <option value="ward-2">Ward-2 Pallikaranai High School</option>
                <option value="ward-3">Ward-3 Madipakkam Community Hall</option>
                <option value="ward-4">Ward-4 Adyar Bridge Post</option>
                <option value="ward-5">Ward-5 Saidapet Metro Elevated</option>
                <option value="ward-6">Ward-6 Thoraipakkam IT Park Roof</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t.sensitive_notes}</label>
              <input
                type="text"
                placeholder="e.g. Bedridden senior, needs oxygen (Decrypted only at Hub)"
                value={conditionNotes}
                onChange={e => setConditionNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <textarea
              rows="2"
              placeholder={t.custom_placeholder}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className={`w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-slate-900 font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isElderly ? 'text-lg' : 'text-sm'
              }`}
            ></textarea>
          </div>

          <button
            onClick={() => handleSendSOS()}
            disabled={submitting || !message}
            className={`w-full min-h-[56px] bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 ${
              isElderly ? 'text-xl' : 'text-base'
            }`}
          >
            <Send className="w-5 h-5" />
            <span>{submitting ? t.sending : t.send_sos}</span>
          </button>
        </div>

        {/* Live Two-Way Rescue Tracker & Incoming Rescuer Messages */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className={`${isElderly ? 'text-xl' : 'text-base'} font-extrabold text-slate-900 uppercase tracking-wider flex items-center`}>
                <span className="w-3 h-3 rounded-full bg-blue-600 mr-2 animate-pulse"></span>
                {t.rescue_status_title}
              </h2>
              <p className="text-xs text-slate-600 font-medium">Real-time two-way sync with Central Relief Hub via SSE</p>
            </div>
            {activeCase && (
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold font-mono-code ${
                activeCase.triage_tag === 'RED' ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950'
              }`}>
                TAG: {activeCase.triage_tag} (Score: {activeCase.triage_score})
              </span>
            )}
          </div>

          {!activeCase ? (
            <div className="p-8 text-center text-slate-500 text-sm font-medium">
              {t.no_active_sos}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">{t.route_eta}</span>
                  <span className="font-mono-code text-blue-700 font-extrabold text-lg">
                    {activeCase.mission_route?.eta_minutes || 12} MINS
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Assigned Transit Mode:</span>
                  <span className="text-emerald-800 font-bold">
                    {activeCase.mission_route?.transport_mode || 'Amphibious Rescue Boat'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">{t.supplies_on_way}</span>
                  <span className="text-slate-900 font-mono-code font-bold">
                    {Object.entries(activeCase.allocated_supplies || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'Standard Food/Water Pack'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono-code text-slate-600">
                  <span>BLE Header Frame: <strong className="text-emerald-700">{activeCase.ble_header_bytes || 128} B (≤250 Ready)</strong></span>
                  <span>Wi-Fi Direct Payload: <strong className="text-blue-700">{activeCase.wifi_direct_attachment_bytes || 1840} B</strong></span>
                </div>
              </div>

              {/* Digital Signed Ration Token Card */}
              {activeCase.ration_token && (
                <div className="p-5 bg-gradient-to-r from-blue-50 to-slate-50 border-2 border-blue-200 rounded-2xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono-code text-blue-700 uppercase tracking-wider block font-bold">
                        UN SDG 2: ZERO HUNGER
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-base mt-0.5">{t.token_title}</h4>
                      <p className="text-xs font-mono-code text-slate-700 mt-1">
                        Token ID: <span className="text-blue-700 font-bold">{activeCase.ration_token.tokenId}</span>
                      </p>
                      <p className="text-xs text-emerald-700 font-medium mt-0.5">
                        Ed25519 Sig: {activeCase.ration_token.ed25519_signature?.slice(0, 24)}...
                      </p>

                      <div className="mt-3.5 flex items-center space-x-2">
                        <button
                          onClick={handleClaimRation}
                          className={`min-h-[52px] px-5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 shadow-sm ${
                            activeCase.ration_token.status === 'REDEEMED'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            {activeCase.ration_token.status === 'REDEEMED' ? t.redeemed : t.redeem_btn}
                          </span>
                        </button>
                        <button
                          onClick={() => setShowQrModal(true)}
                          className="min-h-[52px] px-4 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 shadow-sm"
                        >
                          <QrCode className="w-4 h-4 text-blue-600" />
                          <span>Show QR</span>
                        </button>
                      </div>

                      {claimStatus === 'DOUBLE_CLAIM_BLOCKED' && (
                        <div className="mt-2.5 text-red-700 text-xs font-bold flex items-center bg-red-50 p-2 rounded-lg border border-red-200">
                          <AlertTriangle className="w-4 h-4 mr-1 text-red-600" /> DOUBLE_CLAIM_BLOCKED — Fraud Prevented!
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 shrink-0">
                      <QRCodeSVG
                        value={JSON.stringify({
                          tokenId: activeCase.ration_token.tokenId,
                          sig: activeCase.ration_token.ed25519_signature?.slice(0, 20)
                        })}
                        size={88}
                        bgColor="#FFFFFF"
                        fgColor="#0F172A"
                      />
                      <span className="block text-center text-[8px] font-bold text-slate-700 mt-1">OFFLINE QR</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Incoming Messages from Laptop Rescuer */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  {t.rescuer_msg_incoming}
                </h4>
                {replies.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl text-slate-500 text-xs text-center border border-slate-200 font-medium">
                    Awaiting dispatch transmission from field coordinator...
                  </div>
                ) : (
                  replies.map(r => (
                    <div key={r.id} className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-blue-900 font-mono-code">{r.rescuer_callsign}</span>
                        <span className="text-slate-500 text-[10px]">{new Date(r.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm text-slate-900 font-semibold">"{r.text}"</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Offline QR Export Modal */}
      {showQrModal && activeCase?.ration_token && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">
              Signed Digital Ration QR
            </h3>
            <div className="bg-white p-4 rounded-2xl mx-auto inline-block border border-slate-200 shadow-md">
              <QRCodeSVG
                value={JSON.stringify({
                  tokenId: activeCase.ration_token.tokenId,
                  source: activeCase.source_name,
                  supplies: activeCase.allocated_supplies,
                  sig: activeCase.ration_token.ed25519_signature
                })}
                size={210}
                bgColor="#FFFFFF"
                fgColor="#0F172A"
              />
            </div>
            <p className="text-xs text-slate-800 font-mono-code font-bold">
              Token ID: {activeCase.ration_token.tokenId}
            </p>
            <p className="text-xs text-emerald-800 font-semibold">
              Verified by Central Disaster Relief Hub
            </p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full min-h-[52px] bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-sm transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
