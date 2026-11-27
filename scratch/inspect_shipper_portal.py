with open('frontend/src/pages/ShipperPortalPage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'scan' in line.lower() or 'modal' in line.lower() or 'chụp' in line.lower() or 'returning' in line.lower() or 'returned' in line.lower():
        print(f"{i+1}: {line.strip()[:100]}")
