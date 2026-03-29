import { LanguageCode, RiskResponse } from './types';

type Dictionary = {
  [key in LanguageCode]: {
    appTitle: string;
    appSubtitle: string;
    online: string;
    offline: string;
    pendingSync: string;
    syncNow: string;
    assessRisk: string;
    clearForm: string;
    result: string;
    recommendations: string;
    assistant: string;
    patientName: string;
    age: string;
    systolic: string;
    diastolic: string;
    bmi: string;
    heartRate: string;
    bloodSugar: string;
    temperature: string;
    hemoglobin: string;
    pcos: string;
    prevComplications: string;
    preexistingDiabetes: string;
    mentalHealth: string;
    sleepPattern: string;
    exercise: string;
    education: string;
  };
};

export const text: Dictionary = {
  en: {
    appTitle: 'BloomCare Stage 1',
    appSubtitle: 'Offline Maternal Risk Triage',
    online: 'Online',
    offline: 'Offline',
    pendingSync: 'Pending sync records',
    syncNow: 'Sync Now',
    assessRisk: 'Assess Risk',
    clearForm: 'Reset Form',
    result: 'Risk Result',
    recommendations: 'Recommendations',
    assistant: 'AI Decision Assistant',
    patientName: 'Patient Name',
    age: 'Age',
    systolic: 'Systolic BP',
    diastolic: 'Diastolic BP',
    bmi: 'BMI',
    heartRate: 'Heart Rate',
    bloodSugar: 'Blood Sugar',
    temperature: 'Body Temperature',
    hemoglobin: 'Hemoglobin',
    pcos: 'PCOS (0/1)',
    prevComplications: 'Previous Complications (0/1)',
    preexistingDiabetes: 'Preexisting Diabetes (0/1)',
    mentalHealth: 'Mental Health Score (1-10)',
    sleepPattern: 'Sleep Hours',
    exercise: 'Exercise Score (0-5)',
    education: 'Education Score (0-5)'
  },
  si: {
    appTitle: 'BloomCare අදියර 1',
    appSubtitle: 'අන්තර්ජාලය නොමැති මව් අවදානම් තක්සේරු කිරීම',
    online: 'සම්බන්ධයි',
    offline: 'අසම්බන්ධයි',
    pendingSync: 'සමමුහුර්ත නොකළ වාර්තා',
    syncNow: 'දැන් සමමුහුර්ත කරන්න',
    assessRisk: 'අවදානම තක්සේරු කරන්න',
    clearForm: 'පෝරමය නැවත සකසන්න',
    result: 'අවදානම් ප්‍රතිඵලය',
    recommendations: 'නිර්දේශ',
    assistant: 'AI තීරණ සහායක',
    patientName: 'රෝගියාගේ නම',
    age: 'වයස',
    systolic: 'ඉහළ රුධිර පීඩනය',
    diastolic: 'පහළ රුධිර පීඩනය',
    bmi: 'BMI',
    heartRate: 'හෘද ස්පන්දන වේගය',
    bloodSugar: 'රුධිර සීනි',
    temperature: 'ශරීර උෂ්ණත්වය',
    hemoglobin: 'හීමොග්ලොබින්',
    pcos: 'PCOS (0/1)',
    prevComplications: 'පෙර සංකූලතා (0/1)',
    preexistingDiabetes: 'පවතින දියවැඩියාව (0/1)',
    mentalHealth: 'මානසික සෞඛ්‍ය ලකුණු (1-10)',
    sleepPattern: 'නින්ද පැය',
    exercise: 'ව්‍යායාම ලකුණු (0-5)',
    education: 'අධ්‍යාපන ලකුණු (0-5)'
  },
  ta: {
    appTitle: 'BloomCare நிலை 1',
    appSubtitle: 'ஆஃப்லைன் தாய் அபாய திரையிடல்',
    online: 'இணைப்பு உள்ளது',
    offline: 'இணைப்பு இல்லை',
    pendingSync: 'ஒத்திசைக்காத பதிவுகள்',
    syncNow: 'இப்போது ஒத்திசை',
    assessRisk: 'அபாயத்தை மதிப்பிடு',
    clearForm: 'படிவம் மீட்டமை',
    result: 'அபாய முடிவு',
    recommendations: 'பரிந்துரைகள்',
    assistant: 'AI தீர்மான உதவியாளர்',
    patientName: 'நோயாளர் பெயர்',
    age: 'வயது',
    systolic: 'மேல் இரத்த அழுத்தம்',
    diastolic: 'கீழ் இரத்த அழுத்தம்',
    bmi: 'BMI',
    heartRate: 'இதய துடிப்பு',
    bloodSugar: 'இரத்த சர்க்கரை',
    temperature: 'உடல் வெப்பநிலை',
    hemoglobin: 'ஹீமோகுளோபின்',
    pcos: 'PCOS (0/1)',
    prevComplications: 'முந்தைய சிக்கல்கள் (0/1)',
    preexistingDiabetes: 'முன் நீரிழிவு (0/1)',
    mentalHealth: 'மனநிலை மதிப்பெண் (1-10)',
    sleepPattern: 'தூக்க நேரம்',
    exercise: 'உடற்பயிற்சி மதிப்பெண் (0-5)',
    education: 'கல்வி மதிப்பெண் (0-5)'
  }
};

export const assistantNarrative = (language: LanguageCode, risk: RiskResponse): string => {
  const level = risk.risk_level === 'high' ? 'high' : 'low';

  if (language === 'si') {
    if (level === 'high') {
      return `ඉහළ අවදානමක් හඳුනාගෙන ඇත (ලකුණ ${Math.round(risk.risk_score * 100)}%). දුරස්ථ ප්‍රතිකාර මත රඳා නොසිට ඉක්මනින් Stage 2 පරීක්ෂණයට යොමු කර BP නැවත මැනවීම කරන්න.`;
    }
    return `අවදානම අඩු මට්ටමේ පවතිනවා (${Math.round(risk.risk_score * 100)}%). සති 1-2 තුළ නැවත පරීක්ෂණයක් සකසා නිතිපතා නිරීක්ෂණය කරගෙන යන්න.`;
  }

  if (language === 'ta') {
    if (level === 'high') {
      return `உயர் அபாயம் கண்டறியப்பட்டது (${Math.round(risk.risk_score * 100)}%). 15 நிமிடங்களில் BP மீண்டும் அளந்து உடனடி Stage 2 மருத்துவ மதிப்பீட்டிற்கு உயர்த்தவும்.`;
    }
    return `அபாயம் தற்போது குறைவு (${Math.round(risk.risk_score * 100)}%). 1-2 வாரங்களுக்குள் மீள் திரையிடல் செய்து வழக்கமான கண்காணிப்பை தொடரவும்.`;
  }

  if (level === 'high') {
    return `High-risk profile detected (${Math.round(risk.risk_score * 100)}%). Repeat BP in 15 minutes and escalate to Stage 2 hospital review.`;
  }
  return `Risk is currently low (${Math.round(risk.risk_score * 100)}%). Continue routine maternal monitoring and rescreen in 1-2 weeks.`;
};
