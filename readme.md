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
GDM Stage 2 ROC-AUC: 0.9981
<br>
Preterm Stage 2 ROC-AUC: 0.9911
<br>
preeclampsia stage2 ROC-AUC: 0.9749

