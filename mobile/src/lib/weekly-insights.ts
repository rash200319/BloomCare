import { LanguageCode } from '../types'

type LocalizedString = {
  en: string
  si: string
  ta: string
}

type Fact = {
  title: LocalizedString
  description: LocalizedString
}

type WeeklyInsight = {
  week: number
  description: LocalizedString
  facts: Fact[]
}

type EnglishFact = {
  title: LocalizedString
  description: LocalizedString
}

type EnglishWeeklyInsight = {
  week: number
  description: LocalizedString
  facts: [EnglishFact, EnglishFact, EnglishFact]
}

type SelectedFact = {
  title: string
  description: string
}

type SelectedWeeklyInsight = {
  week: number
  description: string
  facts: SelectedFact[]
}

const EN_WEEKLY_INSIGHTS: Record<number, EnglishWeeklyInsight> = {
  1: {
  week: 1,
  description: {
    en: "This week is counted from your last menstrual period, so pregnancy has not biologically started yet.",
    si: "මෙම සතිය ඔබගේ අවසාන මාසික වාරයෙන් ගණනය කරන බැවින්, සැබෑ ගර්භණීභාවය තවම ආරම්භ වී නොමැත.",
    ta: "இந்த வாரம் உங்கள் கடைசி மாதவிடாய் முதல் கணக்கிடப்படுகிறது, ஆகையால் உண்மையான கர்ப்பம் இன்னும் தொடங்கவில்லை."
  },
  facts: [
    {
      title: {
        en: "Start Folic Acid",
        si: "ෆොලික් අම්ලය ආරම්භ කරන්න",
        ta: "ஃபோலிக் அமிலம் தொடங்குங்கள்"
      },
      description: {
        en: "Begin prenatal vitamins with 400 to 800 mcg folic acid daily.",
        si: "දිනපතා 400–800 මයික්‍රෝග්‍රෑම් ෆොලික් අම්ලය අඩංගු ගර්භණී විටමින් භාවිතය ආරම්භ කරන්න.",
        ta: "நாள்தோறும் 400–800 மைக்ரோகிராம் ஃபோலிக் அமிலம் கொண்ட கர்ப்ப கால விட்டமின்களை தொடங்குங்கள்."
      }
    },
    {
      title: {
        en: "Build Healthy Routines",
        si: "සෞඛ්‍යවත් දෛනික පුරුදු ඇතිකරගන්න",
        ta: "ஆரோக்கியமான பழக்கங்களை உருவாக்குங்கள்"
      },
      description: {
        en: "Prioritize sleep, hydration, and steady meals to support early pregnancy.",
        si: "නින්ද, ජල පාන සහ නිසි ආහාර වේලට ප්‍රමුඛත්වය දීම ආරම්භක අවධියේ වැදගත්ය.",
        ta: "தூக்கம், நீர் உட்கொள்ளல் மற்றும் ஒழுங்கான உணவு ஆரம்ப கர்ப்பத்திற்கு முக்கியம்."
      }
    },
    {
      title: {
        en: "Avoid Harmful Substances",
        si: "හානිකර ද්‍රව්‍ය වලින් වැළකෙන්න",
        ta: "தீங்கு விளைவிக்கும் பொருட்களை தவிர்க்கவும்"
      },
      description: {
        en: "Avoid alcohol, smoking, and recreational drugs from now onward.",
        si: "මේ මොහොතේ සිට මත්පැන්, දුම්පානය සහ මත්ද්‍රව්‍ය වලින් සම්පූර්ණයෙන්ම වළකින්න.",
        ta: "இப்போதிலிருந்து மதுபானம், புகைபிடித்தல் மற்றும் போதைப்பொருட்களை தவிர்க்கவும்."
      }
    }
  ]
},
2: {
  week: 2,
  description: {
    en: "Ovulation and fertilization can happen around the end of this week.",
    si: "මෙම සතිය අවසානයේ ඌෂ්මණය සහ ගර්භාධානය සිදුවිය හැක.",
    ta: "இந்த வார இறுதியில் ஒவுலேஷன் மற்றும் கருவுறுதல் நடைபெறலாம்."
  },
  facts: [
    {
      title: { en: "Time Conception Window", si: "ගර්භාධානයට සුදුසු කාලය සැලසුම් කරන්න", ta: "கருவுறும் காலத்தை கண்காணிக்கவும்" },
      description: {
        en: "Intercourse near ovulation can increase chances of conception.",
        si: "ඌෂ්මණ කාලයේ සම්බන්ධතාවය ගර්භාධානයේ අවස්ථාව වැඩි කරයි.",
        ta: "ஒவுலேஷன் காலத்தில் உடலுறவு கர்ப்பமாகும் வாய்ப்பை அதிகரிக்கும்."
      }
    },
    {
      title: { en: "Limit Caffeine", si: "කැෆේන් සීමා කරන්න", ta: "கஃபீன் குறைக்கவும்" },
      description: {
        en: "Keep caffeine around or below 200 mg per day.",
        si: "දිනකට 200 mgට අඩු කැෆේන් පරිභෝජනය කරන්න.",
        ta: "நாளொன்றுக்கு 200 mgக்கு குறைவாக கஃபீன் எடுத்துக்கொள்ளவும்."
      }
    },
    {
      title: { en: "Review Medications", si: "ඖෂධ පරීක්ෂා කරන්න", ta: "மருந்துகளை பரிசீலிக்கவும்" },
      description: {
        en: "Ask your clinician to review all current medicines and supplements.",
        si: "ඔබ භාවිතා කරන සියලුම ඖෂධ වෛද්‍යවරයා සමඟ සමාලෝචනය කරන්න.",
        ta: "நீங்கள் எடுத்துக்கொள்ளும் அனைத்து மருந்துகளையும் மருத்துவருடன் பரிசீலிக்கவும்."
      }
    }
  ]
},
3: {
  week: 3,
  description: {
    en: "A fertilized egg may implant in the uterus and early hormone changes begin.",
    si: "ගර්භාධානය වූ බීජය ගර්භාශයේ සවිවීමත් සමඟ හෝමෝන වෙනස්වීම් ආරම්භ වේ.",
    ta: "கருவுற்ற முட்டை கருப்பையில் பதிய ஆரம்பிக்கும் மற்றும் ஹார்மோன் மாற்றங்கள் தொடங்கும்."
  },
  facts: [
    {
      title: { en: "Watch Bleeding Pattern", si: "රුධිර වහනය නිරීක්ෂණය කරන්න", ta: "இரத்தப்போக்கை கவனிக்கவும்" },
      description: {
        en: "Light spotting may occur, but heavy bleeding needs medical advice.",
        si: "සුළු රුධිර වහනය සාමාන්‍ය විය හැකි නමුත් වැඩි වුවහොත් වෛද්‍ය උපදෙස් අවශ්‍යය.",
        ta: "சிறிய இரத்தப்போக்கு சாதாரணமாக இருக்கலாம், ஆனால் அதிகமாக இருந்தால் மருத்துவரை அணுகவும்."
      }
    },
    {
      title: { en: "Continue Prenatal Vitamins", si: "විටමින් දිගටම ගන්න", ta: "விட்டமின்களை தொடரவும்" },
      description: {
        en: "Daily folic acid remains important for neural development.",
        si: "බිළිඳාගේ මොළ වර්ධනය සඳහා ෆොලික් අම්ලය වැදගත්ය.",
        ta: "குழந்தையின் மூளை வளர்ச்சிக்கு ஃபோலிக் அமிலம் அவசியம்."
      }
    },
    {
      title: { en: "Stay Lightly Active", si: "සුළු ව්‍යායාම කරන්න", ta: "லேசான உடற்பயிற்சி செய்யவும்" },
      description: {
        en: "Gentle movement like walking is usually helpful and safe.",
        si: "පදනම් වශයෙන් ඇවිදීම වැනි ව්‍යායාම ආරක්ෂිතය.",
        ta: "நடப்பது போன்ற மென்மையான உடற்பயிற்சி பாதுகாப்பானது."
      }
    }
  ]
},

4: {
  week: 4,
  description: {
    en: "Pregnancy tests often become positive around this week.",
    si: "මෙම සතියේදී ගර්භණී පරීක්ෂාව ධනාත්මක විය හැක.",
    ta: "இந்த வாரத்தில் கர்ப்ப பரிசோதனை நேர்மையாக வரும்."
  },
  facts: [
    {
      title: { en: "Book First Visit", si: "පළමු වෛද්‍ය හමුව සකස් කරන්න", ta: "முதல் பரிசோதனைக்கு நேரம் ஒதுக்குங்கள்" },
      description: {
        en: "Schedule your first antenatal appointment as soon as possible.",
        si: "ඉක්මනින් පළමු ගර්භණී පරීක්ෂාව සකස් කරන්න.",
        ta: "விரைவில் உங்கள் முதல் கர்ப்ப பரிசோதனையை பதிவு செய்யவும்."
      }
    },
    {
      title: { en: "Manage Early Nausea", si: "වමනය පාලනය කරන්න", ta: "வாந்தியை கட்டுப்படுத்துங்கள்" },
      description: {
        en: "Use small, frequent meals to reduce nausea and fatigue.",
        si: "සුළු වාරික ආහාර මඟින් වමනය අඩු කරගන්න.",
        ta: "சிறு அளவு உணவை அடிக்கடி எடுத்துக்கொள்வது உதவும்."
      }
    },
    {
      title: { en: "Use Food Safety Rules", si: "ආහාර ආරක්ෂාව පිළිපදින්න", ta: "உணவு பாதுகாப்பை பின்பற்றவும்" },
      description: {
        en: "Avoid unpasteurized foods and undercooked meat.",
        si: "අපිසුණු ආහාර සහ අඩු පිසූ මස් වලින් වළකින්න.",
        ta: "சமைக்காத உணவுகள் மற்றும் பாஸ்சுரைஸ் செய்யாதவற்றை தவிர்க்கவும்."
      }
    }
  ]
},

// Weeks 5–10 done same quality (kept concise for length)

5: {
  week: 5,
  description: {
    en: "The embryo is developing quickly and early heart structures are forming.",
    si: "භ්රූණය ඉක්මනින් වර්ධනය වෙමින් හෘදය ආරම්භ වේ.",
    ta: "கரு வேகமாக வளர்ந்து இதயம் உருவாக தொடங்குகிறது."
  },
  facts: [
    {
      title: { en: "Nausea Is Common", si: "වමනය සාමාන්‍යය", ta: "வாந்தி சாதாரணம்" },
      description: {
        en: "Morning sickness can happen at any time of day.",
        si: "වමනය දවසේ ඕනෑම වෙලාවක ඇතිවිය හැක.",
        ta: "வாந்தி எந்த நேரத்திலும் ஏற்படலாம்."
      }
    },
    {
      title: { en: "Try Simple Relief", si: "සරල විසඳුම් උත්සාහ කරන්න", ta: "எளிய நிவாரணம் முயற்சிக்கவும்" },
      description: {
        en: "Ginger or vitamin B6 may help if your clinician agrees.",
        si: "ඉඟුරු හෝ B6 උදව් විය හැක.",
        ta: "இஞ்சி அல்லது B6 உதவலாம்."
      }
    },
    {
      title: { en: "Escalate Severe Vomiting", si: "ගැඹුරු වමනයට ප්‍රතිකාර ගන්න", ta: "கடுமையான வாந்திக்கு சிகிச்சை பெறவும்" },
      description: {
        en: "Seek care if vomiting prevents fluid or food intake.",
        si: "ආහාර ගත නොහැකි නම් වෛද්‍ය උපදෙස් ගන්න.",
        ta: "உணவு உட்கொள்ள முடியாவிட்டால் மருத்துவரை அணுகவும்."
      }
    }
  ]
},
6: {
  week: 6,
  description: {
    en: "Early organ systems continue to form rapidly.",
    si: "මෙම අවධියේදී බිළිඳාගේ ප්‍රධාන අවයව වේගයෙන් වර්ධනය වෙමින් පවතී.",
    ta: "இந்த நிலையில் குழந்தையின் முக்கிய உறுப்புகள் வேகமாக உருவாகிக்கொண்டிருக்கின்றன."
  },
  facts: [
    {
      title: {
        en: "Expect Body Changes",
        si: "ශරීරයේ වෙනස්වීම් අපේක්ෂා කරන්න",
        ta: "உடல் மாற்றங்களை எதிர்பார்க்கவும்"
      },
      description: {
        en: "Breast tenderness and frequent urination are common.",
        si: "ස්තන වේදනාව සහ නිතර මුත්‍රා කිරීම සාමාන්‍ය ලක්ෂණ වේ.",
        ta: "மார்பு வலி மற்றும் அடிக்கடி சிறுநீர் கழித்தல் சாதாரணமாக இருக்கும்."
      }
    },
    {
      title: {
        en: "Prioritize Protein",
        si: "ප්‍රෝටීන් ප්‍රමුඛ කරගන්න",
        ta: "புரதம் அதிகரிக்கவும்"
      },
      description: {
        en: "Add protein snacks to keep energy more stable.",
        si: "ශක්තිය ස්ථිරව තබාගැනීමට ප්‍රෝටීන් අඩංගු ආහාර එක්කරන්න.",
        ta: "உடல் சக்தி நிலையாக இருக்க புரதம் கொண்ட சிற்றுண்டிகளை சேர்க்கவும்."
      }
    },
    {
      title: {
        en: "Know Urgent Signs",
        si: "හදිසි ලක්ෂණ හඳුනාගන්න",
        ta: "அவசர அறிகுறிகளை அறியுங்கள்"
      },
      description: {
        en: "Get urgent care for severe pain, fever, or heavy bleeding.",
        si: "තද වේදනාව, උණ හෝ වැඩි රුධිර වහනය ඇතිවුවහොත් වහා වෛද්‍ය උපකාර ලබාගන්න.",
        ta: "கடுமையான வலி, காய்ச்சல் அல்லது அதிக இரத்தப்போக்கு இருந்தால் உடனடி சிகிச்சை பெறவும்."
      }
    }
  ]
},

7: {
  week: 7,
  description: {
    en: "Brain and facial structures are growing at high speed.",
    si: "බිළිඳාගේ මොළය සහ මුහුණේ කොටස් වේගයෙන් වර්ධනය වෙමින් පවතී.",
    ta: "குழந்தையின் மூளை மற்றும் முக அமைப்புகள் வேகமாக வளர்கின்றன."
  },
  facts: [
    {
      title: {
        en: "Respect Fatigue",
        si: "තෙහෙට්ටුව ගරු කරන්න",
        ta: "சோர்வை கவனியுங்கள்"
      },
      description: {
        en: "Strong tiredness is common and rest is essential.",
        si: "තද තෙහෙට්ටුව සාමාන්‍ය වන අතර විවේකය අත්‍යවශ්‍ය වේ.",
        ta: "கடுமையான சோர்வு சாதாரணம், ஓய்வு அவசியம்."
      }
    },
    {
      title: {
        en: "Hydrate Through Day",
        si: "දවස පුරා ජලය පානය කරන්න",
        ta: "நாளெங்கும் தண்ணீர் குடிக்கவும்"
      },
      description: {
        en: "Keep fluids nearby and sip consistently.",
        si: "සෑම වෙලාවකම ජලය සමීපව තබා නිතර පානය කරන්න.",
        ta: "எப்போதும் தண்ணீர் அருகில் வைத்து அடிக்கடி குடிக்கவும்."
      }
    },
    {
      title: {
        en: "Treat Severe Nausea",
        si: "ගැඹුරු වමනයට ප්‍රතිකාර ගන්න",
        ta: "கடுமையான வாந்திக்கு சிகிச்சை பெறவும்"
      },
      description: {
        en: "Ask early about pregnancy-safe anti-nausea options.",
        si: "වමනය අඩු කිරීමට ආරක්ෂිත ඖෂධ පිළිබඳ වෛද්‍ය උපදෙස් ගන්න.",
        ta: "வாந்தி கட்டுப்படுத்த பாதுகாப்பான மருந்துகள் பற்றி மருத்துவரிடம் கேளுங்கள்."
      }
    }
  ]
},

8: {
  week: 8,
  description: {
    en: "Limb development continues and major organs keep maturing.",
    si: "අත්පා සහ ප්‍රධාන අවයවයන් තවදුරටත් වර්ධනය වෙමින් පවතී.",
    ta: "கைகள், கால்கள் மற்றும் முக்கிய உறுப்புகள் தொடர்ந்து வளர்கின்றன."
  },
  facts: [
    {
      title: {
        en: "Prevent Constipation",
        si: "මලබද්ධය වළක්වාගන්න",
        ta: "மலச்சிக்கலை தவிர்க்கவும்"
      },
      description: {
        en: "Increase fiber and water gradually to ease bowel discomfort.",
        si: "ජලය සහ තන්තුවලින් පිරි ආහාර වැඩි කිරීමෙන් මලබද්ධය අඩු කරගත හැක.",
        ta: "நார்ச்சத்து மற்றும் தண்ணீர் அதிகரிப்பதால் மலச்சிக்கல் குறையும்."
      }
    },
    {
      title: {
        en: "Walk Daily",
        si: "දිනපතා ඇවිදින්න",
        ta: "தினமும் நடைபயிற்சி செய்யவும்"
      },
      description: {
        en: "Daily walking often helps digestion and mood.",
        si: "දිනපතා ඇවිදීම ජීර්ණය සහ මනෝභාවය සඳහා උපකාරී වේ.",
        ta: "தினசரி நடைபயிற்சி ஜீரணத்தையும் மனநிலையையும் மேம்படுத்தும்."
      }
    },
    {
      title: {
        en: "Check Before Medicines",
        si: "ඖෂධ ගන්න පෙර පරීක්ෂා කරන්න",
        ta: "மருந்து எடுத்துக்கொள்ளும் முன் பரிசீலிக்கவும்"
      },
      description: {
        en: "Do not self-medicate without clinical guidance.",
        si: "වෛද්‍ය උපදෙස් නොමැතිව ඖෂධ භාවිතා නොකරන්න.",
        ta: "மருத்துவர் ஆலோசனை இல்லாமல் மருந்து எடுத்துக்கொள்ள வேண்டாம்."
      }
    }
  ]
},

9: {
  week: 9,
  description: {
    en: "The embryo is now called a fetus and growth remains rapid.",
    si: "මෙම අවධියේදී භ්‍රූණය ‘බිළිඳා’ ලෙස හැඳින්වෙන අතර වර්ධනය වේගයෙන් සිදු වේ.",
    ta: "இந்த நிலையில் கரு ‘குழந்தை’ என அழைக்கப்படுகிறது மற்றும் வேகமாக வளர்கிறது."
  },
  facts: [
    {
      title: {
        en: "Track Emotions",
        si: "මනෝභාවය නිරීක්ෂණය කරන්න",
        ta: "உணர்ச்சிகளை கவனிக்கவும்"
      },
      description: {
        en: "Mood changes are common, so monitor emotional wellbeing.",
        si: "මනෝභාවයේ වෙනස්වීම් සාමාන්‍ය බැවින් එය සැලකිල්ලෙන් නිරීක්ෂණය කරන්න.",
        ta: "மனநிலை மாற்றங்கள் சாதாரணம், எனவே உணர்ச்சிகளை கவனிக்கவும்."
      }
    },
    {
      title: {
        en: "Use Support System",
        si: "සහාය ලබාගන්න",
        ta: "ஆதரவுகளை பயன்படுத்துங்கள்"
      },
      description: {
        en: "Ask family or partner for practical help when needed.",
        si: "අවශ්‍ය විට පවුලේ අය හෝ සහකරුගෙන් උදව් ඉල්ලන්න.",
        ta: "தேவைப்படும் போது குடும்பத்தினரிடமிருந்து உதவி பெறுங்கள்."
      }
    },
    {
      title: {
        en: "Keep A Weekly Log",
        si: "සතිපතා සටහන් තබාගන්න",
        ta: "வாராந்திர குறிப்புகளை வைத்திருங்கள்"
      },
      description: {
        en: "Record symptoms and questions for your next visit.",
        si: "ඔබට ඇති ලක්ෂණ සහ ප්‍රශ්න සටහන් කර තබාගන්න.",
        ta: "அடுத்த பரிசோதனைக்காக உங்கள் அறிகுறிகளை பதிவு செய்யுங்கள்."
      }
    }
  ]
},

10: {
  week: 10,
  description: {
    en: "Most major organs are formed and now continue maturing.",
    si: "ප්‍රධාන අවයව බොහෝදුරට සෑදී ඇති අතර තවදුරටත් වර්ධනය වෙමින් පවතී.",
    ta: "முக்கிய உறுப்புகள் பெரும்பாலும் உருவாகி தொடர்ந்து வளர்கின்றன."
  },
  facts: [
    {
      title: {
        en: "Eat Balanced Meals",
        si: "සමබර ආහාර ගන්න",
        ta: "சமநிலை உணவு சாப்பிடுங்கள்"
      },
      description: {
        en: "Focus on nutrient quality even if appetite varies.",
        si: "ආහාර රුචිය වෙනස් වුවද පෝෂණ ගුණයට අවධානය යොමු කරන්න.",
        ta: "உணவு விருப்பம் மாறினாலும் சத்தான உணவுகளை எடுத்துக்கொள்ளுங்கள்."
      }
    },
    {
      title: {
        en: "Support Iron Intake",
        si: "යකඩ පරිභෝජනය වැඩි කරන්න",
        ta: "இரும்புச் சத்து அதிகரிக்கவும்"
      },
      description: {
        en: "Pair iron-rich foods with vitamin C sources.",
        si: "යකඩ අඩංගු ආහාර විටමින් C සමඟ භාවිතා කරන්න.",
        ta: "இரும்புச் சத்து உள்ள உணவுகளை வைட்டமின் C உடன் சேர்த்து உட்கொள்ளவும்."
      }
    },
    {
      title: {
        en: "Discuss Screening",
        si: "පරීක්ෂා පිළිබඳ සාකච්ඡා කරන්න",
        ta: "திரையிடல் பற்றி ஆலோசிக்கவும்"
      },
      description: {
        en: "Review optional and routine prenatal tests with your provider.",
        si: "අවශ්‍ය පරීක්ෂාවන් පිළිබඳ වෛද්‍යවරයා සමඟ සාකච්ඡා කරන්න.",
        ta: "தேவையான பரிசோதனைகள் குறித்து மருத்துவருடன் ஆலோசிக்கவும்."
      }
    }
  ]
},
11: {
  week: 11,
  description: {
    en: "The placenta takes over more hormonal support functions.",
    si: "මෙම අවධියේදී ප්ලාසෙන්ටාව හෝමෝන සහාය වැඩි වශයෙන් භාරගනී.",
    ta: "இந்த நிலையில் பிளாசெண்டா ஹார்மோன் ஆதரவை அதிகமாக ஏற்றுக்கொள்கிறது."
  },
  facts: [
    {
      title: {
        en: "Manage Headaches",
        si: "හිසරදය පාලනය කරන්න",
        ta: "தலைவலியை கட்டுப்படுத்துங்கள்"
      },
      description: {
        en: "Hydration, rest, and regular meals may reduce headaches.",
        si: "ජලය ප්‍රමාණවත් ලෙස පානය කිරීම, විවේකය සහ නිතිපතා ආහාර ගැනීම හිසරදය අඩු කරයි.",
        ta: "தண்ணீர் குடித்தல், ஓய்வு மற்றும் ஒழுங்கான உணவு தலைவலியை குறைக்க உதவும்."
      }
    },
    {
      title: {
        en: "Protect Gum Health",
        si: "දන්ත මාංශ සෞඛ්‍යය ආරක්ෂා කරන්න",
        ta: "ஈறு ஆரோக்கியத்தை பாதுகாக்கவும்"
      },
      description: {
        en: "Gum sensitivity can increase, so maintain oral hygiene.",
        si: "දන්ත මාංශ සංවේදීතාව වැඩි විය හැකි බැවින් මුඛ සෞඛ්‍යය රැකගන්න.",
        ta: "ஈறுகளில் உணர்வு அதிகரிக்கலாம், எனவே வாய்ச் சுகாதாரத்தை பேணவும்."
      }
    },
    {
      title: {
        en: "Plan Dental Care",
        si: "දන්ත සත්කාර සැලසුම් කරන්න",
        ta: "பல் பராமரிப்பை திட்டமிடுங்கள்"
      },
      description: {
        en: "Routine dental cleaning is generally safe in pregnancy.",
        si: "සාමාන්‍ය දන්ත පිරිසිදු කිරීම ගර්භණී කාලයේ ආරක්ෂිත වේ.",
        ta: "சாதாரண பல் சுத்தம் கர்ப்ப காலத்தில் பொதுவாக பாதுகாப்பானது."
      }
    }
  ]
},

12: {
  week: 12,
  description: {
    en: "This marks the end of the first trimester for most mothers.",
    si: "මෙය බොහෝ මව්වරුන් සඳහා පළමු ත්‍රයිමාසිකය අවසන් වන අවස්ථාවයි.",
    ta: "இது பெரும்பாலான தாய்மார்களுக்கு முதல் திரைமாசத்தின் முடிவாகும்."
  },
  facts: [
    {
      title: {
        en: "Symptoms May Improve",
        si: "ලක්ෂණ අඩුවිය හැක",
        ta: "அறிகுறிகள் குறையலாம்"
      },
      description: {
        en: "Nausea often begins easing during this stage.",
        si: "මෙම අවධියේදී වමනය අඩුවීමට ආරම්භ විය හැක.",
        ta: "இந்த நிலையில் வாந்தி குறைய ஆரம்பிக்கும்."
      }
    },
    {
      title: {
        en: "Continue Follow Ups",
        si: "වෛද්‍ය පරීක්ෂා දිගටම කරගෙන යන්න",
        ta: "பரிசோதனைகளை தொடர்ந்து செய்யவும்"
      },
      description: {
        en: "Keep prenatal visits even if you feel better.",
        si: "ඔබට හොඳක් දැනුණත් වෛද්‍ය පරීක්ෂා නවතා නොගන්න.",
        ta: "நலம் என்று தோன்றினாலும் பரிசோதனைகளை தவிர்க்க வேண்டாம்."
      }
    },
    {
      title: {
        en: "Review Warning Signs",
        si: "අනතුරු ලක්ෂණ හඳුනාගන්න",
        ta: "எச்சரிக்கை அறிகுறிகளை அறியுங்கள்"
      },
      description: {
        en: "Learn urgent signs like heavy bleeding or fainting.",
        si: "වැඩි රුධිර වහනය හෝ සිහි නැතිවීම වැනි ලක්ෂණ හඳුනාගන්න.",
        ta: "அதிக இரத்தப்போக்கு அல்லது மயக்கம் போன்ற அறிகுறிகளை அறிந்துகொள்ளுங்கள்."
      }
    }
  ]
},

13: {
  week: 13,
  description: {
    en: "Second trimester begins and many mothers feel more energetic.",
    si: "දෙවන ත්‍රයිමාසිකය ආරම්භ වන අතර බොහෝ මව්වරුන්ට ශක්තිය වැඩි වේ.",
    ta: "இரண்டாம் திரைமாசம் தொடங்கி, பல தாய்மார்கள் அதிக சக்தி உணர்கிறார்கள்."
  },
  facts: [
    {
      title: {
        en: "Increase Smart Calories",
        si: "පෝෂණය සහිත කැලරි වැඩි කරන්න",
        ta: "சத்தான கலோரிகளை அதிகரிக்கவும்"
      },
      description: {
        en: "Add nutritious calories, not just larger portions.",
        si: "ආහාර ප්‍රමාණය නොව පෝෂණ ගුණය වැඩි කරන්න.",
        ta: "அளவை அல்ல, சத்துள்ள உணவுகளை அதிகரிக்கவும்."
      }
    },
    {
      title: {
        en: "Stay Active",
        si: "ක්‍රියාශීලීව සිටින්න",
        ta: "சுறுசுறுப்பாக இருங்கள்"
      },
      description: {
        en: "Moderate exercise helps circulation, sleep, and mood.",
        si: "මධ්‍යම ව්‍යායාම රුධිර ප්‍රවාහය, නින්ද සහ මනෝභාවය සඳහා හොඳය.",
        ta: "மிதமான உடற்பயிற்சி இரத்த ஓட்டம், தூக்கம் மற்றும் மனநிலைக்கு உதவும்."
      }
    },
    {
      title: {
        en: "Practice Side Sleeping",
        si: "පසෙකින් නිදන්න පුරුදු වෙන්න",
        ta: "பக்கமாக தூங்க பழகுங்கள்"
      },
      description: {
        en: "Try left-side sleeping for comfort and blood flow.",
        si: "සුවපහසුව සහ රුධිර ප්‍රවාහය සඳහා වම් පැත්තෙන් නිදන්න.",
        ta: "இடப்புறமாக தூங்குவது இரத்த ஓட்டத்திற்கும் நலத்திற்கும் உதவும்."
      }
    }
  ]
},

14: {
  week: 14,
  description: {
    en: "The fetus continues growing in length and movement.",
    si: "බිළිඳා දිගට සහ චලනයෙන් වර්ධනය වෙමින් පවතී.",
    ta: "குழந்தை நீளத்திலும் இயக்கத்திலும் தொடர்ந்து வளர்கிறது."
  },
  facts: [
    {
      title: {
        en: "Handle Nasal Stuffiness",
        si: "නාසික අවහිරතාව පාලනය කරන්න",
        ta: "மூக்கடைப்பை சமாளிக்கவும்"
      },
      description: {
        en: "Pregnancy hormones can cause nasal congestion.",
        si: "ගර්භණී හෝමෝන නිසා නාසය අවහිර විය හැක.",
        ta: "கர்ப்ப ஹார்மோன்கள் மூக்கடைப்பை ஏற்படுத்தலாம்."
      }
    },
    {
      title: {
        en: "Use Saline First",
        si: "මුලින්ම සාලයින් භාවිතා කරන්න",
        ta: "முதலில் சாலின் பயன்படுத்தவும்"
      },
      description: {
        en: "Try saline spray or humidification before medication.",
        si: "ඖෂධයට පෙර සාලයින් හෝ වායු ආර්ද්‍රතාවය භාවිතා කරන්න.",
        ta: "மருந்துக்கு முன் சாலின் அல்லது ஈரப்பதத்தை பயன்படுத்துங்கள்."
      }
    },
    {
      title: {
        en: "Follow Lab Schedule",
        si: "පරීක්ෂණ කාලසටහන අනුගමනය කරන්න",
        ta: "பரிசோதனை அட்டவணையை பின்பற்றவும்"
      },
      description: {
        en: "Complete recommended blood and urine tests on time.",
        si: "නිර්දේශිත රුධිර සහ මුත්‍රා පරීක්ෂණ කාලයට අනුව සිදුකරන්න.",
        ta: "பரிந்துரைக்கப்பட்ட இரத்த மற்றும் சிறுநீர் பரிசோதனைகளை நேரத்தில் செய்யவும்."
      }
    }
  ]
},

15: {
  week: 15,
  description: {
    en: "Bones are developing and movement increases, though often not yet felt.",
    si: "අස්ථි වර්ධනය වෙමින් පවතින අතර චලනය වැඩි වුවද තවමත් දැනෙන්නේ නැති විය හැක.",
    ta: "எலும்புகள் வளர்ந்து இயக்கம் அதிகரிக்கிறது, ஆனால் அது இன்னும் உணரப்படாமல் இருக்கலாம்."
  },
  facts: [
    {
      title: {
        en: "Support Bone Health",
        si: "අස්ථි සෞඛ්‍යය රැකගන්න",
        ta: "எலும்பு ஆரோக்கியத்தை பாதுகாக்கவும்"
      },
      description: {
        en: "Maintain calcium and vitamin D intake daily.",
        si: "දිනපතා කැල්සියම් සහ විටමින් D ලබාගන්න.",
        ta: "தினமும் கால்சியம் மற்றும் வைட்டமின் D எடுத்துக்கொள்ளுங்கள்."
      }
    },
    {
      title: {
        en: "Ease Back Strain",
        si: "පිටු වේදනාව අඩු කරන්න",
        ta: "முதுகு வலியை குறைக்கவும்"
      },
      description: {
        en: "Light stretching can reduce early back discomfort.",
        si: "සුළු ඇදවැටීම් ව්‍යායාම පිටු වේදනාව අඩු කරයි.",
        ta: "லேசான நீட்டிப்பு பயிற்சிகள் முதுகு வலியை குறைக்கும்."
      }
    },
    {
      title: {
        en: "Wear Supportive Footwear",
        si: "සහාය දෙන පාදරක්ෂාව භාවිතා කරන්න",
        ta: "ஆதரவான காலணிகள் அணியுங்கள்"
      },
      description: {
        en: "Supportive shoes help balance as posture shifts.",
        si: "ශරීර ස්ථානය වෙනස් වීමේදී සමාන්‍ය තත්ත්වය රැකගැනීමට උපකාරී වේ.",
        ta: "உடல் சமநிலையை பராமரிக்க உதவும் காலணிகள் அணியுங்கள்."
      }
    }
  ]
},
16: {
  week: 16,
  description: {
    en: "Some mothers begin to feel subtle fetal movement around this time.",
    si: "මෙම අවධියේදී සමහර මව්වරුන් බිළිඳාගේ සුක්ෂම චලනයක් දැනෙන්න පටන් ගනී.",
    ta: "இந்த நேரத்தில் சில தாய்மார்கள் சற்று குழந்தையின் இயக்கத்தை உணர ஆரம்பிக்கிறார்கள்."
  },
  facts: [
    {
      title: {
        en: "Prepare Anatomy Scan",
        si: "අංග විශේෂාංග පරීක්ෂණය සූදානම් කරන්න",
        ta: "அனடமி ஸ்கேன் தயாராகுங்கள்"
      },
      description: {
        en: "Plan your mid-pregnancy scan and key questions.",
        si: "ගර්භණී කාලයේ මධ්‍ය පරීක්ෂණය සහ ප්‍රධාන ප්‍රශ්න සැලසුම් කරන්න.",
        ta: "மத்திய கர்ப்ப கால ஸ்கேன் மற்றும் முக்கிய கேள்விகளை திட்டமிடுங்கள்."
      }
    },
    {
      title: {
        en: "Watch Iron Needs",
        si: "ආයර්න් අවශ්‍යතා පරීක්ෂා කරන්න",
        ta: "இரும்பு தேவையை கவனிக்கவும்"
      },
      description: {
        en: "Iron demand rises, so review diet and supplements.",
        si: "ආයර්න් අවශ්‍යතා වැඩි වීම නිසා ආහාර සහ අතිරික්ත උපාංග පරීක්ෂා කරන්න.",
        ta: "இரும்பு தேவைகள் அதிகரிக்கும், ஆகவே உணவு மற்றும் சப்பிளிமெண்ட்களை மதிப்பாய்வு செய்யவும்."
      }
    },
    {
      title: {
        en: "Report Dizziness",
        si: "තැන්පතු නැතිවීම වාර්තා කරන්න",
        ta: "தலை சுழறல் அறிக்கையிடவும்"
      },
      description: {
        en: "Persistent dizziness or palpitations should be assessed.",
        si: "දිගු කාලීන තැන්පතු නැතිවීම හෝ හෘද තලානාව පිළිබඳව වෛද්‍යවරුන් විසින් පරීක්ෂා කළ යුතුය.",
        ta: "நிறுவன தலைசுழறல் அல்லது இதயமுடக்கத்தை மதிப்பீடு செய்ய வேண்டும்."
      }
    }
  ]
},

17: {
  week: 17,
  description: {
    en: "Placental support remains strong while growth continues.",
    si: "ප්ලාසෙන්ටා සහාය තවත් ශක්තිමත් වන අතර වර්ධනය දිගටම සිදු වේ.",
    ta: "பிளாசெண்டா ஆதரவு வலுவாக இருக்கும் போது வளர்ச்சி தொடர்கிறது."
  },
  facts: [
    {
      title: {
        en: "Expect Skin Changes",
        si: "සැලකිය යුතු සම වෙනස්කම්",
        ta: "சரும மாற்றங்களை எதிர்பார்க்கவும்"
      },
      description: {
        en: "Pigmentation changes can be normal in pregnancy.",
        si: "ගර්භණී කාලයේ සමයේ වර්ණ වෙනස්කම් සාමාන්‍යය.",
        ta: "கர்ப்ப காலத்தில் நிற மாற்றங்கள் சாதாரணமாக இருக்கலாம்."
      }
    },
    {
      title: {
        en: "Use Sun Protection",
        si: "සූරිය ආරක්ෂාව භාවිතා කරන්න",
        ta: "சூரிய பாதுகாப்பைப் பயன்படுத்துங்கள்"
      },
      description: {
        en: "Sunscreen helps prevent dark patches from worsening.",
        si: "සන්ස්ක්‍රීන් භාවිතය කළු ලප වර්ධනය වීම වැලැක්වීමට උපකාරී වේ.",
        ta: "சன்ஸ்கிரீன் கறுப்பான தழும்புகளை அதிகரிப்பதைத் தடுக்கும்."
      }
    },
    {
      title: {
        en: "Train Core Gently",
        si: "මධ්‍ය සන්ධාන සැහැල්ලුවෙන් පුහුණු කරන්න",
        ta: "மையப்பகுதியில் மெதுவாக பயிற்சி செய்யவும்"
      },
      description: {
        en: "Safe prenatal core work can reduce back strain later.",
        si: "ආරක්ෂිත මධ්‍ය පුහුණු වැඩ පිටු වේදනාව අඩු කරයි.",
        ta: "பாதுகாப்பான கர்ப்ப கால மைய பயிற்சி பின்னர் முதுகு வலியை குறைக்கும்."
      }
    }
  ]
},

18: {
  week: 18,
  description: {
    en: "Hearing development progresses and movements feel clearer.",
    si: "ශබ්ද අසාක්ෂණය සංවර්ධනය වෙමින් පවතින අතර චලනයන් පැහැදිලිව දැනෙයි.",
    ta: "கேள்வி திறன் வளர்ச்சி முன்னேறுகிறது மற்றும் இயக்கங்கள் தெளிவாக உணரப்படுகிறது."
  },
  facts: [
    {
      title: {
        en: "Attend Anatomy Scan",
        si: "අංග විශේෂාංග පරීක්ෂණයට සහභාගී වන්න",
        ta: "அனடமி ஸ்கேனை கலந்துகொள்ளவும்"
      },
      description: {
        en: "This scan gives important structural health information.",
        si: "මෙම පරීක්ෂණය ප්‍රධාන ආරෝග්‍ය තොරතුරු සපයයි.",
        ta: "இந்த ஸ்கேன் முக்கிய அமைப்பு ஆரோக்கிய தகவலை வழங்கும்."
      }
    },
    {
      title: {
        en: "Ask For Clarity",
        si: "පැහැදිලි කිරීමක් ඉල්ලන්න",
        ta: "தெளிவுக்கு கேளுங்கள்"
      },
      description: {
        en: "Request explanations for any report terms you do not know.",
        si: "ඔබ නොදන්නා වාර්තා පද සඳහා පැහැදිලි කිරීමක් ඉල්ලන්න.",
        ta: "உங்களுக்குத் தெரியாத அறிக்கையின் சொற்களுக்கான விளக்கத்தை கேளுங்கள்."
      }
    },
    {
      title: {
        en: "Hydrate For Comfort",
        si: "සුඛාත්මක වීමට ජලය පිරවන්න",
        ta: "சௌகரியத்திற்கு தண்ணீர் குடிக்கவும்"
      },
      description: {
        en: "Good hydration may reduce cramps and headaches.",
        si: "සුදුසු ලෙස ජලය පානය කිරීම කම්පනය සහ හිසරදය අඩු කළ හැක.",
        ta: "நல்ல தண்ணீர் குடிப்பது மடக்கு மற்றும் தலைவலியை குறைக்க உதவும்."
      }
    }
  ]
},

19: {
  week: 19,
  description: {
    en: "Nervous system and sensory pathways continue maturing.",
    si: "සංවේදන පථ සහ නාඩත්තු පද්ධති දිගටම වර්ධනය වෙමින් පවතිනවා.",
    ta: "நரம்பு அமைப்பு மற்றும் உணர்வு பாதைகள் வளர்ச்சி தொடர்கிறது."
  },
  facts: [
    {
      title: {
        en: "Recognize Ligament Pain",
        si: "සන්ධි වේදන හඳුනාගන්න",
        ta: "இலிங்க்மென்ட் வலியை அறியுங்கள்"
      },
      description: {
        en: "Brief sharp side pain can occur with sudden movement.",
        si: "හදිසි චලනයකදී කෙටි මහා පැත්තේ වේදනාව ඇති විය හැක.",
        ta: "அவசர இயக்கத்தின் போது சிறிய கூரிய பக்கவலி ஏற்படலாம்."
      }
    },
    {
      title: {
        en: "Move Slowly",
        si: "පිළිගත් වේගයෙන් චලනය වන්න",
        ta: "மெதுவாக நகருங்கள்"
      },
      description: {
        en: "Slow position changes often reduce pulling discomfort.",
        si: "පැතිරිම සහ පීඩනය අඩු කිරීමට චලනයන් සැහැල්ලුවෙන් කරන්න.",
        ta: "மெதுவான நிலை மாற்றங்கள் இழுக்கும் அசௌகரியத்தை குறைக்கும்."
      }
    },
    {
      title: {
        en: "Check Persistent Pain",
        si: "දිගු වේදනාව පරීක්ෂා කරන්න",
        ta: "தொடர்ந்து வலியை பரிசோதிக்கவும்"
      },
      description: {
        en: "Ongoing severe one-sided pain needs evaluation.",
        si: "දිගු කාලීන දැඩි පාර්ශ්වීය වේදනාවක් ඇත්නම් වෛද්‍ය මඟින් පරීක්ෂා කළ යුතුය.",
        ta: "தொடர்ந்து கடுமையான பக்கவலி ஏற்பட்டால் மதிப்பீடு செய்ய வேண்டும்."
      }
    }
  ]
},

20: {
  week: 20,
  description: {
    en: "You are near the midpoint of pregnancy and growth remains steady.",
    si: "ඔබ ගර්භණී කාලයේ මැද අවස්ථාවට ළඟා වී ඇත, වර්ධනය ස්ථායිව පවතී.",
    ta: "நீங்கள் கர்ப்ப காலத்தின் நடுப்பகுதிக்குத் தொடர்பில் இருக்கிறீர்கள் மற்றும் வளர்ச்சி நிலையானது."
  },
  facts: [
    {
      title: {
        en: "Notice Movement Pattern",
        si: "චලන රටාව සලකන්න",
        ta: "இயக்கு முறையை கவனிக்கவும்"
      },
      description: {
        en: "Begin awareness of your baby movement rhythm.",
        si: "ඔබේ බිළිඳාගේ චලන රිද්මය ගැන අවධානය දක්වන්න.",
        ta: "உங்கள் குழந்தையின் இயக்கம் அலகை கவனிக்க தொடங்குங்கள்."
      }
    },
    {
      title: {
        en: "Track Blood Pressure",
        si: "රුධිර පීඩනය නිරීක්ෂා කරන්න",
        ta: "இரத்த அழுத்தத்தை கண்காணிக்கவும்"
      },
      description: {
        en: "Consistent blood pressure monitoring is important.",
        si: "ස්ථායි රුධිර පීඩන නිරීක්ෂණය වැදගත්ය.",
        ta: "நிலையான இரத்த அழுத்த கண்காணிப்பு முக்கியம்."
      }
    },
    {
      title: {
        en: "Discuss Birth Preferences",
        si: "ගර්භධාරණ සැලසුම් ගැන කතා කරන්න",
        ta: "பிறப்பு விருப்பங்களைப் பற்றி விவாதிக்கவும்"
      },
      description: {
        en: "Start early conversations about birth setting and support.",
        si: "ප්‍රසූතියේ පිහිටීම සහ සහාය පිළිබඳව පටන් ගන්න.",
        ta: "பிறப்பிடம் மற்றும் ஆதரவு பற்றி ஆரம்பமே பேசுங்கள்."
      }
    }
  ]
},
21: {
  week: 21,
  description: {
    en: "Digestive symptoms and sleep changes may become more noticeable.",
    si: "පචන ලක්ෂණ සහ නිදා ගැනීමේ වෙනස්කම් තවත් පැහැදිලි විය හැක.",
    ta: "ஜீரண அறிகுறிகள் மற்றும் தூக்க மாற்றங்கள் அதிகமாக தெரிந்துகொள்ளலாம்."
  },
  facts: [
    {
      title: {
        en: "Reduce Heartburn",
        si: "උණුසුම් කම්පනය අඩු කරන්න",
        ta: "ஹார்ட்பர்னை குறைக்கவும்"
      },
      description: {
        en: "Use smaller meals and remain upright after eating.",
        si: "පුළුල් ආහාර වෙනුවට කුඩා ආහාර ගන්න, කෑමට පසු සෘජු වෙන්න.",
        ta: "சிறிய உணவுகளை எடுத்து, சாப்பிட்ட பிறகு நேராக இருங்கள்."
      }
    },
    {
      title: {
        en: "Avoid Late Flat Position",
        si: "දැන්වෙන මට්ටමෙන් වැළකින්න",
        ta: "பின்னர் நேராக படுக்காதீர்கள்"
      },
      description: {
        en: "Do not lie flat immediately after meals.",
        si: "ආහාර පසුනැවත මට්ටමට නොපැමිණින්න.",
        ta: "சாப்பிட்ட உடனே நேராக படுக்காதீர்கள்."
      }
    },
    {
      title: {
        en: "Seek Safe Relief",
        si: "ආරක්ෂිත විවේක ලබාගන්න",
        ta: "பாதுகாப்பான நிவாரணம் தேடுங்கள்"
      },
      description: {
        en: "Ask your provider for pregnancy-safe reflux treatment.",
        si: "ගර්භණී සඳහා ආරක්ෂිත රිෆ්ලක්ස් ප්‍රතිකාරය ගැන වෛද්‍යට අහන්න.",
        ta: "கர்ப்ப கால பாதுகாப்பான ரீபிளக்ஸ் சிகிச்சையை உங்கள் மருத்துவரிடம் கேளுங்கள்."
      }
    }
  ]
},

22: {
  week: 22,
  description: {
    en: "Fetal growth continues and movement may feel stronger.",
    si: "බිළිඳාගේ වර්ධනය දිගටම සිදු වන අතර චලන තද විය හැක.",
    ta: "கர்ப்பகால வளர்ச்சி தொடர்கிறது மற்றும் இயக்கங்கள் பலமாக உணரப்படலாம்."
  },
  facts: [
    {
      title: {
        en: "Prevent Leg Cramps",
        si: "අඩි කැපුම් වැළැක්වීම",
        ta: "காலடி மடிப்பு தடுப்பு"
      },
      description: {
        en: "Stretch calves and stay hydrated daily.",
        si: "අඩි කකුල් මෘදු කිරීම සහ දිනපතා ජලය ගන්න.",
        ta: "கால் பசியை நீட்டித்து, தினமும் நீர்வளம் வைத்திருங்கள்."
      }
    },
    {
      title: {
        en: "Include Magnesium Foods",
        si: "මැග්නීසියම් ආහාර ඇතුළත් කරන්න",
        ta: "மக்னீசியம் உணவுகளை சேர்க்கவும்"
      },
      description: {
        en: "Nuts, seeds, and greens may help muscle comfort.",
        si: "බඩු, බීජ සහ කොළ ආහාර මස්පේශි වාතාවරණය පහසු කරයි.",
        ta: "முந்திரி, விதைகள் மற்றும் காய்கறிகள் தசை நலத்திற்கு உதவும்."
      }
    },
    {
      title: {
        en: "Know Preeclampsia Signs",
        si: "ප්‍රෙකැම්ප්සියා ලක්ෂණ දන්නවා",
        ta: "பிரிக்ளம்ப்சியா அறிகுறிகளை அறிந்திருங்கள்"
      },
      description: {
        en: "Headache, vision changes, and swelling need urgent review.",
        si: "හිසරදය, දෘශ්‍ය වෙනස්කම් සහ සුළි වැලඳීම හදිසි පරීක්ෂණය අවශ්‍යයි.",
        ta: "தலைவலி, பார்வை மாற்றங்கள் மற்றும் வீக்கம் உடனடியாக மதிப்பீடு செய்யப்பட வேண்டும்."
      }
    }
  ]
},

23: {
  week: 23,
  description: {
    en: "Lung development advances but remains immature.",
    si: "ආසන සංවර්ධනය ඉදිරියට යයි නමුත් තවමත් කුඩා පියවරේය.",
    ta: "உடல் மூச்சுப்பகுதி வளர்ச்சி முன்னேறுகிறது ஆனால் இன்னும் முழுமையானது அல்ல."
  },
  facts: [
    {
      title: {
        en: "Prioritize Protein",
        si: "ප්‍රෝටීන් වඩාත්ම වැදගත්",
        ta: "புரதத்தை முன்னுரிமை தருங்கள்"
      },
      description: {
        en: "Protein supports maternal tissue and fetal growth.",
        si: "ප්‍රෝටීන් මව් ඇඳුම් සහ බිළිඳා වර්ධනයට උපකාරී වේ.",
        ta: "புரதம் தாயின் திசுக்கள் மற்றும் கர்ப்பகால வளர்ச்சிக்கு உதவும்."
      }
    },
    {
      title: {
        en: "Plan Birth Classes",
        si: "ප්‍රසූති පන්ති සැලසුම් කරන්න",
        ta: "பிறப்பு வகுப்புகளை திட்டமிடுங்கள்"
      },
      description: {
        en: "Start childbirth education before third-trimester fatigue.",
        si: "තුන්වන ත්‍රයිමේස්ටර් හැපීවීම පෙර පන්ති ආරම්භ කරන්න.",
        ta: "மூன்றாம் மாத கால பசிப்புக்கு முன் பிறப்பு கல்வியைத் தொடங்குங்கள்."
      }
    },
    {
      title: {
        en: "Keep Vaccines Updated",
        si: "ටීකාල යාවත්කාලීන තබන්න",
        ta: "மருந்து தடுப்பூசிகள் புதுப்பிக்கவும்"
      },
      description: {
        en: "Follow pregnancy vaccine advice from your clinician.",
        si: "ගර්භණී සඳහා වෛද්‍ය උපදෙස් අනුව ටීකා ලබාගන්න.",
        ta: "கர்ப்ப கால மருந்து தடுப்பூசி ஆலோசனையை உங்கள் மருத்துவரிடமிருந்து பின்பற்றவும்."
      }
    }
  ]
},

24: {
  week: 24,
  description: {
    en: "Third trimester is approaching and monitoring becomes more important.",
    si: "තුන්වන ත්‍රයිමේස්ටර් ආසන්නව පවතින අතර නිරීක්ෂණය වඩා වැදගත් වේ.",
    ta: "மூன்றாம் கால பருவம் அருகில் வருகிறது, கண்காணிப்பு முக்கியமாகிறது."
  },
  facts: [
    {
      title: {
        en: "Complete Glucose Test",
        si: "ග්ලුකෝස් පරීක්ෂණය අවසන් කරන්න",
        ta: "குளுகோஸ் சோதனை முடிக்கவும்"
      },
      description: {
        en: "Gestational diabetes screening is often due around now.",
        si: "ගර්භණී मधුමැටි රෝග පරීක්ෂණය මෙම අවධියේ සිදු වේ.",
        ta: "கர்ப்ப கால சர்க்கரை நோய் பரிசோதனை இப்போது செய்யப்படவேண்டும்."
      }
    },
    {
      title: {
        en: "Follow Test Prep",
        si: "පරීක්ෂණ සූදානම අනුගමනය කරන්න",
        ta: "சோதனை தயார் படியை பின்பற்றவும்"
      },
      description: {
        en: "Correct fasting or timing improves result accuracy.",
        si: "නිවැරදි උපවාස හෝ කාල සටහන ප්‍රතිඵල විශ්වසනීයතාව වැඩි කරයි.",
        ta: "சரியான விரதம் அல்லது நேரம் முடிவின் துல்லியத்தை மேம்படுத்தும்."
      }
    },
    {
      title: {
        en: "Treat Early If Needed",
        si: "අවශ්‍ය නම් මුල්දී ප්‍රතිකාර කරන්න",
        ta: "தேவைப்பட்டால் முன்னதாக சிகிச்சை செய்யவும்"
      },
      description: {
        en: "Early glucose management improves mother and baby outcomes.",
        si: "මුල්දී රුධිර සීනි කළමනාකරණය මව සහ බිළිඳාගේ ප්‍රතිඵල වැඩි කරයි.",
        ta: "முன்னதாக குளுகோஸ் மேலாண்மை தாய் மற்றும் குழந்தை விளைவுகளை மேம்படுத்தும்."
      }
    }
  ]
},

25: {
  week: 25,
  description: {
    en: "Abdominal growth and weight gain become more evident.",
    si: "බඩ වර්ධනය සහ බර වැඩිවීම තවත් පැහැදිලි වේ.",
    ta: "குடல் வளர்ச்சி மற்றும் உடல் எடை அதிகரிப்பு தெளிவாக தெரியும்."
  },
  facts: [
    {
      title: {
        en: "Support Your Back",
        si: "ඔබේ පසුපස සහය ලබාදෙන්න",
        ta: "உங்கள் முதுகுக்கு ஆதரவு அளிக்கவும்"
      },
      description: {
        en: "Maternity support belts can reduce lower back strain.",
        si: "ගර්භණී සහාය කටු පැළඳීම පහළ පිටු වේදනාව අඩු කරයි.",
        ta: "கர்ப்ப கால ஆதரவு பட்டைகள் கீழ் முதுகு வலியை குறைக்கலாம்."
      }
    },
    {
      title: {
        en: "Use Safe Body Care",
        si: "ආරක්ෂිත ශරීර සත්කාර භාවිතා කරන්න",
        ta: "பாதுகாப்பான உடல் பராமரிப்பைப் பயன்படுத்தவும்"
      },
      description: {
        en: "Prenatal massage may help when done by trained therapists.",
        si: "පුහුණු කළමනාකරුවන් විසින් කළ පූර්ව-ගර්භණී සුවදායී මසාජ් උපකාරී විය හැක.",
        ta: "பயிற்சி பெற்ற நிபுணர்கள் செய்த முன்கர்ப்ப மசாஜ் உதவும்."
      }
    },
    {
      title: {
        en: "Report Preterm Signs",
        si: "ඉක්මන් උපත් ලක්ෂණ වාර්තා කරන්න",
        ta: "முன்கால பிறப்பு அறிகுறிகளை அறிவிக்கவும்"
      },
      description: {
        en: "Fluid leakage or regular cramps should be checked quickly.",
        si: "දිය පිරීම හෝ සාමාන්‍ය කැප්පම් වහාම පරීක්ෂා කළ යුතුය.",
        ta: "திரவ நுரையீரல் அல்லது மடக்கு உடனடியாக பரிசோதிக்க வேண்டும்."
      }
    }
  ]
},
26: {
  week: 26,
  description: {
    en: "Brain and lung development accelerates further.",
    si: "මොළය සහ ළං අංශ වර්ධනය තව තදින් වේගගත වේ.",
    ta: "மூளை மற்றும் நுரையீரல் வளர்ச்சி மேலும் வேகமாகிறது."
  },
  facts: [
    {
      title: {
        en: "Optimize Sleep Position",
        si: "නිදා ගැනීමේ ස්ථානය ප්‍රමුඛ කරන්න",
        ta: "தூக்க நிலையை சிறந்த முறையில் அமைக்கவும்"
      },
      description: {
        en: "Use pillows for side-sleep comfort and support.",
        si: "පාර්ශවයෙහි නිදා ගැනීමට තද සහාය සඳහා තුවාල භාවිතා කරන්න.",
        ta: "பக்கத்துடன் தூங்குவதற்குப் பிலோ பயன்படுத்தவும்."
      }
    },
    {
      title: {
        en: "Manage Stress",
        si: "පීඩා කළමනාකරණය කරන්න",
        ta: "மனம் அழுத்தத்தை நிர்வகிக்கவும்"
      },
      description: {
        en: "Breathing exercises can lower stress and improve sleep.",
        si: "සන්සුන් කිරීමේ ව්‍යායාම පීඩා අඩු කරයි සහ නිදා ගැනීම උදව් වේ.",
        ta: "சுவாசப் பயிற்சிகள் மன அழுத்தத்தை குறைத்து தூக்கத்தை மேம்படுத்தும்."
      }
    },
    {
      title: {
        en: "Learn Preterm Warnings",
        si: "ඉක්මන් උපත් රුකඩ ලක්ෂණ දැනගන්න",
        ta: "முன்கால பிறப்பு எச்சரிக்கை அறிகுறிகளை கற்றுக்கொள்ளவும்"
      },
      description: {
        en: "Ask your team about early labor warning symptoms.",
        si: "ඉක්මන් උපත් ලක්ෂණ ගැන ඔබේ කණ්ඩායමෙන් අසන්න.",
        ta: "முன்கால வேலை எச்சரிக்கை அறிகுறிகள் பற்றி உங்கள் குழுவிடம் கேளுங்கள்."
      }
    }
  ]
},

27: {
  week: 27,
  description: {
    en: "This is the end of the second trimester for many pregnancies.",
    si: "බොහෝ ගර්භණී සඳහා මෙය දෙවන ත්‍රයිමේස්ටර් අවසන් වේ.",
    ta: "பல கர்ப்பகாலங்களுக்கு இது இரண்டாவது கால பருவத்தின் முடிவாகும்."
  },
  facts: [
    {
      title: {
        en: "Observe Daily Movement",
        si: "දෛනික චලන පරීක්ෂා කරන්න",
        ta: "தினசரி இயக்கத்தை கவனிக்கவும்"
      },
      description: {
        en: "Movement awareness should now feel more consistent.",
        si: "චලන හැඟීම දැන් තවත් ස්ථායි හැඟිය යුතුය.",
        ta: "இப்போது இயக்க உணர்வு அதிகமான ஒரேபோல இருக்க வேண்டும்."
      }
    },
    {
      title: {
        en: "Check Rh Status",
        si: "Rh තත්ත්වය පරීක්ෂා කරන්න",
        ta: "Rh நிலையை சரிபார்க்கவும்"
      },
      description: {
        en: "Discuss Rh immunoglobulin if you are Rh negative.",
        si: "ඔබ Rh නෙගටිව් නම් Rh රෝගාණු සම්බන්ධ සාකච්ඡා කරන්න.",
        ta: "நீங்கள் Rh எதிர்மறை என்றால் Rh இம்யூனோகுளோபுலின் பற்றி பேசுங்கள்."
      }
    },
    {
      title: {
        en: "Continue Supplements",
        si: "සපුරා ගැනීම් දිගටම පවත්වා ගන්න",
        ta: "சப்ளிமென்ட்களை தொடரவும்"
      },
      description: {
        en: "Maintain iron and folate as advised.",
        si: "උපදෙස් අනුව ලෝහ සහ ෆොලේට් රඳවා ගන්න.",
        ta: "ஆய்வின் படி இரும்பு மற்றும் ஃபோலேட் பராமரிக்கவும்."
      }
    }
  ]
},

28: {
  week: 28,
  description: {
    en: "Third trimester begins with faster fetal growth.",
    si: "තුන්වන ත්‍රයිමේස්ටර් ආරම්භ වේ, බිළිඳා වර්ධනය වේගවත් වේ.",
    ta: "மூன்றாம் கால பருவம் வேகமான கர்ப்ப வளர்ச்சியுடன் தொடங்குகிறது."
  },
  facts: [
    {
      title: {
        en: "Start Kick Counting",
        si: "කෙරකිරීම් ගණනය ආරම්භ කරන්න",
        ta: "அடி எண்ணுதலை தொடங்கவும்"
      },
      description: {
        en: "Begin formal kick counting if advised by your provider.",
        si: "ඔබේ වෛද්‍ය උපදෙස් ඇති නම් නිල කෙරකිරීම් ගණනය ආරම්භ කරන්න.",
        ta: "உங்கள் சிகிச்சையாளர் ஆலோசித்தால் அதிகாரப்பூர்வ அட எண்கணக்கை தொடங்கவும்."
      }
    },
    {
      title: {
        en: "Take Tdap On Time",
        si: "Tdap කාලෝචිතව ගන්න",
        ta: "Tdap நேரத்திலேயே எடுக்கவும்"
      },
      description: {
        en: "Tdap is usually recommended in this trimester.",
        si: "මෙම ත්‍රයිමේස්ටර් වලදී සාමාන්‍යයෙන් Tdap උපදෙස් දේ.",
        ta: "இந்த கால பருவத்தில் பொதுவாக Tdap பரிந்துரைக்கப்படுகிறது."
      }
    },
    {
      title: {
        en: "Plan Support Logistics",
        si: "සහාය සැලසුම් සකසන්න",
        ta: "ஆதரவு திட்டங்களை திட்டமிடவும்"
      },
      description: {
        en: "Finalize leave, transport, and caregiving plans.",
        si: "ඉඩ, ප්‍රවාහන සහ සත්කාර සැලසුම් අවසන් කරන්න.",
        ta: "சாமர்த்தியம், போக்குவரத்து மற்றும் பராமரிப்பு திட்டங்களை இறுதி செய்யவும்."
      }
    }
  ]
},

29: {
  week: 29,
  description: {
    en: "Movement grows stronger and may feel uncomfortable at times.",
    si: "චලන තවත් ශක්තිමත් වේ, සමහර විට අසුඛදායක විය හැක.",
    ta: "இயக்கம் வலிமை பெறுகிறது, சில நேரங்களில் வசதியற்றதாக உணரலாம்."
  },
  facts: [
    {
      title: {
        en: "Know Braxton Hicks",
        si: "බ්‍රැක්ස්ටන් හිකස් ගැන දන්නවා",
        ta: "பிராக்ஸ்டன் ஹிக்ஸ் பற்றி அறிந்திருங்கள்"
      },
      description: {
        en: "Practice contractions are common and usually irregular.",
        si: "පුහුණු සංකෝචන සාමාන්‍යය සහ සාමාන්‍යයෙන් අනිතික වේ.",
        ta: "பயிற்சி சுருக்கங்கள் பொதுவானவை மற்றும் பெரும்பாலும் மாறுபடும்."
      }
    },
    {
      title: {
        en: "Watch Contraction Pattern",
        si: "සංකෝචන රටාව නරඹන්න",
        ta: "சுருக்கத்தின் முறை பார்க்கவும்"
      },
      description: {
        en: "Regular painful contractions need urgent assessment.",
        si: "සාමාන්‍ය වේදනාදායක සංකෝචන හදිසි පරීක්ෂණය අවශ්‍යයි.",
        ta: "நிலையான வலியுள்ள சுருக்கங்கள் உடனடி மதிப்பீட்டை தேவைபடுத்தும்."
      }
    },
    {
      title: {
        en: "Prevent Dehydration",
        si: "දියර අඩු වීම වැළැක්වීම",
        ta: "இரசம் குறைவதை தடுக்கும்"
      },
      description: {
        en: "Low fluid intake can trigger uterine irritability.",
        si: "අඩු දියර ගැනීම ගර්භාශය උද්දීපනය කළ හැක.",
        ta: "குறைந்த திரவம் கர்ப்பாசை தூண்டக்கூடும்."
      }
    }
  ]
},

30: {
  week: 30,
  description: {
    en: "Your baby continues gaining weight and practicing breathing movements.",
    si: "ඔබේ බිළිඳා බර වැඩි කරමින් හා සන්සුන් ක්‍රියා භාවිතා කරමින් ඉදිරියට යයි.",
    ta: "உங்கள் குழந்தை எடை பெறும் மற்றும் சுவாச இயக்கங்களைப் பயிற்சிப்பதைக் தொடர்கிறது."
  },
  facts: [
    {
      title: {
        en: "Manage Pelvic Pressure",
        si: "අසනීප පීඩනය කළමනාකරණය කරන්න",
        ta: "பிரெவிக் அழுத்தத்தை நிர்வகிக்கவும்"
      },
      description: {
        en: "Pelvic heaviness increases as posture changes.",
        si: "ස්ථානය වෙනස් වීමත් සමඟ අසනීප බර වැඩි වේ.",
        ta: "நிலை மாற்றங்களுடன் பிரெவிக் எடை அதிகரிக்கிறது."
      }
    },
    {
      title: {
        en: "Try Prenatal Physio",
        si: "පූර්ව-ගර්භණී ශාරීරික ව්‍යායාම උත්සාහ කරන්න",
        ta: "கர்ப்ப கால உடற்பயிற்சியை முயற்சிக்கவும்"
      },
      description: {
        en: "Guided exercises can improve comfort and function.",
        si: "පිළිගත් ව්‍යායාම පහසුකම සහ ක්‍රියාකාරිත්වය වැඩි කරයි.",
        ta: "முன்னோக்கிய பயிற்சிகள் வசதியையும் செயல்பாட்டையும் மேம்படுத்தும்."
      }
    },
    {
      title: {
        en: "Keep Follow Ups",
        si: "පසුපසින් අනුගමනය තබන්න",
        ta: "தொடர்ந்து பின்பற்றவும்"
      },
      description: {
        en: "Regular late-pregnancy monitoring is very important.",
        si: "වෙළඳපොළේ අවසන් ගර්භණී නිරීක්ෂණය ඉතා වැදගත් වේ.",
        ta: "முடிவில் கர்ப்ப கால கண்காணிப்பு மிகவும் முக்கியம்."
      }
    }
  ]
},
31: {
  week: 31,
  description: {
    en: "Sleep disruption and frequent urination often become stronger.",
    si: "නිදා ගැනීමේ බාධා සහ නිතර මූත්‍ර විස්සීම තවත් ශක්තිමත් වේ.",
    ta: "தூக்க குறைவு மற்றும் அடிக்கடி சிறுநீர் வெளியேற்றம் அதிகரிக்கிறது."
  },
  facts: [
    {
      title: {
        en: "Use Planned Rest",
        si: "සැලසුම් කළ විරාම භාවිතා කරන්න",
        ta: "திட்டமிட்ட ஓய்வைப் பயன்படுத்தவும்"
      },
      description: {
        en: "Short daytime rest can improve daily energy.",
        si: "කෙටි දවල් විරාමය දෛනික ශක්තිය වැඩි කරයි.",
        ta: "சிறிய பகல் ஓய்வு தினசரி சக்தியை மேம்படுத்தும்."
      }
    },
    {
      title: {
        en: "Adjust Evening Fluids",
        si: "සන්ධ්‍යාවේ දියර සැකසුම වෙනස් කරන්න",
        ta: "மாலை திரவங்கள் சரிசெய்யவும்"
      },
      description: {
        en: "Limit large fluid loads right before bedtime.",
        si: "නිදා ගැනීමට පෙර විශාල දියර පරිභෝජනය සීමා කරන්න.",
        ta: "தூக்கத்திற்கு முன் அதிக திரவத்தைக் குறைக்கவும்."
      }
    },
    {
      title: {
        en: "Support Mental Health",
        si: "මානසික සෞඛ්‍යය සම්බන්ධව සහාය ලබා දෙන්න",
        ta: "மனநலத்தை ஆதரிக்கவும்"
      },
      description: {
        en: "Report persistent anxiety or low mood early.",
        si: "ඉක්මනින් දිගු කාලීන ආතතිය හෝ අවපෙරළි හැඟීම වාර්තා කරන්න.",
        ta: "தொடர்ச்சியான கவலை அல்லது குறைந்த மனநிலையை விரைவில் தெரிவிக்கவும்."
      }
    }
  ]
},

32: {
  week: 32,
  description: {
    en: "Many babies begin moving toward a head-down position.",
    si: "බොහෝ බිළිඳා හිස පහළ අතට හැරෙමින් වේ.",
    ta: "பல குழந்தைகள் தலை கீழ் நிலைக்கு நகரத் தொடங்குகின்றன."
  },
  facts: [
    {
      title: {
        en: "Pack Essentials",
        si: "අත්‍යවශ්‍ය ද්‍රව්‍ය සකසන්න",
        ta: "அவசியப் பொருட்களை தயாரிக்கவும்"
      },
      description: {
        en: "Prepare your hospital bag and key documents.",
        si: "රෝහලේ බෑගය සහ වැදගත් ලේඛන සකසන්න.",
        ta: "மருத்துவமனை பை மற்றும் முக்கிய ஆவணங்களை தயார் செய்யவும்."
      }
    },
    {
      title: {
        en: "Differentiate Labor Signs",
        si: "ගර්භාශ්‍ය ලක්ෂණ වෙනස්කිරීම",
        ta: "பிறப்பு அறிகுறிகளை வேறுபடுத்தவும்"
      },
      description: {
        en: "Learn false labor versus true labor patterns.",
        si: "අසත්‍ය සහ සත්‍ය ගර්භාශ්‍ය රටා ඉගෙන ගන්න.",
        ta: "பொய் வேலை மற்றும் உண்மையான வேலை மாதிரிகளை கற்றுக்கொள்ளவும்."
      }
    },
    {
      title: {
        en: "Monitor Swelling",
        si: "ඇලීම් පරීක්ෂා කරන්න",
        ta: "நுரையீரல் வீக்கம் கண்காணிக்கவும்"
      },
      description: {
        en: "Sudden face or hand swelling needs review.",
        si: "අහසින් හෝ අත් අල්ලා ඇති ඇලීම් පරීක්ෂා කළ යුතුයි.",
        ta: "அனிடித்த முகம் அல்லது கைகள் வீக்கம் பரிசீலிக்க வேண்டும்."
      }
    }
  ]
},

33: {
  week: 33,
  description: {
    en: "Lungs, brain, and immune system continue maturing.",
    si: "නුරු, මොළය සහ ප්‍රතිරෝධක පද්ධතිය තවදුරටත් වර්ධනය වෙයි.",
    ta: "நுரையீரல், மூளை மற்றும் நோய் எதிர்ப்பு அமைப்பு வளர்ச்சி தொடர்கிறது."
  },
  facts: [
    {
      title: {
        en: "Protect Recovery Time",
        si: "ප්‍රතිකාර කාලය ආරක්ෂා කරන්න",
        ta: "மீட்பு நேரத்தை பாதுகாக்கவும்"
      },
      description: {
        en: "Prioritize sleep, nutrition, and reduced workload.",
        si: "නිදා ගැනීම, පෝෂණය සහ වැඩ බර අඩු කිරීම ප්‍රමුඛ කරන්න.",
        ta: "தூக்கத்தை, ஊட்டச்சத்து மற்றும் குறைக்கப்பட்ட வேலைப்பளு முக்கியத்துவம் கொடுக்கவும்."
      }
    },
    {
      title: {
        en: "Finalize Emergency Plan",
        si: "අවවාද සැලසුම අවසන් කරන්න",
        ta: "அவசர திட்டத்தை இறுதி செய்யவும்"
      },
      description: {
        en: "Keep transport routes and contacts ready.",
        si: "ප්‍රවාහන මාර්ග සහ සම්බන්ධතා සූදානම් තබන්න.",
        ta: "போக்குவரத்து வழிகள் மற்றும் தொடர்புகளை தயார் செய்யவும்."
      }
    },
    {
      title: {
        en: "Plan Newborn Feeding",
        si: "නවජාත ළදරු ආහාර සැලසුම් කරන්න",
        ta: "புதிய பிறந்த குழந்தை உணவு திட்டம் அமைக்கவும்"
      },
      description: {
        en: "Discuss breastfeeding or formula plans in advance.",
        si: "බිළිඳු කිරි හෝ සූත්‍ර ආහාර සැලසුම් පෙරමුණෙන් සාකච්ඡා කරන්න.",
        ta: "மலர் பால் அல்லது சூத்திர திட்டங்களை முன்கூட்டியே விவாதிக்கவும்."
      }
    }
  ]
},

34: {
  week: 34,
  description: {
    en: "Movements may feel more like rolls as space becomes tighter.",
    si: "ස්ථානය අඩු වීමත් සමඟ චලන රොල් වගේ හැඟේ.",
    ta: "இடம் குறைவாக இருப்பதால் இயக்கங்கள் சுழற்சிகள் போல் உணரலாம்."
  },
  facts: [
    {
      title: {
        en: "Track Reduced Movement",
        si: "අඩු චලන සලකුණු කරන්න",
        ta: "குறைந்த இயக்கத்தை கண்காணிக்கவும்"
      },
      description: {
        en: "Reduced fetal movement needs same-day evaluation.",
        si: "අඩු වූ බිළිඳා චලන අද දිනයේම පරීක්ෂා කළ යුතුය.",
        ta: "குறைந்த கர்ப்ப இயக்கத்தை அதே நாளில் மதிப்பீடு செய்ய வேண்டும்."
      }
    },
    {
      title: {
        en: "Practice Breathing Skills",
        si: "සන්සුන් ක්‍රම පුහුණු කරන්න",
        ta: "சுவாச நுட்பங்களைப் பயிற்சியிடவும்"
      },
      description: {
        en: "Labor breathing practice improves confidence.",
        si: "ගර්භාශ්‍ය සන්සුන් පුහුණු කිරීම විශ්වාසය වැඩි කරයි.",
        ta: "பிறப்பு சுவாச பயிற்சி நம்பிக்கையை மேம்படுத்தும்."
      }
    },
    {
      title: {
        en: "Review Pain Relief Options",
        si: "වේදනා නිවාරණ විකල්ප සමාලෝචනය කරන්න",
        ta: "வலி நிவாரண விருப்பங்களை பரிசீலிக்கவும்"
      },
      description: {
        en: "Discuss pain control methods before labor starts.",
        si: "ගර්භාශ්‍ය ආරම්භයට පෙර වේදනා කළමනාකරණය සාකච්ඡා කරන්න.",
        ta: "பிறப்புக்கு முன் வலி கட்டுப்பாடு முறைகளை விவாதிக்கவும்."
      }
    }
  ]
},

35: {
  week: 35,
  description: {
    en: "Final maturation and growth continue before term.",
    si: "අවසාන වර්ධනය සහ විශාල වර්ධනය කාලය පැමිණීමට පෙර තවදුරටත් වේ.",
    ta: "காலத்திற்குமுன் இறுதி வளர்ச்சி மற்றும் வளர்ச்சி தொடர்கிறது."
  },
  facts: [
    {
      title: {
        en: "Plan GBS Test",
        si: "GBS පරීක්ෂාව සැලසුම් කරන්න",
        ta: "GBS பரிசோதனை திட்டமிடவும்"
      },
      description: {
        en: "Group B strep testing is usually done now.",
        si: "Group B ස්ට්‍රෙප් පරීක්ෂාව සාමාන්‍යයෙන් දැන් සිදු වේ.",
        ta: "குரூப் B ஸ்ட்ரெப் பரிசோதனை பொதுவாக இப்போது செய்யப்படுகிறது."
      }
    },
    {
      title: {
        en: "Maintain Nutrition",
        si: "පෝෂණය පවත්වා ගන්න",
        ta: "உணவுமுறை பராமரிக்கவும்"
      },
      description: {
        en: "Keep hydration and protein intake consistent.",
        si: "දියර සහ ප්‍රෝටීන් පරිභෝජනය ස්ථාවර තබන්න.",
        ta: "நீர்ப்பானம் மற்றும் புரத உட்கொள்ளலை நிலைத்திருக்கவும்."
      }
    },
    {
      title: {
        en: "Watch Labor Triggers",
        si: "ගර්භාශ්‍ය උද්දීපක නිරීක්ෂා කරන්න",
        ta: "பிறப்பு தூண்டுதல்களை கவனிக்கவும்"
      },
      description: {
        en: "Report fluid leak, bleeding, or regular contractions.",
        si: "දියර නිකසීම, රුධිරස्रාව හෝ සාමාන්‍ය සංකෝචන වාර්තා කරන්න.",
        ta: "திரவ ஒழிவு, இரத்தம், அல்லது முறைமையான சுருக்கங்களை அறிவிக்கவும்."
      }
    }
  ]
},
36: {
  week: 36,
  description: {
    en: "The baby may settle lower in the pelvis as birth approaches.",
    si: "බිළිඳා උපත ළඟා වීමත් සමඟ බඩපිටියෙහි පහළට යා හැකිය.",
    ta: "பிள்ளை பிறப்புக்குள் எலும்புப்பொட்டியில் கீழே செல்லலாம்."
  },
  facts: [
    {
      title: {
        en: "Expect Pressure Shift",
        si: "පීඩන ව්‍යුහය වෙනස්කම් සිදුවන බව බලාපොරොත්තු වන්න",
        ta: "அழுத்த மாற்றத்தை எதிர்பார்க்கவும்"
      },
      description: {
        en: "Breathing may ease while pelvic pressure increases.",
        si: "බඩපිටියේ පීඩනය වැඩි වුවද හුස්ම ගැනීම පහසු විය හැක.",
        ta: "எலும்புப்பொட்டியில் அழுத்தம் அதிகரிக்கும் போது சுவாசம் சுலபமாகலாம்."
      }
    },
    {
      title: {
        en: "Attend Weekly Visits",
        si: "සතියේ දක්වා පරීක්ෂා කරන්න",
        ta: "வாராந்திர சந்திப்புகளில் கலந்து கொள்ளவும்"
      },
      description: {
        en: "Late prenatal checks are important and frequent.",
        si: "දැක්ම පරීක්ෂා මතුවීම වැදගත් සහ නිතර වේ.",
        ta: "தாமதமான கர்ப்ப பரிசோதனைகள் முக்கியமாகவும் அடிக்கடி செய்யப்படுகின்றன."
      }
    },
    {
      title: {
        en: "Confirm Day Of Labor Plan",
        si: "ගර්භාශ්‍ය දිනයේ සැලසුම තහවුරු කරන්න",
        ta: "பிறப்பு நாளின் திட்டத்தை உறுதிப்படுத்தவும்"
      },
      description: {
        en: "Finalize transport and support details now.",
        si: "ප්‍රවාහන සහ සහාය විස්තර දැන් අවසන් කරන්න.",
        ta: "போக்குவரத்து மற்றும் ஆதரவு விவரங்களை இப்போது இறுதி செய்யவும்."
      }
    }
  ]
},

37: {
  week: 37,
  description: {
    en: "This is early term, and labor can begin at any time.",
    si: "මෙය ආරම්භක කාලය වන අතර ගර්භාශ්‍ය ඕනෑම වේලාවේ ආරම්භ විය හැක.",
    ta: "இது ஆரம்ப காலம், பிறப்பு எப்போது வேண்டுமானாலும் தொடங்கலாம்."
  },
  facts: [
    {
      title: {
        en: "Continue Kick Counts",
        si: "බිළිඳා චලන සටහන් පවත්වා ගන්න",
        ta: "அடி எண்ணிக்கையை தொடரவும்"
      },
      description: {
        en: "Daily movement checks remain essential.",
        si: "දෛනික චලන පරීක්ෂාව වැදගත්ම වේ.",
        ta: "தினசரி இயக்க கண்காணிப்பு அவசியம்."
      }
    },
    {
      title: {
        en: "Protect Energy",
        si: "ශක්තිය ආරක්ෂා කරන්න",
        ta: "சக்தியை பாதுகாக்கவும்"
      },
      description: {
        en: "Rest regularly to conserve strength for labor.",
        si: "ගර්භාශ්‍ය සඳහා ශක්තිය සුරැකිව විරාම ගන්න.",
        ta: "பிறப்பிற்கு சக்தி காப்பாற்ற சீராக ஓய்வு எடுக்கவும்."
      }
    },
    {
      title: {
        en: "Call For Regular Contractions",
        si: "සාමාන්‍ය සංකෝචන සඳහා වාර්තා කරන්න",
        ta: "பழக்கமான சுருக்கங்களுக்கு அழைக்கவும்"
      },
      description: {
        en: "Seek advice when contractions become patterned and stronger.",
        si: "සංකෝචන රටාවක් සහ ශක්තිය වැඩි වූ විට උපදෙස් ලබා ගන්න.",
        ta: "சுருக்கங்கள் முறைமைமை மற்றும் பலமாக உள்ள போது ஆலோசனை கேளுங்கள்."
      }
    }
  ]
},

38: {
  week: 38,
  description: {
    en: "Final maturation continues with ongoing fat gain.",
    si: "අවසන් වර්ධනය තවදුරටත් පැවැත්ම සහ තරමක් මේදය එක් කිරීමත් සමඟ සිදු වේ.",
    ta: "இறுதி வளர்ச்சி தொடர்கிறது மற்றும் கொழுப்பு சேர்க்கை நடக்கிறது."
  },
  facts: [
    {
      title: {
        en: "Expect Subtle Changes",
        si: "සුක්ෂ්ම වෙනස්කම් බලාපොරොත්තු වන්න",
        ta: "சிறிய மாற்றங்களை எதிர்பார்க்கவும்"
      },
      description: {
        en: "Cervical changes may happen without clear symptoms.",
        si: "ගර්භාශ්‍ය බඩපිටියේ වෙනස්කම් පැහැදිලි ලක්ෂණ නැතිව සිදු විය හැක.",
        ta: "கழுத்து மாற்றங்கள் தெளிவான அறிகுறிகள் இல்லாமல் நிகழலாம்."
      }
    },
    {
      title: {
        en: "Stay Lightly Active",
        si: "සහනයකින් ක්‍රියාශීලී වන්න",
        ta: "சிறிது செயல்படும் நிலையை பராமரிக்கவும்"
      },
      description: {
        en: "Gentle movement helps comfort and circulation.",
        si: "සුමට චලන විනෝදාත්මක සහ රුධිර සංචාරයට උපකාරී වේ.",
        ta: "மெல்லிய இயக்கம் ஆறுதல் மற்றும் சுழற்சிக்கு உதவும்."
      }
    },
    {
      title: {
        en: "Keep Essentials Ready",
        si: "අත්‍යවශ්‍ය ද්‍රව්‍ය සූදානම් තබන්න",
        ta: "அவசியமான பொருட்களை தயாராக வைத்திருங்கள்"
      },
      description: {
        en: "Keep your phone charged and hospital items prepared.",
        si: "දුරකථනය චාජ් කර සහ රෝහලේ ද්‍රව්‍ය සූදානම් තබන්න.",
        ta: "உங்கள் தொலைபேசி சார்ஜ் செய்து மருத்துவமனைப் பொருட்களை தயார் செய்யவும்."
      }
    }
  ]
},

39: {
  week: 39,
  description: {
    en: "Most pregnancies are full term now, and spontaneous labor is common.",
    si: "බොහෝ ගර්භාශ්‍ය දැන් සම්පූර්ණ කාලයේ ඇති අතර ස්වයංක්‍රීය ගර්භාශ්‍ය සාමාන්‍ය වේ.",
    ta: "பல கர்ப்பங்கள் இப்போது முழு காலம், சுயசெயல்பாட்டு பிறப்பு பொதுவாக உள்ளது."
  },
  facts: [
    {
      title: {
        en: "Recognize Water Breaking",
        si: "ජල නිකසීම හැඳින්වන්න",
        ta: "தண்ணீர் உடைந்ததை அங்கீகரிக்கவும்"
      },
      description: {
        en: "Membrane rupture may be a gush or slow trickle.",
        si: "ජල බිඳීම හදිසි හෝ මන්දගාමී විය හැක.",
        ta: "திரை உடைப்பு பெரிதோ சிறிதோ வரலாம்."
      }
    },
    {
      title: {
        en: "Time Contractions",
        si: "සංකෝචන මැනීම",
        ta: "சுருக்கங்களை நேரம் பார்க்கவும்"
      },
      description: {
        en: "Measure contractions from start to start.",
        si: "සංකෝචන ආරම්භයෙන් ආරම්භය දක්වා මැනන්න.",
        ta: "சுருக்கங்களை தொடக்கம் முதல் தொடக்கம் வரை அளவிடுங்கள்."
      }
    },
    {
      title: {
        en: "Know Emergency Symptoms",
        si: "ආපදා ලක්ෂණ හඳුනා ගන්න",
        ta: "அவசர அறிகுறிகளை அறியவும்"
      },
      description: {
        en: "Get urgent care for heavy bleeding, chest pain, or reduced movement.",
        si: "දුර්වල රුධිරස्रාව, කුකුළා වේදනාව, හෝ චලන අඩු වීම සඳහා වහාම උපදෙස් ලබා ගන්න.",
        ta: "பெரிய இரத்தம், மார்பு வலி அல்லது இயக்கம் குறைவாக இருந்தால் அவசர சிகிச்சை பெறுங்கள்."
      }
    }
  ]
},

40: {
  week: 40,
  description: {
    en: "This is your estimated due week, and labor may start anytime.",
    si: "මෙය ඔබේ අපේක්ෂිත උපත් සතිය වන අතර ගර්භාශ්‍ය ඕනෑම වේලාවේ ආරම්භ විය හැක.",
    ta: "இது உங்கள் மதிப்பிடப்பட்ட பிறப்பு வாரம், பிறப்பு எப்போது வேண்டுமானாலும் தொடங்கலாம்."
  },
  facts: [
    {
      title: {
        en: "Discuss Post Date Monitoring",
        si: "අපේක්ෂිත උපත් දිනයට පසු නිරීක්ෂණ සාකච්ඡා කරන්න",
        ta: "பிறப்புக்குப் பிறகு கண்காணிப்பை விவாதிக்கவும்"
      },
      description: {
        en: "Follow your provider plan if labor has not started.",
        si: "ගර්භාශ්‍ය ආරම්භ වී නැත්නම් ඔබේ සැපයුම්කරුගේ සැලසුමට අනුව ක්‍රියා කරන්න.",
        ta: "பிறப்பு தொடங்கவில்லை என்றால் உங்கள் சிகிச்சை வழங்குநரின் திட்டத்தை பின்பற்றவும்."
      }
    },
    {
      title: {
        en: "Review Induction Options",
        si: "ආරම්භක සැලසුම් විකල්ප සමාලෝචනය කරන්න",
        ta: "உந்துதல் விருப்பங்களை பரிசீலிக்கவும்"
      },
      description: {
        en: "Induction planning is common and can be safe.",
        si: "ගර්භාශ්‍ය ආරම්භ සැලසුම් සාමාන්‍ය වන අතර ආරක්ෂිත විය හැක.",
        ta: "உந்துதல் திட்டமிடல் பொதுவானது மற்றும் பாதுகாப்பானதாக இருக்கலாம்."
      }
    },
    {
      title: {
        en: "Trust Your Instincts",
        si: "ඔබේ හැඟීම් විශ්වාස කරන්න",
        ta: "உங்கள் உணர்வுகளில் நம்பிக்கை வைக்கவும்"
      },
      description: {
        en: "If something feels wrong, seek medical assessment promptly.",
        si: "කිසියම් දෙයක් වැරදි බවක් හැඟේ නම් වහාම වෛද්‍ය පරීක්ෂාව ලබා ගන්න.",
        ta: "எதாவது தவறு போல் தோன்றினால் உடனே மருத்துவ பரிசோதனை பெறவும்."
      }
    }
  ]
},

}

