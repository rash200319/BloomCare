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

# MSF Dataset Overview (Mother's Significant Feature)
---

**Summary**
The Mother's Significant Feature (MSF) dataset is described as having 450 records and 130 features. Each mother has three survey forms:
1. `1_Form_Genral_info.pdf`
2. `2_Form_Mother_Features.pdf`
3. `3_Form_Pregnancy_Outcome.pdf`

**Excel Sheets (6 total)**
1. `MSF_Dataset_Complete.xlsx` (all 130 attributes; noted as 1000 records)
2. `MSF_Physical&health_Fetaures.xlsx` (physical and health attributes)
3. `MSF_Mother_lifestyle.xlsx` (lifestyle attributes)
4. `MSF_Mother_Social.xlsx` (social status attributes)
5. `MSF_Mother_stress.xlsx` (stress level attributes)
6. `MSF_HealthOutcome.xlsx` (pregnancy and baby health outcomes)

**Key Notes**
- Primary key: `Mother_UID` (unique per woman).
- Records with the same `Mother_UID` across sheets belong to the same woman.
- In MSF data, `1` denotes "yes/true" and `0` denotes "no/false".

**Attributes With Missing Values**
1. Mother's weight before delivery
2. Miscarriage history
3. Cravings
4. Family support
5. Women supporting family
6. Hobbies

## MSF_Physical&health_Fetaures.xlsx Features
1. Age of Mother
2. Mother's weight before pregnancy
3. Mother's weight before delivery
4. Height
5. BMI
6. Haemoglobin
7. PCOS (Polycystic ovary syndrome)
8. Age of Father
9. Infertility treatment
10. Miscarriage history
11. Menstrual cycle (before marriage)
12. Menstrual cycle (after marriage)
13. Time taken to conceive
14. Thyroid
15. Hypertension
16. Gestational diabetes
17. Gastric issue
18. Cold/viral infection
19. Low amniotic fluid
20. High amniotic fluid
21. No health complication during pregnancy
22. IVF
23. Birth parity

## MSF_Mother_Social.xlsx Features
1. Years of marriage
2. Does newborn have siblings
3. Number of newborn's siblings
4. Mother education status
5. Family income
6. Hobbies (visiting places)
7. Hobbies (artistic things: dance/singing/painting etc.)
8. Hobbies (shopping)
9. Hobbies (cooking/household work)
10. Hobbies (spending time with people)
11. Hobbies (eating / foodie)
12. Hobbies (sitting alone in peace)
13. Working till which month of pregnancy (during pregnancy)
14. Family support by (in-laws)
15. Family support by (parents)
16. Family support by (husband)
17. You supporting the family (in-laws)
18. You supporting the family (parents)
19. You supporting the family (other family members)

## MSF_Mother_stress.xlsx Features
1. Travel time (during teenage)
2. Travel time (after marriage)
3. Travel time (during pregnancy)
4. Hours at work (after marriage)
5. Hours at work (during pregnancy)
6. Stress level at work/home (after marriage)
7. Stress level at work/home (during pregnancy)
8. Happy about arrival of baby
9. Depression/loneliness (before pregnancy)
10. Depression/loneliness (during pregnancy)

## MSF_Mother_lifestyle.xlsx Features
1. Exercise (during teenage)
2. Exercise (after marriage)
3. Exercise (during pregnancy)
4. Use of laptop/mobile (during teenage)
5. Use of laptop/mobile (after marriage)
6. Use of laptop/mobile (during pregnancy)
7. Outside food habits (during teenage)
8. Outside food habits (after marriage)
9. Outside food habits (during pregnancy)
10. Tea/coffee/caffeine (during teenage)
11. Tea/coffee/caffeine (after marriage)
12. Tea/coffee/caffeine (during pregnancy)
13. Smoking (during teenage)
14. Smoking (after marriage)
15. Smoking (during pregnancy)
16. Alcohol (during teenage)
17. Alcohol (after marriage)
18. Alcohol (during pregnancy)
19. Noise/air pollution (during teenage)
20. Noise/air pollution (after marriage)
21. Noise/air pollution (during pregnancy)
22. Health conscious (during teenage)
23. Health conscious (after marriage)
24. Health conscious (during pregnancy)
25. Diet: grains/vegetables/pulses/rice/salad (during teenage)
26. Diet: more pulses and rice (during teenage)
27. Diet: more dairy products (during teenage)
28. Diet: mostly snacks/high carbohydrate (during teenage)
29. Diet: non-vegetarian food (during teenage)
30. Diet: fruits and salads (during teenage)
31. Diet: grains/vegetables/pulses/rice/salad (after marriage)
32. Diet: more pulses and rice (after marriage)
33. Diet: more dairy products (after marriage)
34. Diet: mostly snacks/high carbohydrate (after marriage)
35. Diet: non-vegetarian food (after marriage)
36. Diet: fruits and salads (after marriage)
37. Diet: grains/vegetables/pulses/rice/salad (during pregnancy)
38. Diet: more pulses and rice (during pregnancy)
39. Diet: more dairy products (during pregnancy)
40. Diet: mostly snacks/high carbohydrate (during pregnancy)
41. Diet: non-vegetarian food (during pregnancy)
42. Diet: fruits and salads (during pregnancy)
43. Sleep pattern (during teenage) (get up early)
44. Sleep pattern (during teenage) (night person)
45. Sleep pattern (during teenage) (sleep more than 8 hours)
46. Sleep pattern (during teenage) (sleep less than 7 hours)
47. Sleep pattern (after marriage) (get up early)
48. Sleep pattern (after marriage) (night person)
49. Sleep pattern (after marriage) (sleep more than 8 hours)
50. Sleep pattern (after marriage) (sleep less than 7 hours)
51. Sleep pattern (during pregnancy) (get up early)
52. Sleep pattern (during pregnancy) (night person)
53. Sleep pattern (during pregnancy) (sleep more than 8 hours)
54. Sleep pattern (during pregnancy) (sleep less than 7 hours)
55. Exposure to morning sunlight (during teenage)
56. Exposure to morning sunlight (after marriage)
57. Exposure to morning sunlight (during pregnancy)
58. Travel time (during teenage)
59. Travel time (after marriage)
60. Travel time (during pregnancy)
61. Mode of commutation (during teenage)
62. Mode of commutation (after marriage)
63. Mode of commutation (during pregnancy)
64. Works as (after marriage)
65. Works as (during pregnancy)
66. Use of contraceptive (how long)
67. Type of contraceptive used (before pregnancy)
68. Intercourse frequency
69. Craving
70. Carving
71. Craving

## MSF_HealthOutcome.xlsx Features
1. Preterm birth
2. Full term birth
3. Weight of baby/babies
4. Number of days in hospital just after childbirth
5. NICU stay requirement
6. Jaundice detected in baby after birth
7. C-section delivery
8. Vaginal delivery
9. Hours in labour before childbirth
10. Need to induce artificial pain for labour

**Purpose**
This dataset is designed so researchers can experiment with different combinations of features to analyze women's and children's health.

**Cited Papers**
1. Deshpande H., Ragha L., "A Hybrid Random Forest based Feature selection model using Mutual Information and F-score for Preterm birth classification.", International Journal of Medical Engineering and Informatics (in press).
2. Deshpande H., Ragha L., "Random forest based Fuzzy Feature weighing model for Imbalance class distribution towards Preterm-birth classification", SSRN-Elsevier's Online Digital Publication under ICAST-2021 Conference Proceedings (in press).

**Data Consistency Check**
The description mentions 450 records, but `MSF_Dataset_Complete.xlsx` is noted as 1000 records. Please confirm which count is correct.

