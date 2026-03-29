# current code process 
---


1. preeclampsia model is broken in to two stages and stage 1 is now scanning for all main 3 illnesses as a primary screener.
<br>
2. preeclampsia stage 2 is working as a secondary screener.
<br>
3. gdm model is stage 2 and it has a mini AI model to generate BMI values since the main csv is missing those(have to check if its good to add this). currently OGTT is missing too. (have to check if there exists any other columns that are important other than we are using currently)
<br>
4. preematureb.py is stage 2 and its using phycological + medical + lifestyle columns .since it has many columns that can be used for pirmary screening have to check that too.
<br> 
5. MSF_Dataset_Complete_450.csv has some cleaning to do.
<br>

# current roc-auc 
---
GDM Stage 2 ROC-AUC: 0.9983
<br>
Preterm Stage 2 ROC-AUC: 0.9911
<br>
preeclampsia stage2 ROC-AUC: 0.9749

# Dataset Column Meanings
---

## Categorical/Ordinal Columns (Integer Values)

| Column | Value Interpretation |
|--------|----------------------|
| **Age_Father** | Integer age (0-60 years) |
| **Yrs_Of_Marriage** | Integer years married (0-30 years) |
| **Sibling** | Count of siblings (0-3+) |
| **Education** | 0=Uneducated, 1=Primary, 2=Secondary, 3=Higher Secondary, 4=Undergrad, 5=Postgrad, 6=Doctorate |
| **Exercise** | 1=Never, 2=Rarely, 3=Sometimes, 4=Often, 5=Always |
| **Laptop** | 1=Never, 2=Rarely, 3=Sometimes, 4=Often, 5=Always |
| **Outside Food** | 1=Never, 2=Rarely, 3=Sometimes, 4=Often, 5=Always |
| **Tea/Coffee** | 1=Never, 2=Rarely, 3=Sometimes, 4=Often |
| **Cigratte** | 1=No, 2=Yes (or frequency: 1=Never, 2=Occasional) |
| **Alcohol** | 1=No, 2=Yes (or frequency: 1=Never, 2=Occasional) |
| **Work_Hours** | 1=Part-time, 2=6-8hrs, 3=8-10hrs, 4=10+ hrs, 5=Very High |
| **Stress** | 1=Low, 2=Moderate, 3=High |
| **Happy** | 1=Very Unhappy, 2=Unhappy, 3=Neutral, 4=Happy, 5=Very Happy |
| **Contraceptive_Time** | 0=Not using, 1=<1yr, 2=1-2yrs, 3=2-5yrs, 4=5-10yrs, 5=10+ yrs |
| **Intercourse** | 1=Never, 2=Rarely, 3=Sometimes, 4=Often, 5=Always |
| **Depressed** | 1=Never, 2=Rarely, 3=Sometimes, 4=Often, 5=Always |
| **Time_Taken_To_Concieve** | 1=<1month, 2=1-3months, 3=3-6months, 4=6-12months, 5=12+ months |
| **Family_Income** | 1=Low, 2=Lower-Middle, 3=Middle, 4=Upper-Middle, 5=High, 6=Very High |
| **Fertility_Treatment** | 0=None, 1=Yes (receiving treatment) |
| **NOISE/AIR pollution** | 1=Very Low, 2=Low, 3=Moderate, 4=High, 5=Very High |
| **Health_Concious** | 1=Not at all, 2=Slightly, 3=Moderately, 4=Very |
| **Daily_Diet** | 1=Poor, 2=Fair, 3=Good, 4=Very Good, 5=Excellent |
| **Menstrual_Cycle** | 1=Very Irregular, 2=Irregular, 3=Regular, 4=Very Regular, 5=Perfect |
| **Sleep_Pattern** | 1=Very Poor, 2=Poor, 3=Fair, 4=Good, 5=Excellent |
| **Sunlight** | 1=No exposure, 2=Minimal, 3=Moderate, 4=Good, 5=Excellent |
| **Travel_Time** | 1=<15min, 2=15-30min, 3=30-60min, 4=1-2hrs, 5=2+ hrs |
| **Travel_Mode** | 1=Walk, 2=Bicycle, 3=Public Transport, 4=Car, 5=Mixed modes |
| **Works_As** | 1=Housewife, 2=Student, 3=Office, 4=Labor, 5=Other |
| **Contraceptive_Type** | 0=None, 1=Pill, 2=IUD, 3=Condom, 4=Natural, 5=Sterilization, 6=Other |

## Binary Columns (0 or 1)

| Column | Meaning |
|--------|---------|
| **Previous_Complications** | 0=No, 1=Yes |
| **Preexisting_Diabetes** | 0=No, 1=Yes |
| **Gestational_Diabetes** | 0=No, 1=Yes |
| **Mental_Health** | 0=No issue, 1=Has issue |
| **PCOS** | 0=No, 1=Yes |

## Continuous Columns (Float Values)

| Column | Description |
|--------|-------------|
| **Age** | Mother's age in years |
| **Systolic BP** | Systolic blood pressure (mmHg) |
| **Diastolic** | Diastolic blood pressure (mmHg) |
| **BS** | Blood sugar level |
| **Body Temp** | Body temperature in °F |
| **BMI** | Body Mass Index |
| **Heart Rate** | Beats per minute |
| **weight_before_preg** | Weight before pregnancy (kg) |
| **Height(cm)** | Height in centimeters |
| **Hemoglobin** | Hemoglobin level (g/dL) |

**Note:** These column value interpretations are inferred from data patterns and standard healthcare survey conventions. Verify against your original data dictionary for exact mappings.

