import pandas as pd

# Read the CSV
df = pd.read_csv('Data/MSF_Dataset_Complete_450.csv')

# Expected features from README organized by category
expected_features = {
    "Physical & Health (23)": [
        "Age of Mother",
        "Mother's Weight before pregnancy",
        "Mother's Weight before Delivery",
        "Height",
        "BMI",
        "Haemoglobin",
        "PCOS",
        "Age of Father",
        "Infertility Treatment",
        "Miscarriage History",
        "Menstrual Cycle (Before Marriage)",
        "Menstrual Cycle (After Marriage)",
        "Time taken to conceive",
        "Thyroid",
        "Hypertension",
        "Gestational Diabetes",
        "Gastric Issue",
        "Cold/viral Infection",
        "Low amniotic fluid",
        "High Amniotic Fluid",
        "No Health complication during pregnancy",
        "IVF",
        "Birth Parity"
    ],
    "Mother Social (19)": [
        "Years of marriage",
        "Does new born have siblings",
        "Number of new born's siblings",
        "Mother Education Status",
        "Family income",
        "Hobbies (Visiting places)",
        "Hobbies (Artistic things)",
        "Hobbies (Shopping)",
        "Hobbies (Cooking/household work)",
        "Hobbies (Spending time with people)",
        "Hobbies (Eating / Foodie)",
        "Hobbies (Sitting alone in peace)",
        "Working till which month of pregnancy",
        "Family support by (in-laws)",
        "Family support by (parents)",
        "Family support by (husband)",
        "You supporting the family (in-laws)",
        "You supporting the family (parents)",
        "You supporting the family (other family members)"
    ],
    "Mother Stress (10)": [
        "Travel time (During teenage)",
        "Travel time (After marriage)",
        "Travel time (During pregnancy)",
        "Hours at work (After marriage)",
        "Hours at work (During pregnancy)",
        "Stress Level at work/home (After marriage)",
        "Stress Level at work/home (During pregnancy)",
        "Happy about arrival of baby",
        "Depression/loneliness (Before pregnancy)",
        "Depression/loneliness (During pregnancy)"
    ],
    "Health Outcome (10)": [
        "Pre term birth",
        "Full term birth",
        "Weight of baby/babies",
        "Number of days in hospital just after childbirth",
        "NICU stay requirement",
        "Jaundice detected in baby after birth",
        "C-section delivery",
        "Vaginal Delivery",
        "Hours in labour before childbirth",
        "Need to induce artificial pain for labour"
    ]
}

existing_cols = set(df.columns)
unnamed_cols = [col for col in df.columns if 'Unnamed' in col]

print("=" * 90)
print("ISSUES FOUND IN MSF_Dataset_Complete_450.csv")
print("=" * 90)

print(f"\n1. UNNAMED COLUMNS ({len(unnamed_cols)} columns need proper naming):")
print("-" * 90)
for col in unnamed_cols:
    print(f"   {col}")

print(f"\n2. COLUMN NAMING ERRORS:")
print("-" * 90)
naming_issues = [
    ("Hemoglobin", "Haemoglobin (UK spelling)"),
    ("Cigratte", "Smoking (misspelled)"),
    ("Miscarrage History", "Miscarriage History (misspelled)"),
    ("Health Concious", "Health Conscious (misspelled)"),
    ("NOISE/AIR pollution", "Noise/Air pollution (case/format)"),
]

for wrong, correct in naming_issues:
    if wrong in existing_cols:
        print(f"   ✗ '{wrong}' → '{correct}'")

print(f"\n3. MISSING DOCUMENTED FEATURES:")
print("-" * 90)
all_expected = []
for category, features in expected_features.items():
    all_expected.extend(features)

missing_count = 0
for feat in all_expected:
    if feat not in existing_cols:
        print(f"   - {feat}")
        missing_count += 1

print(f"\n   Total missing: {missing_count} features")

print(f"\n4. INVALID COLUMN NAMES AT END:")
print("-" * 90)
bad_cols = [col for col in df.columns if isinstance(col, int) or (isinstance(col, str) and col.isdigit())]
for col in bad_cols:
    print(f"   ✗ Column '{col}' - not a valid feature name")

print(f"\n5. SUMMARY:")
print("-" * 90)
print(f"   Total columns in CSV: {len(df.columns)}")
print(f"   Properly named columns: {len(existing_cols) - len(unnamed_cols) - len(bad_cols)}")
print(f"   Unnamed columns: {len(unnamed_cols)}")
print(f"   Invalid numeric columns: {len(bad_cols)}")
print(f"   Total rows: {len(df)} (expected: 450)")
print(f"   Expected feature columns: ~130")
print(f"   Actual useful columns: {len(existing_cols) - len(unnamed_cols) - len(bad_cols) - 1}")

print(f"\n6. FIRST ROW PREVIEW:")
print("-" * 90)
print(df.head(1).to_string())
