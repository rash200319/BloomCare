#!/usr/bin/env python3
with open('frontend/components/frontline-triage-dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Remove the standalone Create Appointment button
idx = content.find(
    '                          <Button \n                            onClick={() => {')
if idx != -1:
    button_start = idx
    close_tag = '</Button>'
    next_close = content.find(close_tag, button_start)
    if next_close != -1:
        section = content[button_start:next_close+len(close_tag)]
        if 'Create Appointment' in section:
            content = content[:button_start] + \
                content[next_close+len(close_tag):]

# Step 2: Update flex container
content = content.replace(
    'flex flex-col sm:flex-row gap-4', 'flex flex-row gap-4 w-full')

# Step 3: Add Create button before Print button
if '<Button onClick={handlePrintReferralCard}' in content:
    print_btn_idx = content.find('<Button onClick={handlePrintReferralCard}')
    if print_btn_idx != -1:
        create_btn = '''                          <Button 
                            onClick={() => {
                              if (!selectedPatient) {
                                setStatusMessage(getText("Select a patient first to create an appointment.", "නියමනය වෙන්කර ගැනීමට පළමුව රෝගියෙකු තෝරන්න.", "நியமனம் உருவாக్క முதலில் நோயாளியைத் தேர్ந்தெடுக్కவும్."))
                                return
                              }
                              setShowAppointmentBooking(true)
                            }}
                            className="flex-1 bg-bloom-gradient hover:opacity-90 text-white font-black h-16 rounded-2xl shadow-xl shadow-primary/30 text-xs uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] border-0"
                          >
                            <Plus className="w-5 h-5 mr-3" />
                            {getText("Create Appointment", "පත්‍ර ගිණුම සාදන්න", "சந്திப్పு உருవाक్కुঙ్ങ्ल")}
                          </Button>
```
        content = content[:print_btn_idx] + create_btn + content[print_btn_idx:]

with open('frontend/components/frontline-triage-dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Button layout updated - both buttons now side by side with equal width')
