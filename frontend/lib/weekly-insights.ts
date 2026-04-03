export interface WeeklyFact {
  title: string
  description: string
}

export interface WeeklyInsight {
  week: number
  description: string
  facts: [WeeklyFact, WeeklyFact, WeeklyFact]
}

const WEEKLY_INSIGHTS: Record<number, WeeklyInsight> = {
  1: {
    week: 1,
    description: "This week is counted from your last menstrual period, so pregnancy has not biologically started yet.",
    facts: [
      { title: "Start Folic Acid", description: "Begin prenatal vitamins with 400 to 800 mcg folic acid daily." },
      { title: "Build Healthy Routines", description: "Prioritize sleep, hydration, and steady meals to support early pregnancy." },
      { title: "Avoid Harmful Substances", description: "Avoid alcohol, smoking, and recreational drugs from now onward." },
    ],
  },
  2: {
    week: 2,
    description: "Ovulation and fertilization can happen around the end of this week.",
    facts: [
      { title: "Time Conception Window", description: "Intercourse near ovulation can increase chances of conception." },
      { title: "Limit Caffeine", description: "Keep caffeine around or below 200 mg per day." },
      { title: "Review Medications", description: "Ask your clinician to review all current medicines and supplements." },
    ],
  },
  3: {
    week: 3,
    description: "A fertilized egg may implant in the uterus and early hormone changes begin.",
    facts: [
      { title: "Watch Bleeding Pattern", description: "Light spotting may occur, but heavy bleeding needs medical advice." },
      { title: "Continue Prenatal Vitamins", description: "Daily folic acid remains important for neural development." },
      { title: "Stay Lightly Active", description: "Gentle movement like walking is usually helpful and safe." },
    ],
  },
  4: {
    week: 4,
    description: "Pregnancy tests often become positive around this week.",
    facts: [
      { title: "Book First Visit", description: "Schedule your first antenatal appointment as soon as possible." },
      { title: "Manage Early Nausea", description: "Use small, frequent meals to reduce nausea and fatigue." },
      { title: "Use Food Safety Rules", description: "Avoid unpasteurized foods and undercooked meat." },
    ],
  },
  5: {
    week: 5,
    description: "The embryo is developing quickly and early heart structures are forming.",
    facts: [
      { title: "Nausea Is Common", description: "Morning sickness can happen at any time of day." },
      { title: "Try Simple Relief", description: "Ginger or vitamin B6 may help if your clinician agrees." },
      { title: "Escalate Severe Vomiting", description: "Seek care if vomiting prevents fluid or food intake." },
    ],
  },
  6: {
    week: 6,
    description: "Early organ systems continue to form rapidly.",
    facts: [
      { title: "Expect Body Changes", description: "Breast tenderness and frequent urination are common." },
      { title: "Prioritize Protein", description: "Add protein snacks to keep energy more stable." },
      { title: "Know Urgent Signs", description: "Get urgent care for severe pain, fever, or heavy bleeding." },
    ],
  },
  7: {
    week: 7,
    description: "Brain and facial structures are growing at high speed.",
    facts: [
      { title: "Respect Fatigue", description: "Strong tiredness is common and rest is essential." },
      { title: "Hydrate Through Day", description: "Keep fluids nearby and sip consistently." },
      { title: "Treat Severe Nausea", description: "Ask early about pregnancy-safe anti-nausea options." },
    ],
  },
  8: {
    week: 8,
    description: "Limb development continues and major organs keep maturing.",
    facts: [
      { title: "Prevent Constipation", description: "Increase fiber and water gradually to ease bowel discomfort." },
      { title: "Walk Daily", description: "Daily walking often helps digestion and mood." },
      { title: "Check Before Medicines", description: "Do not self-medicate without clinical guidance." },
    ],
  },
  9: {
    week: 9,
    description: "The embryo is now called a fetus and growth remains rapid.",
    facts: [
      { title: "Track Emotions", description: "Mood changes are common, so monitor emotional wellbeing." },
      { title: "Use Support System", description: "Ask family or partner for practical help when needed." },
      { title: "Keep A Weekly Log", description: "Record symptoms and questions for your next visit." },
    ],
  },
  10: {
    week: 10,
    description: "Most major organs are formed and now continue maturing.",
    facts: [
      { title: "Eat Balanced Meals", description: "Focus on nutrient quality even if appetite varies." },
      { title: "Support Iron Intake", description: "Pair iron-rich foods with vitamin C sources." },
      { title: "Discuss Screening", description: "Review optional and routine prenatal tests with your provider." },
    ],
  },
  11: {
    week: 11,
    description: "The placenta takes over more hormonal support functions.",
    facts: [
      { title: "Manage Headaches", description: "Hydration, rest, and regular meals may reduce headaches." },
      { title: "Protect Gum Health", description: "Gum sensitivity can increase, so maintain oral hygiene." },
      { title: "Plan Dental Care", description: "Routine dental cleaning is generally safe in pregnancy." },
    ],
  },
  12: {
    week: 12,
    description: "This marks the end of the first trimester for most mothers.",
    facts: [
      { title: "Symptoms May Improve", description: "Nausea often begins easing during this stage." },
      { title: "Continue Follow Ups", description: "Keep prenatal visits even if you feel better." },
      { title: "Review Warning Signs", description: "Learn urgent signs like heavy bleeding or fainting." },
    ],
  },
  13: {
    week: 13,
    description: "Second trimester begins and many mothers feel more energetic.",
    facts: [
      { title: "Increase Smart Calories", description: "Add nutritious calories, not just larger portions." },
      { title: "Stay Active", description: "Moderate exercise helps circulation, sleep, and mood." },
      { title: "Practice Side Sleeping", description: "Try left-side sleeping for comfort and blood flow." },
    ],
  },
  14: {
    week: 14,
    description: "The fetus continues growing in length and movement.",
    facts: [
      { title: "Handle Nasal Stuffiness", description: "Pregnancy hormones can cause nasal congestion." },
      { title: "Use Saline First", description: "Try saline spray or humidification before medication." },
      { title: "Follow Lab Schedule", description: "Complete recommended blood and urine tests on time." },
    ],
  },
  15: {
    week: 15,
    description: "Bones are developing and movement increases, though often not yet felt.",
    facts: [
      { title: "Support Bone Health", description: "Maintain calcium and vitamin D intake daily." },
      { title: "Ease Back Strain", description: "Light stretching can reduce early back discomfort." },
      { title: "Wear Supportive Footwear", description: "Supportive shoes help balance as posture shifts." },
    ],
  },
  16: {
    week: 16,
    description: "Some mothers begin to feel subtle fetal movement around this time.",
    facts: [
      { title: "Prepare Anatomy Scan", description: "Plan your mid-pregnancy scan and key questions." },
      { title: "Watch Iron Needs", description: "Iron demand rises, so review diet and supplements." },
      { title: "Report Dizziness", description: "Persistent dizziness or palpitations should be assessed." },
    ],
  },
  17: {
    week: 17,
    description: "Placental support remains strong while growth continues.",
    facts: [
      { title: "Expect Skin Changes", description: "Pigmentation changes can be normal in pregnancy." },
      { title: "Use Sun Protection", description: "Sunscreen helps prevent dark patches from worsening." },
      { title: "Train Core Gently", description: "Safe prenatal core work can reduce back strain later." },
    ],
  },
  18: {
    week: 18,
    description: "Hearing development progresses and movements feel clearer.",
    facts: [
      { title: "Attend Anatomy Scan", description: "This scan gives important structural health information." },
      { title: "Ask For Clarity", description: "Request explanations for any report terms you do not know." },
      { title: "Hydrate For Comfort", description: "Good hydration may reduce cramps and headaches." },
    ],
  },
  19: {
    week: 19,
    description: "Nervous system and sensory pathways continue maturing.",
    facts: [
      { title: "Recognize Ligament Pain", description: "Brief sharp side pain can occur with sudden movement." },
      { title: "Move Slowly", description: "Slow position changes often reduce pulling discomfort." },
      { title: "Check Persistent Pain", description: "Ongoing severe one-sided pain needs evaluation." },
    ],
  },
  20: {
    week: 20,
    description: "You are near the midpoint of pregnancy and growth remains steady.",
    facts: [
      { title: "Notice Movement Pattern", description: "Begin awareness of your baby movement rhythm." },
      { title: "Track Blood Pressure", description: "Consistent blood pressure monitoring is important." },
      { title: "Discuss Birth Preferences", description: "Start early conversations about birth setting and support." },
    ],
  },
  21: {
    week: 21,
    description: "Digestive symptoms and sleep changes may become more noticeable.",
    facts: [
      { title: "Reduce Heartburn", description: "Use smaller meals and remain upright after eating." },
      { title: "Avoid Late Flat Position", description: "Do not lie flat immediately after meals." },
      { title: "Seek Safe Relief", description: "Ask your provider for pregnancy-safe reflux treatment." },
    ],
  },
  22: {
    week: 22,
    description: "Fetal growth continues and movement may feel stronger.",
    facts: [
      { title: "Prevent Leg Cramps", description: "Stretch calves and stay hydrated daily." },
      { title: "Include Magnesium Foods", description: "Nuts, seeds, and greens may help muscle comfort." },
      { title: "Know Preeclampsia Signs", description: "Headache, vision changes, and swelling need urgent review." },
    ],
  },
  23: {
    week: 23,
    description: "Lung development advances but remains immature.",
    facts: [
      { title: "Prioritize Protein", description: "Protein supports maternal tissue and fetal growth." },
      { title: "Plan Birth Classes", description: "Start childbirth education before third-trimester fatigue." },
      { title: "Keep Vaccines Updated", description: "Follow pregnancy vaccine advice from your clinician." },
    ],
  },
  24: {
    week: 24,
    description: "Third trimester is approaching and monitoring becomes more important.",
    facts: [
      { title: "Complete Glucose Test", description: "Gestational diabetes screening is often due around now." },
      { title: "Follow Test Prep", description: "Correct fasting or timing improves result accuracy." },
      { title: "Treat Early If Needed", description: "Early glucose management improves mother and baby outcomes." },
    ],
  },
  25: {
    week: 25,
    description: "Abdominal growth and weight gain become more evident.",
    facts: [
      { title: "Support Your Back", description: "Maternity support belts can reduce lower back strain." },
      { title: "Use Safe Body Care", description: "Prenatal massage may help when done by trained therapists." },
      { title: "Report Preterm Signs", description: "Fluid leakage or regular cramps should be checked quickly." },
    ],
  },
  26: {
    week: 26,
    description: "Brain and lung development accelerates further.",
    facts: [
      { title: "Optimize Sleep Position", description: "Use pillows for side-sleep comfort and support." },
      { title: "Manage Stress", description: "Breathing exercises can lower stress and improve sleep." },
      { title: "Learn Preterm Warnings", description: "Ask your team about early labor warning symptoms." },
    ],
  },
  27: {
    week: 27,
    description: "This is the end of the second trimester for many pregnancies.",
    facts: [
      { title: "Observe Daily Movement", description: "Movement awareness should now feel more consistent." },
      { title: "Check Rh Status", description: "Discuss Rh immunoglobulin if you are Rh negative." },
      { title: "Continue Supplements", description: "Maintain iron and folate as advised." },
    ],
  },
  28: {
    week: 28,
    description: "Third trimester begins with faster fetal growth.",
    facts: [
      { title: "Start Kick Counting", description: "Begin formal kick counting if advised by your provider." },
      { title: "Take Tdap On Time", description: "Tdap is usually recommended in this trimester." },
      { title: "Plan Support Logistics", description: "Finalize leave, transport, and caregiving plans." },
    ],
  },
  29: {
    week: 29,
    description: "Movement grows stronger and may feel uncomfortable at times.",
    facts: [
      { title: "Know Braxton Hicks", description: "Practice contractions are common and usually irregular." },
      { title: "Watch Contraction Pattern", description: "Regular painful contractions need urgent assessment." },
      { title: "Prevent Dehydration", description: "Low fluid intake can trigger uterine irritability." },
    ],
  },
  30: {
    week: 30,
    description: "Your baby continues gaining weight and practicing breathing movements.",
    facts: [
      { title: "Manage Pelvic Pressure", description: "Pelvic heaviness increases as posture changes." },
      { title: "Try Prenatal Physio", description: "Guided exercises can improve comfort and function." },
      { title: "Keep Follow Ups", description: "Regular late-pregnancy monitoring is very important." },
    ],
  },
  31: {
    week: 31,
    description: "Sleep disruption and frequent urination often become stronger.",
    facts: [
      { title: "Use Planned Rest", description: "Short daytime rest can improve daily energy." },
      { title: "Adjust Evening Fluids", description: "Limit large fluid loads right before bedtime." },
      { title: "Support Mental Health", description: "Report persistent anxiety or low mood early." },
    ],
  },
  32: {
    week: 32,
    description: "Many babies begin moving toward a head-down position.",
    facts: [
      { title: "Pack Essentials", description: "Prepare your hospital bag and key documents." },
      { title: "Differentiate Labor Signs", description: "Learn false labor versus true labor patterns." },
      { title: "Monitor Swelling", description: "Sudden face or hand swelling needs review." },
    ],
  },
  33: {
    week: 33,
    description: "Lungs, brain, and immune system continue maturing.",
    facts: [
      { title: "Protect Recovery Time", description: "Prioritize sleep, nutrition, and reduced workload." },
      { title: "Finalize Emergency Plan", description: "Keep transport routes and contacts ready." },
      { title: "Plan Newborn Feeding", description: "Discuss breastfeeding or formula plans in advance." },
    ],
  },
  34: {
    week: 34,
    description: "Movements may feel more like rolls as space becomes tighter.",
    facts: [
      { title: "Track Reduced Movement", description: "Reduced fetal movement needs same-day evaluation." },
      { title: "Practice Breathing Skills", description: "Labor breathing practice improves confidence." },
      { title: "Review Pain Relief Options", description: "Discuss pain control methods before labor starts." },
    ],
  },
  35: {
    week: 35,
    description: "Final maturation and growth continue before term.",
    facts: [
      { title: "Plan GBS Test", description: "Group B strep testing is usually done now." },
      { title: "Maintain Nutrition", description: "Keep hydration and protein intake consistent." },
      { title: "Watch Labor Triggers", description: "Report fluid leak, bleeding, or regular contractions." },
    ],
  },
  36: {
    week: 36,
    description: "The baby may settle lower in the pelvis as birth approaches.",
    facts: [
      { title: "Expect Pressure Shift", description: "Breathing may ease while pelvic pressure increases." },
      { title: "Attend Weekly Visits", description: "Late prenatal checks are important and frequent." },
      { title: "Confirm Day Of Labor Plan", description: "Finalize transport and support details now." },
    ],
  },
  37: {
    week: 37,
    description: "This is early term, and labor can begin at any time.",
    facts: [
      { title: "Continue Kick Counts", description: "Daily movement checks remain essential." },
      { title: "Protect Energy", description: "Rest regularly to conserve strength for labor." },
      { title: "Call For Regular Contractions", description: "Seek advice when contractions become patterned and stronger." },
    ],
  },
  38: {
    week: 38,
    description: "Final maturation continues with ongoing fat gain.",
    facts: [
      { title: "Expect Subtle Changes", description: "Cervical changes may happen without clear symptoms." },
      { title: "Stay Lightly Active", description: "Gentle movement helps comfort and circulation." },
      { title: "Keep Essentials Ready", description: "Keep your phone charged and hospital items prepared." },
    ],
  },
  39: {
    week: 39,
    description: "Most pregnancies are full term now, and spontaneous labor is common.",
    facts: [
      { title: "Recognize Water Breaking", description: "Membrane rupture may be a gush or slow trickle." },
      { title: "Time Contractions", description: "Measure contractions from start to start." },
      { title: "Know Emergency Symptoms", description: "Get urgent care for heavy bleeding, chest pain, or reduced movement." },
    ],
  },
  40: {
    week: 40,
    description: "This is your estimated due week, and labor may start anytime.",
    facts: [
      { title: "Discuss Post Date Monitoring", description: "Follow your provider plan if labor has not started." },
      { title: "Review Induction Options", description: "Induction planning is common and can be safe." },
      { title: "Trust Your Instincts", description: "If something feels wrong, seek medical assessment promptly." },
    ],
  },
}

export function getWeeklyInsight(gestationalWeek: number): WeeklyInsight {
  const normalized = Number.isFinite(gestationalWeek) ? Math.floor(gestationalWeek) : 1
  const safeWeek = Math.min(40, Math.max(1, normalized))
  return WEEKLY_INSIGHTS[safeWeek]
}