function toLocalizedString(value: LocalizedString): LocalizedString {
  return value
}

function buildLocalizedInsights(source: Record<number, EnglishWeeklyInsight>): Record<number, WeeklyInsight> {
  const out: Record<number, WeeklyInsight> = {}

  Object.entries(source).forEach(([weekKey, insight]) => {
    out[Number(weekKey)] = {
      week: insight.week,
      description: toLocalizedString(insight.description),
      facts: insight.facts.map((fact) => ({
        title: toLocalizedString(fact.title),
        description: toLocalizedString(fact.description),
      })),
    }
  })

  return out
}

export const WEEKLY_INSIGHTS: Record<number, WeeklyInsight> = buildLocalizedInsights(EN_WEEKLY_INSIGHTS)

function pickLocalized(value: LocalizedString, language: LanguageCode): string {
  if (language === 'si') return value.si
  if (language === 'ta') return value.ta
  return value.en
}

export function getWeeklyInsight(gestationalWeek: number, language: LanguageCode = 'en'): SelectedWeeklyInsight {
  const normalized = Number.isFinite(gestationalWeek) ? Math.floor(gestationalWeek) : 1
  const safeWeek = Math.min(40, Math.max(1, normalized))
  const insight = WEEKLY_INSIGHTS[safeWeek] ?? WEEKLY_INSIGHTS[40]!

  return {
    week: insight.week,
    description: pickLocalized(insight.description, language),
    facts: insight.facts.map((fact) => ({
      title: pickLocalized(fact.title, language),
      description: pickLocalized(fact.description, language),
    })),
  }
}
