with open('backend/src/main/java/vn/rikkei/post/controller/ShipperController.java', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'scan-return' in line or 'scan-delivery' in line or 'complete-delivery' in line:
        for j in range(max(0, i-2), min(len(lines), i+15)):
            print(f"{j+1}: {lines[j].strip()}")
        print("-" * 50)
